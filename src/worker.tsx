import { Hono } from "hono";
import { requestId } from "hono/request-id";

import { importPublicSheet } from "./importer";
import { securityHeaders } from "./middleware/security";
import { isValidSheetId, sanitizeSheet } from "./sheet";
import { HomePage, NotFoundPage, PrivacyPage } from "./ui/pages";

export type Bindings = {
  ASSETS: Fetcher;
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();
const sessionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const editTokenPattern = /^[a-zA-Z0-9_-]{43}$/;
const eventNames = new Set([
  "visited",
  "returned",
  "editor_started",
  "sheet_imported",
  "sheet_saved",
  "share_copied",
  "commands_copied",
  "ccfolia_copied",
  "json_exported",
  "sheet_deleted",
]);
const daySeconds = 86_400;
const maximumJsonBytes = 64_000;

app.use("*", requestId());
app.use("*", securityHeaders);

const nowSeconds = () => Math.floor(Date.now() / 1000);

const normalize = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maximum) : "";

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const randomToken = (byteCount: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
};

const isSameOriginMutation = (request: Request) => {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite) return fetchSite === "same-origin";
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
};

const parseJson = async (request: Request) => {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new Error("unsupported_media_type");
  }
  if (Number(request.headers.get("content-length") ?? 0) > maximumJsonBytes) {
    throw new Error("payload_too_large");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maximumJsonBytes) {
    throw new Error("payload_too_large");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid_json");
  }
};

const recordEvent = async (db: D1Database, sessionId: string, name: string, sheetId: string) => {
  const sessionHash = await sha256(sessionId);
  const timestamp = nowSeconds();
  const daily = await db
    .prepare(
      "SELECT COUNT(*) AS count FROM product_events WHERE session_hash = ? AND created_at >= ?",
    )
    .bind(sessionHash, timestamp - daySeconds)
    .first<{ count: number }>();
  if ((daily?.count ?? 0) >= 200) return false;

  await db
    .prepare(
      `INSERT INTO product_events
       (session_hash, name, sheet_id, is_automated, occurred_on, created_at)
       VALUES (?, ?, ?, 0, ?, ?)`,
    )
    .bind(sessionHash, name, sheetId || null, new Date().toISOString().slice(0, 10), timestamp)
    .run();
  return true;
};

app.get("/", (c) => c.html(<HomePage />));
app.get("/privacy", (c) => c.html(<PrivacyPage />));
app.get("/s/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidSheetId(id)) return c.html(<NotFoundPage />, 404);
  const exists = await c.env.DB.prepare("SELECT 1 AS found FROM sheets WHERE id = ?")
    .bind(id)
    .first<{ found: number }>();
  if (!exists) return c.html(<NotFoundPage />, 404);
  c.header("Cache-Control", "private, no-store");
  c.header("X-Robots-Tag", "noindex, nofollow, noarchive");
  return c.html(<HomePage sheetId={id} />);
});

app.get("/api/sheets/:id", async (c) => {
  const id = c.req.param("id");
  if (!isValidSheetId(id)) return c.json({ error: "not_found" }, 404);
  const row = await c.env.DB.prepare("SELECT data, updated_at FROM sheets WHERE id = ?")
    .bind(id)
    .first<{ data: string; updated_at: number }>();
  if (!row) return c.json({ error: "not_found" }, 404);
  c.header("Cache-Control", "private, no-store");
  return c.json({ data: JSON.parse(row.data) as unknown, id, updatedAt: row.updated_at });
});

app.post("/api/sheets", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  let input: unknown;
  try {
    input = await parseJson(c.req.raw);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return c.json({ error: code }, code === "payload_too_large" ? 413 : 400);
  }
  const body =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const data = sanitizeSheet(body.data);
  const id = randomToken(9);
  const editToken = randomToken(32);
  const timestamp = nowSeconds();
  await c.env.DB.prepare(
    "INSERT INTO sheets (id, edit_token_hash, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, await sha256(editToken), JSON.stringify(data), timestamp, timestamp)
    .run();
  return c.json(
    {
      editToken,
      id,
      url: `${new URL(c.req.url).origin}/s/${id}`,
      updatedAt: timestamp,
    },
    201,
  );
});

app.put("/api/sheets/:id", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  const id = c.req.param("id");
  const editToken = normalize(c.req.header("x-edit-token"), 64);
  if (!isValidSheetId(id) || !editTokenPattern.test(editToken)) {
    return c.json({ error: "not_found" }, 404);
  }
  let input: unknown;
  try {
    input = await parseJson(c.req.raw);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return c.json({ error: code }, code === "payload_too_large" ? 413 : 400);
  }
  const body =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const timestamp = nowSeconds();
  const result = await c.env.DB.prepare(
    "UPDATE sheets SET data = ?, updated_at = ? WHERE id = ? AND edit_token_hash = ?",
  )
    .bind(JSON.stringify(sanitizeSheet(body.data)), timestamp, id, await sha256(editToken))
    .run();
  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "edit_key_invalid" }, 403);
  return c.json({ id, updatedAt: timestamp, url: `${new URL(c.req.url).origin}/s/${id}` });
});

app.delete("/api/sheets/:id", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  const id = c.req.param("id");
  const editToken = normalize(c.req.header("x-edit-token"), 64);
  if (!isValidSheetId(id) || !editTokenPattern.test(editToken)) {
    return c.json({ error: "not_found" }, 404);
  }
  const result = await c.env.DB.prepare("DELETE FROM sheets WHERE id = ? AND edit_token_hash = ?")
    .bind(id, await sha256(editToken))
    .run();
  if ((result.meta.changes ?? 0) === 0) return c.json({ error: "edit_key_invalid" }, 403);
  return c.body(null, 204);
});

app.post("/api/import", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  let input: unknown;
  try {
    input = await parseJson(c.req.raw);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return c.json({ error: code }, code === "payload_too_large" ? 413 : 400);
  }
  const body =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const url = normalize(body.url, 240);
  try {
    const data = await importPublicSheet(url);
    return c.json({ data });
  } catch (error) {
    const code = error instanceof Error ? error.message : "import_failed";
    const status =
      code === "invalid_source_url" ? 400 : code === "unsupported_source_sheet" ? 422 : 502;
    return c.json({ error: code }, status);
  }
});

app.post("/api/events", async (c) => {
  if (!isSameOriginMutation(c.req.raw)) return c.json({ error: "forbidden" }, 403);
  let input: unknown;
  try {
    input = await parseJson(c.req.raw);
  } catch (error) {
    const code = error instanceof Error ? error.message : "invalid_request";
    return c.json({ error: code }, code === "payload_too_large" ? 413 : 400);
  }
  const body =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  if (body.automated === true) return c.body(null, 204);
  const sessionId = normalize(body.sessionId, 36);
  const name = normalize(body.name, 40);
  const sheetId = normalize(body.sheetId, 12);
  if (
    !sessionIdPattern.test(sessionId) ||
    !eventNames.has(name) ||
    (sheetId && !isValidSheetId(sheetId))
  ) {
    return c.json({ error: "invalid_event" }, 400);
  }
  const accepted = await recordEvent(c.env.DB, sessionId, name, sheetId);
  return accepted ? c.body(null, 204) : c.json({ error: "rate_limited" }, 429);
});

app.get("/healthz", (c) =>
  c.json({
    healthy: true,
    importSource: "charasheet.vampire-blood.net",
    service: "takufuda",
    time: new Date().toISOString(),
  }),
);

app.notFound((c) =>
  c.req.path.startsWith("/api/")
    ? c.json({ error: "not_found", requestId: c.get("requestId") }, 404)
    : c.html(<NotFoundPage />, 404),
);

app.onError((error, c) => {
  console.error(
    JSON.stringify({
      event: "request_failed",
      message: error.message,
      requestId: c.get("requestId"),
    }),
  );
  return c.json({ error: "internal_error", requestId: c.get("requestId") }, 500);
});

const scheduled: ExportedHandlerScheduledHandler<Bindings> = async (_controller, env) => {
  await env.DB.prepare("DELETE FROM product_events WHERE created_at < ?")
    .bind(nowSeconds() - 35 * daySeconds)
    .run();
};

export { app };
export default { fetch: app.fetch, scheduled };

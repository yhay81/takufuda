import { afterEach, describe, expect, it, vi } from "vitest";

import { app, type Bindings } from "../src/worker";

const sameOrigin = { "content-type": "application/json", "sec-fetch-site": "same-origin" };
const sessionId = "7c0dbe70-8c47-4fc0-aa62-52427133c612";
const sheetId = "AbCdEfGhIjKl";

type Call = {
  arguments: unknown[];
  sql: string;
};

const makeBindings = ({
  eventCount = 0,
  existingData = "",
  changes = 1,
}: {
  changes?: number;
  eventCount?: number;
  existingData?: string;
} = {}) => {
  const calls: Call[] = [];
  const prepare = vi.fn((sql: string) => {
    const call: Call = { arguments: [], sql };
    calls.push(call);
    const statement = {
      bind: vi.fn((...arguments_: unknown[]) => {
        call.arguments = arguments_;
        return statement;
      }),
      first: vi.fn(async () => {
        if (sql.includes("COUNT(*)")) return { count: eventCount };
        if (sql.includes("SELECT 1 AS found")) return existingData ? { found: 1 } : null;
        if (sql.includes("SELECT data")) {
          return existingData ? { data: existingData, updated_at: 1_785_000_000 } : null;
        }
        return null;
      }),
      run: vi.fn(async () => ({ meta: { changes }, success: true })),
    };
    return statement;
  });
  return {
    bindings: {
      ASSETS: { fetch: () => Promise.resolve(new Response("not used")) },
      DB: { prepare },
    } as unknown as Bindings,
    calls,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("卓札 worker", () => {
  it("renders the visual workspace with modest typography and no internal experiment copy", async () => {
    const response = await app.request("/", undefined, makeBindings().bindings);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
    expect(html).toContain('class="workspace-shell"');
    expect(html).toContain('data-radar="true"');
    expect(html).toContain("キャラクター保管所の公開URL");
    expect(html).toContain("ココフォリア用の駒をコピー");
    expect(html).not.toContain('class="hero"');
    expect(html).not.toContain("Success signal");
    expect(html).not.toContain("実験");
  });

  it("creates a sanitized sheet and stores only a hash of the edit token", async () => {
    const { bindings, calls } = makeBindings();
    const response = await app.request(
      "/api/sheets",
      {
        body: JSON.stringify({
          data: {
            name: "  探索者  ",
            color: "invalid",
            notes: "公開メモ",
            stats: { str: 13, con: -5 },
            skills: [
              { name: "目星", value: 80 },
              { name: "目星", value: 90 },
            ],
            unexpected: "secret",
          },
        }),
        headers: sameOrigin,
        method: "POST",
      },
      bindings,
    );
    const payload = await response.json<{ editToken: string; id: string }>();
    expect(response.status).toBe(201);
    expect(payload.id).toMatch(/^[a-zA-Z0-9_-]{12}$/);
    expect(payload.editToken).toMatch(/^[a-zA-Z0-9_-]{43}$/);
    const insert = calls.find((call) => call.sql.includes("INSERT INTO sheets"));
    expect(insert?.arguments[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.arguments).not.toContain(payload.editToken);
    const stored = JSON.parse(String(insert?.arguments[2])) as Record<string, unknown>;
    expect(stored).not.toHaveProperty("unexpected");
    expect(stored).toEqual(
      expect.objectContaining({
        color: "amber",
        name: "探索者",
        skills: [{ name: "目星", value: 80 }],
      }),
    );
  });

  it("serves existing shared sheets as noindex and never renders missing ids", async () => {
    const data = JSON.stringify({ name: "共有探索者" });
    const page = await app.request(
      `/s/${sheetId}`,
      undefined,
      makeBindings({ existingData: data }).bindings,
    );
    expect(page.status).toBe(200);
    expect(page.headers.get("x-robots-tag")).toContain("noindex");
    expect(await page.text()).toContain(`data-sheet-id="${sheetId}"`);

    const missing = await app.request(`/s/${sheetId}`, undefined, makeBindings().bindings);
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain("札が見つかりません");
  });

  it("requires the edit key for update and delete", async () => {
    const token = "a".repeat(43);
    const denied = await app.request(
      `/api/sheets/${sheetId}`,
      {
        body: JSON.stringify({ data: { name: "更新" } }),
        headers: { ...sameOrigin, "x-edit-token": token },
        method: "PUT",
      },
      makeBindings({ changes: 0 }).bindings,
    );
    expect(denied.status).toBe(403);

    const deleted = await app.request(
      `/api/sheets/${sheetId}`,
      {
        headers: { "sec-fetch-site": "same-origin", "x-edit-token": token },
        method: "DELETE",
      },
      makeBindings().bindings,
    );
    expect(deleted.status).toBe(204);
  });

  it("imports through the allowlisted public JSON endpoint", async () => {
    const sourceFetch = vi.fn(async () =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            game: "coc",
            pc_name: "移した探索者",
            NP1: "12",
            NP2: "11",
            NP3: "10",
            NP4: "9",
            NP5: "8",
            NP6: "13",
            NP7: "14",
            NP8: "15",
          }),
        ),
      ),
    );
    vi.stubGlobal("fetch", sourceFetch);
    const response = await app.request(
      "/api/import",
      {
        body: JSON.stringify({ url: "https://charasheet.vampire-blood.net/4330377" }),
        headers: sameOrigin,
        method: "POST",
      },
      makeBindings().bindings,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({ data: expect.objectContaining({ name: "移した探索者" }) }),
    );
    expect(sourceFetch).toHaveBeenCalledWith(
      "https://charasheet.vampire-blood.net/4330377.js",
      expect.anything(),
    );
  });

  it("drops automated QA events and hashes real anonymous sessions", async () => {
    const automated = makeBindings();
    const qa = await app.request(
      "/api/events",
      {
        body: JSON.stringify({ automated: true, name: "visited", sessionId }),
        headers: sameOrigin,
        method: "POST",
      },
      automated.bindings,
    );
    expect(qa.status).toBe(204);
    expect(automated.calls.some((call) => call.sql.includes("INSERT INTO product_events"))).toBe(
      false,
    );

    const real = makeBindings();
    const response = await app.request(
      "/api/events",
      {
        body: JSON.stringify({ name: "ccfolia_copied", sessionId, sheetId }),
        headers: sameOrigin,
        method: "POST",
      },
      real.bindings,
    );
    expect(response.status).toBe(204);
    const insert = real.calls.find((call) => call.sql.includes("INSERT INTO product_events"));
    expect(insert?.arguments[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(insert?.arguments).not.toContain(sessionId);
    expect(insert?.arguments).toContain("ccfolia_copied");
  });

  it("documents local-only notes, cookies, retention, deletion, and independence", async () => {
    const response = await app.request("/privacy", undefined, makeBindings().bindings);
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain("localStorage");
    expect(html).toContain("端末だけのメモはサーバーへ送りません");
    expect(html).toContain("Cookie、広告、外部解析SDKは使いません");
    expect(html).toContain("35日以内");
    expect(html).toContain("公式・認定・提携サービスではありません");
  });
});

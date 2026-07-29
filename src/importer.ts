import { sanitizeSheet, type SheetData, type Skill, type StatKey } from "./sheet";

const sourceHost = "charasheet.vampire-blood.net";
const sourceIdPattern = /^(?:\d{1,12}|m[a-f0-9]{32})$/i;
const derivedNames = new Set([
  "SANチェック",
  "アイデア",
  "幸運",
  "知識",
  "STR",
  "CON",
  "POW",
  "DEX",
  "APP",
  "SIZ",
  "INT",
  "EDU",
]);

const sourceText = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maximum) : "";

const sourceNumber = (value: unknown, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : fallback;
};

const values = (value: unknown) =>
  Array.isArray(value)
    ? value.map(String)
    : typeof value === "string"
      ? value.split("|").map((item) => item.trim())
      : [];

export const parseSourceId = (input: string) => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== sourceHost) return null;
  const match = url.pathname.match(/^\/([a-zA-Z0-9]{1,64})(?:\.(?:html|js))?\/?$/);
  const id = match?.[1] ?? "";
  return sourceIdPattern.test(id) ? id : null;
};

const parseSkills = (memo: string) => {
  const skills: Skill[] = [];
  const seen = new Set<string>();
  const pattern = /(?:CCB|1D100)\s*<=\s*(\d{1,3})\s*[【[]([^】\]\r\n]{1,48})[】\]]/giu;
  for (const match of memo.matchAll(pattern)) {
    const name = sourceText(match[2], 48);
    if (!name || derivedNames.has(name.toUpperCase()) || seen.has(name)) continue;
    seen.add(name);
    skills.push({ name, value: sourceNumber(match[1]) });
    if (skills.length === 80) break;
  }
  return skills;
};

const parseInventory = (payload: Record<string, unknown>) => {
  const names = values(payload.item_name);
  const counts = values(payload.item_num);
  return names
    .map((name, index) => {
      if (!name) return "";
      const count = sourceText(counts[index], 12);
      return count && count !== "1" ? `${name} ×${count}` : name;
    })
    .filter(Boolean)
    .join("\n");
};

export const transformSourcePayload = (input: unknown, sourceUrl: string): SheetData | null => {
  if (typeof input !== "object" || input === null) return null;
  const payload = input as Record<string, unknown>;
  if (payload.game !== "coc") return null;

  const statMap: Record<StatKey, string> = {
    str: "NP1",
    con: "NP2",
    pow: "NP3",
    dex: "NP4",
    app: "NP5",
    siz: "NP6",
    int: "NP7",
    edu: "NP8",
  };
  const stats = Object.fromEntries(
    Object.entries(statMap).map(([key, source]) => [key, sourceNumber(payload[source], 10)]),
  ) as SheetData["stats"];
  const hp = sourceNumber(payload.NP9, Math.ceil((stats.con + stats.siz) / 2));
  const mp = sourceNumber(payload.NP10, stats.pow);
  const san = sourceNumber(payload.SAN_Left ?? payload.NP11, stats.pow * 5);
  const memo = sourceText(payload.pc_making_memo, 24_000);
  const notes = [
    sourceText(payload.pc_profile, 12_000),
    sourceText(payload.pc_memo, 12_000),
    sourceText(payload.personal_memo, 12_000),
  ]
    .filter(Boolean)
    .join("\n\n");

  return sanitizeSheet({
    version: 1,
    name: payload.pc_name ?? payload.data_title,
    player: payload.player_name ?? payload.pl_name,
    occupation: payload.shuzoku,
    age: payload.age,
    gender: payload.sex,
    origin: payload.pc_kigen,
    color: "cyan",
    stats,
    hp,
    hpMax: hp,
    mp,
    mpMax: mp,
    san,
    sanMax: sourceNumber(payload.SAN_Max, 99),
    skills: parseSkills(memo),
    inventory: parseInventory(payload),
    notes,
    sourceUrl,
  });
};

export const importPublicSheet = async (
  inputUrl: string,
  fetcher: typeof fetch = fetch,
): Promise<SheetData> => {
  const id = parseSourceId(inputUrl);
  if (!id) throw new Error("invalid_source_url");
  const sourceUrl = `https://${sourceHost}/${id}`;
  const response = await fetcher(`${sourceUrl}.js`, {
    headers: { Accept: "application/json" },
    redirect: "manual",
  });
  if (response.status >= 300 && response.status < 400) throw new Error("source_redirected");
  if (!response.ok) throw new Error("source_unavailable");
  const body = await response.text();
  if (body.length > 250_000) throw new Error("source_too_large");
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new Error("invalid_source_data");
  }
  const transformed = transformSourcePayload(payload, sourceUrl);
  if (!transformed) throw new Error("unsupported_source_sheet");
  return transformed;
};

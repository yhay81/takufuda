export const statKeys = ["str", "con", "pow", "dex", "app", "siz", "int", "edu"] as const;

export type StatKey = (typeof statKeys)[number];

export type Skill = {
  name: string;
  value: number;
};

export type SheetData = {
  version: 1;
  name: string;
  player: string;
  occupation: string;
  age: string;
  gender: string;
  origin: string;
  color: string;
  stats: Record<StatKey, number>;
  hp: number;
  hpMax: number;
  mp: number;
  mpMax: number;
  san: number;
  sanMax: number;
  skills: Skill[];
  inventory: string;
  notes: string;
  sourceUrl: string;
};

const colors = new Set(["amber", "cyan", "violet", "green", "rose"]);

const text = (value: unknown, maximum: number) =>
  typeof value === "string" ? value.normalize("NFKC").trim().slice(0, maximum) : "";

const integer = (value: unknown, minimum = 0, maximum = 999) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed)));
};

export const emptySheet = (): SheetData => ({
  version: 1,
  name: "",
  player: "",
  occupation: "",
  age: "",
  gender: "",
  origin: "",
  color: "amber",
  stats: {
    str: 10,
    con: 10,
    pow: 10,
    dex: 10,
    app: 10,
    siz: 10,
    int: 10,
    edu: 10,
  },
  hp: 10,
  hpMax: 10,
  mp: 10,
  mpMax: 10,
  san: 50,
  sanMax: 99,
  skills: [
    { name: "目星", value: 25 },
    { name: "聞き耳", value: 25 },
    { name: "図書館", value: 25 },
  ],
  inventory: "",
  notes: "",
  sourceUrl: "",
});

export const sanitizeSheet = (input: unknown): SheetData => {
  const candidate =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const rawStats =
    typeof candidate.stats === "object" && candidate.stats !== null
      ? (candidate.stats as Record<string, unknown>)
      : {};
  const stats = Object.fromEntries(
    statKeys.map((key) => [key, integer(rawStats[key], 0, 999)]),
  ) as Record<StatKey, number>;
  const rawSkills = Array.isArray(candidate.skills) ? candidate.skills : [];
  const seen = new Set<string>();
  const skills: Skill[] = [];

  for (const item of rawSkills.slice(0, 120)) {
    if (typeof item !== "object" || item === null) continue;
    const raw = item as Record<string, unknown>;
    const name = text(raw.name, 48);
    const key = name.toLocaleLowerCase("ja");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    skills.push({ name, value: integer(raw.value, 0, 999) });
    if (skills.length === 80) break;
  }

  const color = text(candidate.color, 12);
  return {
    version: 1,
    name: text(candidate.name, 80),
    player: text(candidate.player, 80),
    occupation: text(candidate.occupation, 80),
    age: text(candidate.age, 24),
    gender: text(candidate.gender, 32),
    origin: text(candidate.origin, 80),
    color: colors.has(color) ? color : "amber",
    stats,
    hp: integer(candidate.hp),
    hpMax: integer(candidate.hpMax),
    mp: integer(candidate.mp),
    mpMax: integer(candidate.mpMax),
    san: integer(candidate.san),
    sanMax: integer(candidate.sanMax),
    skills,
    inventory: text(candidate.inventory, 12_000),
    notes: text(candidate.notes, 24_000),
    sourceUrl: text(candidate.sourceUrl, 240),
  };
};

export const isValidSheetId = (value: string) => /^[a-zA-Z0-9_-]{12}$/.test(value);

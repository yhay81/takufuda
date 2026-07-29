const statKeys = ["str", "con", "pow", "dex", "app", "siz", "int", "edu"];
const defaultSheet = () => ({
  version: 1,
  name: "",
  player: "",
  occupation: "",
  age: "",
  gender: "",
  origin: "",
  color: "amber",
  stats: { str: 10, con: 10, pow: 10, dex: 10, app: 10, siz: 10, int: 10, edu: 10 },
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

const storageKeys = {
  draft: "takufuda:draft:v1",
  recent: "takufuda:recent:v1",
  session: "takufuda:session:v1",
  seen: "takufuda:seen:v1",
};
const qs = (selector, root = document) => root.querySelector(selector);
const qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
const initialSheetId = document.body.dataset.sheetId || "";
const editMatch = location.hash.match(/^#edit=([a-zA-Z0-9_-]{43})$/);
const automated =
  new URLSearchParams(location.search).get("qa") === "1" || navigator.webdriver === true;
const sessionId = (() => {
  const current = localStorage.getItem(storageKeys.session);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const created = crypto.randomUUID();
  localStorage.setItem(storageKeys.session, created);
  return created;
})();

let sheet = defaultSheet();
let sheetId = initialSheetId;
let editToken = editMatch?.[1] || "";
let privateNotes = "";
let readonly = Boolean(sheetId && !editToken);
let dirty = false;
let saveTimer = 0;

const toast = (message, tone = "normal") => {
  const node = qs("[data-toast]");
  node.textContent = message;
  node.dataset.tone = tone;
  node.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("visible"), 3200);
};
toast.timer = 0;

const postEvent = (name) => {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ automated, name, sessionId, sheetId }),
    keepalive: true,
  }).catch(() => {});
};

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(999, Math.round(parsed))) : fallback;
};

const safeRecent = () => {
  try {
    const value = JSON.parse(localStorage.getItem(storageKeys.recent) || "[]");
    return Array.isArray(value) ? value.filter((item) => item && item.id).slice(0, 20) : [];
  } catch {
    return [];
  }
};

const writeRecent = () => {
  if (!sheetId || !editToken) return;
  const rest = safeRecent().filter((item) => item.id !== sheetId);
  const recent = [
    {
      id: sheetId,
      editToken,
      name: sheet.name || "名前のない探索者",
      occupation: sheet.occupation || "",
      color: sheet.color,
      updatedAt: Date.now(),
    },
    ...rest,
  ].slice(0, 20);
  localStorage.setItem(storageKeys.recent, JSON.stringify(recent));
  renderRecent();
};

const privateKey = () => `takufuda:private:${sheetId || "draft"}`;

const saveDraft = () => {
  if (readonly) return;
  localStorage.setItem(storageKeys.draft, JSON.stringify(sheet));
  localStorage.setItem(privateKey(), privateNotes);
  const label = qs("[data-save-label]");
  const detail = qs("[data-save-detail]");
  if (dirty) {
    label.textContent = "端末に下書き保存";
    detail.textContent = sheetId ? "共有版には未反映です" : "共有すると編集鍵が発行されます";
    qs("[data-save-light]").dataset.state = "local";
  }
};

const scheduleDraft = () => {
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraft, 220);
};

const commandText = () => {
  const stats = statKeys.map(
    (key) => `1D100<=${number(sheet.stats[key]) * 5} 【${key.toUpperCase()}】`,
  );
  const skills = sheet.skills
    .filter((skill) => skill.name)
    .map((skill) => `1D100<=${number(skill.value)} 【${skill.name}】`);
  return [
    `1D100<=${number(sheet.san)} 【SANチェック】`,
    `1D100<=${number(sheet.stats.int) * 5} 【アイデア】`,
    `1D100<=${number(sheet.stats.pow) * 5} 【幸運】`,
    `1D100<=${number(sheet.stats.edu) * 5} 【知識】`,
    "",
    ...skills,
    "",
    ...stats,
  ].join("\n");
};

const renderRadar = () => {
  const values = statKeys.map((key) => number(sheet.stats[key]));
  const maximum = Math.max(18, ...values);
  const points = values.map((value, index) => {
    const angle = (-90 + index * 45) * (Math.PI / 180);
    const radius = 88 * (value / maximum);
    return [120 + Math.cos(angle) * radius, 120 + Math.sin(angle) * radius];
  });
  qs("[data-radar]").setAttribute(
    "points",
    points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" "),
  );
  const group = qs("[data-radar-points]");
  group.replaceChildren(
    ...points.map(([x, y]) => {
      const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      point.setAttribute("cx", x.toFixed(1));
      point.setAttribute("cy", y.toFixed(1));
      point.setAttribute("r", "4");
      return point;
    }),
  );
  statKeys.forEach((key) => {
    const bar = qs(`[data-stat-bar="${key}"]`);
    bar.style.setProperty(
      "--value",
      `${Math.min(100, (number(sheet.stats[key]) / maximum) * 100)}%`,
    );
  });
  qs('[data-derived="idea"]').textContent = number(sheet.stats.int) * 5;
  qs('[data-derived="luck"]').textContent = number(sheet.stats.pow) * 5;
  qs('[data-derived="knowledge"]').textContent = number(sheet.stats.edu) * 5;
};

const renderSkills = () => {
  const root = qs("[data-skill-list]");
  const filter = (qs("[data-skill-filter]")?.value || "").normalize("NFKC").toLowerCase();
  root.replaceChildren();
  sheet.skills.forEach((skill, index) => {
    if (filter && !skill.name.normalize("NFKC").toLowerCase().includes(filter)) return;
    const row = document.createElement("div");
    row.className = "skill-row";
    row.dataset.skillIndex = String(index);

    const ring = document.createElement("span");
    ring.className = "skill-ring";
    ring.style.setProperty("--skill", `${Math.min(100, number(skill.value))}%`);
    ring.setAttribute("aria-hidden", "true");

    const name = document.createElement("input");
    name.value = skill.name;
    name.maxLength = 48;
    name.placeholder = "技能名";
    name.dataset.skillName = String(index);
    name.disabled = readonly;
    name.setAttribute("aria-label", "技能名");

    const value = document.createElement("input");
    value.value = String(number(skill.value));
    value.type = "number";
    value.min = "0";
    value.max = "999";
    value.inputMode = "numeric";
    value.dataset.skillValue = String(index);
    value.disabled = readonly;
    value.setAttribute("aria-label", `${skill.name || "技能"}の値`);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "×";
    remove.dataset.removeSkill = String(index);
    remove.disabled = readonly;
    remove.setAttribute("aria-label", `${skill.name || "技能"}を削除`);

    row.append(ring, name, value, remove);
    root.append(row);
  });
  if (root.children.length === 0) {
    const empty = document.createElement("p");
    empty.className = "skill-empty";
    empty.textContent = filter ? "一致する技能がありません" : "技能を追加してください";
    root.append(empty);
  }
  qs("[data-skill-count]").textContent = String(sheet.skills.length);
  const first = sheet.skills.find((skill) => skill.name);
  qs("[data-command-preview]").textContent = first
    ? `1D100<=${number(first.value)} 【${first.name}】`
    : "技能を追加すると判定コマンドができます";
};

const renderIdentity = () => {
  const initial = Array.from(sheet.name || "?")[0] || "?";
  qs("[data-monogram]").textContent = initial;
  qs(".portrait-card").dataset.color = sheet.color;
  qsa("[data-color-choice]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.colorChoice === sheet.color));
  });
};

const renderReadonly = () => {
  qsa("[data-field], [data-stat], [data-color-choice], [data-action='calculate']").forEach(
    (element) => {
      element.disabled = readonly;
    },
  );
  qs("[data-private-notes]").disabled = readonly;
  qs("[data-import-form] input").disabled = readonly;
  qs("[data-import-form] button").disabled = readonly;
  qs("[data-action='add-skill']").disabled = readonly;
  const saveButton = qs("[data-action='save']");
  saveButton.innerHTML = readonly
    ? '<span aria-hidden="true">⧉</span> 複製して編集'
    : '<span aria-hidden="true">⌁</span> 保存して共有';
  qs("[data-action='delete']").hidden = !(sheetId && editToken);
};

const renderAll = () => {
  qsa("[data-field]").forEach((input) => {
    const key = input.dataset.field;
    if (key in sheet) input.value = String(sheet[key] ?? "");
  });
  qsa("[data-stat]").forEach((input) => {
    input.value = String(sheet.stats[input.dataset.stat] ?? 0);
  });
  qs("[data-private-notes]").value = privateNotes;
  renderIdentity();
  renderRadar();
  renderSkills();
  renderReadonly();
};

const applySheet = (value) => {
  const base = defaultSheet();
  const candidate = value && typeof value === "object" ? value : {};
  sheet = {
    ...base,
    ...candidate,
    stats: { ...base.stats, ...candidate.stats },
    skills: Array.isArray(candidate.skills) ? candidate.skills.slice(0, 80) : base.skills,
    version: 1,
  };
  privateNotes = localStorage.getItem(privateKey()) || "";
  renderAll();
  scheduleDraft();
};

const setSavedState = (updatedAt) => {
  dirty = false;
  qs("[data-save-light]").dataset.state = "cloud";
  qs("[data-save-label]").textContent = "共有版に保存済み";
  qs("[data-save-detail]").textContent = new Date(updatedAt * 1000).toLocaleString("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  qs("[data-action='copy-share']").disabled = false;
};

const loadPublished = async () => {
  try {
    const response = await fetch(`/api/sheets/${sheetId}`, { cache: "no-store" });
    if (!response.ok) throw new Error("not_found");
    const payload = await response.json();
    applySheet(payload.data);
    dirty = false;
    setSavedState(payload.updatedAt);
    if (editToken) writeRecent();
  } catch {
    toast("共有札を読み込めませんでした", "error");
  }
};

const savePublished = async () => {
  const wasReadonly = readonly;
  if (wasReadonly) {
    readonly = false;
    sheetId = "";
    editToken = "";
    renderReadonly();
  }
  const existing = Boolean(sheetId && editToken);
  const response = await fetch(existing ? `/api/sheets/${sheetId}` : "/api/sheets", {
    method: existing ? "PUT" : "POST",
    headers: {
      "content-type": "application/json",
      ...(existing ? { "x-edit-token": editToken } : {}),
    },
    body: JSON.stringify({ data: sheet }),
  });
  if (!response.ok) {
    if (response.status === 403) throw new Error("編集鍵が一致しません");
    throw new Error("保存できませんでした");
  }
  const payload = await response.json();
  if (!existing) {
    sheetId = payload.id;
    editToken = payload.editToken;
    history.replaceState({}, "", `/s/${sheetId}#edit=${editToken}`);
    localStorage.setItem(`takufuda:private:${sheetId}`, privateNotes);
  }
  setSavedState(payload.updatedAt);
  writeRecent();
  renderReadonly();
  postEvent("sheet_saved");
  toast(wasReadonly ? "複製した札を保存しました" : "共有版を保存しました");
};

const renderRecent = () => {
  const recent = safeRecent();
  qs("[data-recent-count]").textContent = String(recent.length);
  const root = qs("[data-recent-list]");
  root.replaceChildren();
  if (recent.length === 0) {
    const empty = document.createElement("div");
    empty.className = "recent-empty";
    empty.innerHTML = "<span>□</span><p>共有した札がここに並びます</p>";
    root.append(empty);
    return;
  }
  recent.forEach((item) => {
    const link = document.createElement("a");
    link.className = "recent-item";
    link.href = `/s/${item.id}#edit=${item.editToken}`;
    link.dataset.color = item.color || "amber";
    const monogram = document.createElement("span");
    monogram.textContent = Array.from(item.name || "?")[0] || "?";
    const copy = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = item.name || "名前のない探索者";
    const occupation = document.createElement("small");
    occupation.textContent = item.occupation || "職業未設定";
    copy.append(name, occupation);
    const time = document.createElement("time");
    time.textContent = new Date(item.updatedAt).toLocaleDateString("ja-JP", {
      month: "numeric",
      day: "numeric",
    });
    link.append(monogram, copy, time);
    root.append(link);
  });
};

const copyText = async (text, message) => {
  await navigator.clipboard.writeText(text);
  toast(message);
};

qsa("[data-field]").forEach((input) => {
  input.addEventListener("input", () => {
    const key = input.dataset.field;
    sheet[key] = input.type === "number" ? number(input.value) : input.value;
    renderIdentity();
    scheduleDraft();
  });
});

qsa("[data-stat]").forEach((input) => {
  input.addEventListener("input", () => {
    sheet.stats[input.dataset.stat] = number(input.value);
    renderRadar();
    scheduleDraft();
  });
});

qs("[data-private-notes]").addEventListener("input", (event) => {
  privateNotes = event.target.value;
  scheduleDraft();
});

qsa("[data-color-choice]").forEach((button) => {
  button.addEventListener("click", () => {
    sheet.color = button.dataset.colorChoice;
    renderIdentity();
    scheduleDraft();
  });
});

qsa("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    qsa("[data-tab]").forEach((tab) => tab.setAttribute("aria-selected", String(tab === button)));
    qsa("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== button.dataset.tab;
    });
  });
});

qs("[data-action='calculate']").addEventListener("click", () => {
  sheet.hp = Math.ceil((number(sheet.stats.con) + number(sheet.stats.siz)) / 2);
  sheet.hpMax = sheet.hp;
  sheet.mp = number(sheet.stats.pow);
  sheet.mpMax = sheet.mp;
  sheet.san = number(sheet.stats.pow) * 5;
  sheet.sanMax = 99;
  renderAll();
  scheduleDraft();
  toast("HP・MP・SANを整えました");
});

qs("[data-action='add-skill']").addEventListener("click", () => {
  if (sheet.skills.length >= 80) {
    toast("技能は80件までです", "error");
    return;
  }
  sheet.skills.push({ name: "", value: 0 });
  qs("[data-skill-filter]").value = "";
  renderSkills();
  qs(`[data-skill-name="${sheet.skills.length - 1}"]`)?.focus();
  scheduleDraft();
  postEvent("editor_started");
});

qs("[data-skill-filter]").addEventListener("input", renderSkills);

qs("[data-skill-list]").addEventListener("input", (event) => {
  const nameIndex = event.target.dataset.skillName;
  const valueIndex = event.target.dataset.skillValue;
  if (nameIndex !== undefined) sheet.skills[Number(nameIndex)].name = event.target.value;
  if (valueIndex !== undefined) sheet.skills[Number(valueIndex)].value = number(event.target.value);
  if (valueIndex !== undefined) {
    event.target
      .closest(".skill-row")
      ?.querySelector(".skill-ring")
      ?.style.setProperty("--skill", `${Math.min(100, number(event.target.value))}%`);
  }
  const first = sheet.skills.find((skill) => skill.name);
  qs("[data-command-preview]").textContent = first
    ? `1D100<=${number(first.value)} 【${first.name}】`
    : "技能を追加すると判定コマンドができます";
  scheduleDraft();
});

qs("[data-skill-list]").addEventListener("click", (event) => {
  const index = event.target.dataset.removeSkill;
  if (index === undefined) return;
  sheet.skills.splice(Number(index), 1);
  renderSkills();
  scheduleDraft();
});

qs("[data-import-form]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = qs("#source-url");
  const button = qs("[data-import-form] button");
  button.disabled = true;
  button.textContent = "移しています…";
  try {
    const response = await fetch("/api/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: input.value }),
    });
    const payload = await response.json();
    if (!response.ok) {
      if (payload.error === "unsupported_source_sheet")
        throw new Error("クトゥルフ神話TRPGの公開シートを指定してください");
      if (payload.error === "invalid_source_url")
        throw new Error("キャラクター保管所の公開URLを確認してください");
      throw new Error("公開シートを取得できませんでした");
    }
    applySheet(payload.data);
    input.value = "";
    postEvent("sheet_imported");
    toast(`${sheet.name || "探索者"}を取り込みました`);
  } catch (error) {
    toast(error.message || "取り込みに失敗しました", "error");
  } finally {
    button.disabled = readonly;
    button.textContent = "取り込む";
  }
});

qs("[data-action='save']").addEventListener("click", async () => {
  const button = qs("[data-action='save']");
  button.disabled = true;
  try {
    await savePublished();
  } catch (error) {
    toast(error.message || "保存できませんでした", "error");
  } finally {
    button.disabled = false;
  }
});

qs("[data-action='copy-share']").addEventListener("click", async () => {
  if (!sheetId) return;
  await copyText(`${location.origin}/s/${sheetId}`, "閲覧URLをコピーしました");
  postEvent("share_copied");
});

qs("[data-action='copy-commands']").addEventListener("click", async () => {
  await copyText(commandText(), "判定コマンドをコピーしました");
  postEvent("commands_copied");
});

qs("[data-action='copy-ccfolia']").addEventListener("click", async () => {
  const payload = {
    kind: "character",
    data: {
      name: sheet.name || "探索者",
      initiative: number(sheet.stats.dex),
      externalUrl: sheetId ? `${location.origin}/s/${sheetId}` : "",
      status: [
        { label: "HP", value: number(sheet.hp), max: number(sheet.hpMax) },
        { label: "MP", value: number(sheet.mp), max: number(sheet.mpMax) },
        { label: "SAN", value: number(sheet.san), max: number(sheet.sanMax) },
      ],
      params: statKeys.map((key) => ({
        label: key.toUpperCase(),
        value: String(number(sheet.stats[key])),
      })),
      commands: commandText(),
      memo: sheet.notes,
    },
  };
  await copyText(JSON.stringify(payload), "ココフォリア用の駒をコピーしました");
  postEvent("ccfolia_copied");
});

qs("[data-action='export']").addEventListener("click", () => {
  const blob = new Blob(
    [JSON.stringify({ exportedAt: new Date().toISOString(), sheet }, null, 2)],
    {
      type: "application/json",
    },
  );
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `${(sheet.name || "takufuda").replace(/[\\/:*?"<>|]/g, "_")}.json`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
  postEvent("json_exported");
  toast("JSONを書き出しました");
});

qs("[data-import-file]").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 64_000) throw new Error("ファイルが大きすぎます");
    const payload = JSON.parse(await file.text());
    applySheet(payload.sheet || payload);
    toast("JSONを読み込みました");
  } catch (error) {
    toast(error.message || "JSONを読み込めませんでした", "error");
  } finally {
    event.target.value = "";
  }
});

qs("[data-action='delete']").addEventListener("click", async () => {
  if (!sheetId || !editToken) return;
  if (!confirm("この共有札を削除します。端末のJSONバックアップがなければ元に戻せません。")) return;
  const response = await fetch(`/api/sheets/${sheetId}`, {
    method: "DELETE",
    headers: { "x-edit-token": editToken },
  });
  if (!response.ok) {
    toast("削除できませんでした", "error");
    return;
  }
  const deletedId = sheetId;
  const recent = safeRecent().filter((item) => item.id !== deletedId);
  localStorage.setItem(storageKeys.recent, JSON.stringify(recent));
  localStorage.removeItem(`takufuda:private:${deletedId}`);
  sheetId = "";
  editToken = "";
  sheet = defaultSheet();
  readonly = false;
  history.replaceState({}, "", "/");
  renderAll();
  renderRecent();
  postEvent("sheet_deleted");
  toast("共有札を削除しました");
});

qs("[data-action='new']").addEventListener("click", () => {
  if (dirty && !confirm("いまの下書きを閉じて、新しい札を作りますか？")) return;
  sheetId = "";
  editToken = "";
  readonly = false;
  sheet = defaultSheet();
  privateNotes = "";
  dirty = false;
  localStorage.removeItem(storageKeys.draft);
  history.pushState({}, "", "/");
  renderAll();
  toast("新しい札を開きました");
});

qs("[data-action='recent']").addEventListener("click", () =>
  qs("[data-recent-dialog]").showModal(),
);
qs("[data-action='close-recent']").addEventListener("click", () =>
  qs("[data-recent-dialog]").close(),
);
qs("[data-recent-dialog]").addEventListener("click", (event) => {
  if (event.target === event.currentTarget) event.currentTarget.close();
});

window.addEventListener("beforeunload", saveDraft);

const initialize = async () => {
  renderRecent();
  const lastSeen = Number(localStorage.getItem(storageKeys.seen) || 0);
  postEvent(lastSeen && Date.now() - lastSeen > 86_400_000 ? "returned" : "visited");
  localStorage.setItem(storageKeys.seen, String(Date.now()));
  if (sheetId) {
    await loadPublished();
    return;
  }
  try {
    const draft = JSON.parse(localStorage.getItem(storageKeys.draft) || "null");
    if (draft) applySheet(draft);
    else renderAll();
  } catch {
    renderAll();
  }
};

void initialize();

import { describe, expect, it, vi } from "vitest";

import { importPublicSheet, parseSourceId, transformSourcePayload } from "../src/importer";

const sourcePayload = {
  game: "coc",
  data_title: "神室初",
  pc_name: "かむろ うい",
  player_name: "PL",
  shuzoku: "記者",
  age: "23",
  sex: "女",
  pc_kigen: "日本",
  NP1: "13",
  NP2: "12",
  NP3: "12",
  NP4: "10",
  NP5: "15",
  NP6: "13",
  NP7: "17",
  NP8: "15",
  NP9: "13",
  NP10: "12",
  SAN_Left: "60",
  SAN_Max: "99",
  item_name: ["手帳", "万年筆"],
  item_num: ["1", "2"],
  pc_making_memo:
    "CCB<={SAN} 【SANチェック】\nCCB<=75 【目星】\nCCB<=65 【聞き耳】\nCCB<=75 【目星】\nCCB<=({STR}*5) 【STR】",
  phrase: "must-not-leak",
};

describe("キャラクター保管所の公開シート取り込み", () => {
  it("accepts only exact public sheet URLs on the supported host", () => {
    expect(parseSourceId("https://charasheet.vampire-blood.net/4330377")).toBe("4330377");
    expect(
      parseSourceId("http://charasheet.vampire-blood.net/m61b83410b8020702492070026f7631df.html"),
    ).toBe("m61b83410b8020702492070026f7631df");
    expect(parseSourceId("https://evil.example/4330377")).toBeNull();
    expect(parseSourceId("https://charasheet.vampire-blood.net/list_coc.html")).toBeNull();
    expect(parseSourceId("https://charasheet.vampire-blood.net/../help")).toBeNull();
  });

  it("maps identity, stats, vitals, inventory, and unique commands without leaking unknown fields", () => {
    const transformed = transformSourcePayload(
      sourcePayload,
      "https://charasheet.vampire-blood.net/4330377",
    );
    expect(transformed).toEqual(
      expect.objectContaining({
        name: "かむろ うい",
        occupation: "記者",
        hp: 13,
        mp: 12,
        san: 60,
        sourceUrl: "https://charasheet.vampire-blood.net/4330377",
      }),
    );
    expect(transformed?.stats).toEqual(
      expect.objectContaining({ str: 13, dex: 10, int: 17, edu: 15 }),
    );
    expect(transformed?.skills).toEqual([
      { name: "目星", value: 75 },
      { name: "聞き耳", value: 65 },
    ]);
    expect(transformed?.inventory).toBe("手帳\n万年筆 ×2");
    expect(JSON.stringify(transformed)).not.toContain("must-not-leak");
  });

  it("fetches the documented JSON endpoint over HTTPS and rejects other game systems", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify(sourcePayload), { status: 200 }));
    const sheet = await importPublicSheet(
      "http://charasheet.vampire-blood.net/4330377.html",
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      "https://charasheet.vampire-blood.net/4330377.js",
      expect.objectContaining({ redirect: "manual" }),
    );
    expect(sheet.name).toBe("かむろ うい");

    await expect(
      importPublicSheet(
        "https://charasheet.vampire-blood.net/4330377",
        async () => new Response(JSON.stringify({ game: "sw2" }), { status: 200 }),
      ),
    ).rejects.toThrow("unsupported_source_sheet");
  });
});

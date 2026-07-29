import { describe, expect, it } from "vitest";

import client from "../public/app.js?raw";
import pages from "../src/ui/pages.tsx?raw";

describe("卓札 client", () => {
  it("keeps private notes out of cloud payloads and strips edit keys from share links", () => {
    expect(client).toContain("body: JSON.stringify({ data: sheet })");
    expect(client).not.toContain("data: { ...sheet, privateNotes");
    expect(client).toContain("`/s/${sheetId}#edit=${editToken}`");
    expect(client).toContain("`${location.origin}/s/${sheetId}`");
  });

  it("marks webdriver and qa query sessions as automated", () => {
    expect(client).toContain('new URLSearchParams(location.search).get("qa") === "1"');
    expect(client).toContain("navigator.webdriver === true");
    expect(client).toContain("JSON.stringify({ automated, name, sessionId, sheetId })");
  });

  it("uses a compact application workspace and responsive visual surfaces", () => {
    expect(pages).toContain('class="workspace-shell"');
    expect(pages).toContain('class="radar-shape"');
    expect(pages).toContain('class="skill-list"');
    expect(pages).not.toContain('class="hero"');
  });
});

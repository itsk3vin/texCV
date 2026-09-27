import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { STARTER } from "./starter.js";

describe("starter template", () => {
  it("uses the repository template verbatim", async () => {
    const template = await readFile(new URL("../.texcv-template.tex", import.meta.url), "utf8");
    expect(STARTER).toBe(template);
  });
});

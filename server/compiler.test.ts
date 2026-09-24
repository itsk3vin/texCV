import { describe, expect, it } from "vitest";
import { parseDiagnostics } from "./compiler.js";

describe("Tectonic diagnostics", () => {
  it("parses file and line errors", () => {
    expect(parseDiagnostics("resume.tex:17: Undefined control sequence")).toEqual([
      { severity: "error", file: "resume.tex", line: 17, message: "Undefined control sequence" },
    ]);
  });

  it("parses classic TeX errors and warnings", () => {
    const result = parseDiagnostics("! Missing $ inserted.\nl.9 experience & impact\nLaTeX Warning: Label changed");
    expect(result[0]).toMatchObject({ severity: "error", line: 9, message: "Missing $ inserted." });
    expect(result[1]).toMatchObject({ severity: "warning", message: "LaTeX Warning: Label changed" });
  });
});

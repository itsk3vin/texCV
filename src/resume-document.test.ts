import { describe, expect, it } from "vitest";
import { escapeLatex, parseResume, updateResumeSource } from "./resume-document";

const document = String.raw`\documentclass{article}
\newcommand{\resumeSubheading}[4]{#1 #2 #3 #4}
\newcommand{\resumeProjectHeading}[2]{#1 #2}
\newcommand{\resumeItem}[1]{#1}
\begin{document}
\section{Education}
\resumeSubheading{School}{Chicago}{Computer Science}{2026}
\section{Experience}
\resumeSubheading{Engineer}{Now}{Acme}{Remote}
\resumeItem{Improved uptime by 20\%}
\resumeSubheading{Intern}{2024}{Beta}{Austin}
\resumeItem{Built internal tools}
\section{Projects}
\resumeProjectHeading{\textbf{TexCV} $|$ \emph{React, TypeScript}}{2026}
\resumeItem{Built a resume editor}
\section{Technical Skills}
\textbf{Languages}{: TypeScript, Python} \\
\end{document}`;

describe("resume document", () => {
  it("parses multiple entries and their own bullets", () => {
    const result = parseResume(document);
    expect(result.experience).toHaveLength(2);
    expect(result.experience[0].bullets).toEqual(["Improved uptime by 20%"]);
    expect(result.experience[1].title).toBe("Intern");
    expect(result.projects[0].subtitle).toBe("React, TypeScript");
  });

  it("updates sections without replacing the preamble", () => {
    const data = parseResume(document);
    data.education[0].title = "A & B University";
    const updated = updateResumeSource(document, data);
    expect(updated).toContain("\\documentclass{article}");
    expect(updated).toContain("{A \\& B University}");
    expect(parseResume(updated).education[0].title).toBe("A & B University");
  });

  it("escapes LaTeX control characters", () => {
    expect(escapeLatex("R&D_100%")).toBe("R\\&D\\_100\\%");
  });
});

export type ResumeEntry = {
  id: string;
  title: string;
  subtitle: string;
  location: string;
  date: string;
  bullets: string[];
};

export type ResumeData = {
  education: ResumeEntry[];
  experience: ResumeEntry[];
  projects: ResumeEntry[];
  skills: { id: string; category: string; value: string }[];
};

const id = () => Math.random().toString(36).slice(2, 10);

function section(source: string, names: string[]) {
  const alternatives = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return source.match(new RegExp(`\\\\section\\{(?:${alternatives})\\}([\\s\\S]*?)(?=\\n\\s*\\\\section\\{|\\n\\s*%[-%]*\\s*\\\\end\\{document\\}|\\n\\s*\\\\end\\{document\\})`, "i"))?.[1] ?? "";
}

function commandArgs(source: string, command: string, count: number) {
  const found: string[][] = [];
  let cursor = 0;
  while ((cursor = source.indexOf(`\\${command}`, cursor)) >= 0) {
    cursor += command.length + 1;
    const args: string[] = [];
    for (let index = 0; index < count; index++) {
      while (/\s/.test(source[cursor] ?? "")) cursor++;
      if (source[cursor] !== "{") break;
      let depth = 0, start = ++cursor;
      for (; cursor < source.length; cursor++) {
        if (source[cursor] === "{" && source[cursor - 1] !== "\\") depth++;
        if (source[cursor] === "}" && source[cursor - 1] !== "\\") {
          if (depth === 0) { args.push(source.slice(start, cursor)); cursor++; break; }
          depth--;
        }
      }
    }
    if (args.length === count) found.push(args);
  }
  return found;
}

function plain(value: string) {
  return value
    .replace(/\\(?:textbf|emph|textit|underline)\{([^{}]*)\}/g, "$1")
    .replace(/\$\|\$/g, "|").replace(/\\&/g, "&").replace(/\\%/g, "%")
    .replace(/\\_/g, "_").replace(/\\#/g, "#").trim();
}

function entriesFrom(chunk: string, kind: "education" | "experience" | "project"): ResumeEntry[] {
  const project = kind === "project";
  const command = project ? "resumeProjectHeading" : "resumeSubheading";
  const headings = commandArgs(chunk, command, project ? 2 : 4);
  let searchFrom = 0;
  return headings.map((args) => {
    const start = chunk.indexOf(`\\${command}`, searchFrom);
    const next = chunk.indexOf(`\\${command}`, start + command.length + 1);
    searchFrom = start + command.length + 1;
    const body = chunk.slice(start, next < 0 ? undefined : next);
    const bullets = commandArgs(body, "resumeItem", 1).map(([value]) => plain(value));
    if (project) {
      const heading = plain(args[0]);
      const [title, ...tech] = heading.split("|");
      return { id: id(), title: title.trim(), subtitle: tech.join("|").trim(), location: "", date: plain(args[1]), bullets };
    }
    return kind === "education"
      ? { id: id(), title: plain(args[0]), location: plain(args[1]), subtitle: plain(args[2]), date: plain(args[3]), bullets }
      : { id: id(), title: plain(args[0]), date: plain(args[1]), subtitle: plain(args[2]), location: plain(args[3]), bullets };
  });
}

export function parseResume(source: string): ResumeData {
  const skillsChunk = section(source, ["Technical Skills", "Skills"]);
  const skills = commandArgs(skillsChunk, "textbf", 1).map(([category]) => {
    const position = skillsChunk.indexOf(`\\textbf{${category}}`);
    const tail = skillsChunk.slice(position + category.length + 9);
    const match = tail.match(/^\s*\{?:\s*([^}\\]*(?:\\[&_#%][^}\\]*)*)/);
    return { id: id(), category: plain(category), value: plain(match?.[1] ?? "") };
  });
  return {
    education: entriesFrom(section(source, ["Education"]), "education"),
    experience: entriesFrom(section(source, ["Experience", "Work Experience"]), "experience"),
    projects: entriesFrom(section(source, ["Projects"]), "project"),
    skills,
  };
}

export function escapeLatex(value: string) {
  return value.replace(/\\/g, "\\textbackslash{}").replace(/([&%$#_{}])/g, "\\$1").replace(/~/g, "\\textasciitilde{}").replace(/\^/g, "\\textasciicircum{}");
}

function entryLatex(entry: ResumeEntry, kind: "education" | "experience" | "project") {
  const heading = kind === "project"
    ? `      \\resumeProjectHeading\n          {\\textbf{${escapeLatex(entry.title)}}${entry.subtitle ? ` $|$ \\emph{${escapeLatex(entry.subtitle)}}` : ""}}{${escapeLatex(entry.date)}}`
    : kind === "education"
      ? `    \\resumeSubheading\n      {${escapeLatex(entry.title)}}{${escapeLatex(entry.location)}}\n      {${escapeLatex(entry.subtitle)}}{${escapeLatex(entry.date)}}`
      : `    \\resumeSubheading\n      {${escapeLatex(entry.title)}}{${escapeLatex(entry.date)}}\n      {${escapeLatex(entry.subtitle)}}{${escapeLatex(entry.location)}}`;
  const bullets = entry.bullets.filter(Boolean);
  return `${heading}${bullets.length ? `\n      \\resumeItemListStart\n${bullets.map((item) => `        \\resumeItem{${escapeLatex(item)}}`).join("\n")}\n      \\resumeItemListEnd` : ""}`;
}

function sectionLatex(title: string, entries: ResumeEntry[], kind: "education" | "experience" | "project") {
  return `\\section{${title}}\n  \\resumeSubHeadingListStart\n${entries.map((entry) => entryLatex(entry, kind)).join("\n\n")}\n  \\resumeSubHeadingListEnd`;
}

function skillsLatex(skills: ResumeData["skills"]) {
  const rows = skills.filter((skill) => skill.category || skill.value).map((skill) => `     \\textbf{${escapeLatex(skill.category)}}{: ${escapeLatex(skill.value)}} \\\\`).join("\n");
  return `\\section{Technical Skills}\n \\begin{itemize}[leftmargin=0.15in, label={}]\n    \\small{\\item{\n${rows}\n    }}\n \\end{itemize}`;
}

function replaceSection(source: string, names: string[], replacement: string) {
  const alternatives = names.join("|");
  const pattern = new RegExp(`\\\\section\\{(?:${alternatives})\\}[\\s\\S]*?(?=\\n\\s*\\\\section\\{|\\n\\s*%[-%]*\\s*\\\\end\\{document\\}|\\n\\s*\\\\end\\{document\\})`, "i");
  return pattern.test(source) ? source.replace(pattern, replacement) : source.replace(/\\end\{document\}/, `${replacement}\n\n\\end{document}`);
}

export function updateResumeSource(source: string, data: ResumeData) {
  let next = replaceSection(source, ["Education"], sectionLatex("Education", data.education, "education"));
  next = replaceSection(next, ["Experience", "Work Experience"], sectionLatex("Experience", data.experience, "experience"));
  next = replaceSection(next, ["Projects"], sectionLatex("Projects", data.projects, "project"));
  return replaceSection(next, ["Technical Skills", "Skills"], skillsLatex(data.skills));
}

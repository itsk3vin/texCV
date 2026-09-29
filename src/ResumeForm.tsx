import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { ResumeData, ResumeEntry } from "./resume-document";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "./components/ui/accordion";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";

type Props = { value: ResumeData; onChange: (value: ResumeData) => void };
type EntryKey = "education" | "experience" | "projects";

const blankEntry = (): ResumeEntry => ({ id: crypto.randomUUID(), title: "", subtitle: "", location: "", date: "", bullets: [""] });

function SkillEditor({ category, value, onCategoryChange, onValueChange }: { category: string; value: string; onCategoryChange: (value: string) => void; onValueChange: (value: string) => void }) {
  const [draft, setDraft] = useState("");
  const skills = value.split(",").map((skill) => skill.trim()).filter(Boolean);
  const addSkill = () => {
    const next = draft.trim().replace(/,$/, "");
    if (!next) return;
    if (!skills.some((skill) => skill.toLowerCase() === next.toLowerCase())) onValueChange([...skills, next].join(", "));
    setDraft("");
  };
  const removeSkill = (index: number) => onValueChange(skills.filter((_, skillIndex) => skillIndex !== index).join(", "));

  return <div className="skill-editor">
    <div className="skill-editor-row"><label><span>Title</span><Input aria-label="Skill group title" value={category} placeholder="Languages" onChange={(event) => onCategoryChange(event.target.value)} /></label><div aria-hidden="true" /></div>
    <div className="skill-editor-row"><label><span>Add a skill</span><Input aria-label="New skill" value={draft} placeholder="TypeScript" onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === ",") { event.preventDefault(); addSkill(); } }} /></label><div className="skill-add-action"><Button size="sm" variant="outline" onClick={addSkill} disabled={!draft.trim()}><Plus size={13} /> Add</Button></div></div>
    {skills.length ? <div className="skill-badges" aria-label="Skills">{skills.map((skill, index) => <Badge key={`${skill}-${index}`} variant="secondary" className="skill-badge"><span>{skill}</span><button type="button" aria-label={`Remove ${skill}`} onClick={() => removeSkill(index)}><X size={11} /></button></Badge>)}</div> : <p className="skill-empty">Skills you add will appear here.</p>}
  </div>;
}

export function ResumeForm({ value, onChange }: Props) {
  const setEntries = (key: EntryKey, entries: ResumeEntry[]) => onChange({ ...value, [key]: entries });
  const updateEntry = (key: EntryKey, index: number, patch: Partial<ResumeEntry>) => setEntries(key, value[key].map((entry, i) => i === index ? { ...entry, ...patch } : entry));

  const renderEntry = (key: EntryKey, title: string, entry: ResumeEntry, index: number) => {
    const summary = entry.title || `Untitled ${title === "Work Experience" ? "experience" : title.toLowerCase().replace(/s$/, "")}`;
    return <Accordion key={entry.id} defaultValue={entry.title ? [] : [entry.id]}>
      <AccordionItem className="resume-entry-accordion" value={entry.id}>
        <AccordionTrigger className="resume-entry-trigger">
          <span className="resume-entry-summary"><strong>{summary}</strong><small>{[entry.subtitle, entry.date].filter(Boolean).join(" · ") || "Click to edit"}</small></span>
        </AccordionTrigger>
        <AccordionPanel className="resume-entry-panel">
          <div className="resume-entry-toolbar"><Button size="xs" variant="ghost" onClick={() => setEntries(key, value[key].filter((_, i) => i !== index))}><Trash2 size={13} /> Remove</Button></div>
          <div className="resume-field-grid">
            <label><span>{key === "education" ? "School" : key === "projects" ? "Project name" : "Role"}</span><Input value={entry.title} placeholder={key === "education" ? "DePaul University" : key === "projects" ? "Portfolio website" : "Software Engineer"} onChange={(event) => updateEntry(key, index, { title: event.target.value })} /></label>
            <label><span>Date</span><Input value={entry.date} placeholder="2024 — Present" onChange={(event) => updateEntry(key, index, { date: event.target.value })} /></label>
            <label><span>{key === "education" ? "Degree" : key === "projects" ? "Technologies" : "Company"}</span><Input value={entry.subtitle} placeholder={key === "projects" ? "React, TypeScript" : ""} onChange={(event) => updateEntry(key, index, { subtitle: event.target.value })} /></label>
            {key !== "projects" ? <label><span>Location</span><Input value={entry.location} placeholder="Chicago, IL" onChange={(event) => updateEntry(key, index, { location: event.target.value })} /></label> : null}
          </div>
          {key !== "education" ? <div className="resume-bullets"><span>Highlights</span>{entry.bullets.map((bullet, bulletIndex) => <div className="resume-bullet" key={bulletIndex}><textarea value={bullet} rows={2} placeholder="Describe an impact or accomplishment…" onChange={(event) => updateEntry(key, index, { bullets: entry.bullets.map((item, i) => i === bulletIndex ? event.target.value : item) })} /><Button aria-label="Remove highlight" size="icon-xs" variant="ghost" onClick={() => updateEntry(key, index, { bullets: entry.bullets.filter((_, i) => i !== bulletIndex) })}><Trash2 size={13} /></Button></div>)}<Button size="xs" variant="ghost" onClick={() => updateEntry(key, index, { bullets: [...entry.bullets, ""] })}><Plus size={13} /> Add highlight</Button></div> : null}
        </AccordionPanel>
      </AccordionItem>
    </Accordion>;
  };

  const renderSection = (key: EntryKey, title: string, description: string) => <section className="resume-form-section">
    <div className="resume-form-heading"><div><h2>{title}</h2><p>{description}</p></div><Button size="sm" className="text-xs" variant="outline" onClick={() => setEntries(key, [...value[key], blankEntry()])}><Plus size={12} /> <span className="text-xs">Add</span></Button></div>
    <div className="resume-entry-list">{value[key].length === 0 ? <button className="resume-empty" onClick={() => setEntries(key, [blankEntry()])}>Add your first {title.toLowerCase()} entry</button> : value[key].map((entry, index) => renderEntry(key, title, entry, index))}</div>
  </section>;

  return <div className="resume-form" aria-label="Resume form">
    <div className="resume-form-intro"><h1>Resume content</h1><p>Fill in the sections below. Your LaTeX is generated automatically.</p></div>
    {renderSection("education", "Education", "Schools, degrees, and graduation dates")}
    {renderSection("experience", "Work Experience", "Roles, responsibilities, and results")}
    {renderSection("projects", "Projects", "Selected work and the tools you used")}
    <section className="resume-form-section">
      <div className="resume-form-heading"><div><h2>Skills</h2><p>Group related tools and capabilities</p></div><Button size="sm" className="text-xs" variant="outline" onClick={() => onChange({ ...value, skills: [...value.skills, { id: crypto.randomUUID(), category: "", value: "" }] })}><Plus size={12} /> <span className="text-xs">Add</span></Button></div>
      <div className="resume-entry-list">{value.skills.length === 0 ? <button className="resume-empty" onClick={() => onChange({ ...value, skills: [{ id: crypto.randomUUID(), category: "", value: "" }] })}>Add your first skill group</button> : value.skills.map((skill, index) => <Accordion key={skill.id} defaultValue={skill.category ? [] : [skill.id]}>
        <AccordionItem className="resume-entry-accordion" value={skill.id}>
          <AccordionTrigger className="resume-entry-trigger"><span className="resume-entry-summary"><strong>{skill.category || "Untitled skill group"}</strong><small>{skill.value || "Click to edit"}</small></span></AccordionTrigger>
          <AccordionPanel className="resume-entry-panel"><div className="resume-entry-toolbar"><Button size="xs" variant="ghost" onClick={() => onChange({ ...value, skills: value.skills.filter((_, i) => i !== index) })}><Trash2 size={13} /> Remove</Button></div><SkillEditor category={skill.category} value={skill.value} onCategoryChange={(category) => onChange({ ...value, skills: value.skills.map((item, i) => i === index ? { ...item, category } : item) })} onValueChange={(skillValue) => onChange({ ...value, skills: value.skills.map((item, i) => i === index ? { ...item, value: skillValue } : item) })} /></AccordionPanel>
        </AccordionItem>
      </Accordion>)}</div>
    </section>
  </div>;
}

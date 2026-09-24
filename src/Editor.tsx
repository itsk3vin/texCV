import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { StreamLanguage, bracketMatching, syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import { searchKeymap } from "@codemirror/search";
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";

type Props = {
  value: string;
  filePath?: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onCompile: () => void;
  onCursor: (line: number, column: number) => void;
};

const theme = EditorView.theme({
  "&": { height: "100%", backgroundColor: "#0f1217", color: "#d8dce3", fontSize: "14px" },
  ".cm-scroller": { fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace', lineHeight: "1.65", overflow: "auto" },
  ".cm-content": { padding: "18px 0", caretColor: "#9bafbf" },
  ".cm-line": { padding: "0 20px" },
  ".cm-gutters": { backgroundColor: "#0f1217", color: "#4f5662", border: "none", paddingLeft: "6px" },
  ".cm-activeLine": { backgroundColor: "#171b22" },
  ".cm-activeLineGutter": { backgroundColor: "#171b22", color: "#8d96a3" },
  "&.cm-focused .cm-selectionBackground, ::selection": { backgroundColor: "#314c61 !important" },
  ".cm-cursor": { borderLeftColor: "#9bafbf", borderLeftWidth: "2px" },
});

export function Editor({ value, filePath, onChange, onSave, onCompile, onCursor }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | undefined>(undefined);
  const handlers = useRef({ onChange, onSave, onCompile, onCursor });
  handlers.current = { onChange, onSave, onCompile, onCursor };

  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), history(), drawSelection(), highlightActiveLine(), highlightActiveLineGutter(), bracketMatching(),
          StreamLanguage.define(stex), syntaxHighlighting(defaultHighlightStyle), theme,
          EditorView.lineWrapping,
          keymap.of([
            { key: "Mod-s", preventDefault: true, run: () => { handlers.current.onSave(); return true; } },
            { key: "Mod-Enter", preventDefault: true, run: () => { handlers.current.onCompile(); return true; } },
            indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) handlers.current.onChange(update.state.doc.toString());
            if (update.selectionSet || update.docChanged) {
              const head = update.state.selection.main.head;
              const line = update.state.doc.lineAt(head);
              handlers.current.onCursor(line.number, head - line.from + 1);
            }
          }),
        ],
      }),
    });
    view.current = editor;
    return () => editor.destroy();
  }, [filePath]);

  useEffect(() => {
    const editor = view.current;
    if (!editor || editor.state.doc.toString() === value) return;
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } });
  }, [value]);

  return <div className="editor-host" ref={host} aria-label={filePath ? `Editing ${filePath}` : "No file open"} />;
}

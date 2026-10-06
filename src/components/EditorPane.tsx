import Editor from "@monaco-editor/react";
import { memo } from "react";

type Props = {
  source: string;
  onChange: (value: string) => void;
  language?: string;
  fileName?: string;
  tabSize?: number;
};

export const EditorPane = memo(function EditorPane({
  source,
  onChange,
  language = "python",
  fileName = "main.py",
  tabSize = 4,
}: Props) {
  return (
    <div className="editor-pane">
      <div className="file-tab">
        <span className={`file-dot${language === "sql" ? " is-sql" : ""}`} />
        {fileName}
      </div>
      <div className="editor-host">
        <Editor
          height="100%"
          defaultLanguage={language}
          defaultValue={source}
          onChange={(value) => onChange(value ?? "")}
          theme="elice-light"
          beforeMount={(monaco) => {
            monaco.editor.defineTheme("elice-light", {
              base: "vs",
              inherit: true,
              rules: [
                { token: "comment", foreground: "66717e", fontStyle: "italic" },
                { token: "keyword", foreground: "7353ea", fontStyle: "bold" },
                { token: "string", foreground: "1b7a4a" },
                { token: "number", foreground: "2f5efb" },
                { token: "identifier", foreground: "191f28" },
              ],
              colors: {
                "editor.background": "#ffffff",
                "editor.foreground": "#191f28",
                "editorLineNumber.foreground": "#98a0aa",
                "editorLineNumber.activeForeground": "#524fa1",
                "editor.selectionBackground": "#7353ea22",
                "editor.lineHighlightBackground": "#f6f4ff",
                "editorCursor.foreground": "#7353ea",
                "editorIndentGuide.background": "#e9ebf0",
              },
            });
          }}
          options={{
            readOnly: false,
            domReadOnly: false,
            fontSize: 14,
            fontFamily: "IBM Plex Mono, ui-monospace, Menlo, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize,
            padding: { top: 12, bottom: 16 },
            renderLineHighlight: "line",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            overviewRulerLanes: 0,
          }}
        />
      </div>
    </div>
  );
});

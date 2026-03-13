import { useState, useRef, useEffect } from "react";
import { COLORS } from "../constants/theme";

export function EditableValue({ value, onChange, suffix = "", style = {} }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const num = parseFloat(draft);
    if (!isNaN(num)) onChange(num);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        style={{
          background: COLORS.bg, color: COLORS.accent, border: `1px solid ${COLORS.accent}`,
          fontFamily: "monospace", fontSize: 10, padding: "1px 4px", width: 50,
          outline: "none", ...style,
        }}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => { setDraft(String(value)); setEditing(true); }}
      style={{ color: COLORS.text, cursor: "text", borderBottom: `1px dotted ${COLORS.panelBorder}`, ...style }}
      title="Double-click to edit"
    >{value}{suffix}</span>
  );
}
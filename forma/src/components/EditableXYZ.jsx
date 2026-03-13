import { useState, useRef, useEffect } from "react";
import { COLORS } from "../constants/theme";

export function EditableXYZ({ piece, index, onUpdatePiece }) {
  const [editing, setEditing] = useState(null); // "x" | "y" | "z" | null
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    if (editing) {
      const num = parseInt(draft);
      if (!isNaN(num)) onUpdatePiece(index, { [editing]: num });
    }
    setEditing(null);
  };

  const startEdit = (field, e) => {
    e.stopPropagation();
    setDraft(String(piece[field]));
    setEditing(field);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(null); }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: COLORS.bg, color: COLORS.accent, border: `1px solid ${COLORS.accent}`,
          fontFamily: "monospace", fontSize: 9, padding: "1px 3px", width: 36,
          outline: "none",
        }}
      />
    );
  }

  const valStyle = { cursor: "text", borderBottom: `1px dotted ${COLORS.panelBorder}`, padding: "0 1px" };
  return (
    <span title="Double-click to edit">
      <span onDoubleClick={(e) => startEdit("x", e)} style={valStyle}>{piece.x}</span>
      ·
      <span onDoubleClick={(e) => startEdit("y", e)} style={valStyle}>{piece.y}</span>
      ·
      <span onDoubleClick={(e) => startEdit("z", e)} style={valStyle}>{piece.z}</span>
    </span>
  );
}
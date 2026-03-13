import { COLORS } from "../constants/theme";

export function SaveDialog({ pieces, saveName, onSaveNameChange, onSave, onClose }) {
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`,
        padding: 24, width: 360, fontFamily: "monospace",
      }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 14, color: COLORS.accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 16 }}>Save Design</div>
        <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 12 }}>
          {pieces.length} pieces · Enter a name for this design
        </div>
        <input
          autoFocus
          value={saveName}
          onChange={(e) => onSaveNameChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") onSave(saveName); if (e.key === "Escape") onClose(); }}
          placeholder="My Sculpture Design"
          style={{
            width: "100%", background: COLORS.bg, color: COLORS.text,
            border: `1px solid ${COLORS.panelBorder}`, padding: "8px 12px",
            fontFamily: "monospace", fontSize: 11, outline: "none",
            marginBottom: 16, boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => onSave(saveName)} style={{
            flex: 1, background: COLORS.accent, color: COLORS.bg, border: "none",
            padding: "8px 0", fontFamily: "monospace", fontSize: 10,
            letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
          }}>Save</button>
          <button onClick={onClose} style={{
            background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.panelBorder}`,
            padding: "8px 16px", fontFamily: "monospace", fontSize: 10,
            letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
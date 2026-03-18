import { COLORS, PIECE_COLORS, PIECE_COLOR_NAMES } from "../constants/theme";
import { getFrameBounds, getStringLengths } from "../utils/strings";
import { EditableValue } from "./EditableValue";
import { EditableXYZ } from "./EditableXYZ";

export function PieceList({ pieces, selectedPiece, onSelectPiece, onUpdatePiece, onAddPiece, onDuplicatePiece, onRemovePiece, unitScale = 1 }) {
  const piece = pieces[selectedPiece];
  return (
    <div style={{ background: COLORS.panel, height: "100%", overflowY: "auto", fontFamily: "monospace", fontSize: 10, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${COLORS.panelBorder}` }}>
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 12, fontWeight: 400, letterSpacing: 4, color: COLORS.accent, textTransform: "uppercase" }}>Object List</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 36px", padding: "6px 14px", borderBottom: `1px solid ${COLORS.panelBorder}`, color: COLORS.textDim, fontSize: 8, letterSpacing: 1, textTransform: "uppercase" }}>
        <span>ID</span><span>X · Y · Z</span><span>Pts</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {pieces.map((p, i) => (
          <div key={p.id} onClick={() => onSelectPiece(i)} style={{
            display: "grid", gridTemplateColumns: "36px 1fr 36px", padding: "8px 14px", cursor: "pointer",
            background: i === selectedPiece ? COLORS.accent + "15" : "transparent",
            borderLeft: i === selectedPiece ? `2px solid ${COLORS.accent}` : "2px solid transparent",
            borderBottom: `1px solid ${COLORS.panelBorder}`, color: i === selectedPiece ? COLORS.text : COLORS.textDim, transition: "all 0.15s",
          }}>
            <span style={{ color: p.color }}>{p.id}</span>
            <EditableXYZ piece={p} index={i} onUpdatePiece={onUpdatePiece} isSelected={i === selectedPiece} />
            <span>{p.controlPoints.length}</span>
          </div>
        ))}
      </div>
      {piece && (
        <div style={{ padding: 14, borderTop: `1px solid ${COLORS.panelBorder}` }}>
          <div style={{ color: COLORS.accent, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Edit {piece.id}</div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
              <span>Z Depth</span>
              <EditableValue value={piece.z} onChange={(v) => onUpdatePiece(selectedPiece, { z: Math.round(Math.max(0, Math.min(400, v))) })} />
            </div>
            <input type="range" min={0} max={400} value={piece.z} onChange={(e) => onUpdatePiece(selectedPiece, { z: Number(e.target.value) })} style={{ width: "100%", accentColor: COLORS.accent }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
              <span>θ Rotation</span>
              <EditableValue
                value={Math.round((piece.theta || 0) * 180 / Math.PI)}
                suffix="°"
                onChange={(v) => onUpdatePiece(selectedPiece, { theta: Math.max(-Math.PI, Math.min(Math.PI, v * Math.PI / 180)) })}
              />
            </div>
            <input type="range" min={-314} max={314} value={Math.round((piece.theta || 0) * 100)} onChange={(e) => onUpdatePiece(selectedPiece, { theta: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: COLORS.accent }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
              <span>Scale</span>
              <EditableValue value={piece.scale.toFixed(2)} onChange={(v) => onUpdatePiece(selectedPiece, { scale: Math.max(0.2, Math.min(2.0, v)) })} />
            </div>
            <input type="range" min={20} max={200} value={Math.round(piece.scale * 100)} onChange={(e) => onUpdatePiece(selectedPiece, { scale: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: COLORS.accent }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
              <span>Size (cm)</span>
              <EditableValue
                value={(piece.sizeCm || 5).toFixed(1)}
                suffix=" cm"
                onChange={(v) => onUpdatePiece(selectedPiece, { sizeCm: Math.max(0.5, Math.min(50, v)) })}
              />
            </div>
            <input type="range" min={5} max={500} value={Math.round((piece.sizeCm || 5) * 10)} onChange={(e) => onUpdatePiece(selectedPiece, { sizeCm: Number(e.target.value) / 10 })} style={{ width: "100%", accentColor: COLORS.accent }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
              <span>Thickness</span>
              <EditableValue
                value={(piece.thickness || 3).toFixed(1)}
                suffix=" mm"
                onChange={(v) => onUpdatePiece(selectedPiece, { thickness: Math.max(0.5, Math.min(20, v)) })}
              />
            </div>
            <input type="range" min={5} max={200} value={Math.round((piece.thickness || 3) * 10)} onChange={(e) => onUpdatePiece(selectedPiece, { thickness: Number(e.target.value) / 10 })} style={{ width: "100%", accentColor: COLORS.accent }} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: COLORS.textDim, marginBottom: 6 }}>Color</div>
            <div style={{ display: "flex", gap: 6 }}>
              {PIECE_COLORS.map((c, i) => (
                <div key={i} onClick={() => onUpdatePiece(selectedPiece, { color: c })} title={PIECE_COLOR_NAMES[i]} style={{
                  width: 22, height: 22, borderRadius: "50%", background: c, cursor: "pointer",
                  border: piece.color === c ? "2px solid #fff" : `2px solid ${COLORS.panelBorder}`,
                  boxShadow: piece.color === c ? `0 0 6px ${c}60` : "none",
                }} />
              ))}
            </div>
          </div>
          <div style={{ background: COLORS.bg, border: `1px solid ${COLORS.panelBorder}`, padding: 10, marginBottom: 10 }}>
            <div style={{ color: COLORS.accent, fontSize: 8, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>Fabrication Info</div>
            <div style={{ color: COLORS.textDim, fontSize: 9, lineHeight: 1.8 }}>
              <div>Bounding tube: <span style={{ color: COLORS.text }}>{((piece.sizeCm || 5) * unitScale).toFixed(1)} × {((piece.sizeCm || 5) * unitScale).toFixed(1)} cm</span></div>
              <div>Material: <span style={{ color: COLORS.text }}>{((piece.thickness || 3) * unitScale).toFixed(1)} mm</span></div>
              {(() => {
                const fb = getFrameBounds(pieces);
                const sl = getStringLengths(piece, fb.frameY);
                return <>
                  <div>Frame: <span style={{ color: COLORS.text }}>{Math.round(fb.size * unitScale)} × {Math.round(fb.size * unitScale)} mm</span></div>
                  <div>Strings: <span style={{ color: COLORS.orange }}>L ≈ {Math.round(sl.left * unitScale)}mm · R ≈ {Math.round(sl.right * unitScale)}mm</span></div>
                </>;
              })()}
            </div>
          </div>
        </div>
      )}
      <div style={{ padding: "10px 14px", borderTop: `1px solid ${COLORS.panelBorder}`, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button onClick={onAddPiece} style={{ flex: "1 1 0", background: COLORS.accent, color: COLORS.bg, border: "none", padding: "6px 0", fontFamily: "monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>+ Add</button>
        <button onClick={() => onDuplicatePiece(selectedPiece)} style={{ flex: "1 1 0", background: "transparent", color: COLORS.accent, border: `1px solid ${COLORS.accent}`, padding: "6px 0", fontFamily: "monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>Duplicate</button>
        {pieces.length > 1 && (
          <button onClick={() => onRemovePiece(selectedPiece)} style={{ flexBasis: "100%", background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.red}40`, padding: "6px 0", fontFamily: "monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>Delete Piece</button>
        )}
      </div>
    </div>
  );
}

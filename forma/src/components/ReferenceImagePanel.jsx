import { useState, useRef } from "react";
import { COLORS } from "../constants/theme";
import { EditableValue } from "./EditableValue";

export function ReferenceImagePanel({ refImage, onUpdate }) {
  const fileInputRef = useRef(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      onUpdate({ src: ev.target.result, visible: true });
    };
    reader.readAsDataURL(file);
  };

  const btnStyle = {
    background: COLORS.accent, color: COLORS.bg, border: "none",
    padding: "6px 0", fontFamily: "monospace", fontSize: 9, letterSpacing: 1,
    textTransform: "uppercase", cursor: "pointer", width: "100%",
  };

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, fontFamily: "monospace", fontSize: 10 }}>
      <div
        style={{
          padding: "14px 14px 10px", borderBottom: collapsed ? "none" : `1px solid ${COLORS.panelBorder}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer",
        }}
        onClick={() => setCollapsed(prev => !prev)}
      >
        <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 12, fontWeight: 400, letterSpacing: 4, color: COLORS.accent, textTransform: "uppercase" }}>Reference Image</div>
        <span style={{ color: COLORS.textDim, fontSize: 14, lineHeight: 1, userSelect: "none" }}>
          {collapsed ? "▸" : "▾"}
        </span>
      </div>

      {!collapsed && (
        <div style={{ padding: 14 }}>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
          <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} style={btnStyle}>
            {refImage.src ? "Change Image" : "Load Image"}
          </button>

          {refImage.src && (
            <div style={{ marginTop: 10 }}>
              {/* Thumbnail */}
              <div style={{
                width: "100%", height: 60, marginBottom: 10, borderRadius: 2,
                border: `1px solid ${COLORS.panelBorder}`, overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: COLORS.bg,
              }}>
                <img src={refImage.src} alt="ref" style={{ maxWidth: "100%", maxHeight: "100%", opacity: refImage.opacity }} />
              </div>

              {/* Visible toggle */}
              <div
                onClick={() => onUpdate({ visible: !refImage.visible })}
                style={{
                  display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                  color: refImage.visible ? COLORS.text : COLORS.textDim, marginBottom: 10,
                }}
              >
                <div style={{
                  width: 28, height: 14, borderRadius: 7, position: "relative",
                  background: refImage.visible ? COLORS.accent : COLORS.panelBorder,
                  transition: "background 0.2s",
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%", background: "#fff",
                    position: "absolute", top: 2,
                    left: refImage.visible ? 16 : 2,
                    transition: "left 0.2s",
                  }} />
                </div>
                <span style={{ fontSize: 9 }}>Visible</span>
              </div>

              {/* Opacity */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
                  <span>Opacity</span>
                  <EditableValue
                    value={(refImage.opacity * 100).toFixed(0)}
                    suffix="%"
                    onChange={(v) => onUpdate({ opacity: Math.max(0, Math.min(100, v)) / 100 })}
                  />
                </div>
                <input type="range" min={0} max={100} value={Math.round(refImage.opacity * 100)}
                  onChange={(e) => onUpdate({ opacity: Number(e.target.value) / 100 })}
                  style={{ width: "100%", accentColor: COLORS.accent }} />
              </div>

              {/* Scale */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
                  <span>Scale</span>
                  <EditableValue
                    value={((refImage.scale || 1) * 100).toFixed(0)}
                    suffix="%"
                    onChange={(v) => onUpdate({ scale: Math.max(10, Math.min(300, v)) / 100 })}
                  />
                </div>
                <input type="range" min={10} max={300} value={Math.round((refImage.scale || 1) * 100)}
                  onChange={(e) => onUpdate({ scale: Number(e.target.value) / 100 })}
                  style={{ width: "100%", accentColor: COLORS.accent }} />
              </div>

              {/* X Position */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
                  <span>X Offset</span>
                  <EditableValue value={refImage.x || 0} onChange={(v) => onUpdate({ x: Math.round(v) })} />
                </div>
                <input type="range" min={-200} max={200} value={refImage.x || 0}
                  onChange={(e) => onUpdate({ x: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: COLORS.accent }} />
              </div>

              {/* Y Position */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", color: COLORS.textDim, marginBottom: 4 }}>
                  <span>Y Offset</span>
                  <EditableValue value={refImage.y || 0} onChange={(v) => onUpdate({ y: Math.round(v) })} />
                </div>
                <input type="range" min={-200} max={200} value={refImage.y || 0}
                  onChange={(e) => onUpdate({ y: Number(e.target.value) })}
                  style={{ width: "100%", accentColor: COLORS.accent }} />
              </div>

              {/* Remove button */}
              <button
                onClick={() => onUpdate({ src: null, visible: false })}
                style={{
                  background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.red}40`,
                  padding: "4px 0", fontFamily: "monospace", fontSize: 8, cursor: "pointer",
                  width: "100%", marginTop: 6, letterSpacing: 1, textTransform: "uppercase",
                }}
              >Remove Image</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
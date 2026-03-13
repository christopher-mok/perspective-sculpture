import { COLORS } from "../constants/theme";

export function ViewportLabel({ label, subtitle }) {
  return (
    <div style={{ position: "absolute", top: 10, left: 12, zIndex: 5, pointerEvents: "none" }}>
      <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 12, fontWeight: 400, letterSpacing: 4, color: COLORS.accent, textTransform: "uppercase" }}>{label}</div>
      {subtitle && <div style={{ fontFamily: "monospace", fontSize: 9, color: COLORS.textDim, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}
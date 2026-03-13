import { useState, useRef, useCallback } from "react";
import { COLORS } from "../constants/theme";
import { generateSplineCurve } from "../utils/geometry";
import { getCanvasMousePos } from "../utils/canvas";
import { useResizableCanvas } from "../hooks/useResizableCanvas";
import { ViewportLabel } from "./ViewportLabel";

const GRID_SPACING = 20;
const HANDLE_RADIUS = 5;
const POINT_RADIUS = 8;

export function ShapeEditor({ pieces, selectedPiece, onUpdatePiece }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const piece = pieces[selectedPiece];
  const [dragging, setDragging] = useState(null);
  const [hovering, setHovering] = useState(null);

  const drawFn = useCallback((ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, w, h);

    // Grid
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.5;
    const gridExtent = Math.max(w, h);
    for (let i = -Math.ceil(gridExtent / GRID_SPACING); i <= Math.ceil(gridExtent / GRID_SPACING); i++) {
      const off = i * GRID_SPACING;
      ctx.beginPath(); ctx.moveTo(cx + off, 0); ctx.lineTo(cx + off, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + off); ctx.lineTo(w, cy + off); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.gridLine; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();

    if (!piece) return;
    const cp = piece.controlPoints;
    const sc = piece.scale;
    const n = cp.length;

    // Draw the Bézier curve
    const curve = generateSplineCurve(cp, 20);
    ctx.beginPath();
    curve.forEach((p, i) => {
      const px = cx + p.x * sc, py = cy + p.y * sc;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fillStyle = piece.color + "15"; ctx.fill();
    ctx.strokeStyle = piece.color; ctx.lineWidth = 2; ctx.stroke();

    // Draw handles and control points
    cp.forEach((pt, i) => {
      const px = cx + pt.x * sc, py = cy + pt.y * sc;
      const hInPx = px + (pt.hInX || 0) * sc, hInPy = py + (pt.hInY || 0) * sc;
      const hOutPx = px + (pt.hOutX || 0) * sc, hOutPy = py + (pt.hOutY || 0) * sc;

      // Handle lines
      ctx.strokeStyle = piece.color + "50"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(hInPx, hInPy); ctx.lineTo(px, py); ctx.lineTo(hOutPx, hOutPy); ctx.stroke();

      // Handle In dot
      const hInActive = dragging?.type === "hIn" && dragging.idx === i;
      const hInHover = hovering?.type === "hIn" && hovering.idx === i;
      ctx.beginPath(); ctx.arc(hInPx, hInPy, hInActive ? 6 : hInHover ? 5.5 : HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = hInActive ? "#fff" : hInHover ? piece.color : piece.color + "88";
      ctx.fill();
      ctx.strokeStyle = COLORS.bg; ctx.lineWidth = 1.5; ctx.stroke();

      // Handle Out dot
      const hOutActive = dragging?.type === "hOut" && dragging.idx === i;
      const hOutHover = hovering?.type === "hOut" && hovering.idx === i;
      ctx.beginPath(); ctx.arc(hOutPx, hOutPy, hOutActive ? 6 : hOutHover ? 5.5 : HANDLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = hOutActive ? "#fff" : hOutHover ? piece.color : piece.color + "88";
      ctx.fill();
      ctx.strokeStyle = COLORS.bg; ctx.lineWidth = 1.5; ctx.stroke();

      // Control point
      const ptActive = dragging?.type === "point" && dragging.idx === i;
      const ptHover = hovering?.type === "point" && hovering.idx === i;
      const r = ptActive ? 10 : ptHover ? 9 : POINT_RADIUS;

      if (ptActive || ptHover) {
        ctx.beginPath(); ctx.arc(px, py, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = piece.color + "40"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = ptActive ? "#fff" : ptHover ? piece.color : piece.color + "cc";
      ctx.fill();
      ctx.strokeStyle = COLORS.bg; ctx.lineWidth = 2; ctx.stroke();

      ctx.fillStyle = "#fff"; ctx.font = "10px monospace"; ctx.textAlign = "center";
      ctx.fillText(i, px, py + 4); ctx.textAlign = "left";
    });

    ctx.fillStyle = COLORS.textDim; ctx.font = "9px monospace";
    ctx.fillText(`${cp.length} points · Cubic Bézier · Drag handles for smoothness`, 10, h - 10);
    ctx.fillText(`Scale: ${piece.scale.toFixed(2)}`, 10, h - 24);
  }, [piece, dragging, hovering]);

  useResizableCanvas(canvasRef, drawFn, [drawFn]);

  const findTarget = (mx, my) => {
    if (!piece) return null;
    const sc = piece.scale;
    const cp = piece.controlPoints;
    for (let i = 0; i < cp.length; i++) {
      const pt = cp[i];
      const px = pt.x * sc, py = pt.y * sc;
      const hInPx = px + (pt.hInX || 0) * sc, hInPy = py + (pt.hInY || 0) * sc;
      const hOutPx = px + (pt.hOutX || 0) * sc, hOutPy = py + (pt.hOutY || 0) * sc;
      if ((mx - hInPx) ** 2 + (my - hInPy) ** 2 < 200) return { type: "hIn", idx: i };
      if ((mx - hOutPx) ** 2 + (my - hOutPy) ** 2 < 200) return { type: "hOut", idx: i };
    }
    for (let i = 0; i < cp.length; i++) {
      const dx = mx - cp[i].x * sc, dy = my - cp[i].y * sc;
      if (dx * dx + dy * dy < 350) return { type: "point", idx: i };
    }
    return null;
  };

  const handleMouseDown = (e) => {
    const { x, y } = getCanvasMousePos(e, canvasRef);
    const target = findTarget(x, y);
    if (target) setDragging(target);
  };

  const handleMouseMove = (e) => {
    const { x, y } = getCanvasMousePos(e, canvasRef);
    if (dragging && piece) {
      const sc = piece.scale;
      const idx = dragging.idx;
      const pt = piece.controlPoints[idx];

      if (dragging.type === "point") {
        const newCPs = piece.controlPoints.map((cp, i) =>
          i === idx ? { ...cp, x: x / sc, y: y / sc } : cp
        );
        onUpdatePiece(selectedPiece, { controlPoints: newCPs });
      } else if (dragging.type === "hIn") {
        const hx = x / sc - pt.x;
        const hy = y / sc - pt.y;
        const newCPs = piece.controlPoints.map((cp, i) =>
          i === idx ? { ...cp, hInX: hx, hInY: hy, hOutX: -hx, hOutY: -hy } : cp
        );
        onUpdatePiece(selectedPiece, { controlPoints: newCPs });
      } else if (dragging.type === "hOut") {
        const hx = x / sc - pt.x;
        const hy = y / sc - pt.y;
        const newCPs = piece.controlPoints.map((cp, i) =>
          i === idx ? { ...cp, hOutX: hx, hOutY: hy, hInX: -hx, hInY: -hy } : cp
        );
        onUpdatePiece(selectedPiece, { controlPoints: newCPs });
      }
    } else {
      setHovering(findTarget(x, y));
    }
  };

  const getCursor = () => {
    if (dragging) return "grabbing";
    if (hovering?.type === "hIn" || hovering?.type === "hOut") return "pointer";
    if (hovering?.type === "point") return "grab";
    return "crosshair";
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", height: "100%", background: COLORS.bg, overflow: "hidden" }}>
      <ViewportLabel label="Shape Editor" subtitle={piece ? `Editing ${piece.id} · Drag handles for smoothness` : "No selection"} />
      <canvas ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, cursor: getCursor() }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => { setDragging(null); setHovering(null); }}
      />
    </div>
  );
}
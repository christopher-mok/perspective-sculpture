import { useState, useRef, useCallback } from "react";
import { COLORS } from "../constants/theme";
import { generateSplineCurve } from "../utils/geometry";
import { getBoundingRadius } from "../utils/collision";
import { getCanvasMousePos } from "../utils/canvas";
import { useResizableCanvas } from "../hooks/useResizableCanvas";
import { ViewportLabel } from "./ViewportLabel";

// 1:1 scale to match perspective output exactly
const GS = 1.0;

export function CoordinateGrid({ pieces, selectedPiece, onSelectPiece, onUpdatePiece }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  const drawFn = useCallback((ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h);

    const gridExtent = Math.max(w, h);
    const gridStep = 20;
    for (let off = -Math.ceil(gridExtent / gridStep) * gridStep; off <= gridExtent; off += gridStep) {
      const isAxis = Math.abs(off) < 0.5;
      ctx.strokeStyle = isAxis ? COLORS.gridLine : COLORS.grid;
      ctx.lineWidth = isAxis ? 1 : 0.5;
      ctx.beginPath(); ctx.moveTo(cx + off, 0); ctx.lineTo(cx + off, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, cy + off); ctx.lineTo(w, cy + off); ctx.stroke();
    }
    ctx.fillStyle = COLORS.red; ctx.font = "10px monospace"; ctx.fillText("X →", w - 30, cy - 6);
    ctx.fillStyle = COLORS.green; ctx.fillText("Y ↓", cx + 6, h - 10);

    pieces.forEach((piece, i) => {
      const px = cx + piece.x * GS, py = cy + piece.y * GS;
      const isSel = i === selectedPiece;

      const curve = generateSplineCurve(piece.controlPoints, 8);

      // Compute centroid of the parametric curve in canvas coords
      let centX = 0, centY = 0;
      for (const p of curve) {
        centX += p.x * piece.scale * GS;
        centY += p.y * piece.scale * GS;
      }
      centX = px + centX / curve.length;
      centY = py + centY / curve.length;

      ctx.beginPath();
      curve.forEach((p, j) => {
        const sx = px + p.x * piece.scale * GS;
        const sy = py + p.y * piece.scale * GS;
        j === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
      });
      ctx.closePath();
      ctx.fillStyle = piece.color + (isSel ? "55" : "25"); ctx.fill();
      ctx.strokeStyle = isSel ? "#fff" : piece.color + "80"; ctx.lineWidth = isSel ? 1.5 : 0.8; ctx.stroke();

      // Collision radius indicator for selected piece
      if (isSel) {
        const r = getBoundingRadius(piece) * GS;
        ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.strokeStyle = COLORS.red + "40"; ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
      }

      // Center dot at the curve centroid
      ctx.beginPath(); ctx.arc(centX, centY, 3, 0, Math.PI * 2);
      ctx.fillStyle = isSel ? "#fff" : piece.color; ctx.fill();

      ctx.fillStyle = isSel ? "#fff" : COLORS.textDim;
      ctx.font = `${isSel ? "bold " : ""}8px monospace`; ctx.textAlign = "center";
      ctx.fillText(piece.id, centX, centY - 10); ctx.textAlign = "left";
      if (isSel) { ctx.fillStyle = COLORS.textDim; ctx.font = "8px monospace"; ctx.fillText(`(${piece.x}, ${piece.y})`, centX + 14, centY + 3); }
    });
  }, [pieces, selectedPiece]);

  useResizableCanvas(canvasRef, drawFn, [drawFn]);

  // Compute the curve centroid offset for a piece (in scaled GS units, relative to piece origin)
  const getCentroidOffset = useCallback((piece) => {
    const curve = generateSplineCurve(piece.controlPoints, 8);
    let cx = 0, cy = 0;
    for (const p of curve) {
      cx += p.x * piece.scale * GS;
      cy += p.y * piece.scale * GS;
    }
    return { cx: cx / curve.length, cy: cy / curve.length };
  }, []);

  const dragOffsetRef = useRef({ dx: 0, dy: 0 });

  const handleMouseDown = (e) => {
    const { x, y } = getCanvasMousePos(e, canvasRef);
    for (let i = 0; i < pieces.length; i++) {
      const off = getCentroidOffset(pieces[i]);
      const centX = pieces[i].x * GS + off.cx;
      const centY = pieces[i].y * GS + off.cy;
      const dx = x - centX, dy = y - centY;
      if (dx * dx + dy * dy < 400) {
        onSelectPiece(i);
        // Store offset from mouse to piece origin so dragging moves the origin, not the centroid
        dragOffsetRef.current = { dx: pieces[i].x * GS - x, dy: pieces[i].y * GS - y };
        setDragging(i);
        return;
      }
    }
  };

  const handleMouseMove = (e) => {
    if (dragging === null) return;
    const { x, y } = getCanvasMousePos(e, canvasRef);
    const newX = Math.round((x + dragOffsetRef.current.dx) / GS);
    const newY = Math.round((y + dragOffsetRef.current.dy) / GS);
    onUpdatePiece(dragging, { x: newX, y: newY });
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: COLORS.bg, overflow: "hidden" }}>
      <ViewportLabel label="XY Position Grid" subtitle="Top-down · Drag to reposition" />
      <canvas ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, cursor: dragging !== null ? "grabbing" : "default" }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)} onMouseLeave={() => setDragging(null)} />
    </div>
  );
}
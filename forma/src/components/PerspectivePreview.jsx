import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS, CAMERA } from "../constants/theme";
import { generateSplineCurve } from "../utils/geometry";
import { useResizableCanvas } from "../hooks/useResizableCanvas";
import { ViewportLabel } from "./ViewportLabel";

export function PerspectivePreview({ pieces, refImage, cameraDepth, onCameraDepthChange }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [imageVersion, setImageVersion] = useState(0);
  const depth = cameraDepth || CAMERA.viewerDistance;

  useEffect(() => {
    if (!refImage.src) { imgRef.current = null; return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; setImageVersion(v => v + 1); };
    img.onerror = () => { imgRef.current = null; setImageVersion(v => v + 1); };
    img.src = refImage.src;
  }, [refImage.src]);

  const drawFn = useCallback((ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#080808"; ctx.fillRect(0, 0, w, h);

    // Reference image behind everything
    if (imgRef.current && refImage.visible && imageVersion >= 0) {
      ctx.save();
      ctx.globalAlpha = refImage.opacity;
      const img = imgRef.current;
      const imgAspect = img.width / img.height;
      const vpAspect = w / h;
      const sc = refImage.scale || 1.0;
      let drawW, drawH;
      if (imgAspect > vpAspect) {
        drawW = w * 0.8 * sc;
        drawH = drawW / imgAspect;
      } else {
        drawH = h * 0.8 * sc;
        drawW = drawH * imgAspect;
      }
      const drawX = cx - drawW / 2 + (refImage.x || 0);
      const drawY = cy - drawH / 2 + (refImage.y || 0);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    }

    const grad = ctx.createRadialGradient(cx, cy, 50, cx, cy, Math.max(w, h) * 0.55);
    grad.addColorStop(0, "transparent"); grad.addColorStop(1, "rgba(0,0,0,0.3)");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = COLORS.gridLine; ctx.lineWidth = 0.5; ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(w, cy); ctx.stroke();
    ctx.setLineDash([]);

    const vd = depth;
    const focalPx = CAMERA.focalPixelsForHeight(h);
    const sortedByDepth = [...pieces].sort((a, b) => b.z - a.z);

    sortedByDepth.forEach(piece => {
      const sc = piece.scale;
      const cosT = Math.cos(piece.theta || 0);
      const perspFactor = focalPx / (vd + piece.z);

      const curve = generateSplineCurve(piece.controlPoints, 16);
      ctx.beginPath();
      curve.forEach((p, i) => {
        const px = cx + (piece.x + p.x * sc * cosT) * perspFactor;
        const py = cy + (piece.y + p.y * sc) * perspFactor;
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.fillStyle = piece.color + "cc"; ctx.fill();
      ctx.strokeStyle = piece.color; ctx.lineWidth = 1; ctx.stroke();
    });

    ctx.strokeStyle = COLORS.panelBorder; ctx.lineWidth = 1; ctx.strokeRect(20, 20, w - 40, h - 40);
    const mk = 12;
    [[20,20,1,1],[w-20,20,-1,1],[20,h-20,1,-1],[w-20,h-20,-1,-1]].forEach(([x,y,dx,dy]) => {
      ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+mk*dx,y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x,y+mk*dy); ctx.stroke();
    });
  }, [pieces, refImage, imageVersion, depth]);

  useResizableCanvas(canvasRef, drawFn, [drawFn]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#080808", overflow: "hidden" }}>
      <ViewportLabel label="Perspective Output" subtitle={`Viewer POV · 50mm · ${Math.round(depth)}mm`} />
      <canvas ref={canvasRef} style={{ position: "absolute", top: 0, left: 0 }} />
      <div style={{
        position: "absolute", left: 18, right: 18, bottom: 16,
        display: "flex", alignItems: "center", gap: 10,
        background: "rgba(8,8,8,0.78)", border: `1px solid ${COLORS.panelBorder}`,
        padding: "8px 10px", fontFamily: "monospace",
      }}>
        <span style={{ color: COLORS.textDim, fontSize: 9, letterSpacing: 2, textTransform: "uppercase", flexShrink: 0 }}>Depth</span>
        <input
          type="range"
          min={CAMERA.minViewerDistance}
          max={CAMERA.maxViewerDistance}
          step={10}
          value={Math.round(depth)}
          onChange={(e) => onCameraDepthChange?.(Number(e.target.value))}
          style={{ flex: 1, accentColor: COLORS.accent }}
        />
        <span style={{ color: COLORS.accent, fontSize: 10, minWidth: 54, textAlign: "right" }}>{Math.round(depth)}mm</span>
      </div>
    </div>
  );
}

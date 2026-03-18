import { useState, useRef, useEffect, useCallback } from "react";
import { COLORS } from "../constants/theme";
import { generateSplineCurve } from "../utils/geometry";
import { getFrameBounds, getAttachmentPoints } from "../utils/strings";
import { useResizableCanvas } from "../hooks/useResizableCanvas";
import { ViewportLabel } from "./ViewportLabel";

const SHAPE_SCALE = 1.0;

export function Viewport3D({ pieces, selectedPiece, onSelectPiece }) {
  const canvasRef = useRef(null);
  const [rotation, setRotation] = useState({ rx: 0.4, ry: -0.6 });
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const dragMoved = useRef(false);

  const project3D = useCallback((x, y, z, cx, cy) => {
    const cosRx = Math.cos(rotation.rx), sinRx = Math.sin(rotation.rx);
    const cosRy = Math.cos(rotation.ry), sinRy = Math.sin(rotation.ry);
    let px = x * cosRy - z * sinRy;
    let pz = x * sinRy + z * cosRy;
    let py = y * cosRx - pz * sinRx;
    pz = y * sinRx + pz * cosRx;
    const fov = 600;
    const scale = fov / (fov + pz) * zoom;
    return { sx: cx + pan.x + px * scale, sy: cy + pan.y + py * scale, scale, depth: pz };
  }, [rotation, zoom, pan]);

  const drawFn = useCallback((ctx, w, h) => {
    const cx = w / 2, cy = h / 2;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, w, h);

    // Grid floor
    ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 0.5;
    for (let i = -200; i <= 200; i += 40) {
      const a = project3D(i, 100, -200, cx, cy), b = project3D(i, 100, 300, cx, cy);
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
      const c = project3D(-200, 100, i + 100, cx, cy), d = project3D(200, 100, i + 100, cx, cy);
      ctx.beginPath(); ctx.moveTo(c.sx, c.sy); ctx.lineTo(d.sx, d.sy); ctx.stroke();
    }

    // Axes
    const origin = project3D(0, 0, 0, cx, cy);
    [[project3D(80,0,0,cx,cy), COLORS.red, "X"], [project3D(0,-80,0,cx,cy), COLORS.green, "Y"], [project3D(0,0,80,cx,cy), COLORS.blue, "Z"]].forEach(([end, col, label]) => {
      ctx.beginPath(); ctx.moveTo(origin.sx, origin.sy); ctx.lineTo(end.sx, end.sy);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = col; ctx.font = "10px monospace"; ctx.fillText(label, end.sx + 4, end.sy - 4);
    });

    const sorted = [...pieces].map((p, i) => ({ ...p, idx: i })).sort((a, b) => {
      return project3D(b.x, b.y, b.z, cx, cy).depth - project3D(a.x, a.y, a.z, cx, cy).depth;
    });

    const frameBounds = getFrameBounds(pieces);
    const frameY = frameBounds.frameY;

    sorted.forEach((piece) => {
      // Two strings from frame to piece's top attachment points
      const attach = getAttachmentPoints(piece, SHAPE_SCALE);
      const hangL = project3D(attach.left.x, frameY, attach.left.z, cx, cy);
      const hangR = project3D(attach.right.x, frameY, attach.right.z, cx, cy);
      const attachL = project3D(attach.left.x, attach.left.y, attach.left.z, cx, cy);
      const attachR = project3D(attach.right.x, attach.right.y, attach.right.z, cx, cy);

      ctx.strokeStyle = COLORS.textDim + "40"; ctx.lineWidth = 0.8;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(hangL.sx, hangL.sy); ctx.lineTo(attachL.sx, attachL.sy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(hangR.sx, hangR.sy); ctx.lineTo(attachR.sx, attachR.sy); ctx.stroke();
      ctx.setLineDash([]);

      const curve = generateSplineCurve(piece.controlPoints, 12);
      const cosT = Math.cos(piece.theta || 0);
      const sinT = Math.sin(piece.theta || 0);
      const isSel = piece.idx === selectedPiece;
      const thick = (piece.thickness || 3) * SHAPE_SCALE;

      // Back face (offset by thickness along piece's local normal)
      // The piece's normal in world space is (-sinT, 0, cosT) after Y rotation
      const nxW = -sinT * thick;
      const nzW = cosT * thick;

      ctx.beginPath();
      curve.forEach((p, j) => {
        const lx = p.x * piece.scale * SHAPE_SCALE;
        const ly = p.y * piece.scale * SHAPE_SCALE;
        const worldX = piece.x + lx * cosT + nxW;
        const worldY = piece.y + ly;
        const worldZ = piece.z + lx * sinT + nzW;
        const projected = project3D(worldX, worldY, worldZ, cx, cy);
        j === 0 ? ctx.moveTo(projected.sx, projected.sy) : ctx.lineTo(projected.sx, projected.sy);
      });
      ctx.closePath();
      ctx.fillStyle = piece.color + (isSel ? "20" : "10"); ctx.fill();
      ctx.strokeStyle = (isSel ? "#fff" : piece.color) + "40"; ctx.lineWidth = 0.5; ctx.stroke();

      // Side edges connecting front to back face (every few points)
      const edgeStep = Math.max(1, Math.floor(curve.length / 8));
      ctx.strokeStyle = piece.color + "30"; ctx.lineWidth = 0.5;
      for (let j = 0; j < curve.length; j += edgeStep) {
        const p = curve[j];
        const lx = p.x * piece.scale * SHAPE_SCALE;
        const ly = p.y * piece.scale * SHAPE_SCALE;
        const frontP = project3D(piece.x + lx * cosT, piece.y + ly, piece.z + lx * sinT, cx, cy);
        const backP = project3D(piece.x + lx * cosT + nxW, piece.y + ly, piece.z + lx * sinT + nzW, cx, cy);
        ctx.beginPath(); ctx.moveTo(frontP.sx, frontP.sy); ctx.lineTo(backP.sx, backP.sy); ctx.stroke();
      }

      // Front face
      ctx.beginPath();
      curve.forEach((p, j) => {
        const lx = p.x * piece.scale * SHAPE_SCALE;
        const ly = p.y * piece.scale * SHAPE_SCALE;
        const worldX = piece.x + lx * cosT;
        const worldY = piece.y + ly;
        const worldZ = piece.z + lx * sinT;
        const projected = project3D(worldX, worldY, worldZ, cx, cy);
        j === 0 ? ctx.moveTo(projected.sx, projected.sy) : ctx.lineTo(projected.sx, projected.sy);
      });
      ctx.closePath();
      ctx.fillStyle = piece.color + (isSel ? "60" : "30"); ctx.fill();
      ctx.strokeStyle = isSel ? "#fff" : piece.color; ctx.lineWidth = isSel ? 2 : 1; ctx.stroke();

      ctx.fillStyle = isSel ? "#fff" : COLORS.textDim;
      ctx.font = `${isSel ? "bold " : ""}9px monospace`;
      const labelPos = project3D(piece.x, piece.y, piece.z, cx, cy);
      ctx.fillText(piece.id, labelPos.sx + 10, labelPos.sy - 8);
    });

    // Square frame
    const half = frameBounds.size / 2;
    const fcx = frameBounds.centerX, fcz = frameBounds.centerZ;
    const fc = [
      [fcx - half, frameY, fcz - half],
      [fcx + half, frameY, fcz - half],
      [fcx + half, frameY, fcz + half],
      [fcx - half, frameY, fcz + half],
    ];
    ctx.beginPath();
    fc.forEach((c, i) => { const p = project3D(c[0],c[1],c[2],cx,cy); i===0?ctx.moveTo(p.sx,p.sy):ctx.lineTo(p.sx,p.sy); });
    ctx.closePath(); ctx.strokeStyle = COLORS.accentDim + "60"; ctx.lineWidth = 1; ctx.stroke();

    // Frame size label
    ctx.fillStyle = COLORS.accentDim; ctx.font = "9px monospace";
    const frameLabelPos = project3D(fcx + half, frameY, fcz - half, cx, cy);
    ctx.fillText(`${Math.round(frameBounds.size)}mm`, frameLabelPos.sx + 4, frameLabelPos.sy - 4);

    ctx.fillStyle = COLORS.textDim; ctx.font = "9px monospace";
    ctx.fillText(`Zoom: ${(zoom * 100).toFixed(0)}%`, 10, h - 10);
  }, [pieces, selectedPiece, rotation, zoom, pan, project3D]);

  useResizableCanvas(canvasRef, drawFn, [drawFn]);

  const handleMouseDown = (e) => {
    if (e.shiftKey) {
      setIsPanning(true);
    } else {
      setIsDragging(true);
    }
    dragMoved.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (!isDragging && !isPanning) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) dragMoved.current = true;

    if (isPanning) {
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
    } else {
      setRotation(prev => ({ rx: prev.rx + dy * 0.005, ry: prev.ry + dx * 0.005 }));
    }
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e) => {
    setIsDragging(false);
    setIsPanning(false);
    if (!dragMoved.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = rect.width / 2, cy = rect.height / 2;
      for (let i = 0; i < pieces.length; i++) {
        const p = project3D(pieces[i].x, pieces[i].y, pieces[i].z, cx, cy);
        if ((mx - p.sx) ** 2 + (my - p.sy) ** 2 < 400) { onSelectPiece(i); return; }
      }
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.2, Math.min(5.0, prev * delta)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: COLORS.bg, overflow: "hidden" }}>
      <ViewportLabel label="3D Sculpture View" subtitle={`Orbit · Shift+Drag: Pan · Scroll: Zoom`} />
      <canvas ref={canvasRef}
        style={{ position: "absolute", top: 0, left: 0, cursor: isPanning ? "move" : isDragging ? "grabbing" : "grab" }}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp} onMouseLeave={() => { setIsDragging(false); setIsPanning(false); }} />
    </div>
  );
}
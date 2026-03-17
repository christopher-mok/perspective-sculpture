// Generate an SVG file for laser cutting — all pieces laid out flat in a 2D grid.
// Uses native cubic Bézier paths (not polyline approximations) for smooth cuts.

import { getFrameBounds, getStringLengths } from "./strings";

const GRID_PADDING = 10; // mm between pieces
const LABEL_OFFSET = 4;  // mm below piece for label

// Build an SVG cubic Bézier path string from control points, scaled to mm.
function buildBezierPath(controlPoints, scaleFactor) {
  const n = controlPoints.length;
  if (n < 2) return "";

  const s = scaleFactor;
  const first = controlPoints[0];
  let d = `M ${(first.x * s).toFixed(3)} ${(first.y * s).toFixed(3)}`;

  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[i];
    const p1 = controlPoints[(i + 1) % n];
    const cp1x = (p0.x + (p0.hOutX || 0)) * s;
    const cp1y = (p0.y + (p0.hOutY || 0)) * s;
    const cp2x = (p1.x + (p1.hInX || 0)) * s;
    const cp2y = (p1.y + (p1.hInY || 0)) * s;
    const ex = p1.x * s;
    const ey = p1.y * s;
    d += ` C ${cp1x.toFixed(3)} ${cp1y.toFixed(3)}, ${cp2x.toFixed(3)} ${cp2y.toFixed(3)}, ${ex.toFixed(3)} ${ey.toFixed(3)}`;
  }
  d += " Z";
  return d;
}

// Compute bounding box of a scaled path.
function getPathBounds(controlPoints, scaleFactor, samplesPerSegment = 32) {
  const n = controlPoints.length;
  if (n < 2) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  const s = scaleFactor;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[i];
    const p1 = controlPoints[(i + 1) % n];
    const ax = p0.x * s, ay = p0.y * s;
    const bx = (p0.x + (p0.hOutX || 0)) * s, by = (p0.y + (p0.hOutY || 0)) * s;
    const cx = (p1.x + (p1.hInX || 0)) * s, cy = (p1.y + (p1.hInY || 0)) * s;
    const dx = p1.x * s, dy = p1.y * s;

    for (let t = 0; t <= samplesPerSegment; t++) {
      const u = t / samplesPerSegment;
      const mu = 1 - u, mu2 = mu * mu, mu3 = mu2 * mu;
      const u2 = u * u, u3 = u2 * u;
      const x = mu3 * ax + 3 * mu2 * u * bx + 3 * mu * u2 * cx + u3 * dx;
      const y = mu3 * ay + 3 * mu2 * u * by + 3 * mu * u2 * cy + u3 * dy;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

// Generate the full SVG string for laser cutting.
export function generateLaserCutSVG(pieces) {
  if (pieces.length === 0) return "";

  // Compute frame bounds and string lengths for each piece
  const fb = getFrameBounds(pieces);
  const stringData = pieces.map(p => getStringLengths(p, fb.frameY));

  // For each piece, compute the scale factor that maps control-point units to mm.
  // Control points have default radius ~40, so raw bounding is ~80 units across.
  // We scale so the bounding box width = sizeCm * 10 mm.
  const pieceData = pieces.map((piece, idx) => {
    // First measure raw bounds at scale=1 to find the natural size
    const rawBounds = getPathBounds(piece.controlPoints, 1);
    const rawWidth = rawBounds.maxX - rawBounds.minX;
    const rawHeight = rawBounds.maxY - rawBounds.minY;
    const rawMax = Math.max(rawWidth, rawHeight) || 1;

    // Target physical size in mm, scaled by piece.scale
    const targetMm = (piece.sizeCm || 5) * 10 * piece.scale;
    const scaleFactor = targetMm / rawMax;

    const bounds = getPathBounds(piece.controlPoints, scaleFactor);
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const pathD = buildBezierPath(piece.controlPoints, scaleFactor);

    return {
      id: piece.id,
      color: piece.color,
      pathD,
      bounds,
      width: w,
      height: h,
      scaleFactor,
      strings: stringData[idx],
    };
  });

  // Lay out in a grid — try to make it roughly square
  const cols = Math.ceil(Math.sqrt(pieceData.length));
  const rows = Math.ceil(pieceData.length / cols);

  // Compute column widths and row heights
  const colWidths = new Array(cols).fill(0);
  const rowHeights = new Array(rows).fill(0);
  pieceData.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], p.width);
    rowHeights[row] = Math.max(rowHeights[row], p.height);
  });

  // Compute cell positions
  const colX = [0];
  for (let c = 1; c < cols; c++) colX.push(colX[c - 1] + colWidths[c - 1] + GRID_PADDING);
  const rowY = [0];
  for (let r = 1; r < rows; r++) rowY.push(rowY[r - 1] + rowHeights[r - 1] + GRID_PADDING + LABEL_OFFSET);

  const totalW = colX[cols - 1] + colWidths[cols - 1] + GRID_PADDING * 2;
  const totalH = rowY[rows - 1] + rowHeights[rows - 1] + GRID_PADDING * 2 + LABEL_OFFSET;

  // Build SVG
  let paths = "";
  let labels = "";

  pieceData.forEach((p, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Center piece in its cell
    const cellCx = colX[col] + colWidths[col] / 2 + GRID_PADDING;
    const cellCy = rowY[row] + rowHeights[row] / 2 + GRID_PADDING;
    const pieceCx = (p.bounds.minX + p.bounds.maxX) / 2;
    const pieceCy = (p.bounds.minY + p.bounds.maxY) / 2;
    const tx = cellCx - pieceCx;
    const ty = cellCy - pieceCy;

    paths += `  <path d="${p.pathD}" transform="translate(${tx.toFixed(3)}, ${ty.toFixed(3)})" fill="none" stroke="${p.color}" stroke-width="0.2" />\n`;

    // Label below piece
    const labelX = cellCx;
    const labelY = cellCy + p.height / 2 + LABEL_OFFSET;
    labels += `  <text x="${labelX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-family="monospace" font-size="3" fill="${p.color}">${p.id} — ${((p.width).toFixed(1))}×${((p.height).toFixed(1))}mm — strings: L${p.strings.left}mm R${p.strings.right}mm</text>\n`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${totalW.toFixed(1)}mm" height="${totalH.toFixed(1)}mm" viewBox="0 0 ${totalW.toFixed(1)} ${totalH.toFixed(1)}">
  <title>FORMA Laser Cut Layout</title>
  <desc>Generated by FORMA — ${pieces.length} pieces</desc>
${paths}${labels}</svg>`;
}

// Trigger a file download in the browser.
export function downloadSVG(svgString, filename = "forma-lasercut.svg") {
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
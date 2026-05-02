import { generateSplineCurve } from "./geometry";
import { getBoundingRadius } from "./collision";

// Minimum clearance from the top of the highest piece to the grid frame
const MIN_CLEARANCE = 30;
// Padding around pieces for the frame edges
const FRAME_PADDING = 30;
// Default grid size: 12 × 12 inches = 30.48 cm = 304.8 mm
const DEFAULT_GRID_SIZE = 304.8;

function getRawXZBounds(pieces) {
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of pieces) {
    const r = getBoundingRadius(p);
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minZ = Math.min(minZ, p.z - r);
    maxZ = Math.max(maxZ, p.z + r);
  }

  const extentX = maxX - minX;
  const extentZ = maxZ - minZ;
  const size = Math.max(extentX, extentZ);

  return { minX, maxX, minZ, maxZ, size };
}

function getPaddedXZBounds(pieces) {
  const raw = getRawXZBounds(pieces);
  return {
    minX: raw.minX - FRAME_PADDING,
    maxX: raw.maxX + FRAME_PADDING,
    minZ: raw.minZ - FRAME_PADDING,
    maxZ: raw.maxZ + FRAME_PADDING,
    size: raw.size + FRAME_PADDING * 2,
  };
}

// Compute the frame Y position (the horizontal grid above all pieces).
// Measures from the actual top of each piece's shape, not just piece.y.
export function getFrameY(pieces) {
  if (pieces.length === 0) return -MIN_CLEARANCE;
  let topmost = Infinity;
  for (const p of pieces) {
    const curve = generateSplineCurve(p.controlPoints, 8);
    for (const pt of curve) {
      const worldY = p.y + pt.y * p.scale;
      if (worldY < topmost) topmost = worldY;
    }
  }
  return topmost - MIN_CLEARANCE;
}

// Compute the square frame bounds that contain all pieces.
// Returns { centerX, centerZ, size, frameY } where size is the side length.
// The frame is always square, sized to the larger of the X or Z extent.
export function getFrameBounds(pieces) {
  const frameY = getFrameY(pieces);

  if (pieces.length === 0) {
    return { centerX: 0, centerZ: 150, size: DEFAULT_GRID_SIZE, frameY };
  }

  const bounds = getPaddedXZBounds(pieces);
  // Make it square using the padded footprint of all pieces.
  const size = bounds.size;

  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;

  return { centerX, centerZ, size, frameY };
}

// Compute the raw square footprint in XZ, including padding, without
// enforcing the default minimum frame size.
export function getFrameFootprintSize(pieces) {
  if (pieces.length === 0) return DEFAULT_GRID_SIZE;
  return getPaddedXZBounds(pieces).size;
}

// Compute the raw square content footprint in XZ (no frame padding).
export function getFrameContentSize(pieces) {
  if (pieces.length === 0) return DEFAULT_GRID_SIZE;
  return getRawXZBounds(pieces).size;
}

export function getFramePadding() {
  return FRAME_PADDING;
}

// Find the topmost (minimum) y on the shape curve at a given x, by interpolating
// between consecutive sampled points that straddle targetX.
function findTopYAtX(curve, sc, targetX) {
  let bestY = Infinity;
  const n = curve.length;
  for (let i = 0; i < n; i++) {
    const ax = curve[i].x * sc;
    const bx = curve[(i + 1) % n].x * sc;
    const ay = curve[i].y * sc;
    const by = curve[(i + 1) % n].y * sc;

    if ((ax <= targetX && targetX <= bx) || (bx <= targetX && targetX <= ax)) {
      if (Math.abs(bx - ax) < 1e-6) {
        bestY = Math.min(bestY, ay, by);
      } else {
        const t = (targetX - ax) / (bx - ax);
        const y = ay + t * (by - ay);
        if (y < bestY) bestY = y;
      }
    }
  }
  return bestY;
}

function getPolygonCentroid(curve, sc) {
  const points = curve.map((p) => ({ x: p.x * sc, y: p.y * sc }));
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    area += cross;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }
  if (Math.abs(area) < 1e-6) {
    return { x: points[0].x, y: points[0].y };
  }
  const factor = 1 / (3 * area);
  return { x: cx * factor, y: cy * factor };
}

function lineYAtX(x, x1, y1, x2, y2) {
  if (Math.abs(x2 - x1) < 1e-6) return Math.min(y1, y2);
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

function isLineAboveCentroid(leftX, leftY, rightX, rightY, centroid) {
  const lineY = lineYAtX(centroid.x, leftX, leftY, rightX, rightY);
  return centroid.y > lineY;
}

function _selectAttachmentXs(curve, sc) {
  const points = curve.map((p) => ({ x: p.x * sc, y: p.y * sc }));
  const centerX = points.reduce((sum, pt) => sum + pt.x, 0) / points.length;
  const centroid = getPolygonCentroid(curve, sc);

  let minLocalY = Infinity;
  let maxLocalY = -Infinity;
  for (const pt of points) {
    if (pt.y < minLocalY) minLocalY = pt.y;
    if (pt.y > maxLocalY) maxLocalY = pt.y;
  }

  const height = maxLocalY - minLocalY;
  const topThreshold = minLocalY + height * 0.4;
  const topPoints = points.filter((pt) => pt.y <= topThreshold);

  const minSeparation = Math.max(6, (Math.max(...points.map((pt) => pt.x)) - Math.min(...points.map((pt) => pt.x))) * 0.15);
  let best = null;
  let fallback = null;

  const leftCandidates = topPoints.filter((pt) => pt.x <= centroid.x);
  const rightCandidates = topPoints.filter((pt) => pt.x >= centroid.x);

  if (leftCandidates.length > 0 && rightCandidates.length > 0) {
    for (const left of leftCandidates) {
      for (const right of rightCandidates) {
        if (right.x - left.x < minSeparation) continue;
        const midX = (left.x + right.x) / 2;
        const slope = Math.abs(right.y - left.y) / Math.max(Math.abs(right.x - left.x), 1e-6);
        const score = Math.abs(midX - centroid.x) + slope * 20;
        if (!best || score < best.score) {
          best = { leftX: left.x, rightX: right.x, score };
        }
      }
    }
  }

  if (best) {
    return { leftX: best.leftX, rightX: best.rightX };
  }

  // Fallback: choose a top-region pair while still preferring the centroid line.
  const thresholds = [0.2, 0.3, 0.5];
  for (const fraction of thresholds) {
    const threshold = minLocalY + height * fraction;
    const regionPoints = points.filter((pt) => pt.y <= threshold);
    const leftTop = regionPoints.filter((pt) => pt.x < centerX);
    const rightTop = regionPoints.filter((pt) => pt.x >= centerX);

    let leftX;
    let rightX;
    if (leftTop.length > 0 && rightTop.length > 0) {
      leftX = Math.max(...leftTop.map((pt) => pt.x));
      rightX = Math.min(...rightTop.map((pt) => pt.x));
    } else {
      const xs = regionPoints.length > 0 ? regionPoints.map((pt) => pt.x) : points.map((pt) => pt.x);
      leftX = Math.min(...xs);
      rightX = Math.max(...xs);
    }

    if (rightX - leftX >= minSeparation) {
      fallback = { leftX, rightX };
      break;
    }
  }

  let leftX = fallback?.leftX ?? points[0].x;
  let rightX = fallback?.rightX ?? points[points.length - 1].x;

  if (rightX - leftX < minSeparation) {
    const allX = points.map((pt) => pt.x).sort((a, b) => a - b);
    leftX = allX[0];
    rightX = allX[allX.length - 1];
    if (rightX - leftX < minSeparation && allX.length >= 2) {
      leftX = allX[0];
      rightX = allX[Math.min(allX.length - 1, 1)];
    }
  }

  if (leftX > rightX) {
    const xs = points.map((pt) => pt.x).sort((a, b) => a - b);
    leftX = xs[0];
    rightX = xs[xs.length - 1];
  }

  return { leftX, rightX };
}

// Compute the two top attachment points for a piece's strings.
// Returns { left: {x,y,z}, right: {x,y,z} } in world coordinates.
// The y of each attachment point is the actual contact point where a vertical
// string meets the top of the shape at that string's x position.
export function getAttachmentPoints(piece, shapeScale = 1.0) {
  // Use higher sample count for accurate contact-point interpolation
  const curve = generateSplineCurve(piece.controlPoints, 32);
  const sc = piece.scale * shapeScale;
  const { leftX, rightX } = _selectAttachmentXs(curve, sc);

  let minLocalY = Infinity;
  for (const p of curve) {
    const ly = p.y * sc;
    if (ly < minLocalY) minLocalY = ly;
  }

  const leftContactY = findTopYAtX(curve, sc, leftX);
  const rightContactY = findTopYAtX(curve, sc, rightX);

  const leftY = leftContactY < Infinity ? leftContactY : minLocalY;
  const rightY = rightContactY < Infinity ? rightContactY : minLocalY;

  const cosT = Math.cos(piece.theta || 0);
  const sinT = Math.sin(piece.theta || 0);

  return {
    left: {
      x: piece.x + leftX * cosT,
      y: piece.y + leftY,
      z: piece.z + leftX * sinT,
    },
    right: {
      x: piece.x + rightX * cosT,
      y: piece.y + rightY,
      z: piece.z + rightX * sinT,
    },
  };
}

// Returns string contact points in raw control-point coordinates (no piece.scale applied).
// Used by SVG export to place contact markers at the correct position on the shape.
export function getLocalContactPoints(controlPoints) {
  const curve = generateSplineCurve(controlPoints, 32);
  const { leftX, rightX } = _selectAttachmentXs(curve, 1);

  let minLocalY = Infinity;
  for (const p of curve) {
    if (p.y < minLocalY) minLocalY = p.y;
  }

  const leftY = findTopYAtX(curve, 1, leftX);
  const rightY = findTopYAtX(curve, 1, rightX);

  return {
    leftX,
    leftY: leftY < Infinity ? leftY : minLocalY,
    rightX,
    rightY: rightY < Infinity ? rightY : minLocalY,
  };
}

function dist3D(ax, ay, az, bx, by, bz) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
}

// Compute the two string lengths for a piece.
// Each string goes from the frame (at frameY, directly above the attachment point's XZ) down to the attachment point.
export function getStringLengths(piece, frameY, shapeScale = 1.0) {
  const { left, right } = getAttachmentPoints(piece, shapeScale);
  return {
    left: Math.round(dist3D(left.x, frameY, left.z, left.x, left.y, left.z)),
    right: Math.round(dist3D(right.x, frameY, right.z, right.x, right.y, right.z)),
  };
}

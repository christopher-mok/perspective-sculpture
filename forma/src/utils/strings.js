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

// Compute the two top attachment points for a piece's strings.
// Returns { left: {x,y,z}, right: {x,y,z} } in world coordinates.
// The y of each attachment point is the actual contact point where a vertical
// string meets the top of the shape at that string's x position.
export function getAttachmentPoints(piece, shapeScale = 1.0) {
  // Use higher sample count for accurate contact-point interpolation
  const curve = generateSplineCurve(piece.controlPoints, 32);
  const sc = piece.scale * shapeScale;

  let minLocalY = Infinity;
  let maxLocalY = -Infinity;
  for (const p of curve) {
    const ly = p.y * sc;
    if (ly < minLocalY) minLocalY = ly;
    if (ly > maxLocalY) maxLocalY = ly;
  }
  const shapeHeight = maxLocalY - minLocalY;
  const topThreshold = minLocalY + shapeHeight * 0.2;

  let minX = Infinity, maxX = -Infinity;
  for (const p of curve) {
    const ly = p.y * sc;
    if (ly <= topThreshold) {
      const lx = p.x * sc;
      if (lx < minX) minX = lx;
      if (lx > maxX) maxX = lx;
    }
  }

  const spread = maxX - minX;
  const leftX = minX + spread * 0.25;
  const rightX = maxX - spread * 0.25;

  // Find the actual contact y at each string's x position
  const leftContactY = findTopYAtX(curve, sc, leftX);
  const rightContactY = findTopYAtX(curve, sc, rightX);

  // Fall back to global min if interpolation finds nothing (shouldn't happen)
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

  let minLocalY = Infinity;
  let maxLocalY = -Infinity;
  for (const p of curve) {
    if (p.y < minLocalY) minLocalY = p.y;
    if (p.y > maxLocalY) maxLocalY = p.y;
  }
  const shapeHeight = maxLocalY - minLocalY;
  const topThreshold = minLocalY + shapeHeight * 0.2;

  let minX = Infinity, maxX = -Infinity;
  for (const p of curve) {
    if (p.y <= topThreshold) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
    }
  }

  const spread = maxX - minX;
  const leftX = minX + spread * 0.25;
  const rightX = maxX - spread * 0.25;

  const leftY = findTopYAtX(curve, 1, leftX);
  const rightY = findTopYAtX(curve, 1, rightX);

  return {
    leftX, leftY: leftY < Infinity ? leftY : minLocalY,
    rightX, rightY: rightY < Infinity ? rightY : minLocalY,
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

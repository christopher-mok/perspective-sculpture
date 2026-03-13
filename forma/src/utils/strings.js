import { generateSplineCurve } from "./geometry";
import { getBoundingRadius } from "./collision";

// The frame floats a fixed margin above the topmost piece.
const FRAME_MARGIN = 80;
// Padding around pieces for the frame edges
const FRAME_PADDING = 30;

// Compute the frame Y position (the horizontal grid above all pieces).
export function getFrameY(pieces) {
  if (pieces.length === 0) return -FRAME_MARGIN;
  const minY = Math.min(...pieces.map(p => p.y));
  return minY - FRAME_MARGIN;
}

// Compute the square frame bounds that contain all pieces.
// Returns { centerX, centerZ, size, frameY } where size is the side length.
// The frame is always square, sized to the larger of the X or Z extent.
export function getFrameBounds(pieces) {
  const frameY = getFrameY(pieces);

  if (pieces.length === 0) {
    return { centerX: 0, centerZ: 150, size: 200, frameY };
  }

  // Compute XZ bounding box including each piece's shape radius
  let minX = Infinity, maxX = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of pieces) {
    const r = getBoundingRadius(p);
    minX = Math.min(minX, p.x - r);
    maxX = Math.max(maxX, p.x + r);
    minZ = Math.min(minZ, p.z - r);
    maxZ = Math.max(maxZ, p.z + r);
  }

  // Add padding
  minX -= FRAME_PADDING;
  maxX += FRAME_PADDING;
  minZ -= FRAME_PADDING;
  maxZ += FRAME_PADDING;

  // Make it square — use the larger dimension
  const extentX = maxX - minX;
  const extentZ = maxZ - minZ;
  const size = Math.max(extentX, extentZ);

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  return { centerX, centerZ, size, frameY };
}

// Compute the two top attachment points for a piece's strings.
// Returns { left: {x,y,z}, right: {x,y,z} } in world coordinates.
export function getAttachmentPoints(piece, shapeScale = 0.5) {
  const curve = generateSplineCurve(piece.controlPoints, 8);
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

  const cosT = Math.cos(piece.theta || 0);
  const sinT = Math.sin(piece.theta || 0);

  return {
    left: {
      x: piece.x + leftX * cosT,
      y: piece.y + minLocalY,
      z: piece.z + leftX * sinT,
    },
    right: {
      x: piece.x + rightX * cosT,
      y: piece.y + minLocalY,
      z: piece.z + rightX * sinT,
    },
  };
}

function dist3D(ax, ay, az, bx, by, bz) {
  return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2);
}

// Compute the two string lengths for a piece.
// Each string goes from the frame (at frameY, directly above the attachment point's XZ) down to the attachment point.
export function getStringLengths(piece, frameY, shapeScale = 0.5) {
  const { left, right } = getAttachmentPoints(piece, shapeScale);
  return {
    left: Math.round(dist3D(left.x, frameY, left.z, left.x, left.y, left.z)),
    right: Math.round(dist3D(right.x, frameY, right.z, right.x, right.y, right.z)),
  };
}
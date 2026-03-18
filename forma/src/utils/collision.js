import { generateSplineCurve } from "./geometry";

// Compute the bounding radius of a piece's 2D shape from its center (0,0)
export function getBoundingRadius(piece) {
  const curve = generateSplineCurve(piece.controlPoints, 8);
  let maxR2 = 0;
  for (const p of curve) {
    const r2 = (p.x * piece.scale) ** 2 + (p.y * piece.scale) ** 2;
    if (r2 > maxR2) maxR2 = r2;
  }
  return Math.sqrt(maxR2);
}

// Check if two flat pieces collide.
// Pieces are thin 2D shapes — check XY overlap (shape radii) AND Z overlap (thickness) separately.
function piecesCollide(a, b) {
  const ra = getBoundingRadius(a);
  const rb = getBoundingRadius(b);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const xyDist2 = dx * dx + dy * dy;
  const minXY = ra + rb;
  if (xyDist2 >= minXY * minXY) return false;

  const ta = (a.thickness || 2) / 2;
  const tb = (b.thickness || 2) / 2;
  const zGap = Math.abs(a.z - b.z);
  return zGap < ta + tb + ra + rb;
}

// Resolve position for a piece at `movingIndex` with proposed updates.
// Returns adjusted updates that avoid collision with all other pieces.
// Uses separate XY (shape radius) and Z (thickness) checks for flat pieces.
export function resolveCollisions(pieces, movingIndex, updates) {
  const moving = { ...pieces[movingIndex], ...updates };
  const ra = getBoundingRadius(moving);

  const hasX = "x" in updates;
  const hasY = "y" in updates;
  const hasZ = "z" in updates;

  let { x, y, z } = moving;
  for (let iter = 0; iter < 5; iter++) {
    let resolved = true;
    for (let i = 0; i < pieces.length; i++) {
      if (i === movingIndex) continue;
      const other = pieces[i];
      const rb = getBoundingRadius(other);
      const minXY = ra + rb;

      const dx = x - other.x;
      const dy = y - other.y;
      const xyDist2 = dx * dx + dy * dy;

      const ta = (moving.thickness || 2) / 2;
      const tb = (other.thickness || 2) / 2;
      const dz = z - other.z;
      const minZ = ta + tb;

      // Only collide if overlapping in BOTH XY and Z
      const xyOverlap = xyDist2 < minXY * minXY;
      const zOverlap = Math.abs(dz) < minZ;
      if (!xyOverlap || !zOverlap) continue;

      resolved = false;
      if (hasX || hasY) {
        const xyDist = Math.sqrt(xyDist2);
        if (xyDist < 0.01) {
          if (hasX) x += minXY;
          else y += minXY;
        } else {
          const push = minXY - xyDist;
          if (hasX) x += (dx / xyDist) * push;
          if (hasY) y += (dy / xyDist) * push;
        }
      }
      if (hasZ) {
        const push = minZ - Math.abs(dz);
        z += (dz >= 0 ? 1 : -1) * push;
      }
    }
    if (resolved) break;
  }

  const result = { ...updates };
  if (hasX) result.x = Math.round(x);
  if (hasY) result.y = Math.round(y);
  if (hasZ) result.z = Math.round(z);
  return result;
}
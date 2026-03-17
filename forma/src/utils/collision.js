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

// Check if two pieces collide in 3D space.
// Each piece is a flat shape at (x, y, z) with a bounding radius and thickness along its local Z.
// We use bounding spheres: radius = max(shapeRadius, thickness/2) for a conservative check.
function piecesCollide(a, b) {
  const ra = getBoundingRadius(a);
  const rb = getBoundingRadius(b);
  const ta = (a.thickness || 2) / 2;
  const tb = (b.thickness || 2) / 2;
  // Effective collision radius: shape radius in XY, plus half-thickness for Z extent
  const boundA = Math.sqrt(ra * ra + ta * ta);
  const boundB = Math.sqrt(rb * rb + tb * tb);
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const dist2 = dx * dx + dy * dy + dz * dz;
  const minDist = boundA + boundB;
  return dist2 < minDist * minDist;
}

// Resolve position for a piece at `movingIndex` with proposed updates.
// Returns adjusted updates that avoid collision with all other pieces.
// Strategy: if colliding, push the moved piece away from the collider along the line between centers.
export function resolveCollisions(pieces, movingIndex, updates) {
  const moving = { ...pieces[movingIndex], ...updates };
  const ra = getBoundingRadius(moving);
  const ta = (moving.thickness || 2) / 2;
  const boundA = Math.sqrt(ra * ra + ta * ta);

  const hasX = "x" in updates;
  const hasY = "y" in updates;
  const hasZ = "z" in updates;

  let { x, y, z } = moving;
  // Iterate a few times to resolve cascading overlaps
  for (let iter = 0; iter < 5; iter++) {
    let resolved = true;
    for (let i = 0; i < pieces.length; i++) {
      if (i === movingIndex) continue;
      const other = pieces[i];
      const rb = getBoundingRadius(other);
      const tb = (other.thickness || 2) / 2;
      const boundB = Math.sqrt(rb * rb + tb * tb);
      const minDist = boundA + boundB;

      const dx = x - other.x;
      const dy = y - other.y;
      const dz = z - other.z;
      const dist2 = dx * dx + dy * dy + dz * dz;

      if (dist2 < minDist * minDist) {
        resolved = false;
        const dist = Math.sqrt(dist2);
        if (dist < 0.01) {
          // Pieces are at the same position — push along the axes being updated
          if (hasX) x += minDist;
          else if (hasY) y += minDist;
          else if (hasZ) z += minDist;
        } else {
          // Push only along the axes being updated
          const pushDist = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          if (hasX) x += nx * pushDist;
          if (hasY) y += ny * pushDist;
          if (hasZ) z += nz * pushDist;
        }
      }
    }
    if (resolved) break;
  }

  // Only include axes that were in the original updates
  const result = { ...updates };
  if (hasX) result.x = Math.round(x);
  if (hasY) result.y = Math.round(y);
  if (hasZ) result.z = Math.round(z);
  return result;
}
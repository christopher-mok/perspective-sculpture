export function cubicBezierPoint(p0, cp1, cp2, p1, t) {
  const mt = 1 - t, mt2 = mt * mt, mt3 = mt2 * mt;
  const t2 = t * t, t3 = t2 * t;
  return {
    x: mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x,
    y: mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y,
  };
}

// Generate a closed Bézier curve from control points with handles
// Each control point: { x, y, hInX, hInY, hOutX, hOutY }
// hIn/hOut are offsets from the point for the in/out tangent handles
export function generateSplineCurve(controlPoints, samplesPerSegment = 16) {
  const n = controlPoints.length;
  if (n < 2) return controlPoints.map(p => ({ x: p.x, y: p.y }));
  const curve = [];
  for (let i = 0; i < n; i++) {
    const p0 = controlPoints[i];
    const p1 = controlPoints[(i + 1) % n];
    const cp1 = { x: p0.x + (p0.hOutX || 0), y: p0.y + (p0.hOutY || 0) };
    const cp2 = { x: p1.x + (p1.hInX || 0), y: p1.y + (p1.hInY || 0) };
    for (let s = 0; s < samplesPerSegment; s++) {
      curve.push(cubicBezierPoint(p0, cp1, cp2, p1, s / samplesPerSegment));
    }
  }
  return curve;
}

// Generate circle control points with smooth Bézier handles
export function circlePoints(r = 40, n = 5) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    const ax = Math.cos(a), ay = Math.sin(a);
    const tx = -ay, ty = ax;
    const handleLen = r * Math.sin(Math.PI / n) * 1.33;
    return {
      x: ax * r, y: ay * r,
      hInX: -tx * handleLen, hInY: -ty * handleLen,
      hOutX: tx * handleLen, hOutY: ty * handleLen,
    };
  });
}
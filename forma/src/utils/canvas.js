// Mouse coords helper: always in CSS-pixel space relative to canvas center
export function getCanvasMousePos(e, canvasRef) {
  const canvas = canvasRef.current;
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left - rect.width / 2,
    y: e.clientY - rect.top - rect.height / 2,
  };
}
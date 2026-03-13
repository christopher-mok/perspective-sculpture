import { useRef, useEffect } from "react";

// ResizeObserver hook: keeps canvas pixel size = CSS size
// Sets canvas.width/height AND canvas.style.width/height in px to prevent CSS stretch
export function useResizableCanvas(canvasRef, draw, deps) {
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      draw(ctx, w, h);
    };

    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(resize);
    });
    ro.observe(parent);
    resize();

    return () => { ro.disconnect(); if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, deps);
}
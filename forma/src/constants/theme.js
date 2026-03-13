export const COLORS = {
  bg: "#0a0a0a",
  panel: "#111111",
  panelBorder: "#252525",
  accent: "#f0d040",
  accentDim: "#a08a28",
  text: "#e0e0e0",
  textDim: "#707070",
  grid: "#141414",
  gridLine: "#252525",
  red: "#e06050",
  green: "#6abf8a",
  blue: "#5a9fd4",
  cyan: "#5ac4c4",
  orange: "#e0a050",
  pink: "#d47a9a",
  purple: "#9a7ad4",
};

// 50mm focal length on 36mm sensor (full frame) → FOV ≈ 39.6°
export const CAMERA = {
  focalLength: 50,         // mm
  sensorWidth: 36,         // mm (full frame)
  get fov() { return 2 * Math.atan(this.sensorWidth / (2 * this.focalLength)); },
  viewerDistance: 1000,     // mm from sculpture center
};

export const PIECE_COLORS = ["#f0d040", "#e06050", "#5a9fd4", "#6abf8a", "#e0e0e0"];
export const PIECE_COLOR_NAMES = ["Yellow", "Red", "Blue", "Green", "White"];
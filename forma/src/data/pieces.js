import { circlePoints } from "../utils/geometry";
import { PIECE_COLORS } from "../constants/theme";

export const makeInitialPieces = () => [
  { id: "P01", x: -60, y: -40, z: 80,  scale: 1.0, theta: 0, sizeCm: 5, thickness: 3, color: PIECE_COLORS[0], controlPoints: circlePoints() },
  { id: "P02", x: 30,  y: 20,  z: 150, scale: 0.7, theta: 0, sizeCm: 5, thickness: 3, color: PIECE_COLORS[2], controlPoints: circlePoints() },
  { id: "P03", x: -20, y: 50,  z: 200, scale: 0.9, theta: 0, sizeCm: 5, thickness: 3, color: PIECE_COLORS[1], controlPoints: circlePoints() },
  { id: "P04", x: 50,  y: -30, z: 120, scale: 0.5, theta: 0, sizeCm: 5, thickness: 3, color: PIECE_COLORS[3], controlPoints: circlePoints() },
  { id: "P05", x: -40, y: 10,  z: 250, scale: 0.6, theta: 0, sizeCm: 5, thickness: 3, color: PIECE_COLORS[4], controlPoints: circlePoints() },
];
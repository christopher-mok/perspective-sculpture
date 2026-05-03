import { useState, useEffect, useCallback } from "react";
import { COLORS, CAMERA, PIECE_COLORS } from "./constants/theme";
import { circlePoints } from "./utils/geometry";
import { storage } from "./utils/storage";
import { resolveCollisions } from "./utils/collision";
import { getFrameBounds, getFrameContentSize, getFrameFootprintSize, getFramePadding, getStringLengths } from "./utils/strings";
import { makeInitialPieces } from "./data/pieces";
import { Viewport3D } from "./components/Viewport3D";
import { PerspectivePreview } from "./components/PerspectivePreview";
import { ShapeEditor } from "./components/ShapeEditor";
import { CoordinateGrid } from "./components/CoordinateGrid";
import { ReferenceImagePanel } from "./components/ReferenceImagePanel";
import { PieceList } from "./components/PieceList";
import { SaveDialog } from "./components/SaveDialog";
import { generateLaserCutSVG, generateGridSVG, downloadSVG } from "./utils/svgExport";

const MM_PER_INCH = 25.4;
const MAX_HANGING_PLANE_INPUT = 10;
const MAX_HANGING_PLANE_OUTPUT_IN = 12;

function toMmFactor(unitLike) {
  const unit = String(unitLike || "mm").trim().toLowerCase();
  if (unit === "mm" || unit === "millimeter" || unit === "millimeters") return 1;
  if (unit === "cm" || unit === "centimeter" || unit === "centimeters") return 10;
  if (unit === "m" || unit === "meter" || unit === "meters") return 1000;
  if (unit === "in" || unit === "inch" || unit === "inches") return MM_PER_INCH;
  return 1;
}

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAngleRad(theta) {
  const twoPi = Math.PI * 2;
  let t = theta % twoPi;
  if (t > Math.PI) t -= twoPi;
  if (t < -Math.PI) t += twoPi;
  return t;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "y") return true;
    if (v === "false" || v === "0" || v === "no" || v === "n") return false;
  }
  return fallback;
}

function resolveThetaRadians(rawTheta, unitLike, directionLike) {
  let theta = toFiniteNumber(rawTheta, 0);
  const unit = String(unitLike || "").trim().toLowerCase();
  const direction = String(directionLike || "").trim().toLowerCase();

  const looksDegrees = Math.abs(theta) > Math.PI * 2 + 1e-6;
  const isDegrees = unit.startsWith("deg") || (!unit && looksDegrees);
  if (isDegrees) theta = theta * Math.PI / 180;

  const clockwise = direction === "cw" || direction === "clockwise" || direction === "-1";
  if (clockwise) theta = -theta;

  return normalizeAngleRad(theta);
}

function PerspectiveSculptor() {
  const [pieces, setPieces] = useState(makeInitialPieces);
  const [selectedPiece, setSelectedPiece] = useState(0);
  const [refImage, setRefImage] = useState({ src: null, opacity: 0.3, visible: true, x: 0, y: 0, scale: 1.0 });
  const [activeTab, setActiveTab] = useState("design");
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [exportJSON, setExportJSON] = useState("");
  const [importJSON, setImportJSON] = useState("");
  const [importError, setImportError] = useState("");
  const [saveName, setSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [unitScale, setUnitScale] = useState(1.0);

  // Load saved designs from storage on mount
  useEffect(() => {
    (async () => {
      try {
        const keys = await storage.list("forma-save:");
        const designs = [];
        for (const key of keys) {
          try {
            const val = await storage.get(key);
            if (val) designs.push({ ...JSON.parse(val), _key: key });
          } catch (e) {}
        }
        designs.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        setSavedDesigns(designs);
      } catch (e) {}
    })();
  }, []);

  const updateRefImage = useCallback((updates) => {
    setRefImage(prev => ({ ...prev, ...updates }));
  }, []);

  const updatePiece = useCallback((index, updates) => {
    setPieces(prev => {
      const needsCollision = "x" in updates || "y" in updates || "z" in updates
        || "scale" in updates || "thickness" in updates || "controlPoints" in updates;
      const resolved = needsCollision ? resolveCollisions(prev, index, updates) : updates;
      return prev.map((p, i) => i === index ? { ...p, ...resolved } : p);
    });
  }, []);

  const addPiece = useCallback(() => {
    const id = `P${String(pieces.length + 1).padStart(2, "0")}`;
    const color = PIECE_COLORS[pieces.length % PIECE_COLORS.length];
    setPieces(prev => [...prev, {
      id, x: Math.round(Math.random() * 100 - 50),
      y: Math.round(Math.random() * 80 - 40), z: Math.round(Math.random() * 200 + 50),
      scale: 0.8, theta: 0, sizeCm: 5, thickness: 3, color, controlPoints: circlePoints(),
    }]);
    setSelectedPiece(pieces.length);
  }, [pieces.length]);

  const duplicatePiece = useCallback((index) => {
    const src = pieces[index];
    if (!src) return;
    const id = `P${String(pieces.length + 1).padStart(2, "0")}`;
    setPieces(prev => [...prev, {
      ...src, id, x: src.x + 20, y: src.y + 20,
      controlPoints: src.controlPoints.map(p => ({ ...p })),
    }]);
    setSelectedPiece(pieces.length);
  }, [pieces]);

  const removePiece = useCallback((index) => {
    setPieces(prev => prev.filter((_, i) => i !== index));
    setSelectedPiece(s => Math.min(s, pieces.length - 2));
  }, [pieces.length]);

  const saveDesign = useCallback(async (name) => {
    const design = {
      name: name || `Design ${new Date().toLocaleString()}`,
      savedAt: new Date().toISOString(),
      pieces: pieces.map(p => ({ ...p, controlPoints: p.controlPoints.map(cp => ({ ...cp })) })),
    };
    const key = `forma-save:${Date.now()}`;
    try {
      await storage.set(key, JSON.stringify(design));
      setSavedDesigns(prev => [{ ...design, _key: key }, ...prev]);
    } catch (e) {}
    setShowSaveDialog(false);
    setSaveName("");
  }, [pieces]);

  const loadDesign = useCallback((design) => {
    setPieces(design.pieces.map(p => ({ ...p, controlPoints: p.controlPoints.map(cp => ({ ...cp })) })));
    setSelectedPiece(0);
    setActiveTab("design");
  }, []);

  const importDesignFromParsed = useCallback((parsed, options = {}) => {
    setImportError("");
    if (!parsed || !parsed.pieces || !Array.isArray(parsed.pieces)) {
      setImportError("Invalid format: JSON must contain a 'pieces' array");
      return;
    }

    // Get overall sculpture scale if provided at root level
    const overallScale = toFiniteNumber(parsed.scale, 1.0);
    const coordinateUnit = parsed.coordinateUnit || parsed.positionUnit || parsed.units || "mm";
    const coordToMm = toMmFactor(coordinateUnit);
    const globalThetaUnit = parsed.thetaUnit || parsed.rotationUnit;
    const globalThetaDirection = parsed.thetaDirection || parsed.rotationDirection;
    const globalFlipY = toBoolean(parsed.axisFlipY ?? parsed.flipY, options.fromApi);
    const globalFlipZ = toBoolean(parsed.axisFlipZ ?? parsed.flipZ, options.fromApi);

    let reconstructedPieces = parsed.pieces.map(p => {
      const px = p.position?.x ?? p.x ?? 0;
      const py = p.position?.y ?? p.y ?? 0;
      const pz = p.position?.z ?? p.z ?? 0;
      const rawTheta = p.theta ?? p.rotation ?? 0;
      const thetaUnit = p.thetaUnit || p.rotationUnit || globalThetaUnit;
      const thetaDirection = p.thetaDirection || p.rotationDirection || globalThetaDirection || "";
      const flipY = toBoolean(p.axisFlipY ?? p.flipY, globalFlipY);
      const flipZ = toBoolean(p.axisFlipZ ?? p.flipZ, globalFlipZ);
      const baseY = toFiniteNumber(py, 0) * overallScale * coordToMm;
      const baseZ = toFiniteNumber(pz, 0) * overallScale * coordToMm;
      const shapeYSign = flipY ? -1 : 1;

      let theta = resolveThetaRadians(rawTheta, thetaUnit, thetaDirection);
      if (!thetaDirection && flipZ) {
        // Mirroring Z flips handedness of Y-axis rotation if direction isn't explicit.
        theta = normalizeAngleRad(-theta);
      }

      const controlPoints = (p.controlPoints || []).map(cp => ({
        x: toFiniteNumber(cp.x, 0) * coordToMm,
        y: toFiniteNumber(cp.y, 0) * coordToMm * shapeYSign,
        hInX: toFiniteNumber(cp.handleIn?.x ?? cp.hInX, 0) * coordToMm,
        hInY: toFiniteNumber(cp.handleIn?.y ?? cp.hInY, 0) * coordToMm * shapeYSign,
        hOutX: toFiniteNumber(cp.handleOut?.x ?? cp.hOutX, 0) * coordToMm,
        hOutY: toFiniteNumber(cp.handleOut?.y ?? cp.hOutY, 0) * coordToMm * shapeYSign,
      }));
      return {
        id: p.id || `P${Math.random().toString(36).substr(2, 9)}`,
        x: toFiniteNumber(px, 0) * overallScale * coordToMm,
        y: flipY ? -baseY : baseY,
        z: flipZ ? -baseZ : baseZ,
        scale: toFiniteNumber(p.scale, 1.0) * overallScale,
        theta,
        color: p.color || PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)],
        sizeCm: toFiniteNumber(p.sizeCm, 5),
        thickness: toFiniteNumber(p.thickness, 3),
        controlPoints: controlPoints.length > 0 ? controlPoints : circlePoints(),
      };
    });

    const hangingPlaneSizeInput = Number(parsed.hangingPlaneSize);
    if (options.fromApi && Number.isFinite(hangingPlaneSizeInput) && hangingPlaneSizeInput > 0 && reconstructedPieces.length > 0) {
      const normalizedInput = Math.min(hangingPlaneSizeInput, MAX_HANGING_PLANE_INPUT);
      const targetInches = normalizedInput * (MAX_HANGING_PLANE_OUTPUT_IN / MAX_HANGING_PLANE_INPUT);
      const targetFootprintMm = targetInches * MM_PER_INCH;
      const currentContent = getFrameContentSize(reconstructedPieces);
      const currentFootprint = getFrameFootprintSize(reconstructedPieces);
      const totalPaddingMm = getFramePadding() * 2;
      let fitScale = 1;

      if (targetFootprintMm > totalPaddingMm && currentContent > 0) {
        // Solve for scale in: scaledContent + (2 * padding) = targetFootprintMm
        fitScale = (targetFootprintMm - totalPaddingMm) / currentContent;
      } else if (targetFootprintMm > 0 && currentFootprint > 0) {
        // Fallback when target is smaller than the fixed frame padding envelope.
        fitScale = targetFootprintMm / currentFootprint;
      }

      if (Number.isFinite(fitScale) && fitScale > 0) {
        reconstructedPieces = reconstructedPieces.map((p) => ({
          ...p,
          x: p.x * fitScale,
          y: p.y * fitScale,
          z: p.z * fitScale,
          scale: p.scale * fitScale,
          sizeCm: p.sizeCm * fitScale,
          thickness: p.thickness,
        }));
      }
    }

    setPieces(reconstructedPieces);
    setImportJSON("");
    setSelectedPiece(0);
    setActiveTab("design");
  }, []);

  const importDesignFromJSON = useCallback(() => {
    setImportError("");
    try {
      const parsed = JSON.parse(importJSON);
      importDesignFromParsed(parsed);
    } catch (e) {
      setImportError(`Parse error: ${e.message}`);
    }
  }, [importJSON, importDesignFromParsed]);

  useEffect(() => {
    if (!import.meta.hot) return;
    const onRemoteImport = (payload) => {
      importDesignFromParsed(payload, { fromApi: true });
    };
    import.meta.hot.on("forma:import", onRemoteImport);
    return () => {
      import.meta.hot.off?.("forma:import", onRemoteImport);
    };
  }, [importDesignFromParsed]);

  const deleteSaved = useCallback(async (index) => {
    const d = savedDesigns[index];
    if (d && d._key) {
      try { await storage.delete(d._key); } catch (e) {}
    }
    setSavedDesigns(prev => prev.filter((_, i) => i !== index));
  }, [savedDesigns]);

  const buildExportJSON = useCallback(() => {
    const fb = getFrameBounds(pieces);
    const u = unitScale;
    return JSON.stringify({
      format: "forma-sculpture-v1",
      exportedAt: new Date().toISOString(),
      unitScale: u,
      camera: {
        focalLength: CAMERA.focalLength,
        sensorWidth: CAMERA.sensorWidth,
        viewerDistance: CAMERA.viewerDistance,
      },
      pieces: pieces.map(p => {
        const sl = getStringLengths(p, fb.frameY);
        return {
          id: p.id,
          position: { x: +(p.x * u).toFixed(1), y: +(p.y * u).toFixed(1), z: +(p.z * u).toFixed(1) },
          scale: p.scale, theta: p.theta || 0, color: p.color,
          sizeCm: +((p.sizeCm || 5) * u).toFixed(2), thickness: +((p.thickness || 3) * u).toFixed(2),
          controlPoints: p.controlPoints.map(cp => ({
            x: cp.x, y: cp.y,
            handleIn: { x: cp.hInX || 0, y: cp.hInY || 0 },
            handleOut: { x: cp.hOutX || 0, y: cp.hOutY || 0 },
          })),
          stringLengths: { left: Math.round(sl.left * u), right: Math.round(sl.right * u) },
          boundingTubeMm: Math.round((p.sizeCm || 5) * 10 * u),
        };
      }),
      frame: { size: Math.round(fb.size * u), centerX: Math.round(fb.centerX * u), centerZ: Math.round(fb.centerZ * u), frameY: Math.round(fb.frameY * u) },
      metadata: { totalPieces: pieces.length, colors: [...new Set(pieces.map(p => p.color))] },
    }, null, 2);
  }, [pieces, unitScale]);

  const handleCopy = useCallback((text) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyFeedback(true);
    } catch (e) {
      try { navigator.clipboard?.writeText(text); setCopyFeedback(true); } catch (e2) {}
    }
    setTimeout(() => setCopyFeedback(false), 2000);
  }, []);

  const tabStyle = (id) => ({
    fontSize: 10, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
    color: activeTab === id ? COLORS.accent : COLORS.textDim, padding: "4px 12px",
    borderBottom: activeTab === id ? `1px solid ${COLORS.accent}` : "1px solid transparent",
  });

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: COLORS.bg, display: "grid", gridTemplateColumns: "260px 1fr", gridTemplateRows: "auto 1fr", fontFamily: "'DM Sans', sans-serif", overflow: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:wght@400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Top Bar */}
      <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${COLORS.panelBorder}`, background: COLORS.panel }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: COLORS.accent, letterSpacing: 6 }}>FORMA</span>
          <span style={{ fontSize: 9, color: COLORS.textDim, letterSpacing: 3, textTransform: "uppercase" }}>Perspective Sculpture Designer</span>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <span onClick={() => setActiveTab("design")} style={tabStyle("design")}>Design</span>
          <span onClick={() => setActiveTab("saved")} style={tabStyle("saved")}>Saved{savedDesigns.length > 0 ? ` (${savedDesigns.length})` : ""}</span>
          <span onClick={() => setActiveTab("import")} style={tabStyle("import")}>Import</span>
          <span onClick={() => { setExportJSON(buildExportJSON()); setActiveTab("export"); }} style={tabStyle("export")}>Export</span>
          <div style={{ marginLeft: 16, display: "flex", gap: 6 }}>
            <button onClick={() => setShowSaveDialog(true)} style={{ background: "transparent", border: `1px solid ${COLORS.panelBorder}`, color: COLORS.textDim, padding: "5px 14px", fontFamily: "monospace", fontSize: 9, letterSpacing: 2, cursor: "pointer", textTransform: "uppercase" }}>Save</button>
            <button onClick={() => { setExportJSON(buildExportJSON()); setActiveTab("export"); }} style={{ background: COLORS.accent, border: "none", color: COLORS.bg, padding: "5px 14px", fontFamily: "monospace", fontSize: 9, letterSpacing: 2, cursor: "pointer", textTransform: "uppercase", fontWeight: 600 }}>Export Package</button>
          </div>
        </div>
      </div>

      {/* Left: fixed sidebar */}
      <div style={{ borderRight: `1px solid ${COLORS.panelBorder}`, overflow: "hidden", display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
        <ReferenceImagePanel refImage={refImage} onUpdate={updateRefImage} />
        <div style={{ flex: 1, overflow: "hidden" }}>
          <PieceList pieces={pieces} selectedPiece={selectedPiece} onSelectPiece={setSelectedPiece} onUpdatePiece={updatePiece} onAddPiece={addPiece} onDuplicatePiece={duplicatePiece} onRemovePiece={removePiece} unitScale={unitScale} />
        </div>
      </div>

      {/* Right: tab content */}
      {activeTab === "design" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gridTemplateRows: "1fr 1fr", overflow: "hidden", minWidth: 0, minHeight: 0 }}>
          <div style={{ borderRight: `1px solid ${COLORS.panelBorder}`, borderBottom: `1px solid ${COLORS.panelBorder}`, position: "relative", minWidth: 0, minHeight: 0 }}>
            <Viewport3D pieces={pieces} selectedPiece={selectedPiece} onSelectPiece={setSelectedPiece} />
          </div>
          <div style={{ borderBottom: `1px solid ${COLORS.panelBorder}`, position: "relative", minWidth: 0, minHeight: 0 }}>
            <PerspectivePreview pieces={pieces} refImage={refImage} />
          </div>
          <div style={{ borderRight: `1px solid ${COLORS.panelBorder}`, position: "relative", minWidth: 0, minHeight: 0 }}>
            <ShapeEditor pieces={pieces} selectedPiece={selectedPiece} onUpdatePiece={updatePiece} />
          </div>
          <div style={{ position: "relative", minWidth: 0, minHeight: 0 }}>
            <CoordinateGrid pieces={pieces} selectedPiece={selectedPiece} onSelectPiece={setSelectedPiece} onUpdatePiece={updatePiece} />
          </div>
        </div>
      )}

      {activeTab === "saved" && (
        <div style={{ overflow: "auto", padding: 30, fontFamily: "monospace" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: COLORS.accent, letterSpacing: 4, textTransform: "uppercase" }}>Saved Designs</div>
            {savedDesigns.length > 0 && (
              <button onClick={() => {
                const allData = {
                  format: "forma-sculpture-bundle-v1",
                  exportedAt: new Date().toISOString(),
                  designs: savedDesigns.map(d => {
                    const dfb = getFrameBounds(d.pieces);
                    return {
                      name: d.name,
                      savedAt: d.savedAt,
                      frame: { size: Math.round(dfb.size), frameY: Math.round(dfb.frameY) },
                      pieces: d.pieces.map(p => {
                        const sl = getStringLengths(p, dfb.frameY);
                        return {
                          id: p.id,
                          position: { x: p.x, y: p.y, z: p.z },
                          scale: p.scale, theta: p.theta || 0, color: p.color,
                          thickness: p.thickness || 3,
                          controlPoints: p.controlPoints.map(cp => ({
                            x: cp.x, y: cp.y,
                            handleIn: { x: cp.hInX || 0, y: cp.hInY || 0 },
                            handleOut: { x: cp.hOutX || 0, y: cp.hOutY || 0 },
                          })),
                          stringLengths: { left: sl.left, right: sl.right },
                        };
                      }),
                    };
                  }),
                  metadata: { totalDesigns: savedDesigns.length },
                };
                setExportJSON(JSON.stringify(allData, null, 2));
                setActiveTab("export");
              }} style={{
                background: "transparent", color: COLORS.accent, border: `1px solid ${COLORS.accent}`,
                padding: "5px 14px", fontFamily: "monospace", fontSize: 9, letterSpacing: 1,
                textTransform: "uppercase", cursor: "pointer",
              }}>Export All ({savedDesigns.length})</button>
            )}
          </div>
          {savedDesigns.length === 0 ? (
            <div style={{ color: COLORS.textDim, fontSize: 12, lineHeight: 1.8 }}>
              No saved designs yet.<br />Click "Save" in the top bar to save your current sculpture.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {savedDesigns.map((d, i) => (
                <div key={d._key || i} style={{
                  background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, padding: 16,
                  transition: "border-color 0.2s",
                }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = COLORS.accent}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = COLORS.panelBorder}
                >
                  <div style={{ color: COLORS.text, fontSize: 12, marginBottom: 6 }}>{d.name}</div>
                  <div style={{ color: COLORS.textDim, fontSize: 9, marginBottom: 10 }}>
                    {d.pieces.length} pieces · {new Date(d.savedAt).toLocaleDateString()} {new Date(d.savedAt).toLocaleTimeString()}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
                    {d.pieces.slice(0, 8).map((p, j) => (
                      <div key={j} style={{ width: 14, height: 14, borderRadius: "50%", background: p.color, border: `1px solid ${COLORS.panelBorder}` }} />
                    ))}
                    {d.pieces.length > 8 && <span style={{ color: COLORS.textDim, fontSize: 9, alignSelf: "center" }}>+{d.pieces.length - 8}</span>}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => loadDesign(d)} style={{
                      flex: 1, background: COLORS.accent, color: COLORS.bg, border: "none",
                      padding: "5px 0", fontSize: 9, fontFamily: "monospace", letterSpacing: 1,
                      textTransform: "uppercase", cursor: "pointer",
                    }}>Load</button>
                    <button onClick={() => {
                      const dfb = getFrameBounds(d.pieces);
                      const singleExport = {
                        format: "forma-sculpture-v1",
                        exportedAt: new Date().toISOString(),
                        name: d.name,
                        pieces: d.pieces.map(p => {
                          const sl = getStringLengths(p, dfb.frameY);
                          return {
                            id: p.id,
                            position: { x: p.x, y: p.y, z: p.z },
                            scale: p.scale, theta: p.theta || 0, color: p.color,
                            thickness: p.thickness || 3,
                            controlPoints: p.controlPoints.map(cp => ({
                              x: cp.x, y: cp.y,
                              handleIn: { x: cp.hInX || 0, y: cp.hInY || 0 },
                              handleOut: { x: cp.hOutX || 0, y: cp.hOutY || 0 },
                            })),
                            stringLengths: { left: sl.left, right: sl.right },
                          };
                        }),
                        frame: { size: Math.round(dfb.size), centerX: Math.round(dfb.centerX), centerZ: Math.round(dfb.centerZ), frameY: Math.round(dfb.frameY) },
                        metadata: { totalPieces: d.pieces.length, colors: [...new Set(d.pieces.map(p => p.color))] },
                      };
                      setExportJSON(JSON.stringify(singleExport, null, 2));
                      setActiveTab("export");
                    }} style={{
                      background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.panelBorder}`,
                      padding: "5px 8px", fontSize: 8, fontFamily: "monospace", letterSpacing: 1,
                      textTransform: "uppercase", cursor: "pointer",
                    }}>Export</button>
                    <button onClick={() => deleteSaved(i)} style={{
                      background: "transparent", color: COLORS.red, border: `1px solid ${COLORS.red}40`,
                      padding: "5px 10px", fontSize: 9, fontFamily: "monospace", cursor: "pointer",
                    }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "import" && (
        <div style={{ overflow: "auto", padding: 30, fontFamily: "monospace", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: COLORS.accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>Import Design</div>
          <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 16, lineHeight: 1.6 }}>
            Paste a design JSON. Format:
            <div style={{ color: COLORS.text, background: COLORS.panel, padding: 10, marginTop: 8, borderRadius: 3, fontSize: 9, maxHeight: 150, overflow: "auto" }}>
              {`{
  "scale": 1.0,
  "pieces": [
    {
      "id": "P01",
      "position": {"x": -60, "y": -40, "z": 80},
      "scale": 1.0,
      "theta": 0,
      "color": "#ff0000",
      "controlPoints": [
        {"x": 40, "y": 0, "handleIn": {"x": 0, "y": 27}, "handleOut": {"x": 0, "y": -27}},
        ...
      ]
    }
  ]
}`}
            </div>
            <div style={{ marginTop: 10 }}>
              <div>• scale (root): multiplies all positions & scales (optional, default 1.0)</div>
              <div>• hangingPlaneSize: API input 0-10 maps to output 0-12 inches (10 → 12in)</div>
              <div>• coordinateUnit: optional <code>mm</code>, <code>cm</code>, or <code>in</code> for API coordinates</div>
              <div>• controlPoints: optional, auto-generates circles if omitted</div>
              <div>• handleIn/handleOut: control bezier curve tangents</div>
              <div>• Dev API: POST JSON to <code>/api/import</code> while Vite dev server is running</div>
            </div>
          </div>

          {importError && (
            <div style={{
              background: "#8B3A3A", color: "#FFB3B3", border: "1px solid #C94545",
              padding: 12, marginBottom: 16, fontSize: 10, borderRadius: 3,
            }}>
              {importError}
            </div>
          )}

          <textarea
            value={importJSON}
            onChange={(e) => setImportJSON(e.target.value)}
            placeholder={'Paste JSON here, e.g. {"scale": 1.0, "pieces": [...]}'}
            style={{
              flex: 1, minHeight: 300, background: COLORS.panel, color: COLORS.text,
              border: `1px solid ${COLORS.panelBorder}`, padding: 16,
              fontFamily: "monospace", fontSize: 10, lineHeight: 1.5,
              resize: "none", outline: "none", marginBottom: 12,
            }}
          />

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={importDesignFromJSON} style={{
              background: COLORS.accent, color: COLORS.bg, border: "none",
              padding: "8px 20px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}>Load Design</button>
            <button onClick={() => { setImportJSON(""); setImportError(""); }} style={{
              background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.panelBorder}`,
              padding: "8px 16px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}>Clear</button>
            <button onClick={() => setActiveTab("design")} style={{
              background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.panelBorder}`,
              padding: "8px 16px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", marginLeft: "auto",
            }}>Back to Design</button>
          </div>
        </div>
      )}

      {activeTab === "export" && (
        <div style={{ overflow: "auto", padding: 30, fontFamily: "monospace", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: COLORS.accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>Export Package</div>
          <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 16 }}>
            {pieces.length} pieces · forma-sculpture-v1 · Select all and copy, or use the button below
          </div>

          {/* Grid dimensions */}
          {(() => {
            const fb = getFrameBounds(pieces);
            const s = Math.round(fb.size * unitScale);
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, padding: "8px 12px" }}>
                <span style={{ color: COLORS.textDim, fontSize: 10, letterSpacing: 2, textTransform: "uppercase" }}>Grid</span>
                <span style={{ color: COLORS.text, fontSize: 11 }}>{s} × {s} mm</span>
                <span style={{ color: COLORS.textDim, fontSize: 10 }}>({(s / 10).toFixed(1)} × {(s / 10).toFixed(1)} cm)</span>
                <span style={{ color: COLORS.textDim, fontSize: 10 }}>({(s / 25.4).toFixed(1)} × {(s / 25.4).toFixed(1)} in)</span>
              </div>
            );
          })()}

          {/* Unit scale slider */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`, padding: "8px 12px" }}>
            <span style={{ color: COLORS.textDim, fontSize: 10, letterSpacing: 2, textTransform: "uppercase", flexShrink: 0 }}>Unit Scale</span>
            <input type="range" min={10} max={100} value={Math.round(unitScale * 100)}
              onChange={(e) => setUnitScale(Number(e.target.value) / 100)}
              style={{ flex: 1, accentColor: COLORS.accent }} />
            <span style={{ color: COLORS.accent, fontSize: 11, fontFamily: "monospace", minWidth: 36, textAlign: "right" }}>{unitScale.toFixed(2)}×</span>
          </div>

          {/* Per-piece string lengths summary */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: COLORS.textDim, letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>String Lengths</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
              {(() => {
                const fb = getFrameBounds(pieces);
                return pieces.map((p) => {
                  const sl = getStringLengths(p, fb.frameY);
                  return (
                    <div key={p.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      background: COLORS.panel, border: `1px solid ${COLORS.panelBorder}`,
                      padding: "6px 10px",
                    }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                      <span style={{ color: COLORS.text, fontSize: 11, fontWeight: 500 }}>{p.id}</span>
                      <span style={{ color: COLORS.textDim, fontSize: 10, marginLeft: "auto" }}>
                        L:{Math.round(sl.left * unitScale)}mm &nbsp; R:{Math.round(sl.right * unitScale)}mm
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <textarea
            readOnly
            value={exportJSON}
            style={{
              flex: 1, minHeight: 300, background: COLORS.panel, color: COLORS.text,
              border: `1px solid ${COLORS.panelBorder}`, padding: 16,
              fontFamily: "monospace", fontSize: 10, lineHeight: 1.5,
              resize: "none", outline: "none",
            }}
            onFocus={(e) => e.target.select()}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={() => handleCopy(exportJSON)} style={{
              background: copyFeedback ? "#6abf8a" : COLORS.accent, color: COLORS.bg, border: "none",
              padding: "8px 20px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", transition: "background 0.2s",
            }}>{copyFeedback ? "Copied!" : "Copy JSON"}</button>
            <button onClick={() => downloadSVG(generateLaserCutSVG(pieces, unitScale))} style={{
              background: COLORS.accent, color: COLORS.bg, border: "none",
              padding: "8px 20px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}>Download SVG (Laser Cut)</button>
            <button onClick={() => downloadSVG(generateGridSVG(pieces, unitScale), "forma-grid.svg")} style={{
              background: COLORS.accent, color: COLORS.bg, border: "none",
              padding: "8px 20px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}>Download SVG (Grid)</button>
            <button onClick={() => setActiveTab("design")} style={{
              background: "transparent", color: COLORS.textDim, border: `1px solid ${COLORS.panelBorder}`,
              padding: "8px 16px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}>Back to Design</button>
          </div>
        </div>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <SaveDialog
          pieces={pieces}
          saveName={saveName}
          onSaveNameChange={setSaveName}
          onSave={saveDesign}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  );
}

export default function App() {
  return <PerspectiveSculptor />;
}

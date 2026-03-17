import { useState, useEffect, useCallback } from "react";
import { COLORS, CAMERA, PIECE_COLORS } from "./constants/theme";
import { circlePoints } from "./utils/geometry";
import { storage } from "./utils/storage";
import { resolveCollisions } from "./utils/collision";
import { getFrameBounds, getStringLengths } from "./utils/strings";
import { makeInitialPieces } from "./data/pieces";
import { Viewport3D } from "./components/Viewport3D";
import { PerspectivePreview } from "./components/PerspectivePreview";
import { ShapeEditor } from "./components/ShapeEditor";
import { CoordinateGrid } from "./components/CoordinateGrid";
import { ReferenceImagePanel } from "./components/ReferenceImagePanel";
import { PieceList } from "./components/PieceList";
import { SaveDialog } from "./components/SaveDialog";
import { generateLaserCutSVG, downloadSVG } from "./utils/svgExport";

function PerspectiveSculptor() {
  const [pieces, setPieces] = useState(makeInitialPieces);
  const [selectedPiece, setSelectedPiece] = useState(0);
  const [refImage, setRefImage] = useState({ src: null, opacity: 0.3, visible: true, x: 0, y: 0, scale: 1.0 });
  const [activeTab, setActiveTab] = useState("design");
  const [savedDesigns, setSavedDesigns] = useState([]);
  const [exportJSON, setExportJSON] = useState("");
  const [saveName, setSaveName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

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

  const deleteSaved = useCallback(async (index) => {
    const d = savedDesigns[index];
    if (d && d._key) {
      try { await storage.delete(d._key); } catch (e) {}
    }
    setSavedDesigns(prev => prev.filter((_, i) => i !== index));
  }, [savedDesigns]);

  const buildExportJSON = useCallback(() => {
    const fb = getFrameBounds(pieces);
    return JSON.stringify({
      format: "forma-sculpture-v1",
      exportedAt: new Date().toISOString(),
      camera: {
        focalLength: CAMERA.focalLength,
        sensorWidth: CAMERA.sensorWidth,
        viewerDistance: CAMERA.viewerDistance,
      },
      pieces: pieces.map(p => {
        const sl = getStringLengths(p, fb.frameY);
        return {
          id: p.id,
          position: { x: p.x, y: p.y, z: p.z },
          scale: p.scale, theta: p.theta || 0, color: p.color,
          sizeCm: p.sizeCm || 5, thickness: p.thickness || 3,
          controlPoints: p.controlPoints.map(cp => ({
            x: cp.x, y: cp.y,
            handleIn: { x: cp.hInX || 0, y: cp.hInY || 0 },
            handleOut: { x: cp.hOutX || 0, y: cp.hOutY || 0 },
          })),
          stringLengths: { left: sl.left, right: sl.right },
          boundingTubeMm: Math.round((p.sizeCm || 5) * 10),
        };
      }),
      frame: { size: Math.round(fb.size), centerX: Math.round(fb.centerX), centerZ: Math.round(fb.centerZ), frameY: Math.round(fb.frameY) },
      metadata: { totalPieces: pieces.length, colors: [...new Set(pieces.map(p => p.color))] },
    }, null, 2);
  }, [pieces]);

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
          <PieceList pieces={pieces} selectedPiece={selectedPiece} onSelectPiece={setSelectedPiece} onUpdatePiece={updatePiece} onAddPiece={addPiece} onDuplicatePiece={duplicatePiece} onRemovePiece={removePiece} />
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

      {activeTab === "export" && (
        <div style={{ overflow: "auto", padding: 30, fontFamily: "monospace", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: COLORS.accent, letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>Export Package</div>
          <div style={{ color: COLORS.textDim, fontSize: 10, marginBottom: 16 }}>
            {pieces.length} pieces · forma-sculpture-v1 · Select all and copy, or use the button below
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
                        L:{sl.left}mm &nbsp; R:{sl.right}mm
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
            <button onClick={() => downloadSVG(generateLaserCutSVG(pieces))} style={{
              background: COLORS.accent, color: COLORS.bg, border: "none",
              padding: "8px 20px", fontFamily: "monospace", fontSize: 10,
              letterSpacing: 2, textTransform: "uppercase", cursor: "pointer",
            }}>Download SVG (Laser Cut)</button>
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
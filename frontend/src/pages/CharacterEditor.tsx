import { useEffect, useState } from "react";
import {
  Palette,
  Code2,
  Eye,
  Save,
  Download,
  Play,
} from "lucide-react";
import { useEditorStore } from "../stores/editorStore";
import { useProjectStore } from "../stores/projectStore";
import { useAnimationStore } from "../stores/animationStore";
import { PixelCanvas } from "../components/editor/PixelCanvas";
import { OledPreview } from "../components/editor/OledPreview";
import { Toolbar } from "../components/editor/Toolbar";
import { ImageUpload } from "../components/editor/ImageUpload";
import { generateArduinoCode } from "../utils/codeGen";
import { pixelsToDataURL } from "../utils/imageProcessor";
import { OLED_WIDTH, OLED_HEIGHT, type EditorMode } from "../types";

export function CharacterEditor() {
  const editor = useEditorStore();
  const project = useProjectStore();
  const anim = useAnimationStore();
  const [mode, setMode] = useState<EditorMode>("visual");

  // Sync editor pixels with active project on mount
  useEffect(() => {
    const active = project.getActiveProject();
    if (active) {
      editor.setPixels(active.currentFramePixels);
    }
  }, [project.activeProjectId]);

  // Auto-save when pixels change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      const active = project.getActiveProject();
      if (active) {
        project.updateActiveProject((p) => ({
          ...p,
          currentFramePixels: new Uint8Array(editor.pixels),
          characterDesign: { ...p.characterDesign, pixels: new Uint8Array(editor.pixels) },
          thumbnail: pixelsToDataURL(editor.pixels, OLED_WIDTH, OLED_HEIGHT, 2),
        }));
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [editor.pixels]);

  // Generate code in code mode
  useEffect(() => {
    if (mode === "code") {
      const active = project.getActiveProject();
      if (active) {
        const code = generateArduinoCode(active);
        editor.setGeneratedCode(code);
      }
    }
  }, [mode, editor.pixels, project.projects]);

  const handleSaveFrame = () => {
    const active = project.getActiveProject();
    if (!active) return;
    // If there's a selected animation, update the current frame
    if (anim.selectedAnimationId) {
      const animData = anim.animations.find((a) => a.id === anim.selectedAnimationId);
      if (animData) {
        anim.setFramePixels(anim.selectedAnimationId, anim.selectedFrameIndex, editor.pixels);
      }
    }
    // Save project
    project.updateActiveProject((p) => ({
      ...p,
      currentFramePixels: new Uint8Array(editor.pixels),
      characterDesign: { ...p.characterDesign, pixels: new Uint8Array(editor.pixels) },
      thumbnail: pixelsToDataURL(editor.pixels, OLED_WIDTH, OLED_HEIGHT, 2),
    }));
  };

  const handleDownloadCode = () => {
    const blob = new Blob([editor.generatedCode || generateArduinoCode(project.getActiveProject()!)], { type: "text/x-c++src" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "KittyBuddyStudio.ino";
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeProject = project.getActiveProject();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 border-b border-[#1e2129] flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Palette size={18} className="text-[#c084fc]" />
          <h1 className="text-sm font-semibold text-[#e2e8f0]">Character Editor</h1>
        </div>
        <span className="terminal-label text-[#475569]">editor.exe</span>

        {/* Mode toggle */}
        <div className="flex items-center gap-1 ml-4 bg-[#06070a] rounded p-0.5 border border-[#1e2129]">
          <button
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
              mode === "visual" ? "bg-[#7c3aed] text-white" : "text-[#475569] hover:text-[#94a3b8]"
            }`}
            onClick={() => setMode("visual")}
          >
            <Eye size={12} /> Visual
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all ${
              mode === "code" ? "bg-[#7c3aed] text-white" : "text-[#475569] hover:text-[#94a3b8]"
            }`}
            onClick={() => setMode("code")}
          >
            <Code2 size={12} /> Code
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Cursor position */}
          <span className="terminal-label text-[#475569]">
            x:{editor.cursorX} y:{editor.cursorY}
          </span>
          {mode === "code" && (
            <button className="btn text-xs" onClick={handleDownloadCode}>
              <Download size={12} /> Download .ino
            </button>
          )}
          <button className="btn btn-primary text-xs" onClick={handleSaveFrame}>
            <Save size={12} /> Save
          </button>
        </div>
      </div>

      {/* Content */}
      {mode === "visual" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left toolbar */}
          <Toolbar />

          {/* Center canvas */}
          <div className="flex-1 flex flex-col bg-[#06070a] overflow-hidden">
            <div className="flex-1 flex items-center justify-center overflow-auto p-4">
              <PixelCanvas
                onPixelChange={(px) => {
                  // Immediate sync for animation frames
                  if (anim.selectedAnimationId) {
                    anim.setFramePixels(anim.selectedAnimationId, anim.selectedFrameIndex, px);
                  }
                }}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-72 flex-shrink-0 border-l border-[#1e2129] bg-[#0a0b0f] overflow-y-auto">
            {/* OLED Preview */}
            <div className="p-4 border-b border-[#1e2129]">
              <div className="terminal-label text-[#475569] mb-3 flex items-center gap-2">
                <Play size={11} /> display.preview
              </div>
              <OledPreview pixels={editor.pixels} scale={2.5} showInfo />
            </div>

            {/* Image Upload */}
            <div className="border-b border-[#1e2129]">
              <div className="px-4 pt-3 pb-1 terminal-label text-[#475569] flex items-center gap-2">
                <Palette size={11} /> image.upload
              </div>
              <ImageUpload />
            </div>

            {/* Frame Info */}
            {anim.selectedAnimationId && (
              <div className="p-4">
                <div className="terminal-label text-[#475569] mb-2">frame.info</div>
                <div className="space-y-1 terminal-text text-[#94a3b8]">
                  <div>animation: <span className="text-[#e2e8f0]">{anim.animations.find((a) => a.id === anim.selectedAnimationId)?.name}</span></div>
                  <div>frame: <span className="text-[#e2e8f0]">{anim.selectedFrameIndex + 1} / {anim.animations.find((a) => a.id === anim.selectedAnimationId)?.frames.length}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Code Mode */
        <div className="flex-1 flex overflow-hidden">
          <div className="w-72 flex-shrink-0 border-r border-[#1e2129] bg-[#0a0b0f] overflow-y-auto p-4">
            <div className="terminal-label text-[#475569] mb-2">code.mode</div>
            <p className="terminal-text text-[#94a3b8] text-xs mb-4">
              Generated C++ Arduino sketch from your current project. Download and compile with Arduino CLI or PlatformIO.
            </p>
            <div className="px-3 py-2 rounded border border-[#fbbf24]/30 bg-[#fbbf24]/5 flex gap-2 mb-3">
              <span className="terminal-text text-[#fbbf24] text-xs">
                ⚠ Code changes require a firmware rebuild and OTA upload.
              </span>
            </div>
            <div className="space-y-1 terminal-text text-[#94a3b8]">
              <div>project: <span className="text-[#e2e8f0]">{activeProject?.name ?? "—"}</span></div>
              <div>animations: <span className="text-[#e2e8f0]">{activeProject?.animations.length ?? 0}</span></div>
              <div>frames: <span className="text-[#e2e8f0]">{activeProject?.animations.reduce((s, a) => s + a.frames.length, 0) ?? 0}</span></div>
            </div>
          </div>
          <div className="flex-1 overflow-auto bg-[#06070a] p-4">
            <pre className="terminal-text text-[#94a3b8] text-xs leading-relaxed whitespace-pre-wrap font-mono">
              {editor.generatedCode || "// Generating code…"}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default CharacterEditor;

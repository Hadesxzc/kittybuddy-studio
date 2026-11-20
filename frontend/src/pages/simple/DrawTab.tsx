import { useEffect, useRef, useState } from "react";
import {
  Pencil, Eraser, PaintBucket, Minus, Square, Circle,
  Undo2, Redo2, Trash2, Grid3x3, ImagePlus, Send, ChevronLeft, ChevronRight, Plus, X, Type,
} from "lucide-react";
import { TouchCanvas, type PointerHandler, type Box } from "../../components/simple/TouchCanvas";
import { TextPanel } from "../../components/simple/TextPanel";
import { useEditorStore } from "../../stores/editorStore";
import { useAnimationStore } from "../../stores/animationStore";
import { useProjectStore } from "../../stores/projectStore";
import { useUiStore } from "../../stores/uiStore";
import { processImage, pixelsToDataURL } from "../../utils/imageProcessor";
import { sendToDevice, DRAWING_ID } from "../../utils/send";
import { OLED_WIDTH, OLED_HEIGHT, type ToolType } from "../../types";

const TOOLS: { id: ToolType; label: string; icon: typeof Pencil }[] = [
  { id: "pencil", label: "Pen", icon: Pencil },
  { id: "eraser", label: "Erase", icon: Eraser },
  { id: "fill", label: "Fill", icon: PaintBucket },
  { id: "line", label: "Line", icon: Minus },
  { id: "rectangle", label: "Box", icon: Square },
  { id: "circle", label: "Circle", icon: Circle },
];

const SPEEDS = [
  { ms: 100, label: "Fast" },
  { ms: 250, label: "Normal" },
  { ms: 600, label: "Slow" },
  { ms: 2000, label: "Hold" },
];

export function DrawTab() {
  const target = useUiStore((s) => s.target);
  const edit = useUiStore((s) => s.edit);
  const showToast = useUiStore((s) => s.showToast);
  const pixels = useEditorStore((s) => s.pixels);
  const tool = useEditorStore((s) => s.tool);
  const showGrid = useEditorStore((s) => s.showGrid);
  const canUndo = useEditorStore((s) => s.undoStack.length > 0);
  const canRedo = useEditorStore((s) => s.redoStack.length > 0);
  const animations = useAnimationStore((s) => s.animations);
  const [sending, setSending] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const pointerRef = useRef<PointerHandler | null>(null);
  const [boxes, setBoxes] = useState<Box[] | undefined>(undefined);

  const anim = target.kind === "frame" ? animations.find((a) => a.id === target.animId) : undefined;
  const frame = target.kind === "frame" ? anim?.frames[target.frameIndex] : undefined;

  // Write canvas changes back to whatever is being edited
  useEffect(() => {
    if (!useUiStore.getState().hydrated) return;
    if (target.kind === "frame") {
      useAnimationStore.getState().setFramePixels(target.animId, target.frameIndex, pixels);
      return;
    }
    const t = setTimeout(() => {
      useProjectStore.getState().updateActiveProject((p) => ({
        ...p,
        currentFramePixels: new Uint8Array(pixels),
        characterDesign: { ...p.characterDesign, pixels: new Uint8Array(pixels) },
        thumbnail: pixelsToDataURL(pixels, OLED_WIDTH, OLED_HEIGHT, 2),
      }));
    }, 500);
    return () => clearTimeout(t);
  }, [pixels, target]);

  // Leave frame mode if the animation or frame was deleted
  useEffect(() => {
    if (target.kind === "frame" && !frame) edit({ kind: "drawing" });
  }, [target, frame, edit]);

  const send = async () => {
    setSending(true);
    const r = await sendToDevice(target.kind === "frame" ? target.animId : DRAWING_ID);
    setSending(false);
    showToast(r.message, r.ok);
  };

  const ed = useEditorStore.getState();

  return (
    <div className="space-y-3">
      {textOpen ? (
        <p className="text-sm text-[#94a3b8]">Drag a text to move it. Drag its corner dot or pinch to resize.</p>
      ) : target.kind === "frame" && anim && frame ? (
        <FrameBar
          name={anim.name}
          index={target.frameIndex}
          count={anim.frames.length}
          duration={frame.duration}
          onDone={() => edit({ kind: "drawing" })}
          onGo={(i) => edit({ kind: "frame", animId: anim.id, frameIndex: i })}
          onAdd={() => {
            const a = useAnimationStore.getState();
            a.duplicateFrame(anim.id, target.frameIndex);
            edit({ kind: "frame", animId: anim.id, frameIndex: target.frameIndex + 1 });
          }}
          onDelete={() => {
            if (anim.frames.length <= 1) return showToast("An animation needs at least one frame.", false);
            useAnimationStore.getState().deleteFrame(anim.id, target.frameIndex);
            edit({ kind: "frame", animId: anim.id, frameIndex: Math.max(0, target.frameIndex - 1) });
          }}
          onDuration={(ms) => useAnimationStore.getState().setFrameDuration(anim.id, target.frameIndex, ms)}
        />
      ) : (
        <div>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">Draw</h1>
          <p className="text-sm text-[#94a3b8]">Draw with your finger, then tap Show on KittyBuddy.</p>
        </div>
      )}

      <div className="rounded-xl border border-[#2a2e3a] bg-black p-1.5">
        <TouchCanvas onPointer={textOpen ? (e) => pointerRef.current?.(e) : undefined} boxes={textOpen ? boxes : undefined} />
      </div>

      {textOpen ? (
        <TextPanel pointerRef={pointerRef} setBoxes={setBoxes} onClose={() => setTextOpen(false)} />
      ) : (
      <>
      {/* Tools */}
      <div className="grid grid-cols-6 gap-1.5">
        {TOOLS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => ed.setTool(id)}
            className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs border transition-colors ${
              tool === id
                ? "bg-[#7c3aed] border-[#7c3aed] text-white"
                : "bg-[#161922] border-[#2a2e3a] text-[#94a3b8]"
            }`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        <IconBtn label="Undo" icon={Undo2} onClick={ed.undo} disabled={!canUndo} />
        <IconBtn label="Redo" icon={Redo2} onClick={ed.redo} disabled={!canRedo} />
        <IconBtn label="Text" icon={Type} onClick={() => { setPhotoOpen(false); setTextOpen(true); }} />
        <IconBtn label="Photo" icon={ImagePlus} onClick={() => setPhotoOpen((v) => !v)} active={photoOpen} />
        <IconBtn label="Grid" icon={Grid3x3} onClick={ed.toggleGrid} active={showGrid} />
        <IconBtn label="Clear" icon={Trash2} onClick={() => confirm("Clear the whole screen?") && ed.clearCanvas()} />
      </div>

      {photoOpen && <PhotoPanel onClose={() => setPhotoOpen(false)} />}
      </>
      )}

      <button
        onClick={send}
        disabled={sending}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#7c3aed] hover:bg-[#8b5cf6] disabled:opacity-60 text-white font-semibold py-3.5 text-base"
      >
        <Send size={18} />
        {sending ? "Sending…" : target.kind === "frame" ? "Play this animation on KittyBuddy" : "Show on KittyBuddy"}
      </button>
    </div>
  );
}

function IconBtn({ label, icon: Icon, onClick, disabled, active }: {
  label: string; icon: typeof Pencil; onClick: () => void; disabled?: boolean; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex flex-col items-center gap-1 rounded-lg py-2 text-xs border disabled:opacity-35 ${
        active ? "border-[#c084fc] text-[#e2e8f0] bg-[#1c1f2b]" : "border-[#2a2e3a] text-[#94a3b8] bg-[#161922]"
      }`}
    >
      <Icon size={18} />
      {label}
    </button>
  );
}

function FrameBar({ name, index, count, duration, onDone, onGo, onAdd, onDelete, onDuration }: {
  name: string; index: number; count: number; duration: number;
  onDone: () => void; onGo: (i: number) => void; onAdd: () => void; onDelete: () => void; onDuration: (ms: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-3 space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={onDone} className="flex items-center gap-1 text-sm text-[#c084fc]">
          <ChevronLeft size={16} /> Done
        </button>
        <div className="flex-1 text-center text-sm font-semibold text-[#e2e8f0] truncate">{name}</div>
        <span className="w-12" />
      </div>
      <div className="flex items-center gap-2">
        <button className="rounded-lg border border-[#2a2e3a] bg-[#161922] p-2 disabled:opacity-35" disabled={index === 0} onClick={() => onGo(index - 1)}>
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 text-center text-sm text-[#94a3b8]">Frame {index + 1} of {count}</div>
        <button className="rounded-lg border border-[#2a2e3a] bg-[#161922] p-2 disabled:opacity-35" disabled={index >= count - 1} onClick={() => onGo(index + 1)}>
          <ChevronRight size={18} />
        </button>
        <button className="rounded-lg border border-[#2a2e3a] bg-[#161922] p-2" onClick={onAdd} title="Copy this frame">
          <Plus size={18} />
        </button>
        <button className="rounded-lg border border-[#2a2e3a] bg-[#161922] p-2 text-[#f87171]" onClick={onDelete} title="Delete this frame">
          <Trash2 size={18} />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {SPEEDS.map((s) => (
          <button
            key={s.ms}
            onClick={() => onDuration(s.ms)}
            className={`rounded-lg py-1.5 text-xs border ${
              duration === s.ms ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "border-[#2a2e3a] text-[#94a3b8] bg-[#161922]"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {!SPEEDS.some((s) => s.ms === duration) && (
        <div className="text-xs text-center text-[#475569]">This frame shows for {duration} ms</div>
      )}
    </div>
  );
}

function PhotoPanel({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const adj = useEditorStore((s) => s.imageAdjustments);

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    processImage(file, adj)
      .then((px) => { if (!cancelled) { useEditorStore.getState().pushUndo(); useEditorStore.setState({ pixels: px }); } })
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't read that image"));
    return () => { cancelled = true; };
  }, [file, adj]);

  const set = useEditorStore.getState().setImageAdjustments;

  return (
    <div className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-[#e2e8f0]">Turn a photo into pixels</span>
        <button onClick={onClose} className="text-[#94a3b8]"><X size={18} /></button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { setError(null); setFile(e.target.files?.[0] ?? null); }}
      />
      <button className="btn w-full py-2.5" onClick={() => fileRef.current?.click()}>
        <ImagePlus size={16} /> {file ? "Choose another photo" : "Choose a photo"}
      </button>
      {error && <p className="text-sm text-[#f87171]">{error}</p>}
      {file && (
        <>
          <label className="block">
            <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
              <span>Lightness</span><span>{adj.threshold}</span>
            </div>
            <input type="range" min={20} max={235} value={adj.threshold}
              onChange={(e) => set({ threshold: Number(e.target.value) })} className="w-full accent-[#c084fc]" />
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            <Toggle on={adj.dithering !== "none"} onClick={() => set({ dithering: adj.dithering === "none" ? "floyd-steinberg" : "none" })} label="Shading" />
            <Toggle on={adj.invert} onClick={() => set({ invert: !adj.invert })} label="Invert" />
          </div>
        </>
      )}
    </div>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2 text-sm border ${on ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "border-[#2a2e3a] text-[#94a3b8] bg-[#161922]"}`}
    >
      {label}: {on ? "On" : "Off"}
    </button>
  );
}

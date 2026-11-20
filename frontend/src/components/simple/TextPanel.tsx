import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Crosshair, Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { drawLayer, layerBounds, FONTS, type TextLayer } from "../../utils/pixelText";
import { loadPressStart } from "../../utils/pressStart";
import { OLED_WIDTH as W, OLED_HEIGHT as H, nanoid } from "../../types";
import { HANDLE, type Box, type PointerHandler, type PointerInput } from "./TouchCanvas";

interface Props {
  pointerRef: MutableRefObject<PointerHandler | null>;
  setBoxes: (boxes: Box[] | undefined) => void;
  onClose: () => void;
}

const MIN_SIZE = 4;
const MAX_SIZE = 64;
const clampSize = (s: number) => Math.max(MIN_SIZE, Math.min(MAX_SIZE, s));

type Gesture =
  | { mode: "move"; id: string; dx: number; dy: number }
  | { mode: "resize"; id: string; x0: number; y0: number; startSize: number; startDist: number }
  | { mode: "pinch"; id: string; startSize: number; startDist: number; cx: number; cy: number; w0: number; h0: number };

function newLayer(index: number): TextLayer {
  return {
    id: nanoid(),
    text: "",
    size: 16,
    x: 8,
    y: Math.min(H - 16, 8 + ((index * 20) % 48)),
    color: 1,
    font: "press",
    emoji: "detail",
  };
}

/**
 * Any number of text boxes over the current canvas. Drag to move, drag the
 * corner handle or pinch to resize. "Done" stamps them into the image.
 */
export function TextPanel({ pointerRef, setBoxes, onClose }: Props) {
  const base = useRef(useEditorStore.getState().pixels);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [layers, setLayers] = useState<TextLayer[]>(() => [newLayer(0)]);
  const [selectedId, setSelectedId] = useState<string | null>(() => layers[0].id);
  const [fontLoaded, setFontLoaded] = useState(0);

  const layersRef = useRef(layers);
  layersRef.current = layers;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  const selected = layers.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    loadPressStart().then(() => setFontLoaded((n) => n + 1));
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  // Live composite + selection outlines
  useEffect(() => {
    const px = new Uint8Array(base.current);
    for (const l of layers) if (l.text) drawLayer(px, l);
    useEditorStore.setState({ pixels: px });
    setBoxes(layers.map((l) => ({ ...layerBounds(l), selected: l.id === selectedId })));
  }, [layers, selectedId, fontLoaded, setBoxes]);

  useEffect(() => () => setBoxes(undefined), [setBoxes]);

  const update = (id: string, patch: Partial<TextLayer>) =>
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));

  // ---- canvas gestures
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<Gesture | null>(null);

  useEffect(() => {
    const hitLayer = (x: number, y: number) => {
      const ls = layersRef.current;
      for (let i = ls.length - 1; i >= 0; i--) {
        const b = layerBounds(ls[i]);
        if (x >= b.x - 3 && x <= b.x + b.w + 3 && y >= b.y - 3 && y <= b.y + b.h + 3) return ls[i];
      }
      return null;
    };

    const handler = (e: PointerInput) => {
      const pts = pointers.current;
      if (e.type === "down") {
        pts.set(e.id, { x: e.x, y: e.y });
        const sel = layersRef.current.find((l) => l.id === selectedRef.current);
        if (pts.size === 2 && sel) {
          const [a, b] = [...pts.values()];
          const bb = layerBounds(sel);
          gesture.current = {
            mode: "pinch", id: sel.id, startSize: sel.size,
            startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
            cx: bb.x + bb.w / 2, cy: bb.y + bb.h / 2, w0: bb.w, h0: bb.h,
          };
          return;
        }
        if (pts.size > 1) return;
        if (sel) {
          const bb = layerBounds(sel);
          const hx = bb.x + bb.w, hy = bb.y + bb.h;
          if (Math.hypot(e.x - hx, e.y - hy) <= HANDLE) {
            gesture.current = {
              mode: "resize", id: sel.id, x0: bb.x, y0: bb.y, startSize: sel.size,
              startDist: Math.max(1, Math.hypot(e.x - bb.x, e.y - bb.y)),
            };
            return;
          }
        }
        const hit = hitLayer(e.x, e.y);
        if (hit) {
          setSelectedId(hit.id);
          gesture.current = { mode: "move", id: hit.id, dx: e.x - hit.x, dy: e.y - hit.y };
        } else {
          gesture.current = null;
        }
        return;
      }

      if (e.type === "move") {
        if (!pts.has(e.id)) return;
        pts.set(e.id, { x: e.x, y: e.y });
        const g = gesture.current;
        if (!g) return;
        if (g.mode === "move") {
          update(g.id, { x: Math.round(e.x - g.dx), y: Math.round(e.y - g.dy) });
        } else if (g.mode === "resize") {
          const r = Math.hypot(e.x - g.x0, e.y - g.y0) / g.startDist;
          update(g.id, { size: clampSize(g.startSize * r) });
        } else if (g.mode === "pinch" && pts.size >= 2) {
          const [a, b] = [...pts.values()];
          const r = Math.hypot(a.x - b.x, a.y - b.y) / g.startDist;
          const size = clampSize(g.startSize * r);
          const k = size / g.startSize;
          update(g.id, { size, x: Math.round(g.cx - (g.w0 * k) / 2), y: Math.round(g.cy - (g.h0 * k) / 2) });
        }
        return;
      }

      pts.delete(e.id);
      if (pts.size === 0) gesture.current = null;
      else if (gesture.current?.mode === "pinch") gesture.current = null;
    };

    pointerRef.current = handler;
    return () => { pointerRef.current = null; };
  }, [pointerRef]);

  // ---- actions
  const addLayer = () => {
    const l = newLayer(layers.length);
    setLayers((ls) => [...ls, l]);
    setSelectedId(l.id);
    requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
  };

  const removeSelected = () => {
    if (!selected) return;
    const rest = layers.filter((l) => l.id !== selected.id);
    setLayers(rest);
    setSelectedId(rest.length ? rest[rest.length - 1].id : null);
  };

  const center = () => {
    if (!selected) return;
    const b = layerBounds(selected);
    update(selected.id, { x: Math.round((W - b.w) / 2), y: Math.round((H - b.h) / 2) });
  };

  const done = () => {
    if (layers.some((l) => l.text.trim())) {
      useEditorStore.setState((s) => ({ undoStack: [...s.undoStack.slice(-49), base.current], redoStack: [] }));
    } else {
      useEditorStore.setState({ pixels: base.current });
    }
    onClose();
  };

  const cancel = () => {
    useEditorStore.setState({ pixels: base.current });
    onClose();
  };

  const chip = (on: boolean) =>
    `rounded-lg py-2 text-sm border ${on ? "bg-[#7c3aed] border-[#7c3aed] text-white" : "border-[#2a2e3a] text-[#94a3b8] bg-[#161922]"}`;

  return (
    <div className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-3 space-y-3">
      {/* Text boxes */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0 flex gap-1.5 overflow-x-auto">
          {layers.map((l, i) => (
            <button
              key={l.id}
              onClick={() => setSelectedId(l.id)}
              className={`shrink-0 max-w-[7.5rem] truncate rounded-lg px-3 py-1.5 text-xs border ${
                l.id === selectedId ? "border-[#c084fc] text-[#e2e8f0] bg-[#1c1f2b]" : "border-[#2a2e3a] text-[#94a3b8] bg-[#161922]"
              }`}
            >
              {l.text.trim() ? l.text.split("\n")[0] : `Text ${i + 1}`}
            </button>
          ))}
        </div>
        <button onClick={addLayer} className="shrink-0 flex items-center gap-1 rounded-lg bg-[#7c3aed] text-white text-xs font-medium px-3 py-1.5">
          <Plus size={14} /> Add text
        </button>
      </div>

      {selected ? (
        <>
          <textarea
            ref={inputRef}
            value={selected.text}
            onChange={(e) => update(selected.id, { text: e.target.value })}
            rows={2}
            placeholder="Type here… use your phone's emoji keyboard for emoji 😺"
            className="input-field resize-none"
            style={{ fontSize: 16 }}
          />

          <label className="block">
            <div className="flex justify-between text-xs text-[#94a3b8] mb-1">
              <span>Size (or drag the corner dot / pinch on the screen)</span>
              <span className="text-[#c084fc]">{Math.round(selected.size)} px</span>
            </div>
            <input
              type="range" min={MIN_SIZE} max={MAX_SIZE} step={1}
              value={Math.round(selected.size)}
              onChange={(e) => update(selected.id, { size: Number(e.target.value) })}
              className="w-full accent-[#c084fc]"
            />
          </label>

          <div className="grid grid-cols-5 gap-1.5">
            <Pad onClick={() => update(selected.id, { x: selected.x - 1 })} label="Left"><ArrowLeft size={18} /></Pad>
            <Pad onClick={() => update(selected.id, { y: selected.y - 1 })} label="Up"><ArrowUp size={18} /></Pad>
            <Pad onClick={center} label="Center"><Crosshair size={18} /></Pad>
            <Pad onClick={() => update(selected.id, { y: selected.y + 1 })} label="Down"><ArrowDown size={18} /></Pad>
            <Pad onClick={() => update(selected.id, { x: selected.x + 1 })} label="Right"><ArrowRight size={18} /></Pad>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {FONTS.map((f) => (
              <button key={f.id} onClick={() => update(selected.id, { font: f.id })} className={chip(selected.font === f.id)}>
                {f.id === "press" ? "Press Start 2P" : "Classic (thin)"}
              </button>
            ))}
            <button onClick={() => update(selected.id, { color: 1 })} className={chip(selected.color === 1)}>White</button>
            <button onClick={() => update(selected.id, { color: 0 })} className={chip(selected.color === 0)}>Black (cut out)</button>
            <button onClick={() => update(selected.id, { emoji: "detail" })} className={chip(selected.emoji === "detail")}>Emoji: detailed</button>
            <button onClick={() => update(selected.id, { emoji: "solid" })} className={chip(selected.emoji === "solid")}>Emoji: solid</button>
          </div>

          <button onClick={removeSelected} className="btn btn-danger w-full py-2 text-sm">
            <Trash2 size={14} /> Delete this text
          </button>
        </>
      ) : (
        <p className="text-sm text-[#94a3b8] text-center py-2">Tap a text on the screen to edit it, or add a new one.</p>
      )}

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button onClick={cancel} className="btn py-2.5 text-sm">Cancel</button>
        <button onClick={done} className="btn btn-primary py-2.5 text-sm">Done</button>
      </div>
    </div>
  );
}

function Pad({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="flex items-center justify-center rounded-lg border border-[#2a2e3a] bg-[#161922] py-2.5 text-[#94a3b8] active:bg-[#1c1f2b]"
    >
      {children}
    </button>
  );
}

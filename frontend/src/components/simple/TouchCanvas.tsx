import { useEffect, useRef, type PointerEvent } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { OLED_WIDTH as W, OLED_HEIGHT as H } from "../../types";

const PX = 8; // backing pixels per OLED pixel; CSS scales the canvas to fit

type Pt = { x: number; y: number };

/** Pointer input in OLED pixel units (fractional), with the pointer id for multi-touch. */
export type PointerInput = { type: "down" | "move" | "up"; id: number; x: number; y: number };
export type PointerHandler = (e: PointerInput) => void;

export interface Box { x: number; y: number; w: number; h: number; selected: boolean }

export const HANDLE = 6; // resize handle size in OLED pixels

interface Props {
  /** When set, pointer input goes here instead of the drawing tools. */
  onPointer?: PointerHandler;
  /** Outlines drawn over the pixels (not part of the image). */
  boxes?: Box[];
}

/** Editable 128x64 canvas that works with mouse, pen and touch. */
export function TouchCanvas({ onPointer, boxes }: Props = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pixels = useEditorStore((s) => s.pixels);
  const showGrid = useEditorStore((s) => s.showGrid);

  const down = useRef(false);
  const last = useRef<Pt | null>(null);
  const start = useRef<Pt | null>(null);
  const snapshot = useRef<Uint8Array | null>(null);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    c.width = W * PX;
    c.height = H * PX;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#e0f2fe";
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (pixels[y * W + x]) ctx.fillRect(x * PX, y * PX, PX, PX);
    if (showGrid && !boxes) {
      // Guides every 8 pixels; a per-pixel grid turns to moiré on phone screens
      ctx.fillStyle = "rgba(148,163,184,0.22)";
      for (let i = 0; i <= W; i += 8) ctx.fillRect(i * PX - 1, 0, 2, c.height);
      for (let j = 0; j <= H; j += 8) ctx.fillRect(0, j * PX - 1, c.width, 2);
    }
    for (const b of boxes ?? []) {
      ctx.save();
      ctx.lineWidth = b.selected ? 4 : 3;
      ctx.strokeStyle = b.selected ? "#c084fc" : "rgba(192,132,252,0.45)";
      ctx.setLineDash(b.selected ? [] : [12, 8]);
      ctx.strokeRect(b.x * PX - 4, b.y * PX - 4, b.w * PX + 8, b.h * PX + 8);
      if (b.selected) {
        ctx.fillStyle = "#c084fc";
        const hx = (b.x + b.w) * PX + 4, hy = (b.y + b.h) * PX + 4;
        const r = (HANDLE * PX) / 2;
        ctx.beginPath();
        ctx.arc(hx, hy, r * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#06070a";
        ctx.beginPath();
        ctx.arc(hx, hy, r * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }, [pixels, showGrid, boxes]);

  const raw = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const pos = (e: PointerEvent<HTMLCanvasElement>): Pt => {
    const p = raw(e);
    return { x: Math.max(0, Math.min(W - 1, Math.floor(p.x))), y: Math.max(0, Math.min(H - 1, Math.floor(p.y))) };
  };

  const drawShape = (a: Pt, b: Pt) => {
    const st = useEditorStore.getState();
    if (st.tool === "line") st.drawLine(a.x, a.y, b.x, b.y, 1);
    else if (st.tool === "rectangle") st.drawRect(a.x, a.y, b.x, b.y, false, 1);
    else if (st.tool === "circle") st.drawCircle(a.x, a.y, Math.round(Math.hypot(b.x - a.x, b.y - a.y)), 1);
  };

  const onDown = (e: PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (onPointer) return onPointer({ type: "down", id: e.pointerId, ...raw(e) });
    const p = pos(e);
    const st = useEditorStore.getState();
    st.pushUndo();
    down.current = true;
    last.current = p;
    switch (st.tool) {
      case "pencil":
      case "eraser":
        st.drawPixel(p.x, p.y, st.tool === "pencil" ? 1 : 0);
        break;
      case "fill":
        st.fillArea(p.x, p.y, st.pixels[p.y * W + p.x] ? 0 : 1);
        down.current = false;
        break;
      default:
        start.current = p;
        snapshot.current = st.pixels;
    }
  };

  const onMove = (e: PointerEvent<HTMLCanvasElement>) => {
    if (onPointer) {
      if (e.buttons || e.pointerType === "touch") onPointer({ type: "move", id: e.pointerId, ...raw(e) });
      return;
    }
    if (!down.current) return;
    const p = pos(e);
    const prev = last.current;
    if (prev && prev.x === p.x && prev.y === p.y) return;
    last.current = p;
    const st = useEditorStore.getState();
    if (st.tool === "pencil" || st.tool === "eraser") {
      if (prev) st.drawLine(prev.x, prev.y, p.x, p.y, st.tool === "pencil" ? 1 : 0);
    } else if (start.current && snapshot.current) {
      useEditorStore.setState({ pixels: snapshot.current });
      drawShape(start.current, p);
    }
  };

  const onUp = (e: PointerEvent<HTMLCanvasElement>) => {
    if (onPointer) return onPointer({ type: "up", id: e.pointerId, ...raw(e) });
    down.current = false;
    start.current = null;
    snapshot.current = null;
  };

  return (
    <canvas
      ref={ref}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      className={`block w-full h-auto rounded-lg touch-none select-none ${onPointer ? "cursor-move" : "cursor-crosshair"}`}
      style={{ imageRendering: "pixelated", aspectRatio: "2 / 1" }}
    />
  );
}

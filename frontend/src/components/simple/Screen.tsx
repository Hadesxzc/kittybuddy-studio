import { useEffect, useRef, useState } from "react";
import { OLED_WIDTH as W, OLED_HEIGHT as H } from "../../types";

interface ScreenProps {
  frames: { pixels: Uint8Array; duration: number }[];
  className?: string;
}

/** Read-only OLED preview. Plays the frames if there is more than one. */
export function Screen({ frames, className = "" }: ScreenProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [i, setI] = useState(0);
  const idx = frames.length ? i % frames.length : 0;

  useEffect(() => {
    if (frames.length < 2) return;
    const t = setTimeout(() => setI((v) => v + 1), Math.max(80, frames[idx]?.duration ?? 200));
    return () => clearTimeout(t);
  }, [idx, frames]);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const px = frames[idx]?.pixels;
    const img = ctx.createImageData(W, H);
    for (let k = 0; k < W * H; k++) {
      const on = px?.[k];
      img.data[k * 4] = on ? 224 : 0;
      img.data[k * 4 + 1] = on ? 242 : 0;
      img.data[k * 4 + 2] = on ? 254 : 0;
      img.data[k * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }, [idx, frames]);

  return (
    <canvas
      ref={ref}
      width={W}
      height={H}
      className={`block w-full h-auto rounded-md bg-black ${className}`}
      style={{ imageRendering: "pixelated", aspectRatio: "2 / 1" }}
    />
  );
}

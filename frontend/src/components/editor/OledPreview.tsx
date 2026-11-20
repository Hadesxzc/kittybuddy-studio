import { useEffect, useRef } from "react";
import { OLED_WIDTH, OLED_HEIGHT } from "../../types";

interface OledPreviewProps {
  pixels: Uint8Array;
  scale?: number;
  showBorder?: boolean;
  showInfo?: boolean;
}

export function OledPreview({
  pixels,
  scale = 3,
  showBorder = true,
  showInfo = false,
}: OledPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = OLED_WIDTH * scale;
    const h = OLED_HEIGHT * scale;
    canvas.width = w;
    canvas.height = h;

    // Simulated OLED background
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, w, h);

    // Draw pixels with slight glow (simulating OLED)
    for (let y = 0; y < OLED_HEIGHT; y++) {
      for (let x = 0; x < OLED_WIDTH; x++) {
        if (pixels[y * OLED_WIDTH + x]) {
          ctx.fillStyle = "#e0e0e0";
          ctx.fillRect(x * scale, y * scale, scale, scale);
          // Subtle glow
          if (scale >= 3) {
            ctx.fillStyle = "rgba(224, 224, 224, 0.15)";
            ctx.fillRect(x * scale - 1, y * scale - 1, scale + 2, scale + 2);
            ctx.fillStyle = "#e0e0e0";
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
    }
  }, [pixels, scale]);

  return (
    <div className="flex flex-col items-center">
      {showInfo && (
        <div className="terminal-label text-[#475569] mb-2">
          SH1106 · {OLED_WIDTH}x{OLED_HEIGHT} · MONO
        </div>
      )}
      <div
        className="oled-screen p-2"
        style={{
          borderRadius: 8,
          boxShadow: showBorder
            ? "inset 0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(124, 58, 237, 0.1), 0 4px 16px rgba(0,0,0,0.5)"
            : "none",
          border: "2px solid #1a1a1a",
          background: "#0a0a0a",
        }}
      >
        {/* OLED bezel effect */}
        <div className="relative" style={{ borderRadius: 4, overflow: "hidden" }}>
          <canvas
            ref={canvasRef}
            className="block"
            style={{ imageRendering: "pixelated", borderRadius: 2 }}
          />
          {/* Subtle screen reflection */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.01) 100%)",
            }}
          />
        </div>
      </div>
      {showInfo && (
        <div className="terminal-label text-[#475569] mt-2">
          display.preview
        </div>
      )}
    </div>
  );
}

import { useRef, useCallback, useEffect, type MouseEvent } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { OLED_WIDTH, OLED_HEIGHT } from "../../types";

interface PixelCanvasProps {
  externalPixels?: Uint8Array;
  onPixelChange?: (pixels: Uint8Array) => void;
  editable?: boolean;
}

export function PixelCanvas({ externalPixels, onPixelChange, editable = true }: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editor = useEditorStore();
  const {
    pixels,
    tool,
    showGrid,
    zoom,
    isDrawing,
    lineStart,
    drawPixel,
    drawLine,
    drawRect,
    drawCircle,
    fillArea,
    setDrawing,
    setLineStart,
    pushUndo,
    setCursor,
  } = editor;

  const displayPixels = externalPixels ?? pixels;
  const pixelSize = 6 * zoom;

  // Render the canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = OLED_WIDTH * pixelSize;
    const h = OLED_HEIGHT * pixelSize;
    canvas.width = w;
    canvas.height = h;

    // Background
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    // Pixels
    ctx.fillStyle = "#e2e8f0";
    for (let y = 0; y < OLED_HEIGHT; y++) {
      for (let x = 0; x < OLED_WIDTH; x++) {
        if (displayPixels[y * OLED_WIDTH + x]) {
          ctx.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
        }
      }
    }

    // Grid
    if (showGrid && pixelSize >= 4) {
      ctx.strokeStyle = "rgba(42, 46, 58, 0.4)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x <= OLED_WIDTH; x++) {
        ctx.beginPath();
        ctx.moveTo(x * pixelSize, 0);
        ctx.lineTo(x * pixelSize, h);
        ctx.stroke();
      }
      for (let y = 0; y <= OLED_HEIGHT; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * pixelSize);
        ctx.lineTo(w, y * pixelSize);
        ctx.stroke();
      }
    }

    // Grid major lines every 8 pixels
    if (showGrid && pixelSize >= 4) {
      ctx.strokeStyle = "rgba(58, 63, 80, 0.5)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= OLED_WIDTH; x += 8) {
        ctx.beginPath();
        ctx.moveTo(x * pixelSize, 0);
        ctx.lineTo(x * pixelSize, h);
        ctx.stroke();
      }
      for (let y = 0; y <= OLED_HEIGHT; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y * pixelSize);
        ctx.lineTo(w, y * pixelSize);
        ctx.stroke();
      }
    }
  }, [displayPixels, pixelSize, showGrid]);

  useEffect(() => {
    renderCanvas();
  }, [renderCanvas]);

  const getMousePos = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * OLED_WIDTH);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * OLED_HEIGHT);
    return { x: Math.max(0, Math.min(OLED_WIDTH - 1, x)), y: Math.max(0, Math.min(OLED_HEIGHT - 1, y)) };
  };

  const handleMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!editable) return;
    const { x, y } = getMousePos(e);
    setCursor(x, y);
    pushUndo();

    switch (tool) {
      case "pencil":
        setDrawing(true);
        drawPixel(x, y, 1);
        break;
      case "eraser":
        setDrawing(true);
        drawPixel(x, y, 0);
        break;
      case "fill":
        fillArea(x, y, displayPixels[y * OLED_WIDTH + x] ? 0 : 1);
        break;
      case "line":
        setLineStart({ x, y });
        break;
      case "rectangle":
        setLineStart({ x, y });
        break;
      case "circle":
        setLineStart({ x, y });
        break;
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getMousePos(e);
    setCursor(x, y);
    if (!editable || !isDrawing) return;

    switch (tool) {
      case "pencil":
        // Draw line from last position for smooth strokes
        const prevX = editor.cursorX;
        const prevY = editor.cursorY;
        drawLine(prevX, prevY, x, y, 1);
        break;
      case "eraser":
        const prevEx = editor.cursorX;
        const prevEy = editor.cursorY;
        drawLine(prevEx, prevEy, x, y, 0);
        break;
    }
  };

  const handleMouseUp = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!editable) return;
    const { x, y } = getMousePos(e);
    setDrawing(false);

    if (lineStart) {
      switch (tool) {
        case "line":
          drawLine(lineStart.x, lineStart.y, x, y, 1);
          break;
        case "rectangle":
          drawRect(lineStart.x, lineStart.y, x, y, false, 1);
          break;
        case "circle": {
          const dx = x - lineStart.x;
          const dy = y - lineStart.y;
          const r = Math.round(Math.sqrt(dx * dx + dy * dy));
          drawCircle(lineStart.x, lineStart.y, r, 1);
          break;
        }
      }
      setLineStart(null);
    }

    // Notify parent of pixel changes
    if (onPixelChange) {
      onPixelChange(useEditorStore.getState().pixels);
    }
  };

  const handleMouseLeave = () => {
    setDrawing(false);
    setLineStart(null);
  };

  return (
    <div className="relative overflow-auto flex items-center justify-center p-4 bg-[#06070a] rounded">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="oled-screen cursor-crosshair"
        style={{ imageRendering: "pixelated" }}
      />
    </div>
  );
}

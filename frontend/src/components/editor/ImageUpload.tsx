import { useRef, useState, useCallback } from "react";
import { Upload, Image as ImageIcon, RotateCcw, Download } from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import { processImage } from "../../utils/imageProcessor";
import { pixelsToDataURL } from "../../utils/imageProcessor";
import { OLED_WIDTH, OLED_HEIGHT } from "../../types";

export function ImageUpload() {
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditorStore();
  const [processing, setProcessing] = useState(false);
  const [previewPixels, setPreviewPixels] = useState<Uint8Array | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setProcessing(true);
    setFileName(file.name);
    try {
      const pixels = await processImage(file, editor.imageAdjustments);
      setPreviewPixels(pixels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process image");
    } finally {
      setProcessing(false);
    }
  }, [editor.imageAdjustments]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const applyToCanvas = () => {
    if (!previewPixels) return;
    editor.setPixels(previewPixels);
  };

  const adjustments = editor.imageAdjustments;

  return (
    <div className="flex flex-col gap-3 p-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/bmp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {/* Drop zone */}
      <div
        className="border-2 border-dashed border-[#2a2e3a] rounded-lg p-6 text-center cursor-pointer hover:border-[#c084fc] transition-colors"
        onClick={() => fileRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        {processing ? (
          <div className="terminal-text text-[#c084fc] animate-pulse">
            PROCESSING IMAGE…
          </div>
        ) : (
          <>
            <Upload size={24} className="mx-auto mb-2 text-[#475569]" />
            <div className="text-xs text-[#94a3b8]">Drop image or click to upload</div>
            <div className="terminal-label text-[#475569] mt-1">
              PNG · JPG · BMP · GIF
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="terminal-text text-[#f87171] text-center">{error}</div>
      )}

      {fileName && (
        <div className="terminal-label text-[#94a3b8] flex items-center gap-1.5">
          <ImageIcon size={12} />
          {fileName}
        </div>
      )}

      {/* Preview */}
      {previewPixels && (
        <div className="space-y-2">
          <div className="terminal-label text-[#475569]">converted.preview</div>
          <div className="bg-black rounded p-2 flex justify-center">
            <img
              src={pixelsToDataURL(previewPixels, OLED_WIDTH, OLED_HEIGHT, 3)}
              alt="Preview"
              className="oled-screen"
              style={{ imageRendering: "pixelated" }}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn btn-primary flex-1 text-xs" onClick={applyToCanvas}>
              <Download size={12} /> Apply to Canvas
            </button>
            <button
              className="btn btn-ghost text-xs"
              onClick={() => {
                setPreviewPixels(null);
                setFileName("");
              }}
            >
              <RotateCcw size={12} /> Reset
            </button>
          </div>
        </div>
      )}

      {/* Adjustments */}
      <div className="space-y-3 pt-2 border-t border-[#1e2129]">
        <div className="terminal-label text-[#475569]">image.adjustments</div>

        {/* Brightness */}
        <SliderControl
          label="brightness"
          value={adjustments.brightness}
          min={-100}
          max={100}
          onChange={(v) => editor.setImageAdjustments({ brightness: v })}
        />

        {/* Contrast */}
        <SliderControl
          label="contrast"
          value={adjustments.contrast}
          min={-100}
          max={100}
          onChange={(v) => editor.setImageAdjustments({ contrast: v })}
        />

        {/* Threshold */}
        <SliderControl
          label="threshold"
          value={adjustments.threshold}
          min={0}
          max={255}
          onChange={(v) => editor.setImageAdjustments({ threshold: v })}
        />

        {/* Scale */}
        <SliderControl
          label="scale"
          value={adjustments.scale}
          min={10}
          max={200}
          suffix="%"
          onChange={(v) => editor.setImageAdjustments({ scale: v })}
        />

        {/* Dithering */}
        <div>
          <div className="terminal-label text-[#475569] mb-1">dithering.mode</div>
          <select
            className="input-field"
            value={adjustments.dithering}
            onChange={(e) =>
              editor.setImageAdjustments({
                dithering: e.target.value as "none" | "floyd-steinberg" | "ordered",
              })
            }
          >
            <option value="none">None (Threshold)</option>
            <option value="floyd-steinberg">Floyd-Steinberg</option>
            <option value="ordered">Ordered (Bayer)</option>
          </select>
        </div>

        {/* Invert */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={adjustments.invert}
            onChange={(e) => editor.setImageAdjustments({ invert: e.target.checked })}
            className="accent-[#c084fc]"
          />
          <span className="terminal-text text-[#94a3b8]">invert.colors</span>
        </label>

        {/* Offset */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="terminal-label text-[#475569] mb-1">offset.x</div>
            <input
              type="number"
              className="input-field"
              value={adjustments.offsetX}
              onChange={(e) => editor.setImageAdjustments({ offsetX: parseInt(e.target.value) || 0 })}
            />
          </div>
          <div>
            <div className="terminal-label text-[#475569] mb-1">offset.y</div>
            <input
              type="number"
              className="input-field"
              value={adjustments.offsetY}
              onChange={(e) => editor.setImageAdjustments({ offsetY: parseInt(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* Re-process button */}
        {fileName && (
          <button
            className="btn w-full text-xs"
            onClick={() => {
              if (fileRef.current?.files?.[0]) {
                handleFile(fileRef.current.files[0]);
              }
            }}
          >
            <RotateCcw size={12} /> Re-process with new settings
          </button>
        )}
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between terminal-label mb-1">
        <span className="text-[#475569]">{label}</span>
        <span className="text-[#c084fc]">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full accent-[#c084fc] h-1"
      />
    </div>
  );
}

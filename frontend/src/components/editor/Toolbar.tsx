import {
  Pencil,
  Eraser,
  PaintBucket,
  Minus as LineIcon,
  Square,
  Circle,
  Undo2,
  Redo2,
  Trash2,
  Grid3x3,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useEditorStore } from "../../stores/editorStore";
import type { ToolType } from "../../types";

const TOOLS: { id: ToolType; icon: typeof Pencil; label: string }[] = [
  { id: "pencil", icon: Pencil, label: "Pencil" },
  { id: "eraser", icon: Eraser, label: "Eraser" },
  { id: "fill", icon: PaintBucket, label: "Fill" },
  { id: "line", icon: LineIcon, label: "Line" },
  { id: "rectangle", icon: Square, label: "Rectangle" },
  { id: "circle", icon: Circle, label: "Circle" },
];

export function Toolbar() {
  const editor = useEditorStore();

  return (
    <div className="flex flex-col items-center gap-1 p-2 bg-[#06070a] border-r border-[#1e2129]">
      {/* Tools */}
      <div className="space-y-0.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          const active = editor.tool === t.id;
          return (
            <button
              key={t.id}
              className={`w-9 h-9 rounded flex items-center justify-center transition-all group relative ${
                active
                  ? "bg-[#7c3aed] text-white"
                  : "text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218]"
              }`}
              style={active ? { boxShadow: "0 0 8px rgba(124, 58, 237, 0.4)" } : {}}
              onClick={() => editor.setTool(t.id)}
              title={t.label}
            >
              <Icon size={16} />
              <span className="absolute left-12 px-2 py-1 bg-[#1c1f2b] rounded text-xs text-[#e2e8f0] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {t.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="w-7 h-px bg-[#1e2129] my-2" />

      {/* Actions */}
      <button
        className="w-9 h-9 rounded flex items-center justify-center text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218] transition-all disabled:opacity-30"
        onClick={editor.undo}
        disabled={editor.undoStack.length === 0}
        title="Undo"
      >
        <Undo2 size={16} />
      </button>
      <button
        className="w-9 h-9 rounded flex items-center justify-center text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218] transition-all disabled:opacity-30"
        onClick={editor.redo}
        disabled={editor.redoStack.length === 0}
        title="Redo"
      >
        <Redo2 size={16} />
      </button>

      <div className="w-7 h-px bg-[#1e2129] my-2" />

      <button
        className={`w-9 h-9 rounded flex items-center justify-center transition-all ${
          editor.showGrid
            ? "text-[#c084fc] bg-[#101218]"
            : "text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218]"
        }`}
        onClick={editor.toggleGrid}
        title="Toggle Grid"
      >
        <Grid3x3 size={16} />
      </button>

      <button
        className="w-9 h-9 rounded flex items-center justify-center text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218] transition-all"
        onClick={() => editor.setZoom(editor.zoom + 0.5)}
        title="Zoom In"
      >
        <ZoomIn size={16} />
      </button>
      <button
        className="w-9 h-9 rounded flex items-center justify-center text-[#475569] hover:text-[#94a3b8] hover:bg-[#101218] transition-all"
        onClick={() => editor.setZoom(editor.zoom - 0.5)}
        title="Zoom Out"
      >
        <ZoomOut size={16} />
      </button>

      <div className="w-7 h-px bg-[#1e2129] my-2" />

      <button
        className="w-9 h-9 rounded flex items-center justify-center text-[#f87171] hover:bg-[rgba(248,113,113,0.1)] transition-all"
        onClick={() => {
          if (confirm("Clear the entire canvas?")) editor.clearCanvas();
        }}
        title="Clear Canvas"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}

import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  Pencil,
  Play,
  FileJson,
} from "lucide-react";
import { useProjectStore } from "../stores/projectStore";
import { pixelsToDataURL } from "../utils/imageProcessor";
import { OLED_WIDTH, OLED_HEIGHT, type KittyProject } from "../types";

export function ProjectLibrary() {
  const navigate = useNavigate();
  const project = useProjectStore();
  const importRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    const name = newName.trim() || "Untitled Project";
    const id = await project.createProject(name);
    await project.setActiveProject(id);
    navigate("/editor");
    setNewName("");
  };

  const handleOpen = async (id: string) => {
    await project.setActiveProject(id);
    navigate("/editor");
  };

  const handleDuplicate = async (id: string) => {
    await project.duplicateProject(id);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this project? This cannot be undone.")) {
      await project.deleteProject(id);
    }
  };

  const handleRename = async (id: string) => {
    if (editName.trim()) {
      await project.renameProject(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleExport = (id: string) => {
    const json = project.exportProject(id);
    if (!json) return;
    const p = project.projects.find((pr) => pr.id === id);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p?.name ?? "project"}.kittybuddy.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const text = await file.text();
    await project.importProject(text);
  };

  const fmtRel = (ts: number) => {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="p-6 space-y-6">
      <header className="fade-in">
        <div className="flex items-center gap-2 mb-1">
          <span className="terminal-label text-[#c084fc]">projects.db</span>
          <span className="terminal-label text-[#475569]">// project library</span>
        </div>
        <h1 className="text-2xl font-semibold text-[#e2e8f0] tracking-tight">Project Library</h1>
        <p className="terminal-text text-[#94a3b8] mt-1">Manage your KittyBuddy character projects.</p>
      </header>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <input className="input-field max-w-xs" placeholder="New project name…"
          value={newName} onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }} />
        <button className="btn btn-primary" onClick={handleCreate}>
          <Plus size={14} /> New Project
        </button>
        <input ref={importRef} type="file" accept=".json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); }} />
        <button className="btn" onClick={() => importRef.current?.click()}>
          <Upload size={14} /> Import
        </button>
      </div>

      {/* Project grid */}
      {project.projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <FolderKanban size={40} className="text-[#475569] mb-3" />
          <p className="terminal-text text-[#475569] mb-3">No projects yet</p>
          <button className="btn btn-primary" onClick={handleCreate}>
            <Plus size={14} /> Create Your First Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {project.projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              isActive={p.id === project.activeProjectId}
              editing={editingId === p.id}
              editName={editName}
              onEditName={(v) => setEditName(v)}
              onStartEdit={() => { setEditingId(p.id); setEditName(p.name); }}
              onSaveName={() => handleRename(p.id)}
              onOpen={() => handleOpen(p.id)}
              onDuplicate={() => handleDuplicate(p.id)}
              onExport={() => handleExport(p.id)}
              onDelete={() => handleDelete(p.id)}
              fmtRel={fmtRel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project, isActive, editing, editName, onEditName, onStartEdit, onSaveName,
  onOpen, onDuplicate, onExport, onDelete, fmtRel,
}: {
  project: KittyProject;
  isActive: boolean;
  editing: boolean;
  editName: string;
  onEditName: (v: string) => void;
  onStartEdit: () => void;
  onSaveName: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
  fmtRel: (ts: number) => string;
}) {
  const thumb = project.thumbnail ?? pixelsToDataURL(project.currentFramePixels, OLED_WIDTH, OLED_HEIGHT, 3);

  return (
    <div className={`window fade-in group ${isActive ? "glow-border" : ""}`}>
      {/* Thumbnail */}
      <div className="relative bg-black rounded-t overflow-hidden cursor-pointer" onClick={onOpen}>
        <div className="flex items-center justify-center p-4">
          <img src={thumb} alt={project.name} className="oled-screen" style={{ imageRendering: "pixelated" }} />
        </div>
        {isActive && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[#c084fc]/20 border border-[#c084fc]/40 terminal-label text-[#c084fc]">
            ACTIVE
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 border-t border-[#1e2129]">
        {editing ? (
          <div className="flex gap-1">
            <input className="input-field flex-1" value={editName} onChange={(e) => onEditName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onSaveName(); }} autoFocus />
            <button className="btn btn-ghost px-2" onClick={onSaveName}><FileJson size={12} /></button>
          </div>
        ) : (
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-medium text-[#e2e8f0] truncate">{project.name}</h3>
            <button className="opacity-0 group-hover:opacity-100 text-[#475569] hover:text-[#c084fc] transition-all"
              onClick={onStartEdit}>
              <Pencil size={12} />
            </button>
          </div>
        )}
        <div className="terminal-label text-[#475569]">
          {project.animations.length} animations · updated {fmtRel(project.updatedAt)}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 pb-3">
        <button className="btn btn-primary flex-1 text-xs" onClick={onOpen}>
          <Play size={12} /> Open
        </button>
        <button className="btn btn-ghost" onClick={onDuplicate} title="Duplicate">
          <Copy size={14} />
        </button>
        <button className="btn btn-ghost" onClick={onExport} title="Export JSON">
          <Download size={14} />
        </button>
        <button className="btn btn-ghost text-[#f87171]" onClick={onDelete} title="Delete">
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

export default ProjectLibrary;

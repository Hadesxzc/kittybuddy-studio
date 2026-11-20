import { X } from "lucide-react";
import { type ReactNode } from "react";

interface WindowProps {
  title: string;
  techLabel?: string;
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  actions?: ReactNode;
}

export function Window({ title, techLabel, children, className = "", onClose, actions }: WindowProps) {
  return (
    <div className={`window ${className}`}>
      <div className="window-titlebar">
        <div className="window-dot" style={{ background: "#f87171" }} />
        <div className="window-dot" style={{ background: "#fbbf24" }} />
        <div className="window-dot" style={{ background: "#4ade80" }} />
        <span className="terminal-text ml-2">{title}</span>
        {techLabel && <span className="tech-label ml-auto mr-2">{techLabel}</span>}
        {actions && <div className="ml-auto flex items-center gap-1">{actions}</div>}
        {onClose && (
          <button className="ml-auto hover:text-red-400 transition-colors" onClick={onClose}>
            <X size={14} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

import { useEffect, useState } from "react";

const BOOT_LINES = [
  "KITTYBUDDY.BIOS v1.0.0",
  "> INITIALIZING SYSTEM MEMORY …… OK",
  "> LOADING PIXEL ENGINE …… OK",
  "> MOUNTING ANIMATION TIMELINE …… OK",
  "> PROVISIONING DEVICE MANAGER …… OK",
  "> ATTACHING OLED SIMULATOR [128x64] …… OK",
  "> DEPLOYING WIFI COMMS MODULE …… OK",
  "> LINKING OTA FIRMWARE SERVICE …… OK",
  "> CONNECTING PROJECT DATABASE …… OK",
  "> RENDERING WORKSPACE …… OK",
  "",
  "KITTYBUDDY STUDIO IS READY.",
];

export function BootSequence({ onComplete }: { onComplete: () => void }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    if (skipped) {
      setVisibleLines(BOOT_LINES.length);
      setProgress(100);
      const t = setTimeout(onComplete, 300);
      return () => clearTimeout(t);
    }

    if (visibleLines >= BOOT_LINES.length) {
      const t = setTimeout(onComplete, 600);
      return () => clearTimeout(t);
    }

    const delay = visibleLines < 1 ? 300 : 130;
    const t = setTimeout(() => {
      setVisibleLines((v) => v + 1);
      setProgress(Math.round(((visibleLines + 1) / BOOT_LINES.length) * 100));
    }, delay);
    return () => clearTimeout(t);
  }, [visibleLines, skipped, onComplete]);

  return (
    <div
      className="fixed inset-0 bg-[#06070a] z-50 flex items-center justify-center cursor-pointer"
      onClick={() => setSkipped(true)}
    >
      {/* Scan line effect */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(124,58,237,0.03), transparent 70%)",
        }}
      />

      {/* Grid background */}
      <div className="absolute inset-0 grid-bg opacity-30" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl px-8">
        {/* Logo / Title */}
        <div className="mb-12 text-center">
          <div className="terminal-label text-[#475569] mb-2">
            NORTHBOUND.BIOS
          </div>
          <h1
            className="font-mono text-3xl md:text-4xl text-[#e2e8f0] tracking-tight"
            style={{ textShadow: "0 0 20px rgba(192, 132, 252, 0.3)" }}
          >
            KITTYBUDDY STUDIO
          </h1>
          <div className="terminal-label text-[#7c3aed] mt-2">
            ◆ OLED COMPANION DESIGNER ◆
          </div>
        </div>

        {/* Boot log */}
        <div className="terminal-text space-y-0.5 min-h-[260px]">
          {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
            <div
              key={i}
              className={`fade-in ${
                line === ""
                  ? "h-3"
                  : line.includes("READY")
                    ? "text-[#4ade80] font-mono"
                    : "text-[#94a3b8]"
              }`}
            >
              {line}
            </div>
          ))}
          {visibleLines < BOOT_LINES.length && (
            <span className="text-[#c084fc] animate-pulse">_</span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-8">
          <div className="flex justify-between terminal-label mb-1.5">
            <span className="text-[#475569]">LOADING</span>
            <span className="text-[#c084fc]">{progress}%</span>
          </div>
          <div className="h-0.5 bg-[#1e2129] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#c084fc] rounded-full transition-all duration-200"
              style={{
                width: `${progress}%`,
                boxShadow: "0 0 8px rgba(192, 132, 252, 0.6)",
              }}
            />
          </div>
        </div>

        {/* Skip */}
        <div className="mt-6 text-center">
          <button
            className="terminal-label text-[#475569] hover:text-[#c084fc] transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              setSkipped(true);
            }}
          >
            SKIP ▸
          </button>
        </div>
      </div>
    </div>
  );
}

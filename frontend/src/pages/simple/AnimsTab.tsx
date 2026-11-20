import { useState } from "react";
import { Play, Pencil, Trash2, Plus } from "lucide-react";
import { Screen } from "../../components/simple/Screen";
import { useAnimationStore } from "../../stores/animationStore";
import { useUiStore, drawingPixels } from "../../stores/uiStore";
import { ANIMATION_PRESETS } from "../../data/presets";
import { sendToDevice } from "../../utils/send";
import { MAX_TOTAL_FRAMES, unpackFrame } from "../../utils/deviceProtocol";
import { CAPTURED } from "../../data/capturedAnimations";
import { clonePixels, nanoid, type AnimationPreset } from "../../types";

const toPreset = (c: (typeof CAPTURED)[number]): AnimationPreset => ({
  id: c.name,
  name: c.name,
  description: "",
  category: "expression",
  loop: c.loop,
  defaultDuration: 200,
  frames: c.frames.map((f, i) => ({ id: nanoid(), pixels: unpackFrame(f.b), duration: f.d, label: `Frame ${i + 1}` })),
});

const SETS = [
  { id: "robo" as const, title: "Robo Eyes", note: "Idle + happy, curious, annoyed, sad" },
  { id: "kitty" as const, title: "Kitty", note: "Idle blink + peace, smile, wink, sleep, surprised" },
].map((s) => ({ ...s, presets: CAPTURED.filter((c) => c.set === s.id).map(toPreset) }));

export function AnimsTab() {
  const animations = useAnimationStore((s) => s.animations);
  const edit = useUiStore((s) => s.edit);
  const showToast = useUiStore((s) => s.showToast);
  const [busy, setBusy] = useState<string | null>(null);

  const totalFrames = animations.reduce((n, a) => n + a.frames.length, 0) + 1;

  const play = async (id: string) => {
    setBusy(id);
    const r = await sendToDevice(id);
    setBusy(null);
    showToast(r.message, r.ok);
  };

  const newFromDrawing = () => {
    const a = useAnimationStore.getState();
    const id = a.createAnimation(`Animation ${animations.length + 1}`);
    a.setFramePixels(id, 0, clonePixels(drawingPixels()));
    edit({ kind: "frame", animId: id, frameIndex: 0 });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h1 className="text-lg font-semibold text-[#e2e8f0]">Animations</h1>
          <p className="text-sm text-[#94a3b8]">
            Tap Play to show one on your KittyBuddy. The BOOT button on the board switches between them.
          </p>
        </div>

        {animations.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#2a2e3a] p-6 text-center text-sm text-[#94a3b8]">
            No animations yet. Add one below.
          </div>
        )}

        {animations.map((a) => (
          <div key={a.id} className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-3 flex gap-3 items-center">
            <div className="w-28 shrink-0">
              <Screen frames={a.frames} />
            </div>
            <div className="flex-1 min-w-0">
              <input
                className="w-full bg-transparent text-sm font-semibold text-[#e2e8f0] outline-none border-b border-transparent focus:border-[#c084fc]"
                value={a.name}
                maxLength={23}
                onChange={(e) => useAnimationStore.getState().renameAnimation(a.id, e.target.value)}
              />
              <div className="text-xs text-[#475569] mb-2">{a.frames.length} frame{a.frames.length === 1 ? "" : "s"}</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => play(a.id)}
                  disabled={busy !== null}
                  className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-[#7c3aed] text-white text-xs font-medium py-2 disabled:opacity-60"
                >
                  <Play size={14} /> {busy === a.id ? "Sending…" : "Play"}
                </button>
                <button
                  onClick={() => edit({ kind: "frame", animId: a.id, frameIndex: 0 })}
                  className="rounded-lg border border-[#2a2e3a] bg-[#161922] px-3 text-[#94a3b8]"
                  aria-label="Edit"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => confirm(`Delete "${a.name}"?`) && useAnimationStore.getState().deleteAnimation(a.id)}
                  className="rounded-lg border border-[#2a2e3a] bg-[#161922] px-3 text-[#f87171]"
                  aria-label="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}

        {totalFrames > MAX_TOTAL_FRAMES && (
          <p className="text-sm text-[#fbbf24]">
            {totalFrames} frames in total. The device holds {MAX_TOTAL_FRAMES}, so delete some before sending.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-[#e2e8f0]">Your original animations</h2>
          <p className="text-sm text-[#94a3b8]">
            Recorded from your old sketches. Add a set, then Play its Idle. BOOT plays the moods and it returns to idle, like before.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SETS.map((s) => {
            const have = s.presets.filter((p) => animations.some((a) => a.name === p.name)).length;
            return (
              <div key={s.id} className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-2 space-y-2">
                <Screen frames={s.presets[0].frames} />
                <div>
                  <div className="text-sm font-semibold text-[#e2e8f0]">{s.title}</div>
                  <div className="text-[11px] text-[#475569] leading-snug">{s.note}</div>
                </div>
                <button
                  disabled={have === s.presets.length}
                  onClick={() => {
                    for (const p of s.presets) {
                      const st = useAnimationStore.getState();
                      if (!st.animations.some((a) => a.name === p.name)) st.loadPreset(p);
                    }
                    showToast(`Added ${s.title}. Tap Play on "${s.presets[0].name}".`);
                  }}
                  className="w-full rounded-lg bg-[#7c3aed] text-white text-xs font-medium py-2 disabled:opacity-40"
                >
                  {have === s.presets.length ? "Added" : have ? "Add the rest" : "Add set"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[#e2e8f0]">Add an animation</h2>
        <button onClick={newFromDrawing} className="btn w-full py-3 text-sm">
          <Plus size={16} /> New, starting from my drawing
        </button>
        <div className="grid grid-cols-2 gap-2">
          {ANIMATION_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                useAnimationStore.getState().loadPreset(p);
                showToast(`Added "${p.name}"`);
              }}
              className="rounded-xl border border-[#2a2e3a] bg-[#101218] p-2 text-left hover:border-[#c084fc]"
            >
              <Screen frames={p.frames} />
              <div className="mt-1.5 text-xs font-medium text-[#e2e8f0] truncate">{p.name}</div>
              <div className="text-[11px] text-[#475569] truncate">{p.description}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

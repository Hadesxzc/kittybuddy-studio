/*
 * Press Start 2P (SIL Open Font License 1.1, (c) The Press Start 2P Project Authors).
 * The font is drawn on an 8x8 pixel grid, so rendering it at 8px and
 * thresholding gives the exact glyph pixels. Bundled so it works offline.
 */
import fontUrl from "@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2?url";

const FAMILY = "KB Press Start 2P";
const glyphs = new Map<string, string>();
let loading: Promise<void> | null = null;

export function pressStartGlyph(ch: string): string | undefined {
  return glyphs.get(ch);
}

export function pressStartReady(): boolean {
  return glyphs.size > 0;
}

export function loadPressStart(): Promise<void> {
  if (!loading) loading = build().catch((e) => { console.warn("Press Start 2P failed to load", e); });
  return loading;
}

async function build() {
  const face = new FontFace(FAMILY, `url(${fontUrl})`);
  await face.load();
  document.fonts.add(face);

  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.font = `8px "${FAMILY}"`;
  ctx.textBaseline = "alphabetic";

  const render = (ch: string) => {
    ctx.clearRect(0, 0, 16, 16);
    ctx.fillStyle = "#fff";
    ctx.fillText(ch, 4, 11); // baseline at y=11 leaves room above and below
    return ctx.getImageData(0, 0, 16, 16).data;
  };
  const on = (d: Uint8ClampedArray, x: number, y: number) => d[(y * 16 + x) * 4 + 3] >= 128;

  // Find where the cell starts from "H" (cap top, left edge)
  const h = render("H");
  let top = 16, left = 16;
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++)
      if (on(h, x, y)) { top = Math.min(top, y); left = Math.min(left, x); }
  if (top === 16) throw new Error("font did not render");

  for (let code = 32; code < 127; code++) {
    const ch = String.fromCharCode(code);
    const d = render(ch);
    const rows: string[] = [];
    for (let r = 0; r < 8; r++) {
      let row = "";
      for (let col = 0; col < 8; col++) row += on(d, left + col, top + r) ? "#" : ".";
      rows.push(row);
    }
    glyphs.set(ch, rows.join(" "));
  }
}

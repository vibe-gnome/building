export type Stop = { pos: number; color: [number, number, number] };

export interface Palette {
  name: string;
  stops: Stop[];
  ink: [number, number, number];
  paper: [number, number, number];
}

const rgb = (hex: string): [number, number, number] => [
  Number.parseInt(hex.slice(1, 3), 16) / 255,
  Number.parseInt(hex.slice(3, 5), 16) / 255,
  Number.parseInt(hex.slice(5, 7), 16) / 255,
];

export const PALETTES = [
  {
    name: "GNOME Green",
    stops: [
      { pos: 0, color: rgb("#12351b") },
      { pos: 0.22, color: rgb("#3a944a") },
      { pos: 0.46, color: rgb("#6dcc7b") },
      { pos: 0.72, color: rgb("#ffcf4d") },
      { pos: 1, color: rgb("#f7fff8") },
    ],
    ink: rgb("#2d7d3b"),
    paper: rgb("#f7fff8"),
  },
  {
    name: "Molten",
    stops: [
      { pos: 0, color: rgb("#28060a") },
      { pos: 0.22, color: rgb("#d21414") },
      { pos: 0.46, color: rgb("#ff6a1f") },
      { pos: 0.72, color: rgb("#ffcf52") },
      { pos: 1, color: rgb("#fff7ec") },
    ],
    ink: rgb("#7a1410"),
    paper: rgb("#fff7ec"),
  },
  {
    name: "Bubblegum",
    stops: [
      { pos: 0, color: rgb("#2a0718") },
      { pos: 0.22, color: rgb("#ff1e8e") },
      { pos: 0.46, color: rgb("#ff7ab0") },
      { pos: 0.72, color: rgb("#ffe0b0") },
      { pos: 1, color: rgb("#fff5fa") },
    ],
    ink: rgb("#8a0e52"),
    paper: rgb("#fff5fa"),
  },
  {
    name: "Electric",
    stops: [
      { pos: 0, color: rgb("#04102e") },
      { pos: 0.22, color: rgb("#1550ff") },
      { pos: 0.46, color: rgb("#25c8ff") },
      { pos: 0.72, color: rgb("#bff0ff") },
      { pos: 1, color: rgb("#f4faff") },
    ],
    ink: rgb("#0a2b8c"),
    paper: rgb("#f4faff"),
  },
  {
    name: "Jade",
    stops: [
      { pos: 0, color: rgb("#03170f") },
      { pos: 0.22, color: rgb("#0f7a4a") },
      { pos: 0.46, color: rgb("#1fd88a") },
      { pos: 0.72, color: rgb("#b8f5d8") },
      { pos: 1, color: rgb("#f3fbf6") },
    ],
    ink: rgb("#0a3d28"),
    paper: rgb("#f3fbf6"),
  },
  {
    name: "Sunburst",
    stops: [
      { pos: 0, color: rgb("#04161c") },
      { pos: 0.22, color: rgb("#0e7d86") },
      { pos: 0.46, color: rgb("#f2a20c") },
      { pos: 0.72, color: rgb("#ffe27a") },
      { pos: 1, color: rgb("#fefaf0") },
    ],
    ink: rgb("#0a3a40"),
    paper: rgb("#fefaf0"),
  },
] satisfies Palette[];

export interface PaletteUniforms {
  positions: number[];
  colors: number[];
  ink: number[];
  paper: number[];
}

export function paletteUniforms(palette: Palette): PaletteUniforms {
  const positions: number[] = [];
  const colors: number[] = [];

  for (let index = 0; index < 5; index++) {
    const stop = palette.stops[Math.min(index, palette.stops.length - 1)];
    if (!stop) continue;
    positions.push(stop.pos);
    colors.push(...stop.color);
  }

  return {
    positions,
    colors,
    ink: palette.ink,
    paper: palette.paper,
  };
}

const LUMA: readonly [number, number, number] = [0.2126, 0.7152, 0.0722];

function channel(values: number[], index: number) {
  return values[index] ?? 0;
}

function satPreserveLerp(x: number[], y: number[], t: number): number[] {
  const out = x.map((value, index) => {
    const next = y[index] ?? value;
    return value + (next - value) * t;
  });
  const bell = Math.sin(Math.PI * t);
  if (bell < 0.0001) return out;

  const saturationOf = (red: number, green: number, blue: number) => {
    const maximum = Math.max(red, green, blue);
    return maximum === 0 ? 0 : (maximum - Math.min(red, green, blue)) / maximum;
  };

  for (let index = 0; index + 2 < out.length; index += 3) {
    const red = channel(out, index);
    const green = channel(out, index + 1);
    const blue = channel(out, index + 2);
    const target = Math.max(
      saturationOf(
        channel(x, index),
        channel(x, index + 1),
        channel(x, index + 2),
      ),
      saturationOf(
        channel(y, index),
        channel(y, index + 1),
        channel(y, index + 2),
      ),
    );
    const saturation = saturationOf(red, green, blue);
    if (saturation < 0.0001 || target < 0.0001) continue;

    const scale = (saturation + (target - saturation) * bell) / saturation;
    const luminance = LUMA[0] * red + LUMA[1] * green + LUMA[2] * blue;
    out[index] = Math.min(
      1,
      Math.max(0, luminance + (red - luminance) * scale),
    );
    out[index + 1] = Math.min(
      1,
      Math.max(0, luminance + (green - luminance) * scale),
    );
    out[index + 2] = Math.min(
      1,
      Math.max(0, luminance + (blue - luminance) * scale),
    );
  }

  return out;
}

export function lerpPaletteUniforms(
  a: PaletteUniforms,
  b: PaletteUniforms,
  t: number,
): PaletteUniforms {
  if (t <= 0) {
    return {
      positions: [...a.positions],
      colors: [...a.colors],
      ink: [...a.ink],
      paper: [...a.paper],
    };
  }
  if (t >= 1) {
    return {
      positions: [...b.positions],
      colors: [...b.colors],
      ink: [...b.ink],
      paper: [...b.paper],
    };
  }

  const lerpArray = (x: number[], y: number[]) =>
    x.map((value, index) => {
      const next = y[index] ?? value;
      return value + (next - value) * t;
    });

  return {
    positions: lerpArray(a.positions, b.positions),
    colors: satPreserveLerp(a.colors, b.colors, t),
    ink: satPreserveLerp(a.ink, b.ink, t),
    paper: satPreserveLerp(a.paper, b.paper, t),
  };
}

export const WORDS = ["Vibe coding for GNOME.\nWhy not?"];
export const CYCLE_WORDS = WORDS.length > 1;

export const HOLD_SCALE = [1];
export const GRAIN = 0.4;
export const MORPH_LEAD = 0.78;
export const MORPH_LAG = 1.3;
export const CAST_DIR: readonly [number, number] = [0.38, 0.92];
export const CAST_STEP: readonly [number, number, number, number] = [
  0.0008, 0.0022, 0.0042, 0.0075,
];
export const LETTER_SPREAD = 0.45;
export const WARP_RADIUS = 0.2;
export const WARP_AMP = 0.013;
export const WARP_SWIRL = 0.6;
export const WARP_DRAG = 0.26;
export const WARP_STRETCH = 0.5;
export const BREATH = 0.22;

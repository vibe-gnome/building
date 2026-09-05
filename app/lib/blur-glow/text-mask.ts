export interface WordMask {
  canvas: HTMLCanvasElement;
  x0: number;
  x1: number;
}

export function makeWordMask(
  word: string,
  width: number,
  height: number,
  fontFamily: string,
): WordMask {
  const canvasWidth = Math.max(1, Math.round(width));
  const canvasHeight = Math.max(1, Math.round(height));
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) return { canvas, x0: 0.45, x1: 0.55 };

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  const lines = word
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return { canvas, x0: 0.45, x1: 0.55 };

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight * 0.52;
  const maximumWidth = canvasWidth * 0.84;
  let size = canvasHeight * (lines.length > 1 ? 0.22 : 0.34);

  const measureLines = () => {
    const letterSpacing = size * 0.015;
    return lines.map((line) => {
      const characters = [...line];
      const widths = characters.map(
        (character) => context.measureText(character).width,
      );
      return {
        characters,
        letterSpacing,
        totalWidth:
          widths.reduce((total, characterWidth) => total + characterWidth, 0) +
          letterSpacing * (characters.length - 1),
        widths,
      };
    });
  };

  context.font = `600 ${size}px ${fontFamily}`;
  let lineMetrics = measureLines();
  const widestLine = Math.max(
    ...lineMetrics.map(({ totalWidth }) => totalWidth),
  );
  if (widestLine > maximumWidth) {
    size *= maximumWidth / widestLine;
    context.font = `600 ${size}px ${fontFamily}`;
    lineMetrics = measureLines();
  }

  context.textAlign = "left";
  context.textBaseline = "middle";

  const characterCount = lineMetrics.reduce(
    (total, line) => total + line.characters.length,
    0,
  );
  const lastCharacter = Math.max(1, characterCount - 1);
  const lineHeight = size * 1.08;
  const firstLineY = centerY - ((lineMetrics.length - 1) * lineHeight) / 2;
  let characterIndex = 0;
  let left = canvasWidth;
  let right = 0;

  for (let lineIndex = 0; lineIndex < lineMetrics.length; lineIndex++) {
    const metrics = lineMetrics[lineIndex];
    if (!metrics) continue;
    let x = centerX - metrics.totalWidth / 2;
    left = Math.min(left, x);
    right = Math.max(right, x + metrics.totalWidth);

    for (let index = 0; index < metrics.characters.length; index++) {
      context.fillStyle = `rgba(${Math.round(
        (characterIndex / lastCharacter) * 255,
      )}, 0, 0, 1)`;
      context.fillText(
        metrics.characters[index] ?? "",
        x,
        firstLineY + lineIndex * lineHeight,
      );
      x += (metrics.widths[index] ?? 0) + metrics.letterSpacing;
      characterIndex += 1;
    }
  }

  return {
    canvas,
    x0: left / canvasWidth,
    x1: right / canvasWidth,
  };
}

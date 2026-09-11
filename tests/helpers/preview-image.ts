import { readFileSync } from "node:fs";

export const previewImage = (format = "png") =>
  new Response(
    readFileSync(
      new URL(`../fixtures/previews/screenshot.${format}`, import.meta.url),
    ),
    { headers: { "Content-Type": `image/${format}` } },
  );

/** A GIF logical-screen header is enough to test the dimension gate. */
export function imageDimensions(width: number, height: number) {
  const bytes = Buffer.alloc(13);
  bytes.write("GIF89a");
  bytes.writeUInt16LE(width, 6);
  bytes.writeUInt16LE(height, 8);
  return new Response(bytes);
}

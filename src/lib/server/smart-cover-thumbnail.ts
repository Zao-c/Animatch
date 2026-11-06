import sharp from "sharp";
import type { SmartCoverVariant } from "../smart-cover-url";

const SAMPLE_EDGE = 320;
const MAX_INPUT_PIXELS = 32_000_000;
export const SMART_COVER_VERSION = "v1";

export const SMART_COVER_SIZES: Record<SmartCoverVariant, { width: number; height: number }> = {
  card: { width: 320, height: 480 },
  tier: { width: 256, height: 256 }
};

export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface AlphaRegion {
  bounds: CropRegion;
  focusX: number;
  focusY: number;
}

/** Analyze downsampled alpha, not full-resolution RGBA, to bound memory per request. */
export function measureAlphaRegion(
  rgba: Uint8Array,
  width: number,
  height: number
): AlphaRegion {
  const columns = new Uint32Array(width);
  const rows = new Uint32Array(height);
  let totalX = 0;
  let totalY = 0;
  let opaqueCount = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha < 24) continue;
      columns[x]++;
      rows[y]++;
      totalX += x + 0.5;
      totalY += y + 0.5;
      opaqueCount++;
    }
  }

  if (opaqueCount === 0) {
    return { bounds: { left: 0, top: 0, width, height }, focusX: 0.5, focusY: 0.5 };
  }

  // Ignore isolated translucent pixels and tiny edge ornaments while trimming.
  const minColumn = Math.max(1, Math.ceil(height * 0.012));
  const minRow = Math.max(1, Math.ceil(width * 0.012));
  let left = columns.findIndex((count) => count >= minColumn);
  let top = rows.findIndex((count) => count >= minRow);
  if (left < 0) left = 0;
  if (top < 0) top = 0;
  let right = width - 1;
  let bottom = height - 1;
  while (right > left && columns[right] < minColumn) right--;
  while (bottom > top && rows[bottom] < minRow) bottom--;

  const marginX = Math.ceil((right - left + 1) * 0.025);
  const marginY = Math.ceil((bottom - top + 1) * 0.025);
  left = Math.max(0, left - marginX);
  right = Math.min(width - 1, right + marginX);
  top = Math.max(0, top - marginY);
  bottom = Math.min(height - 1, bottom + marginY);

  return {
    bounds: { left, top, width: right - left + 1, height: bottom - top + 1 },
    focusX: Math.min(1, Math.max(0, (totalX / opaqueCount) / width)),
    focusY: Math.min(1, Math.max(0, (totalY / opaqueCount) / height))
  };
}

/** Calculate the focal-area crop without changing the source's aspect ratio. */
export function coverCrop(
  bounds: CropRegion,
  targetAspect: number,
  focalX: number,
  focalY: number
): CropRegion {
  let cropWidth = bounds.width;
  let cropHeight = bounds.height;

  if (bounds.width / bounds.height > targetAspect) {
    cropWidth = Math.max(1, Math.min(bounds.width, Math.round(bounds.height * targetAspect)));
  } else {
    cropHeight = Math.max(1, Math.min(bounds.height, Math.round(bounds.width / targetAspect)));
  }

  const clamp = (value: number, low: number, high: number) =>
    Math.min(high, Math.max(low, value));

  return {
    left: clamp(
      Math.round(focalX - cropWidth / 2),
      bounds.left,
      bounds.left + bounds.width - cropWidth
    ),
    top: clamp(
      Math.round(focalY - cropHeight / 2),
      bounds.top,
      bounds.top + bounds.height - cropHeight
    ),
    width: cropWidth,
    height: cropHeight
  };
}

export async function generateSmartCover(input: Buffer, variant: SmartCoverVariant): Promise<Buffer> {
  const { width, height } = SMART_COVER_SIZES[variant];
  if (!width || !height) throw new Error("Invalid thumbnail variant");

  const normalized = await sharp(input, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .toBuffer();
  const metadata = await sharp(normalized).metadata();
  if (!metadata.width || !metadata.height ||
    metadata.width * metadata.height > MAX_INPUT_PIXELS) {
    throw new Error("Invalid image dimensions");
  }

  const { data, info } = await sharp(normalized)
    .resize({ width: SAMPLE_EDGE, height: SAMPLE_EDGE, fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const alpha = measureAlphaRegion(data, info.width, info.height);
  // Sampling is only used to find an alpha bbox and center of mass.
  const sourceWidth = metadata.width;
  const sourceHeight = metadata.height;
  const bounds = {
    left: Math.floor(alpha.bounds.left / info.width * sourceWidth),
    top: Math.floor(alpha.bounds.top / info.height * sourceHeight),
    width: Math.ceil(alpha.bounds.width / info.width * sourceWidth),
    height: Math.ceil(alpha.bounds.height / info.height * sourceHeight)
  };
  bounds.width = Math.max(1, Math.min(bounds.width, sourceWidth - bounds.left));
  bounds.height = Math.max(1, Math.min(bounds.height, sourceHeight - bounds.top));
  const region = coverCrop(
    bounds,
    width / height,
    alpha.focusX * sourceWidth,
    alpha.focusY * sourceHeight
  );

  // The blurred full artwork supplies a background through transparent gaps.
  // The foreground is a focused, full-bleed crop; it avoids 2:1 images turning
  // into tiny strips in a 2:3 card and does not stretch characters.
  const [background, foreground] = await Promise.all([
    sharp(normalized)
      .extract(bounds)
      .flatten({ background: "#17202c" })
      .resize(width, height, { fit: "cover" })
      .blur(14)
      .modulate({ brightness: 0.65 })
      .png()
      .toBuffer(),
    sharp(normalized)
      .extract(region)
      .resize(width, height, { fit: "cover" })
      .png()
      .toBuffer()
  ]);

  return sharp(background)
    .composite([{ input: foreground }])
    .webp({ quality: 83, effort: 4 })
    .toBuffer();
}

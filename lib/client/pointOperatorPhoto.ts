export const POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH = 900_000;
export const POINT_OPERATOR_PHOTO_INLINE_LIMIT_BYTES = 650_000;
export const POINT_OPERATOR_PHOTO_MAX_DIMENSION = 1280;

const POINT_OPERATOR_PHOTO_MIN_DIMENSION = 640;
const JPEG_START_QUALITY = 0.76;
const JPEG_MIN_QUALITY = 0.48;
const JPEG_QUALITY_STEP = 0.08;

export class PointOperatorPhotoTooLargeError extends Error {
  retryable = false;
  status = 413;

  constructor() {
    super("Photo is too large after compression. Take a new photo at lower resolution.");
    this.name = "PointOperatorPhotoTooLargeError";
  }
}

export function isPointOperatorPhotoDataUrl(value: string): boolean {
  return /^data:image\/[^;,]+;base64,/i.test(value);
}

export function isOversizedPointOperatorPhotoDataUrl(value: string): boolean {
  return value.length > POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH;
}

export async function readPointOperatorPhotoFile(file: File): Promise<string> {
  const dataUrl = await readFileAsDataUrl(file);
  return compactPointOperatorPhotoDataUrl(dataUrl, {
    force: file.size > POINT_OPERATOR_PHOTO_INLINE_LIMIT_BYTES,
  });
}

export async function compactPointOperatorPhotoDataUrl(
  imageData: string,
  options: { force?: boolean } = {},
): Promise<string> {
  if (!isPointOperatorPhotoDataUrl(imageData)) return imageData;
  if (!options.force && !isOversizedPointOperatorPhotoDataUrl(imageData)) return imageData;
  if (typeof document === "undefined" || typeof Image === "undefined") return imageData;

  const image = await loadImage(imageData);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    throw new PointOperatorPhotoTooLargeError();
  }

  const longestSide = Math.max(naturalWidth, naturalHeight);
  const scale = Math.min(1, POINT_OPERATOR_PHOTO_MAX_DIMENSION / longestSide);
  let width = Math.max(1, Math.round(naturalWidth * scale));
  let height = Math.max(1, Math.round(naturalHeight * scale));
  let quality = JPEG_START_QUALITY;
  let compressed = renderJpeg(image, width, height, quality);

  while (compressed.length > POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH && quality > JPEG_MIN_QUALITY) {
    quality = Math.max(JPEG_MIN_QUALITY, quality - JPEG_QUALITY_STEP);
    compressed = renderJpeg(image, width, height, quality);
  }

  while (
    compressed.length > POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH &&
    Math.max(width, height) > POINT_OPERATOR_PHOTO_MIN_DIMENSION
  ) {
    width = Math.max(1, Math.round(width * 0.85));
    height = Math.max(1, Math.round(height * 0.85));
    compressed = renderJpeg(image, width, height, JPEG_MIN_QUALITY);
  }

  if (compressed.length > POINT_OPERATOR_PHOTO_MAX_DATA_URL_LENGTH) {
    throw new PointOperatorPhotoTooLargeError();
  }

  return compressed;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(imageData: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("photo_decode_failed"));
    image.src = imageData;
  });
}

function renderJpeg(
  image: CanvasImageSource,
  width: number,
  height: number,
  quality: number,
): string {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PointOperatorPhotoTooLargeError();

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

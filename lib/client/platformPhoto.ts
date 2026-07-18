export const PLATFORM_PHOTO_MAX_DATA_URL_LENGTH = 300_000;
const PLATFORM_PHOTO_MAX_DIMENSION = 1280;
const PLATFORM_PHOTO_MIN_DIMENSION = 480;

export class PlatformPhotoTooLargeError extends Error {
  constructor() {
    super("Photo could not be compressed enough for mobile upload");
    this.name = "PlatformPhotoTooLargeError";
  }
}

export interface PlatformPhotoAsset {
  dataUrl: string;
  metadata: {
    mimeType: string;
    originalBytes: number;
    storedBytes: number;
    width?: number;
    height?: number;
    capturedAt?: string;
  };
}

function estimateDataUrlBytes(dataUrl: string): number {
  const encoded = dataUrl.split(",", 2)[1] ?? "";
  return Math.max(0, Math.floor(encoded.length * 0.75));
}

async function readImageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return dimensions;
    } catch {
      return {};
    }
  }
  return {};
}

export async function readPlatformPhotoAsset(file: File): Promise<PlatformPhotoAsset> {
  const [dataUrl, dimensions] = await Promise.all([
    readPlatformPhotoFile(file),
    readImageDimensions(file),
  ]);
  return {
    dataUrl,
    metadata: {
      mimeType: file.type || dataUrl.match(/^data:([^;,]+)/i)?.[1] || "image/jpeg",
      originalBytes: file.size,
      storedBytes: estimateDataUrlBytes(dataUrl),
      ...dimensions,
      capturedAt: file.lastModified > 0 ? new Date(file.lastModified).toISOString() : undefined,
    },
  };
}

export async function readPlatformPhotoFile(file: File): Promise<string> {
  const original = typeof FileReader === "undefined"
    ? await fileToDataUrlWithoutFileReader(file)
    : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("photo_read_failed"));
        reader.readAsDataURL(file);
      });
  if (!/^data:image\/[^;,]+;base64,/i.test(original)) throw new Error("photo_invalid");
  if (original.length <= PLATFORM_PHOTO_MAX_DATA_URL_LENGTH) return original;
  if (typeof document === "undefined" || typeof Image === "undefined") throw new PlatformPhotoTooLargeError();

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const candidate = new Image();
    candidate.onload = () => resolve(candidate);
    candidate.onerror = () => reject(new Error("photo_decode_failed"));
    candidate.src = original;
  });
  const longestSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (longestSide <= 0) throw new PlatformPhotoTooLargeError();
  let scale = Math.min(1, PLATFORM_PHOTO_MAX_DIMENSION / longestSide);
  let quality = 0.76;

  while (scale * longestSide >= PLATFORM_PHOTO_MIN_DIMENSION) {
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new PlatformPhotoTooLargeError();
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    const compressed = canvas.toDataURL("image/jpeg", quality);
    if (compressed.length <= PLATFORM_PHOTO_MAX_DATA_URL_LENGTH) return compressed;
    if (quality > 0.48) quality = Math.max(0.48, quality - 0.08);
    else scale *= 0.82;
  }
  throw new PlatformPhotoTooLargeError();
}

async function fileToDataUrlWithoutFileReader(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

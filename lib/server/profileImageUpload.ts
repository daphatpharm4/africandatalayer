const INLINE_PROFILE_IMAGE_REGEX = /^data:(image\/[a-z0-9.+-]+);base64,/i;
const ALLOWED_PROFILE_IMAGE_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

export function mimeToExtension(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export function parseProfileImagePayload(
  imageBase64: string,
  maxBytes: number,
): { imageBuffer: Buffer; mime: string; ext: string } | null {
  const match = imageBase64.match(INLINE_PROFILE_IMAGE_REGEX);
  if (!match) return null;

  const mime = match[1]?.toLowerCase() ?? "";
  if (!ALLOWED_PROFILE_IMAGE_MIME.has(mime)) return null;

  const commaIndex = imageBase64.indexOf(",");
  const base64 = commaIndex === -1 ? imageBase64 : imageBase64.slice(commaIndex + 1);
  const imageBuffer = Buffer.from(base64, "base64");
  if (!imageBuffer.length || imageBuffer.byteLength > maxBytes) return null;

  return { imageBuffer, mime, ext: mimeToExtension(mime) };
}

export interface UploadError {
  status: number;
  code: string;
  message: string;
}

/** Map a blob upload failure to a clear, client-safe response. A missing/invalid
 *  token means storage isn't configured (503); anything else is a transient
 *  upload failure (502). Never leaks the underlying error text to the client. */
export function classifyBlobUploadError(error: unknown): UploadError {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  if (msg.includes("token")) {
    return { status: 503, code: "storage_unavailable", message: "Photo storage is not configured" };
  }
  return { status: 502, code: "upload_failed", message: "Could not upload the photo, please try again" };
}

export function shouldStoreProfileImageInline(error: UploadError, imageBytes: number, maxInlineBytes: number): boolean {
  return error.code === "storage_unavailable" && imageBytes <= maxInlineBytes;
}

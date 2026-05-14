import { PDFDocument } from 'pdf-lib';

export async function buildPdfFromPngs(pngBuffers) {
  if (!Array.isArray(pngBuffers) || pngBuffers.length === 0) {
    throw new Error('buildPdfFromPngs requires at least one PNG buffer');
  }
  const pdf = await PDFDocument.create();
  for (const buf of pngBuffers) {
    const image = await pdf.embedPng(buf);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  }
  return await pdf.save();
}

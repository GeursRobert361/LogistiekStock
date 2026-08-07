/**
 * Verkleint een gekozen foto tot een data-URL.
 *
 * Een storingsfoto is een hulpmiddel, geen archiefstuk: 1024 px lange zijde met
 * JPEG-compressie is ruim genoeg om een defecte tap te herkennen, en houdt de
 * offline opslag klein genoeg om niet tegen quota aan te lopen.
 */
const MAX_DIMENSION = 1024
const JPEG_QUALITY = 0.7

export async function fileToResizedDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Kies een afbeelding.')
  }

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    throw new Error('De foto kon niet worden verwerkt.')
  }

  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/**
 * Shrinks and compresses a picture in the browser BEFORE it is uploaded, so storage stays tiny:
 *   member photo → square 400×400 crop, ~25–40 KB
 *   logo         → fits inside 256×256 (keeps transparency), ~10–20 KB
 * A 4 MB phone photo becomes roughly 1% of its size.
 */

export type ImageKind = 'photo' | 'logo'

const SPEC: Record<ImageKind, { size: number; crop: boolean; quality: number; maxBytes: number }> = {
  photo: { size: 400, crop: true, quality: 0.78, maxBytes: 60_000 },
  logo: { size: 256, crop: false, quality: 0.85, maxBytes: 40_000 },
}

/** Hard ceiling (the storage buckets also refuse anything over 1 MB). */
export const MAX_UPLOAD_BYTES = 1_000_000

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    // Respects the phone camera's rotation (EXIF orientation).
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Fallback for formats createImageBitmap can't read (e.g. HEIC on Safari).
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function compressImage(file: Blob, kind: ImageKind): Promise<Blob> {
  const spec = SPEC[kind]
  const src = await decode(file)
  const w = src.width
  const h = src.height
  if (!w || !h) throw new Error('Unreadable image')

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'

  if (spec.crop) {
    // centre square crop
    const s = Math.min(w, h)
    const out = Math.min(spec.size, s)
    canvas.width = canvas.height = out
    ctx.drawImage(src, (w - s) / 2, (h - s) / 2, s, s, 0, 0, out, out)
  } else {
    const scale = Math.min(1, spec.size / Math.max(w, h))
    canvas.width = Math.max(1, Math.round(w * scale))
    canvas.height = Math.max(1, Math.round(h * scale))
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  }
  if ('close' in src) src.close()

  // WebP is smallest; older Safari can't encode it and silently returns PNG, so fall back.
  let quality = spec.quality
  let blob = await toBlob(canvas, 'image/webp', quality)
  if (!blob || blob.type !== 'image/webp') {
    blob = kind === 'logo'
      ? await toBlob(canvas, 'image/png', 1)       // keep logo transparency
      : await toBlob(canvas, 'image/jpeg', 0.8)
  }
  // Squeeze further if still above the target size.
  while (blob && blob.size > spec.maxBytes && quality > 0.4 && blob.type !== 'image/png') {
    quality -= 0.12
    blob = await toBlob(canvas, blob.type, quality)
  }
  if (!blob) throw new Error('Could not compress image')
  if (blob.size > MAX_UPLOAD_BYTES) throw new Error('Image is too large even after compression')
  return blob
}

export const extFor = (blob: Blob) => (blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp')

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

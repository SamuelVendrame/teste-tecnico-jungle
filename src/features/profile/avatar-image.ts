/** Regras e conversão do avatar: PNG/JPEG/WebP de até 1 MB, recortado em quadrado de 256 px. */
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'
export const AVATAR_TYPES = AVATAR_ACCEPT.split(',')
export const AVATAR_MAX_BYTES = 1024 * 1024
export const AVATAR_SIZE = 256

export class AvatarError extends Error {}

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use uma imagem PNG, JPEG ou WebP.'
  if (file.size > AVATAR_MAX_BYTES) return 'A imagem deve ter no máximo 1 MB.'
  return null
}

/** Lê o arquivo, recorta o centro em quadrado e devolve um data URL de 256 px. */
export async function fileToAvatarDataUrl(file: File, size = AVATAR_SIZE): Promise<string> {
  const invalid = validateAvatarFile(file)
  if (invalid) throw new AvatarError(invalid)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new AvatarError('Não foi possível ler a imagem. Tente outro arquivo.')
  }

  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new AvatarError('Não foi possível processar a imagem.')
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = (bitmap.width - side) / 2
    const sy = (bitmap.height - side) / 2
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, size, size)
    return canvas.toDataURL('image/webp', 0.85)
  } finally {
    bitmap.close()
  }
}

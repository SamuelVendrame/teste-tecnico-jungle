import type { ImgHTMLAttributes } from 'react'

/**
 * As artes em /images têm duas larguras: `nome.webp` (800px) e `nome-400.webp`.
 * Gera o srcset automaticamente quando a URL segue esse padrão.
 */
function smallVariant(src: string): string | null {
  const match = /^(.*\/images\/[^/]+?)\.webp$/.exec(src)
  if (!match || match[1]!.endsWith('-400')) return null
  return `${match[1]}-400.webp`
}

type NftImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt' | 'srcSet'> & {
  src: string
  alt: string
  width: number
  height: number
  /** Imagem de LCP (hero): carrega cedo e com prioridade alta. */
  priority?: boolean
}

export function NftImage({ src, alt, priority = false, sizes, ...rest }: NftImageProps) {
  const small = smallVariant(src)
  return (
    <img
      src={src}
      srcSet={small ? `${small} 400w, ${src} 800w` : undefined}
      sizes={small ? (sizes ?? '(max-width: 768px) 50vw, 260px') : undefined}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding={priority ? 'auto' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
      {...rest}
    />
  )
}

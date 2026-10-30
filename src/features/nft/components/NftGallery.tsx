import { SearchIcon, XIcon } from 'lucide-react'
import { useId, useRef, useState, type KeyboardEvent } from 'react'

import { NftImage } from '@/components/common/NftImage'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface NftGalleryProps {
  images: string[]
  alt: string
}

/**
 * Galeria: miniaturas como tablist vertical (setas, Home/End) e imagem
 * principal como tabpanel. No mobile, as miniaturas viram pontos.
 * A lupa abre a arte em tamanho maior num diálogo (foco preso pelo Radix).
 */
export function NftGallery({ images, alt }: NftGalleryProps) {
  const [active, setActive] = useState(0)
  const panelId = useId()
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])
  const current = images[active] ?? images[0]!

  function focusTab(index: number) {
    const next = (index + images.length) % images.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const keys: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: images.length - 1,
    }
    const target = keys[event.key]
    if (target === undefined) return
    event.preventDefault()
    focusTab(target)
  }

  const label = (index: number) => `Imagem ${index + 1} de ${images.length}`

  return (
    <div className="flex gap-7">
      {images.length > 1 && (
        <div
          role="tablist"
          aria-label="Imagens do NFT"
          aria-orientation="vertical"
          className="hidden max-h-[448px] shrink-0 flex-col gap-4 overflow-y-auto md:flex"
        >
          {images.map((src, index) => (
            <button
              key={`${src}-${index}`}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-controls={panelId}
              aria-label={label(index)}
              tabIndex={index === active ? 0 : -1}
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={cn(
                'size-[100px] shrink-0 overflow-hidden rounded-[4px] border-2 transition-colors',
                index === active ? 'border-brand' : 'border-transparent hover:border-border-soft',
              )}
            >
              <NftImage
                src={src}
                alt=""
                width={100}
                height={100}
                sizes="100px"
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div
          id={panelId}
          role={images.length > 1 ? 'tabpanel' : undefined}
          aria-label={images.length > 1 ? label(active) : undefined}
          className="relative md:rounded-[4px] md:bg-card md:p-5"
        >
          <NftImage
            src={current}
            alt={alt}
            width={404}
            height={404}
            priority
            sizes="(max-width: 767px) 92vw, 404px"
            className="aspect-[361/356] w-full rounded-[24px] object-cover md:aspect-square md:rounded-[16px]"
          />
          <ZoomDialog src={current} alt={alt} />
        </div>

        {images.length > 1 && (
          <div
            role="group"
            aria-label="Imagens do NFT"
            className="mt-2 flex justify-center md:hidden"
          >
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActive(index)}
                aria-label={label(index)}
                aria-current={index === active ? 'true' : undefined}
                className="flex size-6 items-center justify-center"
              >
                <span
                  className={cn(
                    'block size-[7px] rounded-full',
                    index === active ? 'bg-brand' : 'bg-brand/35',
                  )}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ZoomDialog({ src, alt }: { src: string; alt: string }) {
  return (
    <Dialog>
      <DialogTrigger
        aria-label="Ampliar imagem"
        className="absolute top-4 right-4 hidden size-[30px] items-center justify-center rounded-full bg-background/85 text-text-primary transition-colors hover:text-text-accent md:flex"
      >
        <SearchIcon aria-hidden className="size-5" />
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="max-w-[min(92vw,820px)] border-border-soft bg-card p-3 sm:max-w-[min(92vw,820px)]"
      >
        <DialogTitle className="sr-only">{alt}</DialogTitle>
        <DialogDescription className="sr-only">Imagem ampliada do NFT</DialogDescription>
        <img
          src={src}
          alt={alt}
          width={800}
          height={800}
          decoding="async"
          className="aspect-square w-full rounded-[12px] object-cover"
        />
        <DialogClose
          aria-label="Fechar imagem ampliada"
          className="absolute top-5 right-5 inline-flex size-9 items-center justify-center rounded-full bg-background/85 text-text-primary hover:text-text-accent"
        >
          <XIcon aria-hidden className="size-5" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  )
}

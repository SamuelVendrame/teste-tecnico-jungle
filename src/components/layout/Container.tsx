import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

/** Largura de conteúdo do Figma: 1200px úteis (120px de margem em 1440). */
export function Container({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('mx-auto w-full max-w-[1232px] px-4 sm:px-6 xl:px-4', className)}
      {...props}
    />
  )
}

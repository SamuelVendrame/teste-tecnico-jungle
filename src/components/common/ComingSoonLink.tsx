import type { ReactNode } from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ComingSoonLinkProps {
  children: ReactNode
  className?: string
  /** Rótulo acessível quando o conteúdo é só um ícone. */
  label?: string
}

/**
 * Link fora do escopo da entrega (páginas editoriais, suporte, redes sociais).
 * Fica focável, é anunciado como desabilitado e explica "Em breve" no tooltip;
 * não navega nem aparenta sucesso.
 */
export function ComingSoonLink({ children, className, label }: ComingSoonLinkProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a
          role="link"
          aria-disabled="true"
          aria-label={label ? `${label} (em breve)` : undefined}
          tabIndex={0}
          className={cn('cursor-not-allowed', className)}
          onClick={(event) => event.preventDefault()}
        >
          {children}
          {!label && <span className="sr-only"> (em breve)</span>}
        </a>
      </TooltipTrigger>
      <TooltipContent>Em breve</TooltipContent>
    </Tooltip>
  )
}

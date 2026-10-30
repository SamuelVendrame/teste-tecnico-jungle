import { SearchXIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
  headingLevel?: 'h1' | 'h2' | 'h3'
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  headingLevel: Heading = 'h3',
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-soft bg-card/40 px-6 py-16 text-center',
        className,
      )}
    >
      <span aria-hidden className="text-text-accent [&_svg]:size-10">
        {icon ?? <SearchXIcon />}
      </span>
      <Heading className="text-lg font-bold text-text-primary">{title}</Heading>
      {description && <p className="max-w-md text-sm text-text-secondary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

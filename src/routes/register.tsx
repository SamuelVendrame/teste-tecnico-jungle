import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/register')({
  validateSearch: z.object({ returnTo: z.string().optional() }),
  component: () => <main className="p-8">Rota /register em construção.</main>,
})

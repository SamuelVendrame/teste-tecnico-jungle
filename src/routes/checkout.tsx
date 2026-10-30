import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/checkout')({
  component: () => <main className="p-8">Rota /checkout em construção.</main>,
})

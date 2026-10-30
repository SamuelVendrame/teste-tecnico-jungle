import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/orders/$orderId')({
  component: () => <main className="p-8">Rota /orders/$orderId em construção.</main>,
})

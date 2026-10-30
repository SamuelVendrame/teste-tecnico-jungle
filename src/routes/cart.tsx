import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cart')({
  component: () => <main className="p-8">Rota /cart em construção.</main>,
})

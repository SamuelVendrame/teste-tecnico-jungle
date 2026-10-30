import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/nft/$slug')({
  component: () => <main className="p-8">Rota /nft/$slug em construção.</main>,
})

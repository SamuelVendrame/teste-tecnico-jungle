import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/profile')({
  component: () => <main className="p-8">Rota /profile em construção.</main>,
})

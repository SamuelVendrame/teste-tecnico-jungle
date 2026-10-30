import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-[43px] leading-[70px] font-bold">Seja dono do futuro da arte digital</h1>
      <p className="text-text-secondary">Scaffold inicial. Catálogo em construção.</p>
    </main>
  )
}

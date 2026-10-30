import { ComingSoonLink } from '@/components/common/ComingSoonLink'

const POSTS = [
  {
    date: '12 de setembro',
    read: 'Leitura de 6 min',
    title: 'Como funciona a propriedade de NFTs',
    excerpt: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
    image: '/images/nft-neon-vessel-400.webp',
  },
  {
    date: '13 de setembro',
    read: 'Leitura de 2 min',
    title: '10 artistas digitais para acompanhar',
    excerpt: 'Conheça criadores que moldam a cultura digital.',
    image: '/images/nft-emerald-ape-400.webp',
  },
  {
    date: '15 de setembro',
    read: 'Leitura de 3 min',
    title: 'Raridade, atributos e procedência',
    excerpt: 'Entenda raridade, procedência, direitos autorais e utilidade.',
    image: '/images/nft-sage-nomad-400.webp',
  },
  {
    date: '15 de setembro',
    read: 'Leitura de 2 min',
    title: 'Como proteger sua carteira',
    excerpt: 'Proteja sua carteira, seus ativos e sua identidade.',
    image: '/images/nft-golden-beat-400.webp',
  },
] as const

/**
 * "Diário da Cunhagem": conteúdo editorial estático (fora do escopo do
 * desafio). Os links "Ler mais" ficam desabilitados com tooltip "Em breve".
 */
export function BlogSection() {
  return (
    <section aria-labelledby="blog-title" className="mt-24">
      <header className="text-center">
        <h2 id="blog-title" className="text-2xl font-bold text-text-primary md:text-[32px]">
          Diário da Cunhagem
        </h2>
        <p className="mt-3 text-sm text-text-secondary">
          Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.
        </p>
      </header>
      <ul className="-mx-4 mt-10 grid snap-x snap-mandatory auto-cols-[78%] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-2 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {POSTS.map((post) => (
          <li key={post.title} className="relative snap-start">
            <article className="flex h-full flex-col overflow-hidden rounded-[8px] bg-card">
              <img
                src={post.image}
                alt=""
                width={268}
                height={195}
                loading="lazy"
                decoding="async"
                className="aspect-[268/195] w-full object-cover"
              />
              <div className="flex flex-1 flex-col px-4 pt-3 pb-4">
                <p className="text-xs leading-4 text-text-secondary">
                  <time>{post.date}</time>
                  <span aria-hidden className="mx-2">
                    |
                  </span>
                  {post.read}
                </p>
                <h3 className="mt-2 text-base leading-[21px] font-bold text-text-primary">
                  {post.title}
                </h3>
                <p className="mt-2 text-xs leading-4 text-text-secondary">{post.excerpt}</p>
                <ComingSoonLink className="mt-auto w-fit pt-3 text-xs font-bold text-text-accent">
                  Ler mais <span aria-hidden>→</span>
                  <span className="sr-only">: {post.title}</span>
                </ComingSoonLink>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </section>
  )
}

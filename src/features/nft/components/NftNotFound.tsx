import { Link } from '@tanstack/react-router'
import { ImageOffIcon } from 'lucide-react'

import { EmptyState } from '@/components/common/EmptyState'
import { Container } from '@/components/layout/Container'

/** NFT inexistente (404 da API): estado dentro da página, com volta ao catálogo. */
export function NftNotFound() {
  return (
    <Container className="py-16 md:py-24">
      <EmptyState
        icon={<ImageOffIcon />}
        title="NFT não encontrado"
        headingLevel="h1"
        description="O NFT que você procura não existe ou foi removido do catálogo."
        action={
          <Link
            to="/"
            className="inline-flex h-10 items-center rounded-[4px] bg-brand px-5 font-bold text-ink hover:bg-brand/90"
          >
            Voltar ao catálogo
          </Link>
        }
      />
    </Container>
  )
}

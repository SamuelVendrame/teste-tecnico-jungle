import { COLLECTION_LABELS, NETWORK_LABELS, type Nft } from '@/api/contracts'
import { formatHandle } from '@/components/common/nft-display'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatEth } from '@/lib/money'

import { NftReviews } from './NftReviews'

const trigger =
  'h-auto flex-none rounded-none border-0 px-0 pb-3 text-base font-bold text-text-primary after:bottom-[-1px] after:h-[2px] after:bg-brand hover:text-text-accent data-[state=active]:bg-transparent data-[state=active]:text-text-accent'

/** "Detalhes do NFT" e "Avaliações de colecionadores" (abas abaixo da dobra no desktop). */
export function NftInfoTabs({ nft }: { nft: Nft }) {
  return (
    <section aria-label="Informações do NFT" className="mt-12 md:mt-24">
      <Tabs defaultValue="details" className="gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full justify-start gap-8 rounded-none border-b border-border p-0"
        >
          <TabsTrigger value="details" className={trigger}>
            Detalhes do NFT
          </TabsTrigger>
          <TabsTrigger value="reviews" className={trigger}>
            {/* Rótulo curto no mobile: o completo não cabe em 390 px ao lado da outra aba. */}
            <span className="md:hidden">Avaliações ({nft.rating.count})</span>
            <span className="hidden md:inline">
              Avaliações de colecionadores ({nft.rating.count})
            </span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="pt-4 text-sm leading-6 text-text-secondary">
          <p className="whitespace-pre-line">{nft.description}</p>
          <dl className="mt-3 grid gap-3">
            <div>
              <dt className="font-bold text-text-primary">Criador:</dt>
              <dd>
                {nft.creator.name} · {formatHandle(nft.creator.handle)}
              </dd>
            </div>
            <div>
              <dt className="font-bold text-text-primary">Rede:</dt>
              <dd>Cunhado na {NETWORK_LABELS[nft.network]}.</dd>
            </div>
            <div>
              <dt className="font-bold text-text-primary">Coleção:</dt>
              <dd>{COLLECTION_LABELS[nft.collection]}</dd>
            </div>
            <div>
              <dt className="font-bold text-text-primary">Edições:</dt>
              <dd>
                <ul>
                  {nft.editions.map((edition) => (
                    <li key={edition.id}>
                      {edition.name} · {formatEth(edition.priceEth)} ·{' '}
                      {edition.available === 0
                        ? 'Esgotada'
                        : `${edition.available} disponíveis (máx. ${edition.maxPerOrder} por pedido)`}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>
        </TabsContent>
        <TabsContent value="reviews" className="pt-4">
          <NftReviews nft={nft} />
        </TabsContent>
      </Tabs>
    </section>
  )
}

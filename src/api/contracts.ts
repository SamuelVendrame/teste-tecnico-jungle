/**
 * Contratos REST e de eventos compartilhados entre transporte (Axios),
 * estado (TanStack Query), interface e mocks (MSW).
 *
 * Regras:
 * - Valores em ETH trafegam como strings decimais (ex.: "1.19"). Nunca number.
 * - Quantidades são inteiras.
 * - Toda resposta de erro segue `ApiError`.
 * - Recursos mutáveis carregam `version` (inteiro crescente) para reconciliar
 *   eventos Socket.IO duplicados ou antigos.
 */
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Primitivos
// ---------------------------------------------------------------------------

export const ethAmount = z
  .string()
  .regex(/^\d+(\.\d{1,18})?$/, 'Valor em ETH deve ser uma string decimal')
export type EthAmount = z.infer<typeof ethAmount>

export const quantity = z.number().int().min(0)

export const isoDate = z.string().datetime({ offset: true })

export const networkId = z.enum(['ethereum', 'polygon', 'solana'])
export type NetworkId = z.infer<typeof networkId>

export const collectionId = z.enum([
  'arte-digital',
  'fotografia',
  'musica',
  'arte-3d',
  'colecionaveis',
  'generativa',
  'jogos',
  'assinaturas',
  'utilidade',
])
export type CollectionId = z.infer<typeof collectionId>

export const COLLECTION_LABELS: Record<CollectionId, string> = {
  'arte-digital': 'Arte digital',
  fotografia: 'Fotografia',
  musica: 'Música',
  'arte-3d': 'Arte 3D',
  colecionaveis: 'Colecionáveis',
  generativa: 'Generativa',
  jogos: 'Jogos',
  assinaturas: 'Assinaturas',
  utilidade: 'Utilidade',
}

export const NETWORK_LABELS: Record<NetworkId, string> = {
  ethereum: 'Ethereum',
  polygon: 'Polygon',
  solana: 'Solana',
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

export const apiErrorCode = z.enum([
  'VALIDATION_ERROR', // 422
  'UNAUTHORIZED', // 401 (sem sessão ou sessão expirada)
  'FORBIDDEN', // 403
  'NOT_FOUND', // 404
  'EMAIL_TAKEN', // 409
  'INVALID_CREDENTIALS', // 401
  'OUT_OF_STOCK', // 409 (disponibilidade insuficiente)
  'EDITION_UNAVAILABLE', // 409
  'QUOTE_STALE', // 409 (preço/disponibilidade mudou desde a cotação)
  'IDEMPOTENCY_KEY_REUSED', // 409 (mesma chave, payload diferente)
  'COUPON_INVALID', // 422
  'COUPON_EXPIRED', // 422
  'WALLET_LIMIT', // 409
  'SERVICE_UNAVAILABLE', // 503 (falha transitória)
  'INTERNAL_ERROR', // 500
])
export type ApiErrorCode = z.infer<typeof apiErrorCode>

export const apiError = z.object({
  error: z.object({
    code: apiErrorCode,
    message: z.string(),
    /** Erros por campo, para formulários. Chave = nome do campo. */
    details: z.record(z.string(), z.array(z.string())).optional(),
    /** Dados extras (ex.: nova cotação em QUOTE_STALE). */
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
})
export type ApiError = z.infer<typeof apiError>

// ---------------------------------------------------------------------------
// Sessão e conta
// ---------------------------------------------------------------------------

export const user = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  email: z.string().email(),
  bio: z.string().nullable(),
  /** Data URL ou caminho público. */
  avatarUrl: z.string().nullable(),
  createdAt: isoDate,
  version: z.number().int(),
})
export type User = z.infer<typeof user>

export const session = z.object({
  user,
  token: z.string(),
  expiresAt: isoDate,
})
export type Session = z.infer<typeof session>

export const registerInput = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo').max(80),
  email: z.string().trim().email('E-mail inválido'),
  password: z
    .string()
    .min(8, 'Mínimo de 8 caracteres')
    .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
    .regex(/\d/, 'Inclua ao menos um número'),
})
export type RegisterInput = z.infer<typeof registerInput>

export const loginInput = z.object({
  email: z.string().trim().email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
})
export type LoginInput = z.infer<typeof loginInput>

export const updateProfileInput = z.object({
  name: z.string().trim().min(2, 'Informe seu nome completo').max(80),
  username: z
    .string()
    .trim()
    .min(3, 'Mínimo de 3 caracteres')
    .max(24)
    .regex(/^[a-z0-9_]+$/, 'Use letras minúsculas, números e _'),
  bio: z.string().trim().max(160, 'Máximo de 160 caracteres').nullable(),
  avatarUrl: z.string().nullable(),
})
export type UpdateProfileInput = z.infer<typeof updateProfileInput>

export const changePasswordInput = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z
      .string()
      .min(8, 'Mínimo de 8 caracteres')
      .regex(/[A-Za-z]/, 'Inclua ao menos uma letra')
      .regex(/\d/, 'Inclua ao menos um número'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'As senhas não coincidem',
  })
export type ChangePasswordInput = z.infer<typeof changePasswordInput>

// ---------------------------------------------------------------------------
// Carteiras
// ---------------------------------------------------------------------------

export const walletKind = z.enum(['primary', 'secondary'])
export const walletProvider = z.enum(['metamask', 'walletconnect', 'coinbase'])

export const wallet = z.object({
  id: z.string(),
  userId: z.string(),
  kind: walletKind,
  label: z.string(),
  address: z.string(),
  network: networkId,
  provider: walletProvider,
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int(),
})
export type Wallet = z.infer<typeof wallet>

export const walletInput = z.object({
  kind: walletKind,
  label: z.string().trim().min(2, 'Dê um nome à carteira').max(40),
  address: z
    .string()
    .trim()
    .regex(/^0x[a-fA-F0-9]{40}$|^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Endereço inválido'),
  network: networkId,
  provider: walletProvider,
})
export type WalletInput = z.infer<typeof walletInput>

// ---------------------------------------------------------------------------
// NFTs e catálogo
// ---------------------------------------------------------------------------

export const nftBadge = z.enum(['raro', 'novo', 'em-alta'])

export const nftEdition = z.object({
  id: z.string(),
  name: z.string(),
  priceEth: ethAmount,
  /** Unidades disponíveis para venda. 0 = esgotada. */
  available: quantity,
  /** Limite por pedido. */
  maxPerOrder: z.number().int().min(1),
})
export type NftEdition = z.infer<typeof nftEdition>

export const nftCreator = z.object({
  name: z.string(),
  handle: z.string(),
  avatarUrl: z.string(),
})

export const nft = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  collection: collectionId,
  network: networkId,
  imageUrl: z.string(),
  gallery: z.array(z.string()),
  creator: nftCreator,
  /** Preço de referência (menor edição disponível). */
  priceEth: ethAmount,
  /** Preço riscado quando em promoção. */
  compareAtPriceEth: ethAmount.nullable(),
  badge: nftBadge.nullable(),
  editions: z.array(nftEdition).min(1),
  attributes: z.array(z.object({ trait: z.string(), value: z.string() })),
  likes: z.number().int(),
  featured: z.boolean(),
  createdAt: isoDate,
  version: z.number().int(),
})
export type Nft = z.infer<typeof nft>

export const catalogSort = z.enum(['recent', 'price-asc', 'price-desc', 'popular'])
export type CatalogSort = z.infer<typeof catalogSort>

export const catalogTab = z.enum(['all', 'new', 'trending'])
export type CatalogTab = z.infer<typeof catalogTab>

/** Parâmetros de busca. Também são o shape do search da rota `/`. */
export const catalogQuery = z.object({
  q: z.string().trim().optional(),
  collection: z.array(collectionId).optional(),
  network: z.array(networkId).optional(),
  priceMin: ethAmount.optional(),
  priceMax: ethAmount.optional(),
  sort: catalogSort.default('recent'),
  tab: catalogTab.default('all'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48).default(9),
})
export type CatalogQuery = z.infer<typeof catalogQuery>
export type CatalogQueryInput = z.input<typeof catalogQuery>

export const facet = z.object({ key: z.string(), count: z.number().int() })

export const catalogPage = z.object({
  items: z.array(nft),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
  totalPages: z.number().int(),
  facets: z.object({
    collections: z.array(facet),
    networks: z.array(facet),
    priceRange: z.object({ min: ethAmount, max: ethAmount }),
  }),
})
export type CatalogPage = z.infer<typeof catalogPage>

export const featuredResponse = z.object({
  hero: z.array(nft),
  spotlight: nft.nullable(),
})
export type FeaturedResponse = z.infer<typeof featuredResponse>

// ---------------------------------------------------------------------------
// Favoritos
// ---------------------------------------------------------------------------

export const favorites = z.object({
  nftIds: z.array(z.string()),
  version: z.number().int(),
})
export type Favorites = z.infer<typeof favorites>

// ---------------------------------------------------------------------------
// Carrinho
// ---------------------------------------------------------------------------

export const cartItem = z.object({
  id: z.string(),
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
  /** Snapshot leve para render imediato; a fonte da verdade do preço é a cotação. */
  nft: z.object({
    name: z.string(),
    slug: z.string(),
    imageUrl: z.string(),
    network: networkId,
    version: z.number().int(),
  }),
  edition: z.object({
    name: z.string(),
    priceEth: ethAmount,
    available: quantity,
    maxPerOrder: z.number().int(),
  }),
})
export type CartItem = z.infer<typeof cartItem>

export const cart = z.object({
  id: z.string(),
  /** null para carrinho de visitante. */
  userId: z.string().nullable(),
  items: z.array(cartItem),
  couponCode: z.string().nullable(),
  updatedAt: isoDate,
  version: z.number().int(),
})
export type Cart = z.infer<typeof cart>

export const addCartItemInput = z.object({
  nftId: z.string(),
  editionId: z.string(),
  quantity: z.number().int().min(1),
})
export type AddCartItemInput = z.infer<typeof addCartItemInput>

export const updateCartItemInput = z.object({
  quantity: z.number().int().min(1),
})

export const mergeCartInput = z.object({
  guestCartId: z.string(),
})

// ---------------------------------------------------------------------------
// Cotação (quote)
// ---------------------------------------------------------------------------

export const quoteIssueType = z.enum(['price-changed', 'sold-out', 'insufficient-stock'])

export const quoteIssue = z.object({
  type: quoteIssueType,
  nftId: z.string(),
  editionId: z.string(),
  message: z.string(),
  previousPriceEth: ethAmount.optional(),
  currentPriceEth: ethAmount.optional(),
  requested: z.number().int().optional(),
  available: z.number().int().optional(),
})
export type QuoteIssue = z.infer<typeof quoteIssue>

export const quoteLine = z.object({
  nftId: z.string(),
  editionId: z.string(),
  name: z.string(),
  editionName: z.string(),
  imageUrl: z.string(),
  quantity: z.number().int().min(1),
  unitPriceEth: ethAmount,
  lineTotalEth: ethAmount,
  nftVersion: z.number().int(),
})
export type QuoteLine = z.infer<typeof quoteLine>

export const quote = z.object({
  id: z.string(),
  /** Hash determinístico de itens + preços + cupom + rede. Muda se qualquer coisa mudar. */
  fingerprint: z.string(),
  network: networkId,
  lines: z.array(quoteLine),
  subtotalEth: ethAmount,
  discountEth: ethAmount,
  networkFeeEth: ethAmount,
  totalEth: ethAmount,
  coupon: z
    .object({
      code: z.string(),
      description: z.string(),
      percentOff: z.number().int().nullable(),
      amountOffEth: ethAmount.nullable(),
    })
    .nullable(),
  issues: z.array(quoteIssue),
  expiresAt: isoDate,
  createdAt: isoDate,
})
export type Quote = z.infer<typeof quote>

export const quoteInput = z.object({
  items: z.array(addCartItemInput).min(1),
  couponCode: z.string().trim().nullable(),
  network: networkId,
})
export type QuoteInput = z.infer<typeof quoteInput>

// ---------------------------------------------------------------------------
// Pedidos
// ---------------------------------------------------------------------------

export const orderStatus = z.enum(['pending', 'confirmed', 'declined'])
export type OrderStatus = z.infer<typeof orderStatus>

export const collectorInfo = z.object({
  name: z.string().trim().min(2, 'Informe o nome completo'),
  email: z.string().trim().email('E-mail inválido'),
  document: z
    .string()
    .trim()
    .regex(/^\d{11}$|^\d{14}$/, 'Informe CPF (11 dígitos) ou CNPJ (14 dígitos)'),
})
export type CollectorInfo = z.infer<typeof collectorInfo>

export const createOrderInput = z.object({
  quoteId: z.string(),
  /** Fingerprint da cotação que o usuário revisou. O servidor rejeita se divergir. */
  quoteFingerprint: z.string(),
  walletId: z.string(),
  network: networkId,
  collector: collectorInfo,
})
export type CreateOrderInput = z.infer<typeof createOrderInput>

export const order = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatus,
  /** Snapshot imutável da cotação no momento do pedido. */
  snapshot: z.object({
    lines: z.array(quoteLine),
    subtotalEth: ethAmount,
    discountEth: ethAmount,
    networkFeeEth: ethAmount,
    totalEth: ethAmount,
    couponCode: z.string().nullable(),
    network: networkId,
    wallet: z.object({ label: z.string(), address: z.string(), provider: walletProvider }),
    collector: collectorInfo,
  }),
  txHash: z.string().nullable(),
  explorerUrl: z.string().nullable(),
  declineReason: z.string().nullable(),
  idempotencyKey: z.string(),
  createdAt: isoDate,
  updatedAt: isoDate,
  version: z.number().int(),
})
export type Order = z.infer<typeof order>

export const orderList = z.object({ items: z.array(order) })

// ---------------------------------------------------------------------------
// Eventos Socket.IO
// ---------------------------------------------------------------------------

export const SOCKET_EVENTS = {
  nftUpdated: 'nft.updated',
  orderUpdated: 'order.updated',
  /** Cliente -> servidor: associa a conexão à sessão (token). */
  sessionBind: 'session.bind',
  /** Cliente -> servidor: informa quais NFTs estão visíveis (opcional, só para log). */
  subscribe: 'nft.subscribe',
} as const

const eventEnvelope = z.object({
  /** Identidade estável do evento; usada para descartar duplicatas. */
  eventId: z.string(),
  emittedAt: isoDate,
})

export const nftUpdatedEvent = eventEnvelope.extend({
  type: z.literal('nft.updated'),
  resource: z.object({ kind: z.literal('nft'), id: z.string() }),
  /** Versão do NFT após a mudança; eventos com versão <= cache são ignorados. */
  version: z.number().int(),
  payload: z.object({
    priceEth: ethAmount,
    compareAtPriceEth: ethAmount.nullable(),
    editions: z.array(z.object({ id: z.string(), priceEth: ethAmount, available: quantity })),
  }),
})
export type NftUpdatedEvent = z.infer<typeof nftUpdatedEvent>

export const orderUpdatedEvent = eventEnvelope.extend({
  type: z.literal('order.updated'),
  resource: z.object({ kind: z.literal('order'), id: z.string() }),
  /** Dono do pedido; o cliente ignora eventos de outro usuário. */
  userId: z.string(),
  version: z.number().int(),
  payload: z.object({
    status: orderStatus,
    txHash: z.string().nullable(),
    explorerUrl: z.string().nullable(),
    declineReason: z.string().nullable(),
  }),
})
export type OrderUpdatedEvent = z.infer<typeof orderUpdatedEvent>

export const sessionBindPayload = z.object({ token: z.string().nullable() })

// ---------------------------------------------------------------------------
// Cabeçalhos
// ---------------------------------------------------------------------------

export const HEADERS = {
  authorization: 'Authorization',
  cartId: 'X-Cart-Id',
  idempotencyKey: 'Idempotency-Key',
  requestId: 'X-Request-Id',
} as const

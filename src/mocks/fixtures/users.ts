/**
 * Usuários, carteiras e favoritos do seed.
 *
 * Credenciais (senha igual para os dois): `Senha123`.
 * Os hashes abaixo são SHA-256 hex de `<userId>:Senha123` (ver `hashPassword` em utils.ts),
 * pré-calculados para que o seed seja síncrono e determinístico. Nenhuma senha em claro.
 */
import type { User, Wallet } from '@/api/contracts'

export const SEED_PASSWORD_HINT = 'Senha123'

export const SEED_USERS: User[] = [
  {
    id: 'usr_ana',
    name: 'Ana Ribeiro',
    username: 'ana_ribeiro',
    email: 'ana@kurio.dev',
    bio: 'Coleciono arte generativa e fotografia desde 2021.',
    avatarUrl: null,
    createdAt: '2025-03-12T14:20:00.000Z',
    version: 1,
  },
  {
    id: 'usr_bruno',
    name: 'Bruno Lima',
    username: 'bruno_lima',
    email: 'bruno@kurio.dev',
    bio: null,
    avatarUrl: null,
    createdAt: '2025-08-02T09:05:00.000Z',
    version: 1,
  },
]

export const SEED_PASSWORD_HASHES: Record<string, string> = {
  usr_ana: '60c399929464a6de6a871ca11250002a08ed64432546672ac98a1bfe385d6a26',
  usr_bruno: '185202b3c4fe6897f9a52b0d05f2cab69cd531bccbf94b6c6c0638b41c476754',
}

export const SEED_WALLETS: Wallet[] = [
  {
    id: 'wal_ana_primary',
    userId: 'usr_ana',
    kind: 'primary',
    label: 'MetaMask principal',
    address: '0x8f3C2a91B7e4D05c6A1f9E2b3D4c5A6b7C8d9E0F',
    network: 'ethereum',
    provider: 'metamask',
    createdAt: '2025-03-12T14:25:00.000Z',
    updatedAt: '2025-03-12T14:25:00.000Z',
    version: 1,
  },
  {
    id: 'wal_ana_secondary',
    userId: 'usr_ana',
    kind: 'secondary',
    label: 'WalletConnect Polygon',
    address: '0x1A2b3C4d5E6f708192a3B4c5D6e7F8091a2B3c4D',
    network: 'polygon',
    provider: 'walletconnect',
    createdAt: '2025-05-20T10:00:00.000Z',
    updatedAt: '2025-05-20T10:00:00.000Z',
    version: 1,
  },
  {
    id: 'wal_bruno_primary',
    userId: 'usr_bruno',
    kind: 'primary',
    label: 'Coinbase Wallet',
    address: '0x9E8d7C6b5A4f3e2D1c0B9a8F7e6D5c4B3a2F1e0D',
    network: 'ethereum',
    provider: 'coinbase',
    createdAt: '2025-08-02T09:10:00.000Z',
    updatedAt: '2025-08-02T09:10:00.000Z',
    version: 1,
  },
]

/** Ana tem 3 favoritos; Bruno nenhum (estado vazio). */
export const SEED_FAVORITES: Record<string, string[]> = {
  usr_ana: ['nft_001', 'nft_004', 'nft_007'],
  usr_bruno: [],
}

/** Pedido confirmado da Ana: exercita recibo, histórico e 403 ao ser lido pelo Bruno. */
export const SEED_ORDER_ID = 'ord_seed_ana_001'
export const SEED_ORDER_TX = '0xa4bcbe56f72ad710d09c04364cbe8649d7ea7cea9b82bc8b57659cbe7090a8d4'

import {
  ensSuffix,
  walletInput,
  type EnsSuffix,
  type NetworkId,
  type Wallet,
  type WalletInput,
} from '@/api/contracts'

export type WalletKind = Wallet['kind']
export type WalletProvider = Wallet['provider']

export const KIND_LABELS: Record<WalletKind, string> = {
  primary: 'Carteira principal',
  secondary: 'Carteira secundária',
}

export const KIND_ARTICLE: Record<WalletKind, string> = {
  primary: 'principal',
  secondary: 'secundária',
}

export const PROVIDER_LABELS: Record<WalletProvider, string> = {
  metamask: 'MetaMask',
  walletconnect: 'WalletConnect',
  coinbase: 'Coinbase',
}

export const PROVIDERS: WalletProvider[] = ['metamask', 'walletconnect', 'coinbase']
export const NETWORKS: NetworkId[] = ['ethereum', 'polygon', 'solana']
export const ENS_SUFFIXES: EnsSuffix[] = ensSuffix.options

/** Dica do formato esperado por rede. */
export const ADDRESS_HINTS: Record<NetworkId, string> = {
  ethereum: 'Ethereum: 0x seguido de 40 caracteres hexadecimais (ex.: 0x71C7…976F).',
  polygon: 'Polygon: 0x seguido de 40 caracteres hexadecimais (ex.: 0x71C7…976F).',
  solana: 'Solana: 32 a 44 caracteres em base58, sem 0, O, I ou l.',
}

export const ADDRESS_PLACEHOLDERS: Record<NetworkId, string> = {
  ethereum: '0x…',
  polygon: '0x…',
  solana: 'Endereço base58',
}

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/

/** Contrato da API + coerência endereço x rede (EVM começa com 0x; Solana é base58). */
export const walletFormSchema = walletInput.superRefine((value, ctx) => {
  // Formato inválido já é reportado pela regra base do contrato.
  if (!walletInput.shape.address.safeParse(value.address).success) return
  const isEvmAddress = EVM_ADDRESS.test(value.address)
  if (isEvmAddress === (value.network !== 'solana')) return
  ctx.addIssue({
    code: 'custom',
    path: ['address'],
    message:
      value.network === 'solana'
        ? 'Este endereço é do formato 0x; para Solana use um endereço base58.'
        : 'Esta rede usa endereços 0x com 40 caracteres hexadecimais.',
  })
})

export type WalletFormValues = WalletInput

/** 0x1234…abcd */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Id do botão de ação (Adicionar/Editar) da seção. */
export const walletActionId = (kind: WalletKind) => `wallet-action-${kind}`

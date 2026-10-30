/** Evento disparado pelo painel de cenários para preencher o formulário de login. */
export const FILL_CREDENTIALS_EVENT = 'kurio:fill-credentials'

export interface FillCredentialsDetail {
  email: string
  password: string
}

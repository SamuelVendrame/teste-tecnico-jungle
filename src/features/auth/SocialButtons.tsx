import { toast } from 'sonner'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"
      />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#3b5998"
        d="M14 8.5V6.9c0-.8.2-1.2 1.3-1.2H17V2.5c-.3 0-1.3-.1-2.4-.1-2.5 0-4.1 1.5-4.1 4.2v1.9H8v3.4h2.5V21.5H14v-9.6h2.5l.4-3.4H14z"
      />
    </svg>
  )
}

const socialClass =
  'flex h-[40px] w-full items-center justify-center gap-3 rounded-sm border border-border-soft text-xs text-text-secondary transition-colors hover:bg-surface-dark/40 hover:text-text-primary focus-visible:bg-surface-dark/40'

/** Bloco "Ou continue com". Visual coerente com o layout, sem integração real. */
export function SocialButtons() {
  function notAvailable() {
    toast.info('Login social em breve. Use e-mail e senha por enquanto.')
  }

  return (
    <div className="space-y-3">
      <div className="relative flex items-center justify-center md:-mx-[80px]">
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-border-soft/60" />
        <span className="relative bg-background px-3 text-xs text-text-primary md:bg-surface-card">
          Ou continue com
        </span>
      </div>
      <button type="button" onClick={notAvailable} className={socialClass}>
        <GoogleIcon />
        Continuar com Google
      </button>
      <button type="button" onClick={notAvailable} className={socialClass}>
        <FacebookIcon />
        Continuar com Facebook
      </button>
    </div>
  )
}

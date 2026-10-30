import { ImageUpIcon, Loader2Icon } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

import { AVATAR_ACCEPT, AvatarError, fileToAvatarDataUrl } from './avatar-image'
import { initials } from './profile-utils'

interface AvatarPickerProps {
  name: string
  value: string | null
  /** Erro vindo do servidor (ex.: imagem acima do limite). */
  serverError?: string
  onChange: (dataUrl: string | null) => void
}

/** Avatar com pré-visualização, "Alterar" (seleciona e redimensiona) e "Remover". */
export function AvatarPicker({ name, value, serverError, onChange }: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const baseId = useId()
  const labelId = `${baseId}-label`
  const errorId = `${baseId}-error`
  const hintId = `${baseId}-hint`
  const [localError, setLocalError] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const error = localError ?? serverError

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setLocalError(null)
    setProcessing(true)
    try {
      onChange(await fileToAvatarDataUrl(file))
    } catch (cause) {
      setLocalError(
        cause instanceof AvatarError ? cause.message : 'Não foi possível processar a imagem.',
      )
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      aria-describedby={error ? `${hintId} ${errorId}` : hintId}
      className="space-y-2"
    >
      <span id={labelId} className="block text-sm text-text-primary">
        Avatar
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <Avatar className="size-[50px] border border-border-soft bg-card">
          {value && <AvatarImage src={value} alt="Pré-visualização do avatar" />}
          <AvatarFallback className="bg-card text-text-accent">
            {value ? null : <ImageUpIcon aria-hidden className="size-5" />}
            <span className="sr-only">{initials(name)}</span>
          </AvatarFallback>
        </Avatar>
        <input
          ref={inputRef}
          type="file"
          accept={AVATAR_ACCEPT}
          onChange={handleFile}
          data-testid="avatar-input"
          aria-label="Arquivo do avatar"
          hidden
        />
        <Button
          type="button"
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          className="h-10 rounded-sm font-bold"
        >
          {processing ? <Loader2Icon aria-hidden className="animate-spin" /> : null}
          {processing ? 'Processando…' : 'Alterar'}
          <span className="sr-only"> avatar</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={!value || processing}
          onClick={() => {
            setLocalError(null)
            onChange(null)
          }}
          className="h-10 rounded-sm px-3 text-text-primary"
        >
          Remover<span className="sr-only"> avatar</span>
        </Button>
      </div>
      <p id={hintId} className="text-xs text-text-secondary">
        PNG, JPEG ou WebP, até 1 MB. A imagem é recortada em 256 × 256 px.
      </p>
      {error ? (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  )
}

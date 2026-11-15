import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Building2, Camera, Loader2, Trash2 } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { compressImage, type ImageKind } from '../lib/image'
import { useApp } from '../lib/store'
import { Avatar, Button, cx } from './ui'

/**
 * Picture chooser. The picked file is shrunk + compressed right away (image.ts), so only the small
 * version is ever kept or uploaded. `value`: undefined = unchanged, Blob = new picture, null = remove.
 */
export function ImagePicker({ kind, currentUrl, value, onChange, name }: {
  kind: ImageKind
  currentUrl: string | null
  value: Blob | null | undefined
  onChange: (v: Blob | null | undefined) => void
  name: string
}) {
  const { t, lang } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (value instanceof Blob) {
      const u = URL.createObjectURL(value)
      setPreview(u)
      return () => URL.revokeObjectURL(u)
    }
    setPreview(null)
  }, [value])

  const shown = value === null ? null : preview ?? currentUrl

  const pick = async (file: File | undefined) => {
    if (!file) return
    setError(''); setBusy(true)
    try {
      onChange(await compressImage(file, kind))
    } catch {
      setError(t('pictureError'))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const kb = value instanceof Blob ? Math.max(1, Math.round(value.size / 1024)) : null

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        {kind === 'photo'
          ? <Avatar name={name || '?'} src={shown} className="size-20 text-2xl" />
          : <LogoBox url={shown} className="size-20" />}
        {busy && (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-black/40">
            <Loader2 className="size-6 animate-spin text-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" type="button" onClick={() => input.current?.click()} disabled={busy}>
            <Camera className="size-4" /> {shown ? t('changePicture') : t('choosePicture')}
          </Button>
          {shown && (
            <Button size="sm" type="button" variant="ghost" onClick={() => onChange(currentUrl ? null : undefined)} disabled={busy}>
              <Trash2 className="size-4" /> {t('removePicture')}
            </Button>
          )}
        </div>
        <p className={cx('text-[12px]', error ? 'text-danger' : 'text-fg-faint')}>
          {error || (busy ? t('compressing') : kb ? `✓ ${kb} KB` + (lang === 'mm' ? ' (ချုံ့ပြီး)' : ' (compressed)') : t('pictureHint'))}
        </p>
      </div>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

/** Square logo tile; falls back to an icon when there is no logo. */
export function LogoBox({ url, className, icon: Icon = Building2 }: {
  url: string | null | undefined; className?: string; icon?: ComponentType<{ className?: string }>
}) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  if (url && !broken) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setBroken(true)}
        className={cx('shrink-0 rounded-xl border border-border bg-white object-contain p-0.5', className ?? 'size-9')}
      />
    )
  }
  return (
    <div className={cx('grid shrink-0 place-items-center rounded-xl bg-accent-soft text-accent', className ?? 'size-9')}>
      <Icon className="size-[45%]" />
    </div>
  )
}

/** Logo for a group or organisation row. */
export function Logo({ path, className, icon }: {
  path: string | null | undefined; className?: string; icon?: ComponentType<{ className?: string }>
}) {
  const { api } = useApp()
  return <LogoBox url={api.logoUrl(path)} className={className} icon={icon} />
}

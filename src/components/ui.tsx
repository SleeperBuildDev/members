import { createContext, useCallback, useContext, useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Loader2, X } from 'lucide-react'
import { useI18n } from '../lib/i18n'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

/* ---------- Button ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:opacity-90 shadow-sm',
  secondary: 'bg-surface text-fg border border-border hover:bg-muted',
  ghost: 'text-fg-soft hover:bg-muted hover:text-fg',
  danger: 'bg-danger-soft text-danger hover:opacity-80',
}

export function Button({ variant = 'secondary', size = 'md', loading, className, children, ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'icon'; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'sm' && 'h-8 px-3 text-[13px]',
        size === 'icon' && 'h-10 w-10',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  )
}

/* ---------- Inputs ---------- */

const fieldBase =
  'w-full rounded-xl border border-border bg-surface px-3 text-[15px] text-fg placeholder:text-fg-faint outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/15 disabled:opacity-60'

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={cx(fieldBase, 'h-11', className)} />
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(fieldBase, 'py-2.5 min-h-20', className)} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={cx(fieldBase, 'h-11 appearance-none pr-9 bg-[length:16px] bg-[right_12px_center] bg-no-repeat', className)}
      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238a92a0' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }}
    >
      {children}
    </select>
  )
}

export function Field({ label, hint, error, children, className }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; children: ReactNode; className?: string
}) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1.5 block truncate text-[13px] font-medium text-fg-soft">{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[12px] text-danger">{error}</span>
        : hint ? <span className="mt-1 block text-[12px] text-fg-faint">{hint}</span> : null}
    </label>
  )
}

/** Segmented control for small choice sets. */
export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]
}) {
  return (
    <div className="inline-flex rounded-xl bg-muted p-1 gap-1">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'h-8 rounded-lg px-3 text-[13px] font-medium transition',
            value === o.value ? 'bg-surface text-fg shadow-sm' : 'text-fg-soft hover:text-fg',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Display ---------- */

export function Badge({ tone = 'neutral', children, className }: {
  tone?: 'neutral' | 'accent' | 'ok' | 'warn' | 'danger'; children: ReactNode; className?: string
}) {
  const tones = {
    neutral: 'bg-muted text-fg-soft',
    accent: 'bg-accent-soft text-accent',
    ok: 'bg-ok-soft text-ok',
    warn: 'bg-warn-soft text-warn',
    danger: 'bg-danger-soft text-danger',
  }
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-medium', tones[tone], className)}>{children}</span>
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-border bg-surface', className)}>{children}</div>
}

export function Empty({ icon, title, hint, action }: { icon: ReactNode; title: ReactNode; hint?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="mb-4 grid size-14 place-items-center rounded-2xl bg-muted text-fg-faint">{icon}</div>
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-fg-soft max-w-sm">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('size-5 animate-spin text-fg-faint', className)} />
}

export function Avatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])
  const letter = [...(name.trim() || '?')][0]
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360
  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className={cx('shrink-0 rounded-full bg-muted object-cover', className ?? 'size-10 text-sm')}
      />
    )
  }
  return (
    <div
      className={cx('grid shrink-0 place-items-center rounded-full font-semibold text-white', className ?? 'size-10 text-sm')}
      style={{ background: `oklch(0.62 0.13 ${h})` }}
    >
      {letter}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[22px] font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 line-clamp-2 text-sm text-fg-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  )
}

/* ---------- Sheet (right panel on desktop, bottom sheet on mobile) ---------- */

export function Sheet({ open, onClose, title, children, footer, wide }: {
  open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-stretch sm:justify-end">
      <div className="anim-fade absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cx(
          'anim-sheet relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-surface shadow-2xl sm:max-h-none sm:h-full sm:rounded-none sm:rounded-l-3xl',
          wide ? 'sm:max-w-xl' : 'sm:max-w-md',
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-[17px] font-semibold truncate">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2"><X className="size-5" /></Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="safe-bottom flex gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/* ---------- Confirm dialog ---------- */

interface ConfirmOpts { message: ReactNode; confirmLabel?: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(null!)
const ToastCtx = createContext<(msg: string, tone?: 'ok' | 'error') => void>(null!)

export function UiProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const [dlg, setDlg] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: 'ok' | 'error' }[]>([])

  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setDlg({ ...o, resolve })), [])
  const toast = useCallback((msg: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((x) => [...x, { id, msg, tone }])
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), 3200)
  }, [])
  const close = (v: boolean) => { dlg?.resolve(v); setDlg(null) }

  return (
    <ConfirmCtx.Provider value={confirm}>
      <ToastCtx.Provider value={toast}>
        {children}
        {dlg && (
          <div className="fixed inset-0 z-[60] grid place-items-center p-4">
            <div className="anim-fade absolute inset-0 bg-black/40" onClick={() => close(false)} />
            <div role="alertdialog" className="anim-sheet relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl">
              <p className="text-[15px] leading-relaxed">{dlg.message}</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => close(false)}>{t('cancel')}</Button>
                <Button variant={dlg.danger ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus>
                  {dlg.confirmLabel ?? t('confirm')}
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
          {toasts.map((x) => (
            <div
              key={x.id}
              className={cx(
                'anim-sheet pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg',
                x.tone === 'ok' ? 'bg-fg text-bg' : 'bg-danger text-white',
              )}
            >
              {x.msg}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </ConfirmCtx.Provider>
  )
}

export const useConfirm = () => useContext(ConfirmCtx)
export const useToast = () => useContext(ToastCtx)

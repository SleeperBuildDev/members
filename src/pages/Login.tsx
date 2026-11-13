import { useState, type FormEvent } from 'react'
import { Clock, FlaskConical, LogOut, Users } from 'lucide-react'
import { useApp } from '../lib/store'
import { useI18n } from '../lib/i18n'
import { Button, Card, Field, Input, Segmented } from '../components/ui'

function Shell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang } = useI18n()
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-3 grid size-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/30"><Users className="size-7" /></div>
        <h1 className="text-2xl font-bold tracking-tight">{t('appName')}</h1>
      </div>
      <Card className="w-full max-w-sm p-6 shadow-sm">{children}</Card>
      <div className="mt-6">
        <Segmented value={lang} onChange={setLang} options={[{ value: 'mm', label: 'မြန်မာ' }, { value: 'en', label: 'English' }]} />
      </div>
    </div>
  )
}

export function LoginPage() {
  const { api } = useApp()
  const { t } = useI18n()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (api.mode === 'demo') {
    return (
      <Shell>
        <div className="mb-4 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
          <FlaskConical className="size-4 shrink-0 mt-0.5" /><span><b>{t('demoMode')}</b> · {t('demoHint')}</span>
        </div>
        <Button variant="primary" className="w-full h-11" onClick={() => api.signIn('', '')}>{t('enterDemo')}</Button>
      </Shell>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(''); setBusy(true)
    try {
      if (mode === 'in') await api.signIn(email.trim(), password)
      else if (!(await api.signUp(email.trim(), password, fullName.trim()))) {
        setMode('in'); setInfo(t('checkEmail'))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  return (
    <Shell>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'up' && (
          <Field label={t('fullName')}><Input required value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" /></Field>
        )}
        <Field label={t('email')}><Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
        <Field label={t('password')}>
          <Input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} />
        </Field>
        {info && <p className="rounded-xl bg-ok-soft px-3 py-2 text-[13px] text-ok">{info}</p>}
        {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">{error}</p>}
        <Button type="submit" variant="primary" className="w-full h-11" loading={busy}>{mode === 'in' ? t('signIn') : t('signUp')}</Button>
      </form>
      <p className="mt-5 text-center text-sm text-fg-soft">
        {mode === 'in' ? t('noAccount') : t('haveAccount')}{' '}
        <button className="font-semibold text-accent hover:underline" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError('') }}>
          {mode === 'in' ? t('signUp') : t('signIn')}
        </button>
      </p>
    </Shell>
  )
}

export function PendingPage() {
  const { api, profile, reload } = useApp()
  const { t } = useI18n()
  return (
    <Shell>
      <div className="text-center">
        <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-warn-soft text-warn"><Clock className="size-6" /></div>
        <h2 className="font-semibold">{profile?.status === 'disabled' ? t('disabled') : t('pendingTitle')}</h2>
        <p className="mt-1.5 text-sm text-fg-soft">{profile?.status === 'disabled' ? t('disabledBody') : t('pendingBody')}</p>
        <p className="mt-3 text-[13px] text-fg-faint">{profile?.email}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Button onClick={() => reload()}>↻</Button>
          <Button variant="ghost" onClick={() => api.signOut()}><LogOut className="size-4" /> {t('signOut')}</Button>
        </div>
      </div>
    </Shell>
  )
}

import { useState } from 'react'
import { NavLink } from 'react-router'
import { ChevronRight, History, LogOut, Monitor, Moon, RotateCcw, Smartphone, Sun, Trash2 } from 'lucide-react'
import { useApp, applyTheme, readTheme, type Theme } from '../lib/store'
import { useI18n } from '../lib/i18n'
import { Avatar, Badge, Button, Card, PageHeader, Segmented } from '../components/ui'

export function SettingsPage() {
  const { api, profile, isAdmin } = useApp()
  const { t, lang, setLang } = useI18n()
  const [theme, setTheme] = useState<Theme>(readTheme)

  const changeTheme = (v: Theme) => { setTheme(v); applyTheme(v) }

  return (
    <>
      <PageHeader title={t('settings')} />
      <div className="max-w-xl space-y-4">
        <Card className="flex items-center gap-4 p-4">
          <Avatar name={profile?.full_name || profile?.email || '?'} className="size-14 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold truncate">{profile?.full_name || '—'}</div>
            <div className="text-sm text-fg-faint truncate">{profile?.email}</div>
            {isAdmin && <Badge tone="accent" className="mt-1">{t('admin')}</Badge>}
          </div>
        </Card>

        <Card className="divide-y divide-border">
          <div className="flex items-center justify-between gap-3 p-4">
            <span className="font-medium">{t('language')}</span>
            <Segmented value={lang} onChange={setLang} options={[{ value: 'mm', label: 'မြန်မာ' }, { value: 'en', label: 'English' }]} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span className="font-medium">{t('theme')}</span>
            <Segmented
              value={theme}
              onChange={changeTheme}
              options={[
                { value: 'light', label: <span className="flex items-center gap-1.5"><Sun className="size-3.5" />{t('light')}</span> },
                { value: 'dark', label: <span className="flex items-center gap-1.5"><Moon className="size-3.5" />{t('dark')}</span> },
                { value: 'system', label: <span className="flex items-center gap-1.5"><Monitor className="size-3.5" />{t('system')}</span> },
              ]}
            />
          </div>
          <div className="flex items-start gap-3 p-4">
            <Smartphone className="mt-0.5 size-5 text-fg-faint" />
            <div>
              <div className="font-medium">{t('installApp')}</div>
              <div className="text-sm text-fg-soft">{t('installHint')}</div>
            </div>
          </div>
        </Card>

        {isAdmin && (
          <Card className="divide-y divide-border lg:hidden">
            <NavLink to="/trash" className="flex items-center gap-3 p-4"><Trash2 className="size-5 text-fg-faint" /><span className="flex-1 font-medium">{t('trash')}</span><ChevronRight className="size-4 text-fg-faint" /></NavLink>
            <NavLink to="/activity" className="flex items-center gap-3 p-4"><History className="size-5 text-fg-faint" /><span className="flex-1 font-medium">{t('activity')}</span><ChevronRight className="size-4 text-fg-faint" /></NavLink>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          <Button variant="danger" onClick={() => api.signOut()}><LogOut className="size-4" /> {t('signOut')}</Button>
          {api.mode === 'demo' && (
            <Button onClick={() => { try { localStorage.removeItem('member-registry-demo') } catch { /* ignore */ } location.reload() }}><RotateCcw className="size-4" /> {t('resetDemo')}</Button>
          )}
        </div>
      </div>
    </>
  )
}

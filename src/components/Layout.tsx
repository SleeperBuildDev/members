import { NavLink, Outlet } from 'react-router'
import { Building2, History, Settings, Trash2, Users, UserCog, FlaskConical } from 'lucide-react'
import { useApp } from '../lib/store'
import { useI18n, type Key } from '../lib/i18n'
import { Avatar, cx } from './ui'

interface Item { to: string; label: Key; icon: typeof Users; admin?: boolean; mobile?: boolean }

const items: Item[] = [
  { to: '/', label: 'members', icon: Users, mobile: true },
  { to: '/orgs', label: 'organisations', icon: Building2, mobile: true },
  { to: '/users', label: 'users', icon: UserCog, admin: true, mobile: true },
  { to: '/trash', label: 'trash', icon: Trash2, admin: true },
  { to: '/activity', label: 'activity', icon: History, admin: true },
  { to: '/settings', label: 'settings', icon: Settings, mobile: true },
]

export function Layout() {
  const { profile, isAdmin, api } = useApp()
  const { t } = useI18n()
  const visible = items.filter((i) => !i.admin || isAdmin)

  return (
    <div className="min-h-full lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex sticky top-0 h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-3 py-5">
        <div className="flex items-center gap-2.5 px-3 mb-7">
          <div className="grid size-9 place-items-center rounded-xl bg-accent text-accent-fg"><Users className="size-5" /></div>
          <div className="font-bold leading-tight">{t('appName')}</div>
        </div>
        <nav className="flex flex-col gap-1">
          {visible.map((i, idx) => (
            <div key={i.to}>
              {i.admin && !visible[idx - 1]?.admin && (
                <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-fg-faint">{t('admin')}</div>
              )}
              <NavLink
                to={i.to}
                end={i.to === '/'}
                className={({ isActive }) => cx(
                  'flex items-center gap-3 rounded-xl px-3 h-10 text-sm font-medium transition',
                  isActive ? 'bg-accent-soft text-accent' : 'text-fg-soft hover:bg-muted hover:text-fg',
                )}
              >
                <i.icon className="size-[18px]" /> {t(i.label)}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="mt-auto">
          {api.mode === 'demo' && (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-warn-soft px-3 py-2.5 text-[12px] text-warn">
              <FlaskConical className="size-4 shrink-0 mt-0.5" />
              <span><b>{t('demoMode')}</b> · {t('demoHint')}</span>
            </div>
          )}
          <NavLink to="/settings" className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-muted">
            <Avatar name={profile?.full_name || profile?.email || '?'} className="size-9 text-sm" />
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{profile?.full_name || profile?.email}</div>
              <div className="truncate text-[12px] text-fg-faint">{isAdmin ? t('admin') : profile?.email}</div>
            </div>
          </NavLink>
        </div>
      </aside>

      {/* Page */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-10">
        {api.mode === 'demo' && (
          <div className="lg:hidden flex items-center gap-2 bg-warn-soft px-4 py-2 text-[12px] text-warn">
            <FlaskConical className="size-4 shrink-0" /> <b>{t('demoMode')}</b>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 pt-5 lg:px-8 lg:pt-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="safe-bottom lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur">
        <div className="flex">
          {visible.filter((i) => i.mobile).map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) => cx(
                'flex flex-1 flex-col items-center gap-0.5 pt-2 pb-1.5 text-[11px] font-medium',
                isActive ? 'text-accent' : 'text-fg-faint',
              )}
            >
              <i.icon className="size-[22px]" />
              <span className="truncate max-w-full px-1">{t(i.label)}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

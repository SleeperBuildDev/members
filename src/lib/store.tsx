import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getApi, type Api } from './api'
import type { Access, Group, Org, Profile, Role } from './types'

interface AppState {
  api: Api
  ready: boolean
  profile: Profile | null
  groups: Group[]
  orgs: Org[]
  /** The current user's role on each organisation they can see. */
  roles: Record<string, Role>
  isAdmin: boolean
  canEditAny: boolean
  reload: () => Promise<void>
}

const Ctx = createContext<AppState>(null!)

function computeRoles(profile: Profile | null, orgs: Org[], access: Access[]): Record<string, Role> {
  const out: Record<string, Role> = {}
  if (!profile || profile.status !== 'active') return out
  for (const o of orgs) {
    if (profile.is_admin) { out[o.id] = 'admin'; continue }
    const grants = access.filter((a) => a.org_id === o.id || a.group_id === o.group_id)
    if (grants.length) out[o.id] = grants.some((g) => g.role === 'editor') ? 'editor' : 'viewer'
  }
  return out
}

export function AppProvider({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const [api, setApi] = useState<Api | null>(null)
  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [orgs, setOrgs] = useState<Org[]>([])
  const [access, setAccess] = useState<Access[]>([])

  useEffect(() => { getApi().then(setApi) }, [])

  const reload = useCallback(async () => {
    if (!api) return
    const p = await api.currentProfile().catch(() => null)
    setProfile(p)
    if (p && p.status === 'active') {
      const [g, o, a] = await Promise.all([api.listGroups(), api.listOrgs(), api.myAccess()])
      setGroups(g); setOrgs(o); setAccess(a)
    } else {
      setGroups([]); setOrgs([]); setAccess([])
    }
    setReady(true)
  }, [api])

  useEffect(() => {
    if (!api) return
    reload()
    return api.onAuthChange(() => { reload() })
  }, [api, reload])

  const value = useMemo<AppState | null>(() => {
    if (!api) return null
    const roles = computeRoles(profile, orgs, access)
    return {
      api, ready, profile, groups, orgs, roles, reload,
      isAdmin: !!profile?.is_admin && profile.status === 'active',
      canEditAny: Object.values(roles).some((r) => r !== 'viewer'),
    }
  }, [api, ready, profile, groups, orgs, access, reload])

  if (!value || !ready) return <>{fallback}</>
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useApp = () => useContext(Ctx)

/* ---------- theme ---------- */

export type Theme = 'light' | 'dark' | 'system'

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem('theme')
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch { /* ignore */ }
  return 'system'
}

export function applyTheme(t: Theme) {
  const dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f17' : '#ffffff')
  try { localStorage.setItem('theme', t) } catch { /* ignore */ }
}

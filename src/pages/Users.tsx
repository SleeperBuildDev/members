import { useCallback, useEffect, useState } from 'react'
import { Building2, Check, FolderTree, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react'
import { useApp } from '../lib/store'
import { pickName, useI18n } from '../lib/i18n'
import type { Access, Profile } from '../lib/types'
import { Avatar, Badge, Button, Card, Empty, Field, PageHeader, Segmented, Select, Sheet, Spinner, useConfirm, useToast } from '../components/ui'

export function UsersPage() {
  const { api, profile: me, groups, orgs } = useApp()
  const { t, lang } = useI18n()
  const toast = useToast()
  const confirm = useConfirm()
  const [users, setUsers] = useState<Profile[] | null>(null)
  const [access, setAccess] = useState<Access[]>([])
  const [selected, setSelected] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    const [u, a] = await Promise.all([api.listUsers(), api.listAccess()])
    setUsers(u); setAccess(a)
    setSelected((s) => (s ? u.find((x) => x.id === s.id) ?? null : null))
  }, [api])
  useEffect(() => { load().catch((e) => toast((e as Error).message, 'error')) }, [load, toast])

  const update = async (u: Profile, patch: Partial<Profile>) => {
    try { await api.updateUser(u.id, patch); await load(); toast(t('saved')) } catch (e) { toast((e as Error).message, 'error') }
  }

  const grantLabel = (a: Access) => {
    if (a.group_id) { const g = groups.find((x) => x.id === a.group_id); return g ? pickName(g, lang) : '?' }
    const o = orgs.find((x) => x.id === a.org_id); return o ? pickName(o, lang) : '?'
  }

  if (!users) return <div className="grid place-items-center py-20"><Spinner /></div>
  const pending = users.filter((u) => u.status === 'pending')
  const others = users.filter((u) => u.status !== 'pending')

  const row = (u: Profile) => {
    const grants = access.filter((a) => a.user_id === u.id)
    return (
      <div
        key={u.id}
        role="button"
        tabIndex={0}
        onClick={() => setSelected(u)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(u) } }}
        className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
      >
        <Avatar name={u.full_name || u.email} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5 [&>span:not(:first-child)]:shrink-0">
            <span className="min-w-0 truncate font-medium">{u.full_name || u.email}</span>
            {u.id === me?.id && <Badge>{t('you')}</Badge>}
            {u.is_admin && <Badge tone="accent"><ShieldCheck className="size-3" /> {t('admin')}</Badge>}
            {u.status === 'disabled' && <Badge tone="danger">{t('disabled')}</Badge>}
          </div>
          <div className="text-[13px] text-fg-faint truncate">{u.email}</div>
          {!u.is_admin && (
            <div className="mt-1 text-[12px] text-fg-soft truncate">
              {grants.length ? grants.map((g) => `${grantLabel(g)} (${t(g.role)})`).join(' · ') : t('noAccessYet')}
            </div>
          )}
        </div>
        {u.status === 'pending' && (
          <Button size="sm" variant="primary" className="shrink-0" onClick={(e) => { e.stopPropagation(); update(u, { status: 'active' }) }}>
            <Check className="size-4" /> {t('approve')}
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <PageHeader title={t('users')} subtitle={t('usersHint')} />
      {pending.length > 0 && (
        <Card className="mb-4 overflow-hidden border-warn/40">
          <div className="border-b border-border bg-warn-soft px-4 py-2 text-[13px] font-semibold text-warn">{t('pending')} · {pending.length}</div>
          <div className="divide-y divide-border">{pending.map(row)}</div>
        </Card>
      )}
      <Card className="overflow-hidden">
        {others.length ? <div className="divide-y divide-border">{others.map(row)}</div> : <Empty icon={<UserCog className="size-7" />} title="—" />}
      </Card>

      {selected && (
        <UserSheet
          user={selected}
          isMe={selected.id === me?.id}
          grants={access.filter((a) => a.user_id === selected.id)}
          grantLabel={grantLabel}
          onClose={() => setSelected(null)}
          onUpdate={(p) => update(selected, p)}
          onGrant={async (a) => { try { await api.grantAccess(a); await load() } catch (e) { toast((e as Error).message, 'error') } }}
          onRevoke={async (id) => {
            if (!(await confirm({ message: t('deleteQ'), danger: true, confirmLabel: t('delete') }))) return
            try { await api.revokeAccess(id); await load() } catch (e) { toast((e as Error).message, 'error') }
          }}
        />
      )}
    </>
  )
}

function UserSheet({ user, isMe, grants, grantLabel, onClose, onUpdate, onGrant, onRevoke }: {
  user: Profile; isMe: boolean; grants: Access[]; grantLabel: (a: Access) => string
  onClose: () => void; onUpdate: (p: Partial<Profile>) => void
  onGrant: (a: Omit<Access, 'id'>) => Promise<void>; onRevoke: (id: string) => void
}) {
  const { groups, orgs } = useApp()
  const { t, lang } = useI18n()
  const [scope, setScope] = useState<'group' | 'org'>('group')
  const [target, setTarget] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    if (!target) return
    setBusy(true)
    await onGrant({ user_id: user.id, role, group_id: scope === 'group' ? target : null, org_id: scope === 'org' ? target : null })
    setTarget(''); setBusy(false)
  }

  return (
    <Sheet open onClose={onClose} title={user.full_name || user.email}>
      <div className="flex items-center gap-3">
        <Avatar name={user.full_name || user.email} className="size-14 text-xl" />
        <div className="min-w-0">
          <div className="font-semibold">{user.full_name || '—'}</div>
          <div className="text-sm text-fg-faint truncate">{user.email}</div>
        </div>
      </div>

      {!isMe && (
        <div className="mt-5 flex flex-wrap gap-2">
          {user.status === 'pending' && <Button variant="primary" onClick={() => onUpdate({ status: 'active' })}><Check className="size-4" /> {t('approve')}</Button>}
          {user.status === 'active' && <Button variant="danger" onClick={() => onUpdate({ status: 'disabled' })}>{t('disable')}</Button>}
          {user.status === 'disabled' && <Button onClick={() => onUpdate({ status: 'active' })}>{t('enable')}</Button>}
          <Button onClick={() => onUpdate({ is_admin: !user.is_admin })}>
            <ShieldCheck className="size-4" /> {user.is_admin ? `− ${t('admin')}` : `+ ${t('admin')}`}
          </Button>
        </div>
      )}

      {user.is_admin ? (
        <p className="mt-6 rounded-xl bg-accent-soft px-4 py-3 text-sm text-accent">
          <ShieldCheck className="mr-1 inline size-4" /> {t('admin')} — {t('all')} {t('organisations')}
        </p>
      ) : (
        <>
          <h3 className="mb-2 mt-6 text-[13px] font-semibold uppercase tracking-wide text-fg-faint">{t('access')}</h3>
          <div className="space-y-2">
            {grants.length === 0 && <p className="text-sm text-fg-faint">{t('noAccessYet')}</p>}
            {grants.map((g) => (
              <div key={g.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2.5">
                {g.group_id ? <FolderTree className="size-[18px] text-fg-faint" /> : <Building2 className="size-[18px] text-fg-faint" />}
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{grantLabel(g)}</div>
                  <div className="text-[12px] text-fg-faint">{g.group_id ? t('wholeGroup') : t('oneOrg')}</div>
                </div>
                <Badge tone={g.role === 'editor' ? 'accent' : 'neutral'}>{t(g.role)}</Badge>
                <Button size="icon" variant="ghost" onClick={() => onRevoke(g.id)} aria-label={t('delete')}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </div>

          <Card className="mt-4 space-y-3 p-4">
            <div className="text-sm font-semibold">{t('giveAccess')}</div>
            <Segmented value={scope} onChange={(v) => { setScope(v); setTarget('') }}
              options={[{ value: 'group', label: t('wholeGroup') }, { value: 'org', label: t('oneOrg') }]} />
            <Select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{scope === 'group' ? t('group') : t('organisation')}…</option>
              {scope === 'group'
                ? groups.map((g) => <option key={g.id} value={g.id}>{pickName(g, lang)}</option>)
                : groups.map((g) => (
                  <optgroup key={g.id} label={pickName(g, lang)}>
                    {orgs.filter((o) => o.group_id === g.id).map((o) => <option key={o.id} value={o.id}>{pickName(o, lang)}</option>)}
                  </optgroup>
                ))}
            </Select>
            <Field label={t('access')}>
              <div className="grid grid-cols-2 gap-2">
                {(['viewer', 'editor'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`rounded-xl border px-3 py-2.5 text-left transition ${role === r ? 'border-accent bg-accent-soft' : 'border-border hover:bg-muted'}`}
                  >
                    <div className={`text-sm font-semibold ${role === r ? 'text-accent' : ''}`}>{t(r)}</div>
                    <div className="text-[12px] text-fg-faint">{t(r === 'editor' ? 'editorHint' : 'viewerHint')}</div>
                  </button>
                ))}
              </div>
            </Field>
            <Button variant="primary" className="w-full" disabled={!target} loading={busy} onClick={add}><Plus className="size-4" /> {t('giveAccess')}</Button>
          </Card>
        </>
      )}
    </Sheet>
  )
}

import { useCallback, useEffect, useState } from 'react'
import { History, RotateCcw, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store'
import { pickName, useI18n, type Key } from '../lib/i18n'
import { toMmDigits } from '../lib/text'
import type { ActivityEntry, Member } from '../lib/types'
import { Avatar, Button, Card, Empty, PageHeader, Spinner, useConfirm, useToast } from '../components/ui'

export function TrashPage() {
  const { api, orgs } = useApp()
  const { t, lang } = useI18n()
  const confirm = useConfirm()
  const toast = useToast()
  const [rows, setRows] = useState<Member[] | null>(null)

  const load = useCallback(() => api.listDeleted().then(setRows).catch((e) => toast((e as Error).message, 'error')), [api, toast])
  useEffect(() => { load() }, [load])

  const restore = async (m: Member) => {
    try { await api.restoreMember(m.id); toast(t('saved')); load() } catch (e) { toast((e as Error).message, 'error') }
  }
  const purge = async (m: Member) => {
    if (!(await confirm({ message: t('deleteForeverQ'), confirmLabel: t('deleteForever'), danger: true }))) return
    try { await api.purgeMember(m.id); load() } catch (e) { toast((e as Error).message, 'error') }
  }
  const purgeOld = async () => {
    if (!(await confirm({ message: t('deleteForeverQ'), confirmLabel: t('deleteForever'), danger: true }))) return
    try { const n = await api.purgeOld(); toast(`${n}`); load() } catch (e) { toast((e as Error).message, 'error') }
  }

  const num = (n: number) => (lang === 'mm' ? toMmDigits(n) : String(n))
  const daysLeft = (d: string) => Math.max(0, 30 - Math.floor((Date.now() - Date.parse(d)) / 864e5))

  return (
    <>
      <PageHeader
        title={t('trash')}
        actions={rows && rows.some((m) => daysLeft(m.deleted_at!) === 0) && <Button variant="danger" onClick={purgeOld}><Trash2 className="size-4" /> {t('emptyOld')}</Button>}
      />
      {!rows ? <div className="grid place-items-center py-20"><Spinner /></div> : rows.length === 0 ? (
        <Card><Empty icon={<Trash2 className="size-7" />} title={t('trashEmpty')} /></Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((m) => {
            const o = orgs.find((x) => x.id === m.org_id)
            return (
              <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={m.name} className="size-9 text-sm opacity-60" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{m.name}</div>
                  <div className="text-[13px] text-fg-faint truncate">
                    {o ? pickName(o, lang) : ''} · {t('deletedOn')} {new Date(m.deleted_at!).toLocaleDateString(lang === 'mm' ? 'my-MM' : 'en-GB')} · {num(daysLeft(m.deleted_at!))} {t('daysLeft')}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => restore(m)}><RotateCcw className="size-4" /> {t('restore')}</Button>
                  <Button size="sm" variant="danger" onClick={() => purge(m)}>{t('deleteForever')}</Button>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </>
  )
}

export function ActivityPage() {
  const { api, orgs } = useApp()
  const { t, lang } = useI18n()
  const toast = useToast()
  const [rows, setRows] = useState<ActivityEntry[] | null>(null)
  useEffect(() => { api.listActivity(300).then(setRows).catch((e) => toast((e as Error).message, 'error')) }, [api, toast])

  const tones: Record<ActivityEntry['action'], string> = {
    created: 'bg-ok', updated: 'bg-accent', deleted: 'bg-danger', restored: 'bg-ok', purged: 'bg-danger', nrc_viewed: 'bg-warn',
  }

  return (
    <>
      <PageHeader title={t('activity')} />
      {!rows ? <div className="grid place-items-center py-20"><Spinner /></div> : rows.length === 0 ? (
        <Card><Empty icon={<History className="size-7" />} title={t('noActivity')} /></Card>
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {rows.map((r) => {
            const o = orgs.find((x) => x.id === r.org_id)
            return (
              <div key={r.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-2 size-2 shrink-0 rounded-full ${tones[r.action]}`} />
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{r.user_email || '—'}</span>{' '}
                  <span className="text-fg-soft">{t(`act_${r.action}` as Key)}</span>{' '}
                  <span className="font-medium">{r.member_name}</span>
                  {o && <span className="text-fg-faint"> · {pickName(o, lang)}</span>}
                  <div className="text-[12px] text-fg-faint">{new Date(r.created_at).toLocaleString(lang === 'mm' ? 'my-MM' : 'en-GB')}</div>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </>
  )
}

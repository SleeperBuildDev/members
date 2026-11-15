import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Building2, ChevronRight, FolderPlus, FolderTree, Pencil, Plus, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store'
import { pickName, useI18n } from '../lib/i18n'
import { cleanText, toMmDigits } from '../lib/text'
import type { Group, Org } from '../lib/types'
import { Badge, Button, Card, Empty, Field, Input, PageHeader, Select, Sheet, useConfirm, useToast } from '../components/ui'
import { ImagePicker, Logo } from '../components/ImagePicker'

type Editing =
  | { kind: 'group'; item: Partial<Group> }
  | { kind: 'org'; item: Partial<Org> }
  | null

export function OrgsPage() {
  const { api, groups, orgs, roles, isAdmin, reload } = useApp()
  const { t, lang } = useI18n()
  const confirm = useConfirm()
  const toast = useToast()
  const nav = useNavigate()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [editing, setEditing] = useState<Editing>(null)
  const [name, setName] = useState('')
  const [nameEn, setNameEn] = useState('')
  const [groupId, setGroupId] = useState('')
  const [saving, setSaving] = useState(false)
  const [logo, setLogo] = useState<Blob | null | undefined>(undefined)

  useEffect(() => { api.memberCounts().then(setCounts).catch(() => {}) }, [api, orgs])

  const open = (e: Editing) => {
    setEditing(e)
    setName(e?.item.name ?? '')
    setNameEn(e?.item.name_en ?? '')
    setGroupId(e?.kind === 'org' ? e.item.group_id ?? '' : '')
    setLogo(undefined)
  }

  const save = async () => {
    if (!editing || !name.trim()) return
    setSaving(true)
    try {
      const id = editing.kind === 'group'
        ? await api.saveGroup({ id: editing.item.id, name: cleanText(name), name_en: nameEn.trim() })
        : await api.saveOrg({ id: editing.item.id, name: cleanText(name), name_en: nameEn.trim(), group_id: groupId })
      if (logo !== undefined) await api.setLogo(editing.kind, id, logo)
      await reload()
      setEditing(null)
      toast(t('saved'))
    } catch (e) {
      toast(`${t('error')}: ${(e as Error).message}`, 'error')
    } finally { setSaving(false) }
  }

  const remove = async () => {
    if (!editing?.item.id) return
    if (!(await confirm({ message: t('deleteQ'), confirmLabel: t('delete'), danger: true }))) return
    try {
      if (editing.kind === 'group') await api.deleteGroup(editing.item.id)
      else await api.deleteOrg(editing.item.id)
      await reload()
      setEditing(null)
    } catch {
      toast(editing.kind === 'group' ? t('cantDeleteGroup') : t('cantDeleteOrg'), 'error')
    }
  }

  const num = (n: number) => (lang === 'mm' ? toMmDigits(n) : String(n))
  const visibleGroups = groups.filter((g) => isAdmin || orgs.some((o) => o.group_id === g.id && roles[o.id]))

  return (
    <>
      <PageHeader
        title={t('organisations')}
        actions={isAdmin && <Button variant="primary" onClick={() => open({ kind: 'group', item: {} })}><FolderPlus className="size-4" /> {t('addGroup')}</Button>}
      />

      {visibleGroups.length === 0 ? (
        <Card>
          <Empty
            icon={<Building2 className="size-7" />}
            title={isAdmin ? t('noGroups') : t('noAccessHint')}
            hint={isAdmin ? t('noGroupsHint') : undefined}
            action={isAdmin && <Button variant="primary" onClick={() => open({ kind: 'group', item: {} })}><FolderPlus className="size-4" /> {t('addGroup')}</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visibleGroups.map((g) => {
            const list = orgs.filter((o) => o.group_id === g.id && roles[o.id])
            const total = list.reduce((s, o) => s + (counts[o.id] ?? 0), 0)
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
                  <Logo path={g.logo_path} icon={FolderTree} className="size-11" />
                  <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/?group=${g.id}`)}>
                    <div className="truncate font-semibold hover:text-accent">{pickName(g, lang)}</div>
                    <div className="truncate text-[13px] text-fg-faint">{num(list.length)} {t('orgsCount')} · {num(total)} {t('results')}</div>
                  </button>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" className="shrink-0" onClick={() => open({ kind: 'group', item: g })} aria-label={t('editGroup')}><Pencil className="size-4" /></Button>
                  )}
                </div>
                <ul className="divide-y divide-border">
                  {list.map((o) => (
                    <li key={o.id} className="flex items-center gap-2 pr-2">
                      <button className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left hover:bg-muted/50" onClick={() => nav(`/?org=${o.id}`)}>
                        <Logo path={o.logo_path} />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium truncate">{pickName(o, lang)}</div>
                          <div className="truncate text-[13px] text-fg-faint">{num(counts[o.id] ?? 0)} {t('results')}</div>
                        </div>
                        {roles[o.id] !== 'admin' && <Badge tone={roles[o.id] === 'editor' ? 'accent' : 'neutral'}>{t(roles[o.id] as 'editor' | 'viewer')}</Badge>}
                        <ChevronRight className="size-4 shrink-0 text-fg-faint" />
                      </button>
                      {isAdmin && <Button size="icon" variant="ghost" className="shrink-0" onClick={() => open({ kind: 'org', item: o })} aria-label={t('editOrg')}><Pencil className="size-4" /></Button>}
                    </li>
                  ))}
                  {list.length === 0 && !isAdmin && <li className="px-4 py-6 text-center text-sm text-fg-faint">—</li>}
                  {isAdmin && (
                    <li>
                      <button
                        className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-accent hover:bg-accent-soft"
                        onClick={() => open({ kind: 'org', item: { group_id: g.id } })}
                      >
                        <Plus className="size-4 shrink-0" /> <span className="truncate">{t('addOrg')}</span>
                      </button>
                    </li>
                  )}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?.kind === 'group' ? (editing.item.id ? t('editGroup') : t('addGroup')) : (editing?.item.id ? t('editOrg') : t('addOrg'))}
        footer={<>
          {editing?.item.id && <Button variant="danger" onClick={remove}><Trash2 className="size-4" /> {t('delete')}</Button>}
          <Button className="ml-auto" onClick={() => setEditing(null)}>{t('cancel')}</Button>
          <Button variant="primary" loading={saving} disabled={!name.trim()} onClick={save}>{t('save')}</Button>
        </>}
      >
        <div className="space-y-4">
          {editing?.kind === 'org' && (
            <Field label={t('group')}>
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => <option key={g.id} value={g.id}>{pickName(g, lang)}</option>)}
              </Select>
            </Field>
          )}
          <div>
            <span className="mb-1.5 block text-[13px] font-medium text-fg-soft">{t('logo')}</span>
            <ImagePicker kind="logo" name={name} currentUrl={api.logoUrl(editing?.item.logo_path)} value={logo} onChange={setLogo} />
          </div>
          <Field label={t('groupNameMm')}><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
          <Field label={<>{t('groupNameEn')} <span className="font-normal text-fg-faint">· {t('optional')}</span></>}>
            <Input value={nameEn} onChange={(e) => setNameEn(e.target.value)} />
          </Field>
        </div>
      </Sheet>
    </>
  )
}

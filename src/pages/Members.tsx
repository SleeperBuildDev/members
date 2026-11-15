import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Building2, Download, Plus, Search, SlidersHorizontal, Users, X } from 'lucide-react'
import { useApp } from '../lib/store'
import { pickName, useI18n } from '../lib/i18n'
import { ageFrom, formatNrc, formatPhone, regions, toMmDigits, townshipsForRegion } from '../lib/text'
import { emptyFilters, type Member, type MemberFilters } from '../lib/types'
import { MemberDetail } from '../components/MemberDetail'
import { MemberForm } from '../components/MemberForm'
import { Avatar, Badge, Button, Card, Empty, Input, PageHeader, Select, Spinner, cx, useToast } from '../components/ui'

const PAGE = 50

export function MembersPage() {
  const { api, orgs, groups, roles, canEditAny, isAdmin } = useApp()
  const nav = useNavigate()
  const { t, lang } = useI18n()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const [f, setF] = useState<MemberFilters>({ ...emptyFilters, orgId: params.get('org') ?? '', groupId: params.get('group') ?? '' })
  const [qInput, setQInput] = useState('')
  const [rows, setRows] = useState<Member[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [positions, setPositions] = useState<string[]>([])
  const [townships, setTownships] = useState<string[]>([])
  const [selected, setSelected] = useState<Member | null>(null)
  const [photos, setPhotos] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Member | null | 'new'>(null)
  const [exporting, setExporting] = useState(false)

  const visibleOrgIds = useMemo(() => orgs.filter((o) => roles[o.id]).map((o) => o.id), [orgs, roles])
  const scopeOrgIds = useMemo(
    () => (f.groupId ? orgs.filter((o) => o.group_id === f.groupId && roles[o.id]).map((o) => o.id) : visibleOrgIds),
    [f.groupId, orgs, roles, visibleOrgIds],
  )

  // debounce typing
  useEffect(() => {
    const h = setTimeout(() => setF((x) => (x.q === qInput ? x : { ...x, q: qInput })), 250)
    return () => clearTimeout(h)
  }, [qInput])

  // keep ?org= / ?group= in the URL so links from the Organisations page work
  useEffect(() => {
    const next = new URLSearchParams()
    if (f.orgId) next.set('org', f.orgId)
    if (f.groupId) next.set('group', f.groupId)
    setParams(next, { replace: true })
  }, [f.orgId, f.groupId, setParams])

  const load = useCallback(async (offset: number) => {
    setLoading(true)
    try {
      const res = await api.searchMembers(f, scopeOrgIds, offset, PAGE)
      setRows((prev) => (offset === 0 ? res.rows : [...prev, ...res.rows]))
      setCount(res.count)
    } catch (e) {
      toast(`${t('error')}: ${(e as Error).message}`, 'error')
    } finally {
      setLoading(false)
    }
  }, [api, f, scopeOrgIds, toast, t])

  useEffect(() => { load(0) }, [load])

  // Fetch display links for the photos of the members currently shown (cached in the API layer).
  useEffect(() => {
    const paths = rows.map((m) => m.photo_path).filter((p): p is string => !!p && !photos[p])
    if (!paths.length) return
    api.photoUrls(paths).then((u) => setPhotos((prev) => ({ ...prev, ...u }))).catch(() => {})
  }, [api, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  const refreshFacets = useCallback(() => {
    api.positions().then(setPositions).catch(() => {})
    api.townships().then(setTownships).catch(() => {})
  }, [api])
  useEffect(refreshFacets, [refreshFacets])

  const set = (p: Partial<MemberFilters>) => setF((x) => ({ ...x, ...p }))
  const activeFilters = [f.groupId, f.orgId, f.position, f.township, f.status, f.ageMin, f.ageMax].filter(Boolean).length
  const clear = () => { setF(emptyFilters); setQInput('') }

  const orgName = (id: string) => { const o = orgs.find((x) => x.id === id); return o ? pickName(o, lang) : '' }
  const num = (n: number | string) => (lang === 'mm' ? toMmDigits(n) : String(n))
  const townshipLabel = (name: string) => {
    if (lang === 'mm') return name
    for (const r of regions) { const tw = townshipsForRegion(r.mm).find((x) => x[2] === name); if (tw) return tw[3] }
    return name
  }

  const exportCsv = async () => {
    setExporting(true)
    try {
      const all: Member[] = []
      for (let off = 0; ; off += 1000) {
        const res = await api.searchMembers(f, scopeOrgIds, off, 1000)
        all.push(...res.rows)
        if (all.length >= res.count || res.rows.length === 0) break
      }
      const head = ['Name (MM)', 'Name (EN)', 'Organisation', 'Group', 'Position', 'Birth date', 'Age', 'NRC', 'NRC (EN)', 'Phone', 'State/Region', 'Township', 'Street', 'Status', 'Notes']
      const lines = all.map((m) => {
        const o = orgs.find((x) => x.id === m.org_id)
        const g = groups.find((x) => x.id === o?.group_id)
        return [m.name, m.name_en, o?.name ?? '', g?.name ?? '', m.position, m.birth_date ?? '', ageFrom(m.birth_date) ?? '',
          formatNrc(m, 'mm'), formatNrc(m, 'en'), m.phone, m.address_region, m.address_township, m.address_street, m.status, m.notes]
      })
      const csv = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `members-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  const orgsInScope = f.groupId ? orgs.filter((o) => o.group_id === f.groupId && roles[o.id]) : orgs.filter((o) => roles[o.id])
  const groupsVisible = groups.filter((g) => orgs.some((o) => o.group_id === g.id && roles[o.id]))

  if (visibleOrgIds.length === 0) {
    return <>
      <PageHeader title={t('members')} />
      <Card>
        {isAdmin ? (
          <Empty
            icon={<Building2 className="size-7" />}
            title={t('noGroups')}
            hint={t('noGroupsHint')}
            action={<Button variant="primary" onClick={() => nav('/orgs')}><Plus className="size-4" /> {t('addGroup')}</Button>}
          />
        ) : <Empty icon={<Users className="size-7" />} title={t('noAccessHint')} />}
      </Card>
    </>
  }

  return (
    <>
      <PageHeader
        title={t('members')}
        subtitle={loading && rows.length === 0 ? t('loading') : `${num(count)} ${t('results')}`}
        actions={<>
          <Button onClick={exportCsv} loading={exporting} aria-label={t('exportCsv')}><Download className="size-4" /><span className="hidden lg:inline">{t('exportCsv')}</span></Button>
          {canEditAny && <span className="hidden lg:contents"><Button variant="primary" onClick={() => setEditing('new')}><Plus className="size-4" /> {t('addMember')}</Button></span>}
        </>}
      />

      {/* Search + filters */}
      <div className="sticky top-0 z-30 -mx-4 bg-bg/90 px-4 pb-3 pt-1 backdrop-blur lg:static lg:mx-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-fg-faint" />
            <Input
              className="h-12 pl-11 pr-10 rounded-2xl text-[15px]"
              placeholder={t('searchPlaceholder')}
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
            />
            {qInput && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-fg-faint hover:bg-muted" onClick={() => setQInput('')} aria-label="Clear">
                <X className="size-4" />
              </button>
            )}
          </div>
          <Button
            className={cx('h-12 rounded-2xl relative', showFilters && 'border-accent text-accent')}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal className="size-[18px]" />
            <span className="hidden sm:inline">{t('filters')}</span>
            {activeFilters > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-accent text-[11px] font-bold text-accent-fg">{activeFilters}</span>
            )}
          </Button>
        </div>

        {showFilters && (
          <Card className="anim-fade mt-2 p-3">
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Select value={f.groupId} onChange={(e) => set({ groupId: e.target.value, orgId: '' })} aria-label={t('group')}>
                <option value="">{t('group')}: {t('all')}</option>
                {groupsVisible.map((g) => <option key={g.id} value={g.id}>{pickName(g, lang)}</option>)}
              </Select>
              <Select value={f.orgId} onChange={(e) => set({ orgId: e.target.value })} aria-label={t('organisation')}>
                <option value="">{t('organisation')}: {t('all')}</option>
                {orgsInScope.map((o) => <option key={o.id} value={o.id}>{pickName(o, lang)}</option>)}
              </Select>
              <Select value={f.position} onChange={(e) => set({ position: e.target.value })} aria-label={t('position')}>
                <option value="">{t('position')}: {t('all')}</option>
                {positions.map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
              <Select value={f.township} onChange={(e) => set({ township: e.target.value })} aria-label={t('township')}>
                <option value="">{t('township')}: {t('all')}</option>
                {townships.map((p) => <option key={p} value={p}>{townshipLabel(p)}</option>)}
              </Select>
              <Select value={f.status} onChange={(e) => set({ status: e.target.value as MemberFilters['status'] })} aria-label={t('status')}>
                <option value="">{t('status')}: {t('all')}</option>
                <option value="active">{t('active')}</option>
                <option value="inactive">{t('inactive')}</option>
              </Select>
              <div className="col-span-2 flex items-center gap-2 lg:col-span-2">
                <span className="text-[13px] text-fg-soft whitespace-nowrap">{t('age')}</span>
                <Input type="number" min={0} max={120} placeholder="0" value={f.ageMin} onChange={(e) => set({ ageMin: e.target.value })} aria-label="min age" />
                <span className="text-fg-faint">–</span>
                <Input type="number" min={0} max={120} placeholder="120" value={f.ageMax} onChange={(e) => set({ ageMax: e.target.value })} aria-label="max age" />
              </div>
              <Button variant="ghost" className="col-span-2 lg:col-span-1 lg:col-start-4" onClick={clear} disabled={!activeFilters && !qInput}>
                <X className="size-4" /> {t('clearFilters')}
              </Button>
            </div>
          </Card>
        )}

        {!showFilters && activeFilters > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {f.groupId && <Chip onClear={() => set({ groupId: '', orgId: '' })}>{pickName(groups.find((g) => g.id === f.groupId) ?? { name: '', name_en: '' }, lang)}</Chip>}
            {f.orgId && <Chip onClear={() => set({ orgId: '' })}>{orgName(f.orgId)}</Chip>}
            {f.position && <Chip onClear={() => set({ position: '' })}>{f.position}</Chip>}
            {f.township && <Chip onClear={() => set({ township: '' })}>{townshipLabel(f.township)}</Chip>}
            {f.status && <Chip onClear={() => set({ status: '' })}>{t(f.status)}</Chip>}
            {(f.ageMin || f.ageMax) && <Chip onClear={() => set({ ageMin: '', ageMax: '' })}>{t('age')} {num(f.ageMin || '0')}–{num(f.ageMax || '120')}</Chip>}
          </div>
        )}
      </div>

      {/* Results */}
      {rows.length === 0 && !loading ? (
        <Card className="mt-2">
          <Empty icon={<Search className="size-7" />} title={t('noResults')} hint={t('noResultsHint')} />
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <Card className="mt-2 hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-muted/60 text-left text-[12px] font-semibold uppercase tracking-wide text-fg-faint">
                <tr>
                  <th className="whitespace-nowrap px-4 py-3">{t('name')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('position')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('organisation')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('nrcShort')}</th>
                  <th className="whitespace-nowrap px-4 py-3">{t('phone')}</th>
                  <th className="whitespace-nowrap px-4 py-3 text-right">{t('age')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((m) => {
                  const age = ageFrom(m.birth_date)
                  return (
                    <tr key={m.id} onClick={() => setSelected(m)} className="cursor-pointer transition hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={m.name} src={m.photo_path ? photos[m.photo_path] : null} className="size-9 text-sm" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{m.name}</div>
                            {m.name_en && <div className="text-[12px] text-fg-faint truncate">{m.name_en}</div>}
                          </div>
                          {m.status === 'inactive' && <Badge>{t('inactive')}</Badge>}
                        </div>
                      </td>
                      <td className="max-w-40 truncate whitespace-nowrap px-4 py-3 text-fg-soft">{m.position || '—'}</td>
                      <td className="max-w-48 truncate whitespace-nowrap px-4 py-3 text-fg-soft">{orgName(m.org_id)}</td>
                      <td className="px-4 py-3 tabular-nums text-fg-soft whitespace-nowrap">{formatNrc(m, lang, true) || '—'}</td>
                      <td className="px-4 py-3 tabular-nums text-fg-soft whitespace-nowrap">{formatPhone(m.phone, lang === 'mm') || '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-fg-soft">{age !== null ? num(age) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <div className="mt-2 space-y-2 lg:hidden">
            {rows.map((m) => (
              <button key={m.id} onClick={() => setSelected(m)} className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left active:bg-muted">
                <Avatar name={m.name} src={m.photo_path ? photos[m.photo_path] : null} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate">{m.name}</span>
                    {m.status === 'inactive' && <Badge>{t('inactive')}</Badge>}
                  </div>
                  <div className="text-[13px] text-fg-soft truncate">{[m.position, orgName(m.org_id)].filter(Boolean).join(' · ')}</div>
                  {m.phone && <div className="text-[13px] text-fg-faint tabular-nums">{formatPhone(m.phone, lang === 'mm')}</div>}
                </div>
              </button>
            ))}
          </div>

          {(loading || rows.length < count) && (
            <div className="mt-4 flex justify-center">
              {loading ? <Spinner /> : <Button onClick={() => load(rows.length)}>{t('loadMore')}</Button>}
            </div>
          )}
        </>
      )}

      {canEditAny && (
        <button
          onClick={() => setEditing('new')}
          aria-label={t('addMember')}
          className="fixed bottom-20 right-4 z-30 grid size-14 place-items-center rounded-2xl bg-accent text-accent-fg shadow-lg shadow-accent/30 active:scale-95 lg:hidden"
        >
          <Plus className="size-6" />
        </button>
      )}

      <MemberDetail
        member={selected}
        onClose={() => setSelected(null)}
        onEdit={(m) => { setSelected(null); setEditing(m) }}
        onDeleted={() => { setSelected(null); load(0); refreshFacets() }}
      />
      <MemberForm
        open={editing !== null}
        member={editing === 'new' ? null : editing}
        defaultOrgId={f.orgId}
        onClose={() => setEditing(null)}
        onSaved={(m) => { setEditing(null); load(0); refreshFacets(); setSelected(m) }}
      />
    </>
  )
}

function Chip({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1.5 text-[13px] font-medium text-accent">
      <span className="truncate">{children}</span>
      <button onClick={onClear} className="rounded-full p-0.5 hover:bg-accent/15" aria-label="Remove filter"><X className="size-3.5" /></button>
    </span>
  )
}

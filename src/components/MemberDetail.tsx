import { useEffect, useState, type ReactNode } from 'react'
import { Building2, Cake, Eye, EyeOff, IdCard, MapPin, Pencil, Phone, StickyNote, Trash2 } from 'lucide-react'
import { useApp } from '../lib/store'
import { pickName, useI18n } from '../lib/i18n'
import { ageFrom, formatNrc, formatPhone, hasNrc, regions, toMmDigits, townshipsForRegion } from '../lib/text'
import type { Member } from '../lib/types'
import { Avatar, Badge, Button, Sheet, useConfirm, useToast } from './ui'

export function MemberDetail({ member, onClose, onEdit, onDeleted }: {
  member: Member | null; onClose: () => void; onEdit: (m: Member) => void; onDeleted: () => void
}) {
  const { api, orgs, groups, roles, isAdmin } = useApp()
  const { t, lang } = useI18n()
  const confirm = useConfirm()
  const toast = useToast()
  const [showNrc, setShowNrc] = useState(false)
  useEffect(() => setShowNrc(false), [member?.id])
  if (!member) return null

  const org = orgs.find((o) => o.id === member.org_id)
  const group = groups.find((g) => g.id === org?.group_id)
  const role = roles[member.org_id]
  const canEdit = role === 'admin' || role === 'editor'
  const age = ageFrom(member.birth_date)
  const num = (n: string | number) => (lang === 'mm' ? toMmDigits(n) : String(n))

  const revealNrc = () => {
    if (!showNrc) api.logNrcView(member.id).catch(() => {})
    setShowNrc((v) => !v)
  }

  const del = async () => {
    if (!(await confirm({ message: t('deleteMemberQ'), confirmLabel: t('delete'), danger: true }))) return
    try {
      await api.softDeleteMember(member.id)
      toast(t('saved'))
      onDeleted()
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const region = regions.find((r) => r.mm === member.address_region)
  const tw = townshipsForRegion(member.address_region).find((x) => x[2] === member.address_township)
  const address = lang === 'mm'
    ? [member.address_street, member.address_township, member.address_region].filter(Boolean).join('၊ ')
    : [member.address_street, tw?.[3] ?? member.address_township, region?.en ?? member.address_region].filter(Boolean).join(', ')

  return (
    <Sheet
      open
      onClose={onClose}
      title={pickName(member, lang)}
      footer={canEdit ? <>
        {isAdmin && <Button variant="danger" onClick={del}><Trash2 className="size-4" /> {t('delete')}</Button>}
        <Button variant="primary" className="flex-1 sm:flex-none sm:ml-auto" onClick={() => onEdit(member)}>
          <Pencil className="size-4" /> {t('edit')}
        </Button>
      </> : undefined}
    >
      <div className="flex items-center gap-4">
        <Avatar name={member.name} className="size-16 text-2xl" />
        <div className="min-w-0">
          <div className="text-lg font-bold leading-snug">{member.name}</div>
          {member.name_en && <div className="text-sm text-fg-soft">{member.name_en}</div>}
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {member.position && <Badge tone="accent">{member.position}</Badge>}
            <Badge tone={member.status === 'active' ? 'ok' : 'neutral'}>{t(member.status)}</Badge>
            {!canEdit && <Badge>{t('viewOnly')}</Badge>}
          </div>
        </div>
      </div>

      <dl className="mt-6 divide-y divide-border rounded-2xl border border-border">
        <Row icon={<Building2 />} label={t('organisation')}>
          {org ? pickName(org, lang) : '—'}
          {group && <span className="block text-[13px] text-fg-faint">{pickName(group, lang)}</span>}
        </Row>
        <Row icon={<IdCard />} label={t('nrc')}>
          {hasNrc(member) ? (
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium tabular-nums">{formatNrc(member, lang, !showNrc)}</span>
              <Button size="sm" variant="ghost" onClick={revealNrc}>
                {showNrc ? <EyeOff className="size-4" /> : <Eye className="size-4" />} {showNrc ? t('hideNrc') : t('showNrc')}
              </Button>
            </div>
          ) : '—'}
        </Row>
        <Row icon={<Cake />} label={t('birthDate')}>
          {member.birth_date ? <>
            {num(member.birth_date.split('-').reverse().join('-'))}
            {age !== null && <span className="text-fg-faint"> · {t('age')} {num(age)}</span>}
          </> : '—'}
        </Row>
        <Row icon={<Phone />} label={t('phone')}>
          {member.phone ? (
            <a href={`tel:${member.phone}`} className="font-medium text-accent hover:underline">{formatPhone(member.phone, lang === 'mm')}</a>
          ) : '—'}
        </Row>
        <Row icon={<MapPin />} label={t('address')}>{address || '—'}</Row>
        {member.notes && <Row icon={<StickyNote />} label={t('notes')}><span className="whitespace-pre-wrap">{member.notes}</span></Row>}
      </dl>

      <p className="mt-4 text-[12px] text-fg-faint">
        {t('lastUpdated')}: {new Date(member.updated_at).toLocaleString(lang === 'mm' ? 'my-MM' : 'en-GB')}
      </p>
    </Sheet>
  )
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="mt-0.5 text-fg-faint [&>svg]:size-[18px]">{icon}</div>
      <div className="min-w-0 flex-1">
        <dt className="text-[12px] text-fg-faint">{label}</dt>
        <dd className="text-[15px]">{children}</dd>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useApp } from '../lib/store'
import { pickName, useI18n } from '../lib/i18n'
import { cleanText, isZawgyi, normalizePhone, toMmDigits } from '../lib/text'
import type { Member, MemberInput } from '../lib/types'
import { AddressInput, NrcInput } from './NrcInput'
import { ImagePicker } from './ImagePicker'
import { Button, Field, Input, Segmented, Select, Sheet, Textarea, useToast } from './ui'

const blank = (orgId: string): MemberInput => ({
  org_id: orgId, name: '', name_en: '', position: '', birth_date: null,
  nrc_state: null, nrc_township: '', nrc_type: 'နိုင်', nrc_number: '',
  address_region: '', address_township: '', address_street: '', phone: '',
  status: 'active', notes: '',
})

export function MemberForm({ open, member, defaultOrgId, onClose, onSaved }: {
  open: boolean; member: Member | null; defaultOrgId?: string; onClose: () => void; onSaved: (m: Member) => void
}) {
  const { api, orgs, groups, roles } = useApp()
  const { t, lang } = useI18n()
  const toast = useToast()
  const editableOrgs = useMemo(() => orgs.filter((o) => roles[o.id] === 'admin' || roles[o.id] === 'editor'), [orgs, roles])
  const [f, setF] = useState<MemberInput>(blank(''))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [dups, setDups] = useState({ nrc: false, phone: false })
  const [positions, setPositions] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [photo, setPhoto] = useState<Blob | null | undefined>(undefined)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const org = defaultOrgId && editableOrgs.some((o) => o.id === defaultOrgId) ? defaultOrgId : editableOrgs[0]?.id ?? ''
    if (member) {
      const { deleted_at: _d, created_at: _c, updated_at: _u, photo_path: _p, ...rest } = member
      setF(rest)
    } else setF(blank(org))
    setErrors({}); setDups({ nrc: false, phone: false })
    setPhoto(undefined); setPhotoUrl(null)
    if (member?.photo_path) {
      const path = member.photo_path
      api.photoUrls([path]).then((u) => setPhotoUrl(u[path] ?? null)).catch(() => {})
    }
    api.positions().then(setPositions).catch(() => {})
  }, [open, member, defaultOrgId, editableOrgs, api])

  // Debounced duplicate check on NRC / phone
  useEffect(() => {
    if (!open) return
    const nrcFull = f.nrc_state && f.nrc_township && f.nrc_type && f.nrc_number.length === 6
    const phone = normalizePhone(f.phone)
    if (!nrcFull && phone.length < 7) { setDups({ nrc: false, phone: false }); return }
    const h = setTimeout(() => {
      api.findDuplicates({ ...f, nrc_number: nrcFull ? f.nrc_number : '', phone: phone.length >= 7 ? phone : '' }, member?.id)
        .then(setDups).catch(() => {})
    }, 400)
    return () => clearTimeout(h)
  }, [open, api, member?.id, f.nrc_state, f.nrc_township, f.nrc_type, f.nrc_number, f.phone]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (p: Partial<MemberInput>) => setF((x) => ({ ...x, ...p }))

  /** On leaving a text box: convert Zawgyi to Unicode and tell the user once. */
  const fixZawgyi = (key: 'name' | 'position' | 'address_street' | 'notes') => () => {
    const v = f[key]
    if (isZawgyi(v)) { set({ [key]: cleanText(v) }); toast(t('zawgyiFixed')) }
  }

  const submit = async () => {
    const e: Record<string, string> = {}
    if (!f.org_id) e.org_id = t('required')
    if (!f.name.trim()) e.name = t('required')
    const partialNrc = [f.nrc_state, f.nrc_township, f.nrc_number].some(Boolean)
    if (partialNrc && !(f.nrc_state && f.nrc_township && f.nrc_type && f.nrc_number.length === 6)) {
      e.nrc = lang === 'mm' ? 'မှတ်ပုံတင် အပြည့်အစုံ ဖြည့်ပါ (နံပါတ် ၆ လုံး)' : 'Complete the NRC (6-digit number)'
    }
    setErrors(e)
    if (Object.keys(e).length) return
    setSaving(true)
    try {
      const saved = await api.saveMember({
        ...f,
        name: cleanText(f.name), name_en: f.name_en.trim(), position: cleanText(f.position),
        address_street: cleanText(f.address_street), notes: toMmSafe(f.notes),
        phone: normalizePhone(f.phone),
        nrc_type: partialNrc ? f.nrc_type : '',
      })
      toast(t('saved'))
      let result = saved
      if (photo !== undefined) {
        try {
          result = { ...saved, photo_path: await api.setMemberPhoto(saved.id, photo) }
        } catch (err) {
          toast(`${t('photo')}: ${(err as Error).message}`, 'error')
        }
      }
      onSaved(result)
    } catch (err) {
      toast(`${t('error')}: ${(err as Error).message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      wide
      title={member ? t('editMember') : t('addMember')}
      footer={<>
        <Button className="flex-1 sm:flex-none" onClick={onClose}>{t('cancel')}</Button>
        <Button className="flex-1 sm:flex-none sm:ml-auto" variant="primary" loading={saving} onClick={submit}>{t('save')}</Button>
      </>}
    >
      <div className="space-y-4">
        <ImagePicker kind="photo" name={f.name} currentUrl={photoUrl} value={photo} onChange={setPhoto} />

        <Field label={t('organisation')} error={errors.org_id}>
          <Select value={f.org_id} onChange={(e) => set({ org_id: e.target.value })}>
            {groups.map((g) => {
              const list = editableOrgs.filter((o) => o.group_id === g.id)
              return list.length ? (
                <optgroup key={g.id} label={pickName(g, lang)}>
                  {list.map((o) => <option key={o.id} value={o.id}>{pickName(o, lang)}</option>)}
                </optgroup>
              ) : null
            })}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('nameMm')} error={errors.name}>
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} onBlur={fixZawgyi('name')} autoFocus={!member} />
          </Field>
          <Field label={<>{t('nameEn')} <span className="text-fg-faint font-normal">· {t('optional')}</span></>}>
            <Input value={f.name_en} onChange={(e) => set({ name_en: e.target.value })} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('position')}>
            <Input list="positions" value={f.position} onChange={(e) => set({ position: e.target.value })} onBlur={fixZawgyi('position')} />
            <datalist id="positions">{positions.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label={t('birthDate')}>
            <Input type="date" max={new Date().toISOString().slice(0, 10)} value={f.birth_date ?? ''} onChange={(e) => set({ birth_date: e.target.value || null })} />
          </Field>
        </div>

        <div>
          <NrcInput value={f} onChange={(v) => set(v)} error={errors.nrc} />
          {dups.nrc && <DupWarning text={t('dupNrc')} />}
        </div>

        <Field label={t('phone')}>
          <Input
            type="tel"
            inputMode="tel"
            placeholder={lang === 'mm' ? toMmDigits('09 xxx xxx xxx') : '09 xxx xxx xxx'}
            value={f.phone}
            onChange={(e) => set({ phone: e.target.value })}
            onBlur={() => set({ phone: normalizePhone(f.phone) })}
          />
        </Field>
        {dups.phone && <DupWarning text={t('dupPhone')} />}

        <div>
          <span className="mb-1.5 block text-[13px] font-medium text-fg-soft">{t('address')}</span>
          <AddressInput value={f} onChange={(v) => set(v)} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] font-medium text-fg-soft">{t('status')}</span>
          <Segmented
            value={f.status}
            onChange={(v) => set({ status: v })}
            options={[{ value: 'active', label: t('active') }, { value: 'inactive', label: t('inactive') }]}
          />
        </div>

        <Field label={t('notes')}>
          <Textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} onBlur={fixZawgyi('notes')} />
        </Field>
      </div>
    </Sheet>
  )
}

const toMmSafe = (s: string) => (isZawgyi(s) ? cleanText(s) : s.trim())

function DupWarning({ text }: { text: string }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn">
      <AlertTriangle className="size-4 shrink-0" /> {text}
    </div>
  )
}

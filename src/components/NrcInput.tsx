import { useState } from 'react'
import { ClipboardPaste } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { formatNrc, hasNrc, nrcStates, nrcTypes, parseNrc, regions, toAsciiDigits, toMmDigits, townshipsForRegion, townshipsForState, type NrcParts } from '../lib/text'
import { Field, Input, Select } from './ui'

export function NrcInput({ value, onChange, error }: { value: NrcParts; onChange: (v: NrcParts) => void; error?: string }) {
  const { t, lang } = useI18n()
  const [paste, setPaste] = useState('')
  const [pasteBad, setPasteBad] = useState(false)
  const set = (p: Partial<NrcParts>) => onChange({ ...value, ...p })
  const towns = townshipsForState(value.nrc_state)

  const tryPaste = (text: string) => {
    setPaste(text)
    if (!text.trim()) { setPasteBad(false); return }
    const p = parseNrc(text)
    setPasteBad(!p)
    if (p) { onChange(p); setPaste('') }
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/40 p-3.5">
      <div className="mb-2.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[13px] font-medium text-fg-soft">{hasNrc(value) ? t('nrcShort') : t('nrc')}</span>
        {hasNrc(value) && <span className="shrink-0 whitespace-nowrap text-[13px] font-semibold text-accent">{formatNrc(value, lang)}</span>}
      </div>
      <div className="grid grid-cols-[7.5rem_1fr] gap-2">
        <Select
          aria-label={t('nrcState')}
          value={value.nrc_state ?? ''}
          onChange={(e) => set({ nrc_state: e.target.value ? Number(e.target.value) : null, nrc_township: '' })}
        >
          <option value="">{lang === 'mm' ? '—' : '—'}</option>
          {nrcStates.map((s) => (
            <option key={s.n} value={s.n}>{lang === 'mm' ? `${toMmDigits(s.n)} ${s.mm}` : `${s.n} ${s.en}`}</option>
          ))}
        </Select>
        <Select
          aria-label={t('nrcTownship')}
          value={value.nrc_township}
          disabled={!value.nrc_state}
          onChange={(e) => set({ nrc_township: e.target.value })}
        >
          <option value="">{t('nrcTownship')}</option>
          {towns.map((tw) => (
            <option key={tw[0]} value={tw[0]}>{lang === 'mm' ? `${tw[0]} — ${tw[2]}` : `${tw[1]} — ${tw[3]}`}</option>
          ))}
        </Select>
        <Select aria-label={t('nrcType')} value={value.nrc_type} onChange={(e) => set({ nrc_type: e.target.value })}>
          <option value="">{t('nrcType')}</option>
          {nrcTypes.map((ty) => (
            <option key={ty.mm} value={ty.mm}>{lang === 'mm' ? `(${ty.mm})` : `(${ty.en})`}</option>
          ))}
        </Select>
        <Input
          aria-label={t('nrcNumber')}
          inputMode="numeric"
          placeholder={t('nrcNumber')}
          value={lang === 'mm' ? toMmDigits(value.nrc_number) : value.nrc_number}
          onChange={(e) => set({ nrc_number: toAsciiDigits(e.target.value).replace(/\D/g, '').slice(0, 6) })}
        />
      </div>
      <div className="relative mt-2">
        <ClipboardPaste className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-faint" />
        <Input
          className="pl-9 h-10 text-sm"
          placeholder={`${t('nrcPaste')} — 12/OUKAMA(N)123456`}
          value={paste}
          onChange={(e) => tryPaste(e.target.value)}
        />
      </div>
      {(error || (pasteBad && paste)) && (
        <p className="mt-1.5 text-[12px] text-danger">{error ?? (lang === 'mm' ? 'ပုံစံမမှန်ပါ' : 'Format not recognised')}</p>
      )}
    </div>
  )
}

export interface AddressParts { address_region: string; address_township: string; address_street: string }

export function AddressInput({ value, onChange }: { value: AddressParts; onChange: (v: AddressParts) => void }) {
  const { t, lang } = useI18n()
  const set = (p: Partial<AddressParts>) => onChange({ ...value, ...p })
  const towns = townshipsForRegion(value.address_region)
  const known = towns.some((tw) => tw[2] === value.address_township)
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Select aria-label={t('region')} value={value.address_region} onChange={(e) => set({ address_region: e.target.value, address_township: '' })}>
          <option value="">{t('region')}</option>
          {regions.map((r) => <option key={r.mm} value={r.mm}>{lang === 'mm' ? r.mm : r.en}</option>)}
        </Select>
        <Select aria-label={t('township')} value={value.address_township} disabled={!value.address_region} onChange={(e) => set({ address_township: e.target.value })}>
          <option value="">{t('township')}</option>
          {!known && value.address_township && <option value={value.address_township}>{value.address_township}</option>}
          {[...new Map(towns.map((tw) => [tw[2], tw])).values()].map((tw) => (
            <option key={tw[2]} value={tw[2]}>{lang === 'mm' ? tw[2] : tw[3]}</option>
          ))}
        </Select>
      </div>
      <Field label={t('street')}>
        <Input value={value.address_street} onChange={(e) => set({ address_street: e.target.value })} />
      </Field>
    </div>
  )
}

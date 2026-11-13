import Rabbit from 'rabbit-node'
import nrcData from '../data/nrc.json'

/* ------------------------------------------------------------------ */
/*  Zawgyi → Unicode                                                   */
/* ------------------------------------------------------------------ */

// Code points / sequences that only appear in Zawgyi-encoded text.
const ZAWGYI_HINTS = [
  /[ၠ-႗]/,               // Zawgyi-only stacked/ligature glyphs
  /[ဳဴ]/,                // reused code points in Zawgyi
  /(^|[\s၊။(\-,.])ေ/, // "ေ" typed before the consonant
  /ေ[ျၾ-ႄ]/,   // "ေ" before a medial
  /(^|[\s၊။(\-,.])[ျၾ-ႄ]/, // "ျ" typed before the consonant
  /္[^က-အ]/,        // virama used as asat
  /့ံ/,
  /်[ိီဲ]/,
]

export function isZawgyi(text: string): boolean {
  if (!/[က-႟]/.test(text)) return false
  return ZAWGYI_HINTS.some((r) => r.test(text))
}

/** Converts Zawgyi text to Unicode; leaves Unicode text untouched. */
export function toUnicode(text: string): string {
  return isZawgyi(text) ? Rabbit.zg2uni(text) : text
}

/* ------------------------------------------------------------------ */
/*  Digits                                                             */
/* ------------------------------------------------------------------ */

const MM_DIGITS = '၀၁၂၃၄၅၆၇၈၉'

export function toAsciiDigits(text: string): string {
  return text.replace(/[၀-၉]/g, (d) => String(MM_DIGITS.indexOf(d)))
}

export function toMmDigits(text: string | number): string {
  return String(text).replace(/[0-9]/g, (d) => MM_DIGITS[Number(d)])
}

/** Cleans any user text before saving: Zawgyi fix + trims. */
export function cleanText(text: string): string {
  return toUnicode(text).replace(/\s+/g, ' ').trim()
}

/* ------------------------------------------------------------------ */
/*  Phone                                                              */
/* ------------------------------------------------------------------ */

/** 09-xxx, +959xxx, 959xxx, ၀၉xxx → "09xxxxxxxxx" (digits only). */
export function normalizePhone(raw: string): string {
  let p = toAsciiDigits(raw).replace(/[^\d+]/g, '')
  if (p.startsWith('+95')) p = '0' + p.slice(3)
  else if (p.startsWith('95') && p.length >= 10) p = '0' + p.slice(2)
  return p.replace(/\+/g, '')
}

export function formatPhone(p: string, mm = false): string {
  if (!p) return ''
  const pretty = p.startsWith('09') && p.length > 6 ? `${p.slice(0, 2)} ${p.slice(2, 5)} ${p.slice(5)}` : p
  return mm ? toMmDigits(pretty) : pretty
}

/* ------------------------------------------------------------------ */
/*  NRC                                                                */
/* ------------------------------------------------------------------ */

export interface NrcState { n: number; mm: string; en: string }
export type NrcTownship = [code_mm: string, code_en: string, name_mm: string, name_en: string]

export const nrcStates: NrcState[] = (nrcData.states as NrcState[]).filter((s) => s.n >= 1)
export const regions: NrcState[] = nrcData.states as NrcState[]
export const nrcTypes: { mm: string; en: string }[] = nrcData.types
export const nrcTownships = nrcData.townships as unknown as Record<string, NrcTownship[]>

export function townshipsForState(n: number | null): NrcTownship[] {
  return n ? nrcTownships[String(n)] ?? [] : []
}

/** Region (state) name → its township list, for the address picker. */
export function townshipsForRegion(regionMm: string): NrcTownship[] {
  const r = regions.find((x) => x.mm === regionMm)
  return r ? nrcTownships[String(r.n)] ?? [] : []
}

export interface NrcParts {
  nrc_state: number | null
  nrc_township: string
  nrc_type: string
  nrc_number: string
}

export function hasNrc(m: NrcParts): boolean {
  return !!(m.nrc_state && m.nrc_township && m.nrc_type && m.nrc_number)
}

export function formatNrc(m: NrcParts, lang: 'mm' | 'en', masked = false): string {
  if (!hasNrc(m)) return ''
  const num = masked ? '•••' + m.nrc_number.slice(-3) : m.nrc_number
  if (lang === 'mm') {
    return `${toMmDigits(m.nrc_state!)}/${m.nrc_township}(${m.nrc_type})${masked ? '•••' + toMmDigits(m.nrc_number.slice(-3)) : toMmDigits(num)}`
  }
  const tw = townshipsForState(m.nrc_state).find((t) => t[0] === m.nrc_township)
  const ty = nrcTypes.find((t) => t.mm === m.nrc_type)
  return `${m.nrc_state}/${tw?.[1] ?? m.nrc_township}(${ty?.en ?? m.nrc_type})${num}`
}

/** Canonical form stored in the database search text: "12/ဥကမ(နိုင်)123456". */
export function canonicalNrc(m: NrcParts): string {
  return `${m.nrc_state ?? ''}/${m.nrc_township}(${m.nrc_type})${m.nrc_number}`
}

/** Parses an NRC typed in Burmese or English (any digits) into parts. */
export function parseNrc(input: string): NrcParts | null {
  const s = toAsciiDigits(toUnicode(input)).replace(/\s+/g, '')
  const m = s.match(/^(\d{1,2})\/([^()]+)\(([^()]+)\)(\d{1,6})$/)
  if (!m) return null
  const state = Number(m[1])
  const list = townshipsForState(state)
  const twIn = m[2].toUpperCase()
  const tw = list.find((t) => t[0] === m[2] || t[1] === twIn)
  const tyIn = m[3].toUpperCase()
  const ty = nrcTypes.find((t) => t.mm === m[3] || t.en === tyIn)
  if (!tw || !ty) return null
  return { nrc_state: state, nrc_township: tw[0], nrc_type: ty.mm, nrc_number: m[4] }
}

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

/** Turns what the user typed into lowercase search tokens that match the DB search_text. */
export function searchTokens(q: string): string[] {
  const text = toAsciiDigits(toUnicode(q)).trim()
  if (!text) return []
  const nrc = parseNrc(text)
  if (nrc) return [canonicalNrc(nrc).toLowerCase()]
  // A query made only of digits, spaces, dashes and "+" is one phone number: "+959 450 123" → "09450123"
  if (/^\+?[\d\s-]{4,}$/.test(text) && /\d{2}/.test(text)) {
    const digits = text.replace(/[\s-]/g, '')
    return [/^\+?95/.test(digits) || digits.startsWith('09') ? normalizePhone(digits) : digits]
  }
  return text
    .split(/\s+/)
    .map((tok) => (/^\+?[\d-]{6,}$/.test(tok) ? normalizePhone(tok) : tok.toLowerCase()))
    .filter(Boolean)
}

/** Same expression as the generated search_text column (used by demo mode). */
export function memberSearchText(m: {
  name: string; name_en: string; position: string; phone: string; notes: string
  address_region: string; address_township: string; address_street: string
} & NrcParts): string {
  return [
    m.name, m.name_en, m.position, m.phone, canonicalNrc(m), m.nrc_number,
    m.address_region, m.address_township, m.address_street, m.notes,
  ].join(' ').toLowerCase()
}

/* ------------------------------------------------------------------ */
/*  Dates                                                              */
/* ------------------------------------------------------------------ */

export function ageFrom(birth: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth + 'T00:00:00')
  const now = new Date()
  let a = now.getFullYear() - b.getFullYear()
  const m = now.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--
  return a
}

/** Birth-date window for an age range (inclusive). */
export function birthRange(ageMin: string, ageMax: string): { from?: string; to?: string } {
  const today = new Date()
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  const out: { from?: string; to?: string } = {}
  if (ageMin) {
    const d = new Date(today); d.setFullYear(d.getFullYear() - Number(ageMin)); out.to = iso(d)
  }
  if (ageMax) {
    const d = new Date(today); d.setFullYear(d.getFullYear() - Number(ageMax) - 1); d.setDate(d.getDate() + 1); out.from = iso(d)
  }
  return out
}

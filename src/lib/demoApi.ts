import type { Api } from './api'
import type { Access, ActivityEntry, Group, Member, Org, Profile } from './types'
import { birthRange, memberSearchText, searchTokens } from './text'
import { blobToDataUrl } from './image'

/**
 * Demo backend: same behaviour as Supabase, but everything lives in this browser's
 * localStorage. Used when no Supabase keys are configured, so the app can be tried at once.
 */

interface Db {
  me: string | null
  profiles: Profile[]
  groups: Group[]
  orgs: Org[]
  access: Access[]
  members: Member[]
  log: ActivityEntry[]
}

const KEY = 'member-registry-demo'
/** Demo pictures live in their own key (path → data URL) so the main record stays small. */
const IMG_KEY = 'member-registry-demo-images'
const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()

function seed(): Db {
  const adminId = id()
  const g1 = { id: id(), name: 'ရန်ကုန်တိုင်း', name_en: 'Yangon Region' }
  const g2 = { id: id(), name: 'မန္တလေးတိုင်း', name_en: 'Mandalay Region' }
  const o1 = { id: id(), group_id: g1.id, name: 'လူငယ်အဖွဲ့', name_en: 'Youth Association' }
  const o2 = { id: id(), group_id: g1.id, name: 'စာကြည့်တိုက်အသင်း', name_en: 'Library Club' }
  const o3 = { id: id(), group_id: g2.id, name: 'ကျန်းမာရေးအသင်း', name_en: 'Health Volunteers' }
  const m = (org: string, name: string, name_en: string, position: string, birth: string, st: number, tw: string,
    num: string, region: string, township: string, street: string, phone: string, status: 'active' | 'inactive' = 'active'): Member => ({
    id: id(), org_id: org, name, name_en, position, birth_date: birth, nrc_state: st, nrc_township: tw, nrc_type: 'နိုင်',
    nrc_number: num, address_region: region, address_township: township, address_street: street, phone, status,
    notes: '', deleted_at: null, created_at: now(), updated_at: now(),
  })
  const members = [
    m(o1.id, 'အောင်ကိုကို', 'Aung Ko Ko', 'ဥက္ကဋ္ဌ', '1994-03-12', 12, 'ဗဟန', '123456', 'ရန်ကုန်', 'ဗဟန်း', 'အမှတ် ၁၂၊ ရွှေဂုံတိုင်လမ်း', '09450123456'),
    m(o1.id, 'နန္ဒာဝင်း', 'Nandar Win', 'အတွင်းရေးမှူး', '1998-07-21', 12, 'ကမရ', '234567', 'ရန်ကုန်', 'ကမာရွတ်', 'လှည်းတန်း', '09791234567'),
    m(o1.id, 'ဇော်မင်းထွန်း', 'Zaw Min Htun', 'အဖွဲ့ဝင်', '2001-11-02', 12, 'လမန', '345678', 'ရန်ကုန်', 'လှိုင်', 'အမှတ် ၅၊ ကမ္ဘာအေးလမ်း', '09253334444'),
    m(o2.id, 'သီတာအောင်', 'Thida Aung', 'ဘဏ္ဍာရေးမှူး', '1989-01-30', 12, 'ဒဂမ', '456789', 'ရန်ကုန်', 'ဒဂုံမြို့သစ် (မြောက်)', '၁၂ ရပ်ကွက်', '09420011223'),
    m(o2.id, 'ကျော်စွာ', 'Kyaw Swar', 'အဖွဲ့ဝင်', '1976-05-14', 12, 'ဗဟန', '567890', 'ရန်ကုန်', 'ဗဟန်း', '', '09965554433', 'inactive'),
    m(o3.id, 'မြတ်နိုးသွင်', 'Myat Noe Thwin', 'ဥက္ကဋ္ဌ', '1992-09-09', 9, 'မဟမ', '678901', 'မန္တလေး', 'မဟာအောင်မြေ', '၇၈ လမ်း', '09778889900'),
    m(o3.id, 'ဟိန်းထက်', 'Hein Htet', 'စေတနာ့ဝန်ထမ်း', '2000-12-25', 9, 'ခအဇ', '789012', 'မန္တလေး', 'ချမ်းအေးသာဇံ', '', '09400567890'),
  ]
  const editorId = id()
  const pendingId = id()
  return {
    me: null,
    profiles: [
      { id: adminId, email: 'admin@demo.app', full_name: 'Demo Admin', is_admin: true, status: 'active', created_at: now() },
      { id: editorId, email: 'editor@demo.app', full_name: 'Su Su', is_admin: false, status: 'active', created_at: now() },
      { id: pendingId, email: 'new.person@demo.app', full_name: 'Ko Thura', is_admin: false, status: 'pending', created_at: now() },
    ],
    groups: [g1, g2],
    orgs: [o1, o2, o3],
    access: [{ id: id(), user_id: editorId, group_id: g1.id, org_id: null, role: 'editor' }],
    members,
    log: [],
  }
}

function load(): Db {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as Db
  } catch { /* storage blocked or corrupt */ }
  return seed()
}

export function createDemoApi(): Api {
  let db = load()
  const listeners = new Set<() => void>()
  const persist = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* ignore */ }
  }
  const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 60))
  const me = () => db.profiles.find((p) => p.id === db.me) ?? null
  const log = (action: ActivityEntry['action'], mem: Member) => {
    db.log.unshift({
      id: Date.now() + Math.random(), user_email: me()?.email ?? '', action,
      member_id: mem.id, member_name: mem.name, org_id: mem.org_id, created_at: now(),
    })
    db.log = db.log.slice(0, 500)
  }
  const live = () => db.members.filter((m) => !m.deleted_at)

  let images: Record<string, string> = {}
  try { images = JSON.parse(localStorage.getItem(IMG_KEY) ?? '{}') } catch { /* ignore */ }
  const saveImages = () => {
    try { localStorage.setItem(IMG_KEY, JSON.stringify(images)) } catch {
      throw new Error('Demo storage is full — remove some pictures or reset the demo')
    }
  }
  const putImage = async (path: string | null, blob: Blob | null, old?: string | null) => {
    if (old) delete images[old]
    if (path && blob) images[path] = await blobToDataUrl(blob)
    saveImages()
  }

  return {
    mode: 'demo',

    async currentProfile() { return delay(me()) },
    onAuthChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    async signIn() {
      db.me = db.profiles.find((p) => p.is_admin)!.id
      persist(); listeners.forEach((l) => l())
    },
    async signUp() { await this.signIn('', ''); return true },
    async signOut() { db.me = null; persist(); listeners.forEach((l) => l()) },

    async listGroups() { return delay([...db.groups].sort((a, b) => a.name.localeCompare(b.name))) },
    async listOrgs() { return delay([...db.orgs].sort((a, b) => a.name.localeCompare(b.name))) },
    async myAccess() { return delay(db.access.filter((a) => a.user_id === db.me)) },
    async saveGroup(g) {
      const gid = g.id ?? id()
      if (g.id) db.groups = db.groups.map((x) => (x.id === g.id ? { ...x, name: g.name, name_en: g.name_en ?? '' } : x))
      else db.groups.push({ id: gid, name: g.name, name_en: g.name_en ?? '' })
      persist()
      return gid
    },
    async deleteGroup(gid) {
      if (db.orgs.some((o) => o.group_id === gid)) throw new Error('restrict')
      db.groups = db.groups.filter((g) => g.id !== gid)
      db.access = db.access.filter((a) => a.group_id !== gid)
      persist()
    },
    async saveOrg(o) {
      const oid = o.id ?? id()
      if (o.id) db.orgs = db.orgs.map((x) => (x.id === o.id ? { ...x, name: o.name, name_en: o.name_en ?? '', group_id: o.group_id } : x))
      else db.orgs.push({ id: oid, group_id: o.group_id, name: o.name, name_en: o.name_en ?? '' })
      persist()
      return oid
    },
    async deleteOrg(oid) {
      if (db.members.some((m) => m.org_id === oid)) throw new Error('restrict')
      db.orgs = db.orgs.filter((o) => o.id !== oid)
      db.access = db.access.filter((a) => a.org_id !== oid)
      persist()
    },
    async memberCounts() {
      const c: Record<string, number> = {}
      for (const m of live()) c[m.org_id] = (c[m.org_id] ?? 0) + 1
      return delay(c)
    },

    async searchMembers(f, orgIds, offset, limit) {
      const toks = searchTokens(f.q)
      const br = birthRange(f.ageMin, f.ageMax)
      const rows = live()
        .filter((m) => (f.orgId ? m.org_id === f.orgId : orgIds.includes(m.org_id)))
        .filter((m) => { const s = memberSearchText(m); return toks.every((t) => s.includes(t)) })
        .filter((m) => !f.position || m.position === f.position)
        .filter((m) => !f.township || m.address_township === f.township)
        .filter((m) => !f.status || m.status === f.status)
        .filter((m) => (!br.from || (m.birth_date ?? '') >= br.from) && (!br.to || (!!m.birth_date && m.birth_date <= br.to)))
        .sort((a, b) => a.name.localeCompare(b.name))
      return delay({ rows: rows.slice(offset, offset + limit), count: rows.length })
    },
    async saveMember(input) {
      let saved: Member
      if (input.id) {
        const old = db.members.find((m) => m.id === input.id)!
        saved = { ...old, ...input, id: old.id, updated_at: now() }
        db.members = db.members.map((m) => (m.id === saved.id ? saved : m))
        log('updated', saved)
      } else {
        saved = { ...input, id: id(), deleted_at: null, created_at: now(), updated_at: now() }
        db.members.push(saved)
        log('created', saved)
      }
      persist()
      return delay(saved)
    },
    async softDeleteMember(mid) {
      db.members = db.members.map((m) => (m.id === mid ? { ...m, deleted_at: now() } : m))
      log('deleted', db.members.find((m) => m.id === mid)!)
      persist()
    },
    async restoreMember(mid) {
      db.members = db.members.map((m) => (m.id === mid ? { ...m, deleted_at: null } : m))
      log('restored', db.members.find((m) => m.id === mid)!)
      persist()
    },
    async purgeMember(mid) {
      const m = db.members.find((x) => x.id === mid)
      if (m) log('purged', m)
      if (m?.photo_path) { delete images[m.photo_path]; saveImages() }
      db.members = db.members.filter((x) => x.id !== mid)
      persist()
    },
    async purgeOld() {
      const cutoff = Date.now() - 30 * 864e5
      const old = db.members.filter((m) => m.deleted_at && Date.parse(m.deleted_at) < cutoff)
      old.forEach((m) => log('purged', m))
      db.members = db.members.filter((m) => !old.includes(m))
      persist()
      return old.length
    },
    async listDeleted() {
      return delay(db.members.filter((m) => m.deleted_at).sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!)))
    },
    async findDuplicates(x, excludeId) {
      const others = live().filter((m) => m.id !== excludeId)
      return delay({
        nrc: !!x.nrc_number && others.some((m) => m.nrc_state === x.nrc_state && m.nrc_township === x.nrc_township
          && m.nrc_type === x.nrc_type && m.nrc_number === x.nrc_number),
        phone: !!x.phone && others.some((m) => m.phone === x.phone),
      })
    },
    async positions() { return delay([...new Set(live().map((m) => m.position).filter(Boolean))].sort()) },
    async townships() { return delay([...new Set(live().map((m) => m.address_township).filter(Boolean))].sort()) },
    async setLogo(kind, id, blob) {
      const list = kind === 'group' ? db.groups : db.orgs
      const item = list.find((x) => x.id === id)
      if (!item) throw new Error('Not found')
      const path = blob ? `${kind}/${id}/${Date.now()}` : null
      await putImage(path, blob, item.logo_path)
      item.logo_path = path
      persist()
      return path
    },
    async setMemberPhoto(memberId, blob) {
      const m = db.members.find((x) => x.id === memberId)
      if (!m) throw new Error('Not found')
      const path = blob ? `${memberId}/${Date.now()}` : null
      await putImage(path, blob, m.photo_path)
      m.photo_path = path
      persist()
      return path
    },
    logoUrl(path) { return path ? images[path] ?? null : null },
    async photoUrls(paths) {
      const out: Record<string, string> = {}
      for (const p of paths) if (p && images[p]) out[p] = images[p]
      return out
    },
    async logNrcView(mid) {
      const m = db.members.find((x) => x.id === mid)
      if (m) { log('nrc_viewed', m); persist() }
    },

    async listUsers() { return delay([...db.profiles]) },
    async updateUser(uid, patch) {
      db.profiles = db.profiles.map((p) => (p.id === uid ? { ...p, ...patch } : p))
      persist()
    },
    async listAccess() { return delay([...db.access]) },
    async grantAccess(a) {
      db.access = db.access.filter((x) => !(x.user_id === a.user_id && x.group_id === a.group_id && x.org_id === a.org_id))
      db.access.push({ ...a, id: id() })
      persist()
    },
    async revokeAccess(aid) { db.access = db.access.filter((a) => a.id !== aid); persist() },
    async listActivity(limit) { return delay(db.log.slice(0, limit)) },
  }
}

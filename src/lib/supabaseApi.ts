import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Api } from './api'
import type { Access, ActivityEntry, Group, Member, Org, Profile } from './types'
import { birthRange, searchTokens } from './text'
import { extFor } from './image'

function check<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const escLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c)

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null

  // Signed links for private photos are cached ~50 min so lists don't re-download them.
  const photoCache = new Map<string, { url: string; until: number }>()
  const PHOTO_TTL = 3600

  /** Removes every stored photo file of a member (folder "<memberId>/"). */
  async function removeMemberPhotoFiles(memberId: string, keep?: string) {
    const { data } = await sb.storage.from('member-photos').list(memberId)
    const names = (data ?? []).map((f) => `${memberId}/${f.name}`).filter((n) => n !== keep)
    if (names.length) await sb.storage.from('member-photos').remove(names)
  }

  return {
    mode: 'supabase',

    async currentProfile() {
      const id = await uid()
      if (!id) return null
      const res = await sb.from('profiles').select('*').eq('id', id).maybeSingle()
      return check(res) as Profile | null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') cb()
      })
      return () => data.subscription.unsubscribe()
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message)
    },
    async signUp(email, password, fullName) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { full_name: fullName } } })
      if (error) throw new Error(error.message)
      return !!data.session
    },
    async signOut() {
      await sb.auth.signOut()
    },

    async listGroups() {
      return check(await sb.from('groups').select('id,name,name_en,logo_path').order('name')) as Group[]
    },
    async listOrgs() {
      return check(await sb.from('organisations').select('id,group_id,name,name_en,logo_path').order('name')) as Org[]
    },
    async myAccess() {
      const id = await uid()
      if (!id) return []
      return check(await sb.from('access').select('*').eq('user_id', id)) as Access[]
    },
    async saveGroup(g) {
      const row = { name: g.name, name_en: g.name_en ?? '' }
      if (g.id) { check(await sb.from('groups').update(row).eq('id', g.id)); return g.id }
      return (check(await sb.from('groups').insert(row).select('id').single()) as { id: string }).id
    },
    async deleteGroup(id) {
      const g = (check(await sb.from('groups').select('logo_path').eq('id', id).single()) as { logo_path: string | null })
      check(await sb.from('groups').delete().eq('id', id))
      if (g.logo_path) await sb.storage.from('logos').remove([g.logo_path]).catch(() => {})
    },
    async saveOrg(o) {
      const row = { name: o.name, name_en: o.name_en ?? '', group_id: o.group_id }
      if (o.id) { check(await sb.from('organisations').update(row).eq('id', o.id)); return o.id }
      return (check(await sb.from('organisations').insert(row).select('id').single()) as { id: string }).id
    },
    async deleteOrg(id) {
      const o = (check(await sb.from('organisations').select('logo_path').eq('id', id).single()) as { logo_path: string | null })
      check(await sb.from('organisations').delete().eq('id', id))
      if (o.logo_path) await sb.storage.from('logos').remove([o.logo_path]).catch(() => {})
    },
    async memberCounts() {
      const rows = check(await sb.rpc('member_counts')) as { org_id: string; n: number }[]
      return Object.fromEntries(rows.map((r) => [r.org_id, Number(r.n)]))
    },

    async searchMembers(f, orgIds, offset, limit) {
      if (orgIds.length === 0) return { rows: [], count: 0 }
      let q = sb.from('members').select('*', { count: 'exact' }).is('deleted_at', null)
      q = f.orgId ? q.eq('org_id', f.orgId) : q.in('org_id', orgIds)
      for (const tok of searchTokens(f.q)) q = q.ilike('search_text', `%${escLike(tok)}%`)
      if (f.position) q = q.eq('position', f.position)
      if (f.township) q = q.eq('address_township', f.township)
      if (f.status) q = q.eq('status', f.status)
      const br = birthRange(f.ageMin, f.ageMax)
      if (br.from) q = q.gte('birth_date', br.from)
      if (br.to) q = q.lte('birth_date', br.to)
      const res = await q.order('name').range(offset, offset + limit - 1)
      if (res.error) throw new Error(res.error.message)
      return { rows: (res.data ?? []) as Member[], count: res.count ?? 0 }
    },
    async saveMember(m) {
      const { id, ...rest } = m
      const row: Record<string, unknown> = { ...rest }
      delete row.photo_path // photos are changed only through setMemberPhoto
      const res = id
        ? await sb.from('members').update(row).eq('id', id).select().single()
        : await sb.from('members').insert(row).select().single()
      return check(res) as Member
    },
    async softDeleteMember(id) {
      check(await sb.from('members').update({ deleted_at: new Date().toISOString(), deleted_by: await uid() }).eq('id', id))
    },
    async restoreMember(id) {
      check(await sb.from('members').update({ deleted_at: null, deleted_by: null }).eq('id', id))
    },
    async purgeMember(id) {
      await removeMemberPhotoFiles(id).catch(() => {})
      check(await sb.from('members').delete().eq('id', id))
    },
    async purgeOld() {
      const cutoff = new Date(Date.now() - 30 * 864e5).toISOString()
      const old = check(await sb.from('members').select('id').lt('deleted_at', cutoff)) as { id: string }[]
      for (const m of old) await removeMemberPhotoFiles(m.id).catch(() => {})
      return Number(check(await sb.rpc('purge_old_deleted')))
    },
    async listDeleted() {
      return check(
        await sb.from('members').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false }),
      ) as Member[]
    },
    async findDuplicates(m, excludeId) {
      const rows = check(
        await sb.rpc('check_duplicates', {
          p_state: m.nrc_state, p_township: m.nrc_township, p_type: m.nrc_type,
          p_number: m.nrc_number, p_phone: m.phone, p_exclude: excludeId ?? null,
        }),
      ) as { nrc: boolean; phone: boolean }[]
      return rows[0] ?? { nrc: false, phone: false }
    },
    async positions() {
      const rows = check(await sb.rpc('member_facets')) as { kind: string; value: string }[]
      return rows.filter((r) => r.kind === 'position').map((r) => r.value).sort()
    },
    async townships() {
      const rows = check(await sb.rpc('member_facets')) as { kind: string; value: string }[]
      return rows.filter((r) => r.kind === 'township').map((r) => r.value).sort()
    },
    async logNrcView(memberId) {
      await sb.rpc('log_nrc_view', { p_member: memberId })
    },

    async setLogo(kind, id, blob) {
      const table = kind === 'group' ? 'groups' : 'organisations'
      const old = (check(await sb.from(table).select('logo_path').eq('id', id).single()) as { logo_path: string | null }).logo_path
      let path: string | null = null
      if (blob) {
        path = `${kind}/${id}/${Date.now()}.${extFor(blob)}`
        const up = await sb.storage.from('logos').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
        if (up.error) throw new Error(up.error.message)
      }
      check(await sb.from(table).update({ logo_path: path }).eq('id', id))
      if (old && old !== path) await sb.storage.from('logos').remove([old]).catch(() => {})
      return path
    },
    async setMemberPhoto(memberId, blob) {
      let path: string | null = null
      if (blob) {
        path = `${memberId}/${Date.now()}.${extFor(blob)}`
        const up = await sb.storage.from('member-photos').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
        if (up.error) throw new Error(up.error.message)
      }
      check(await sb.from('members').update({ photo_path: path }).eq('id', memberId))
      await removeMemberPhotoFiles(memberId, path ?? undefined).catch(() => {})
      return path
    },
    logoUrl(path) {
      return path ? sb.storage.from('logos').getPublicUrl(path).data.publicUrl : null
    },
    async photoUrls(paths) {
      const now = Date.now()
      const out: Record<string, string> = {}
      const need: string[] = []
      for (const p of new Set(paths.filter(Boolean))) {
        const c = photoCache.get(p)
        if (c && c.until > now) out[p] = c.url
        else need.push(p)
      }
      if (need.length) {
        const { data } = await sb.storage.from('member-photos').createSignedUrls(need, PHOTO_TTL)
        for (const d of data ?? []) {
          if (d.path && d.signedUrl) {
            out[d.path] = d.signedUrl
            photoCache.set(d.path, { url: d.signedUrl, until: now + (PHOTO_TTL - 600) * 1000 })
          }
        }
      }
      return out
    },

    async listUsers() {
      return check(await sb.from('profiles').select('*').order('created_at')) as Profile[]
    },
    async updateUser(id, patch) {
      check(await sb.from('profiles').update(patch).eq('id', id))
    },
    async listAccess() {
      return check(await sb.from('access').select('*')) as Access[]
    },
    async grantAccess(a) {
      check(await sb.from('access').insert(a))
    },
    async revokeAccess(id) {
      check(await sb.from('access').delete().eq('id', id))
    },
    async listActivity(limit) {
      return check(
        await sb.from('activity_log').select('*').order('created_at', { ascending: false }).limit(limit),
      ) as ActivityEntry[]
    },
  }
}

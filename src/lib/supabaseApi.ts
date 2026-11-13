import { createClient, type PostgrestError } from '@supabase/supabase-js'
import type { Api } from './api'
import type { Access, ActivityEntry, Group, Member, Org, Profile } from './types'
import { birthRange, searchTokens } from './text'

function check<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data
}

const escLike = (s: string) => s.replace(/[\\%_]/g, (c) => '\\' + c)

export function createSupabaseApi(url: string, key: string): Api {
  const sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })

  const uid = async () => (await sb.auth.getSession()).data.session?.user.id ?? null

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
      return check(await sb.from('groups').select('id,name,name_en').order('name')) as Group[]
    },
    async listOrgs() {
      return check(await sb.from('organisations').select('id,group_id,name,name_en').order('name')) as Org[]
    },
    async myAccess() {
      const id = await uid()
      if (!id) return []
      return check(await sb.from('access').select('*').eq('user_id', id)) as Access[]
    },
    async saveGroup(g) {
      const row = { name: g.name, name_en: g.name_en ?? '' }
      check(g.id ? await sb.from('groups').update(row).eq('id', g.id) : await sb.from('groups').insert(row))
    },
    async deleteGroup(id) {
      check(await sb.from('groups').delete().eq('id', id))
    },
    async saveOrg(o) {
      const row = { name: o.name, name_en: o.name_en ?? '', group_id: o.group_id }
      check(o.id ? await sb.from('organisations').update(row).eq('id', o.id) : await sb.from('organisations').insert(row))
    },
    async deleteOrg(id) {
      check(await sb.from('organisations').delete().eq('id', id))
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
      const { id, ...row } = m
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
      check(await sb.from('members').delete().eq('id', id))
    },
    async purgeOld() {
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

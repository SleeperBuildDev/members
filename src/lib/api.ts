import type {
  Access, ActivityEntry, Group, Member, MemberFilters, MemberInput, Org, PageResult, Profile,
} from './types'

/** Everything the UI needs from the backend. Implemented by Supabase and by the local demo. */
export interface Api {
  readonly mode: 'supabase' | 'demo'

  // auth
  currentProfile(): Promise<Profile | null>
  onAuthChange(cb: () => void): () => void
  signIn(email: string, password: string): Promise<void>
  /** Resolves true when signed in straight away, false when an email confirmation is needed first. */
  signUp(email: string, password: string, fullName: string): Promise<boolean>
  signOut(): Promise<void>

  // structure
  listGroups(): Promise<Group[]>
  listOrgs(): Promise<Org[]>
  myAccess(): Promise<Access[]>
  saveGroup(g: Partial<Group> & { name: string }): Promise<void>
  deleteGroup(id: string): Promise<void>
  saveOrg(o: Partial<Org> & { name: string; group_id: string }): Promise<void>
  deleteOrg(id: string): Promise<void>
  memberCounts(): Promise<Record<string, number>>

  // members
  searchMembers(f: MemberFilters, orgIds: string[], offset: number, limit: number): Promise<PageResult<Member>>
  saveMember(m: MemberInput): Promise<Member>
  softDeleteMember(id: string): Promise<void>
  restoreMember(id: string): Promise<void>
  purgeMember(id: string): Promise<void>
  purgeOld(): Promise<number>
  listDeleted(): Promise<Member[]>
  /** Checks across ALL organisations (even ones the user can't see) without revealing who. */
  findDuplicates(m: Pick<Member, 'nrc_state' | 'nrc_township' | 'nrc_type' | 'nrc_number' | 'phone'>, excludeId?: string): Promise<{ nrc: boolean; phone: boolean }>
  positions(): Promise<string[]>
  townships(): Promise<string[]>
  logNrcView(memberId: string): Promise<void>

  // admin
  listUsers(): Promise<Profile[]>
  updateUser(id: string, patch: Partial<Pick<Profile, 'status' | 'is_admin' | 'full_name'>>): Promise<void>
  listAccess(): Promise<Access[]>
  grantAccess(a: Omit<Access, 'id'>): Promise<void>
  revokeAccess(id: string): Promise<void>
  listActivity(limit: number): Promise<ActivityEntry[]>
}

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const hasSupabase = !!(SUPABASE_URL && SUPABASE_KEY)

let instance: Promise<Api> | null = null

export function getApi(): Promise<Api> {
  instance ??= hasSupabase
    ? import('./supabaseApi').then((m) => m.createSupabaseApi(SUPABASE_URL!, SUPABASE_KEY!))
    : import('./demoApi').then((m) => m.createDemoApi())
  return instance
}

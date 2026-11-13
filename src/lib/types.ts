export type Role = 'admin' | 'editor' | 'viewer'
export type UserStatus = 'pending' | 'active' | 'disabled'

export interface Profile {
  id: string
  email: string
  full_name: string
  is_admin: boolean
  status: UserStatus
  created_at: string
}

export interface Group {
  id: string
  name: string
  name_en: string
}

export interface Org {
  id: string
  group_id: string
  name: string
  name_en: string
}

export interface Access {
  id: string
  user_id: string
  group_id: string | null
  org_id: string | null
  role: 'editor' | 'viewer'
}

export interface Member {
  id: string
  org_id: string
  name: string
  name_en: string
  position: string
  birth_date: string | null
  nrc_state: number | null
  nrc_township: string
  nrc_type: string
  nrc_number: string
  address_region: string
  address_township: string
  address_street: string
  phone: string
  status: 'active' | 'inactive'
  notes: string
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export type MemberInput = Omit<Member, 'id' | 'deleted_at' | 'created_at' | 'updated_at'> & { id?: string }

export interface MemberFilters {
  q: string
  groupId: string
  orgId: string
  position: string
  township: string
  status: '' | 'active' | 'inactive'
  ageMin: string
  ageMax: string
}

export const emptyFilters: MemberFilters = {
  q: '', groupId: '', orgId: '', position: '', township: '', status: '', ageMin: '', ageMax: '',
}

export interface ActivityEntry {
  id: number
  user_email: string
  action: 'created' | 'updated' | 'deleted' | 'restored' | 'purged' | 'nrc_viewed'
  member_id: string | null
  member_name: string
  org_id: string | null
  created_at: string
}

export interface PageResult<T> {
  rows: T[]
  count: number
}

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'mm' | 'en'

const dict = {
  appName: { mm: 'အဖွဲ့ဝင် မှတ်တမ်း', en: 'Member Registry' },
  // nav
  members: { mm: 'အဖွဲ့ဝင်များ', en: 'Members' },
  organisations: { mm: 'အဖွဲ့အစည်းများ', en: 'Organisations' },
  users: { mm: 'အသုံးပြုသူများ', en: 'Users' },
  trash: { mm: 'အမှိုက်ပုံး', en: 'Recycle bin' },
  activity: { mm: 'လုပ်ဆောင်ချက် မှတ်တမ်း', en: 'Activity log' },
  settings: { mm: 'ဆက်တင်', en: 'Settings' },
  admin: { mm: 'စီမံခန့်ခွဲသူ', en: 'Admin' },
  more: { mm: 'နောက်ထပ်', en: 'More' },
  // auth
  signIn: { mm: 'ဝင်ရောက်မည်', en: 'Sign in' },
  signUp: { mm: 'အကောင့်ဖွင့်ရန် တောင်းဆိုမည်', en: 'Request an account' },
  signOut: { mm: 'ထွက်မည်', en: 'Sign out' },
  email: { mm: 'အီးမေးလ်', en: 'Email' },
  password: { mm: 'စကားဝှက်', en: 'Password' },
  fullName: { mm: 'အမည်အပြည့်အစုံ', en: 'Full name' },
  haveAccount: { mm: 'အကောင့်ရှိပြီးသားလား?', en: 'Already have an account?' },
  noAccount: { mm: 'အကောင့်မရှိသေးဘူးလား?', en: "Don't have an account?" },
  checkEmail: { mm: 'အီးမေးလ်ထဲမှ အတည်ပြုလင့်ခ်ကို နှိပ်ပြီးမှ ဝင်ရောက်ပါ။', en: 'Open the confirmation link in your email, then sign in.' },
  pendingTitle: { mm: 'အတည်ပြုချက် စောင့်ဆိုင်းနေသည်', en: 'Waiting for approval' },
  pendingBody: {
    mm: 'သင့်အကောင့်ကို စီမံခန့်ခွဲသူက အတည်ပြုပြီး အဖွဲ့အစည်းများ ခွင့်ပြုပေးမှ အသုံးပြုနိုင်ပါမည်။',
    en: 'The admin needs to approve your account and give you access to organisations before you can use the app.',
  },
  disabledBody: { mm: 'ဤအကောင့်ကို ပိတ်ထားပါသည်။', en: 'This account has been disabled.' },
  demoMode: { mm: 'နမူနာ မုဒ်', en: 'Demo mode' },
  demoHint: {
    mm: 'ဒေတာများကို ဤစက်ထဲတွင်သာ သိမ်းထားသည်။ Supabase ချိတ်ဆက်ပြီးမှ စက်အားလုံးတွင် ရရှိပါမည်။',
    en: 'Data is saved on this device only. Connect Supabase to sync across all devices.',
  },
  enterDemo: { mm: 'နမူနာဖြင့် စမ်းကြည့်မည်', en: 'Try the demo' },
  // generic
  save: { mm: 'သိမ်းမည်', en: 'Save' },
  cancel: { mm: 'မလုပ်တော့ပါ', en: 'Cancel' },
  delete: { mm: 'ဖျက်မည်', en: 'Delete' },
  edit: { mm: 'ပြင်မည်', en: 'Edit' },
  add: { mm: 'ထည့်မည်', en: 'Add' },
  close: { mm: 'ပိတ်မည်', en: 'Close' },
  confirm: { mm: 'အတည်ပြုမည်', en: 'Confirm' },
  search: { mm: 'ရှာဖွေရန်', en: 'Search' },
  all: { mm: 'အားလုံး', en: 'All' },
  none: { mm: 'မရှိ', en: 'None' },
  loading: { mm: 'ခဏစောင့်ပါ…', en: 'Loading…' },
  saved: { mm: 'သိမ်းပြီးပါပြီ', en: 'Saved' },
  error: { mm: 'အမှားဖြစ်ပွားသည်', en: 'Something went wrong' },
  required: { mm: 'ဖြည့်ရန် လိုအပ်သည်', en: 'Required' },
  optional: { mm: 'မဖြည့်လည်းရ', en: 'optional' },
  // members
  addMember: { mm: 'အဖွဲ့ဝင် ထည့်မည်', en: 'Add member' },
  editMember: { mm: 'အဖွဲ့ဝင် ပြင်ဆင်မည်', en: 'Edit member' },
  searchPlaceholder: { mm: 'အမည်၊ မှတ်ပုံတင်၊ ဖုန်း၊ ရာထူး ဖြင့်ရှာပါ', en: 'Search name, NRC, phone, position' },
  filters: { mm: 'စစ်ထုတ်ရန်', en: 'Filters' },
  clearFilters: { mm: 'စစ်ထုတ်မှု ဖယ်မည်', en: 'Clear filters' },
  results: { mm: 'ဦး', en: 'members' },
  noResults: { mm: 'ရှာမတွေ့ပါ', en: 'No members found' },
  noResultsHint: { mm: 'စာလုံး သို့မဟုတ် စစ်ထုတ်မှုကို ပြောင်းကြည့်ပါ', en: 'Try different words or clear the filters' },
  exportCsv: { mm: 'Excel ထုတ်မည်', en: 'Export to Excel' },
  name: { mm: 'အမည်', en: 'Name' },
  nameMm: { mm: 'အမည် (မြန်မာ)', en: 'Name (Burmese)' },
  nameEn: { mm: 'အမည် (အင်္ဂလိပ်)', en: 'Name (English)' },
  position: { mm: 'ရာထူး', en: 'Position' },
  birthDate: { mm: 'မွေးနေ့', en: 'Birth date' },
  age: { mm: 'အသက်', en: 'Age' },
  ageRange: { mm: 'အသက်အပိုင်းအခြား', en: 'Age range' },
  years: { mm: 'နှစ်', en: 'yrs' },
  nrc: { mm: 'နိုင်ငံသားစိစစ်ရေးကတ်ပြား', en: 'NRC' },
  nrcShort: { mm: 'မှတ်ပုံတင်', en: 'NRC' },
  nrcState: { mm: 'ပြည်နယ်/တိုင်း', en: 'State' },
  nrcTownship: { mm: 'မြို့နယ်', en: 'Township' },
  nrcType: { mm: 'အမျိုးအစား', en: 'Type' },
  nrcNumber: { mm: 'နံပါတ် (၆ လုံး)', en: 'Number (6 digits)' },
  nrcPaste: { mm: 'သို့မဟုတ် အပြည့်ကူးထည့်ပါ', en: 'or paste the full NRC' },
  showNrc: { mm: 'ပြမည်', en: 'Show' },
  hideNrc: { mm: 'ဖုံးမည်', en: 'Hide' },
  address: { mm: 'နေရပ်လိပ်စာ', en: 'Address' },
  region: { mm: 'ပြည်နယ်/တိုင်းဒေသကြီး', en: 'State / Region' },
  township: { mm: 'မြို့နယ်', en: 'Township' },
  street: { mm: 'ရပ်ကွက်၊ လမ်း၊ အိမ်အမှတ်', en: 'Ward, street, house no.' },
  phone: { mm: 'ဖုန်းနံပါတ်', en: 'Phone number' },
  status: { mm: 'အခြေအနေ', en: 'Status' },
  active: { mm: 'လက်ရှိ', en: 'Active' },
  inactive: { mm: 'နုတ်ထွက်', en: 'Inactive' },
  notes: { mm: 'မှတ်ချက်', en: 'Notes' },
  organisation: { mm: 'အဖွဲ့အစည်း', en: 'Organisation' },
  group: { mm: 'အုပ်စု', en: 'Group' },
  call: { mm: 'ဖုန်းခေါ်မည်', en: 'Call' },
  lastUpdated: { mm: 'နောက်ဆုံးပြင်ဆင်ချိန်', en: 'Last updated' },
  dupNrc: { mm: 'ဤမှတ်ပုံတင်ဖြင့် အဖွဲ့ဝင်ရှိပြီးသား', en: 'A member with this NRC already exists' },
  dupPhone: { mm: 'ဤဖုန်းနံပါတ်ဖြင့် အဖွဲ့ဝင်ရှိပြီးသား', en: 'A member with this phone already exists' },
  zawgyiFixed: { mm: 'ဇော်ဂျီစာကို ယူနီကုဒ်သို့ ပြောင်းပေးလိုက်ပါပြီ', en: 'Zawgyi text was converted to Unicode' },
  deleteMemberQ: { mm: 'ဤအဖွဲ့ဝင်ကို ဖျက်မလား? အမှိုက်ပုံးမှ ရက် ၃၀ အတွင်း ပြန်ယူနိုင်သည်။', en: 'Delete this member? You can restore it from the recycle bin for 30 days.' },
  viewOnly: { mm: 'ကြည့်ရှုခွင့်သာ', en: 'View only' },
  // orgs
  addGroup: { mm: 'အုပ်စု ထည့်မည်', en: 'Add group' },
  addOrg: { mm: 'အဖွဲ့အစည်း ထည့်မည်', en: 'Add organisation' },
  editGroup: { mm: 'အုပ်စု ပြင်မည်', en: 'Edit group' },
  editOrg: { mm: 'အဖွဲ့အစည်း ပြင်မည်', en: 'Edit organisation' },
  groupNameMm: { mm: 'အမည် (မြန်မာ)', en: 'Name (Burmese)' },
  groupNameEn: { mm: 'အမည် (အင်္ဂလိပ်)', en: 'Name (English)' },
  noGroups: { mm: 'အုပ်စု မရှိသေးပါ', en: 'No groups yet' },
  noGroupsHint: { mm: 'အုပ်စုတစ်ခု ဖန်တီးပြီး အဖွဲ့အစည်းများ ထည့်ပါ', en: 'Create a group, then add organisations to it' },
  noAccessHint: { mm: 'သင့်အား အဖွဲ့အစည်း မခွင့်ပြုရသေးပါ', en: "You haven't been given access to any organisation yet" },
  orgsCount: { mm: 'ဖွဲ့', en: 'orgs' },
  cantDeleteGroup: { mm: 'အဖွဲ့အစည်းများ ရှိနေသော အုပ်စုကို ဖျက်၍မရပါ', en: 'Remove its organisations first' },
  cantDeleteOrg: { mm: 'အဖွဲ့ဝင်ရှိနေသော အဖွဲ့အစည်းကို ဖျက်၍မရပါ', en: 'Move or delete its members first' },
  deleteQ: { mm: 'ဖျက်မှာ သေချာပါသလား?', en: 'Are you sure you want to delete this?' },
  viewMembers: { mm: 'အဖွဲ့ဝင်များ ကြည့်မည်', en: 'View members' },
  // users & access
  pending: { mm: 'စောင့်ဆိုင်းဆဲ', en: 'Pending' },
  disabled: { mm: 'ပိတ်ထား', en: 'Disabled' },
  approve: { mm: 'အတည်ပြုမည်', en: 'Approve' },
  disable: { mm: 'ပိတ်မည်', en: 'Disable' },
  enable: { mm: 'ပြန်ဖွင့်မည်', en: 'Enable' },
  access: { mm: 'ဝင်ရောက်ခွင့်', en: 'Access' },
  giveAccess: { mm: 'ခွင့်ပြုချက် ပေးမည်', en: 'Give access' },
  editor: { mm: 'ပြင်ဆင်သူ', en: 'Editor' },
  viewer: { mm: 'ကြည့်ရှုသူ', en: 'Viewer' },
  editorHint: { mm: 'ထည့်/ပြင်နိုင်၊ ဖျက်မရ', en: 'Can add & edit, not delete' },
  viewerHint: { mm: 'ရှာ/ကြည့်ရုံသာ', en: 'Search & view only' },
  wholeGroup: { mm: 'အုပ်စုတစ်ခုလုံး', en: 'Whole group' },
  oneOrg: { mm: 'အဖွဲ့အစည်းတစ်ခု', en: 'One organisation' },
  noAccessYet: { mm: 'ခွင့်ပြုချက် မရှိသေး', en: 'No access yet' },
  you: { mm: 'သင်', en: 'You' },
  usersHint: {
    mm: 'အသစ်ဝင်လာသူများသည် "အကောင့်ဖွင့်ရန် တောင်းဆိုမည်" ဖြင့် စာရင်းသွင်းပြီး ဤနေရာတွင် အတည်ပြုချက် စောင့်ပါမည်။',
    en: 'New people sign up with "Request an account" and wait here for your approval.',
  },
  // trash
  restore: { mm: 'ပြန်ယူမည်', en: 'Restore' },
  deleteForever: { mm: 'အပြီးဖျက်မည်', en: 'Delete forever' },
  deleteForeverQ: { mm: 'အပြီးဖျက်ပါက ပြန်ယူ၍ မရတော့ပါ။ ဆက်လုပ်မလား?', en: 'This cannot be undone. Delete permanently?' },
  emptyOld: { mm: 'ရက် ၃၀ ကျော်ပြီးသားများ ရှင်းမည်', en: 'Clear items older than 30 days' },
  trashEmpty: { mm: 'အမှိုက်ပုံး ဗလာဖြစ်နေသည်', en: 'Recycle bin is empty' },
  deletedOn: { mm: 'ဖျက်သည့်ရက်', en: 'Deleted' },
  daysLeft: { mm: 'ရက် ကျန်', en: 'days left' },
  // activity
  act_created: { mm: 'ထည့်သွင်းခဲ့သည်', en: 'added' },
  act_updated: { mm: 'ပြင်ဆင်ခဲ့သည်', en: 'edited' },
  act_deleted: { mm: 'ဖျက်ခဲ့သည်', en: 'deleted' },
  act_restored: { mm: 'ပြန်ယူခဲ့သည်', en: 'restored' },
  act_purged: { mm: 'အပြီးဖျက်ခဲ့သည်', en: 'permanently deleted' },
  act_nrc_viewed: { mm: 'မှတ်ပုံတင် ကြည့်ခဲ့သည်', en: 'viewed the NRC of' },
  noActivity: { mm: 'မှတ်တမ်း မရှိသေးပါ', en: 'No activity yet' },
  // settings
  language: { mm: 'ဘာသာစကား', en: 'Language' },
  theme: { mm: 'အသွင်', en: 'Appearance' },
  light: { mm: 'အလင်း', en: 'Light' },
  dark: { mm: 'အမှောင်', en: 'Dark' },
  system: { mm: 'စက်အတိုင်း', en: 'System' },
  account: { mm: 'အကောင့်', en: 'Account' },
  installApp: { mm: 'App အဖြစ် ထည့်သွင်းမည်', en: 'Install as an app' },
  installHint: {
    mm: 'Browser menu ထဲမှ "Add to Home screen" / "Install app" ကိုနှိပ်ပါ။',
    en: 'Use your browser menu: "Add to Home screen" or "Install app".',
  },
  resetDemo: { mm: 'နမူနာဒေတာ ပြန်စမည်', en: 'Reset demo data' },
  loadMore: { mm: 'ထပ်ပြမည်', en: 'Load more' },
} as const

export type Key = keyof typeof dict

interface I18n {
  lang: Lang
  setLang: (l: Lang) => void
  t: (k: Key) => string
}

const Ctx = createContext<I18n>(null!)

function readLang(): Lang {
  try {
    const v = localStorage.getItem('lang')
    if (v === 'mm' || v === 'en') return v
  } catch { /* storage blocked */ }
  return 'mm'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readLang)
  useEffect(() => {
    document.documentElement.lang = lang === 'mm' ? 'my' : 'en'
  }, [lang])
  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('lang', l) } catch { /* ignore */ }
  }
  const t = (k: Key) => dict[k][lang]
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>
}

export const useI18n = () => useContext(Ctx)

/** Picks the right name for the current language, falling back to the other one. */
export function pickName(o: { name: string; name_en: string }, lang: Lang): string {
  return lang === 'en' ? o.name_en || o.name : o.name || o.name_en
}

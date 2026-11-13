import { HashRouter, Navigate, Route, Routes } from 'react-router'
import { Users } from 'lucide-react'
import { I18nProvider } from './lib/i18n'
import { AppProvider, useApp } from './lib/store'
import { UiProvider } from './components/ui'
import { Layout } from './components/Layout'
import { MembersPage } from './pages/Members'
import { OrgsPage } from './pages/Orgs'
import { UsersPage } from './pages/Users'
import { ActivityPage, TrashPage } from './pages/Admin'
import { SettingsPage } from './pages/Settings'
import { LoginPage, PendingPage } from './pages/Login'

function Splash() {
  return (
    <div className="grid h-full place-items-center">
      <div className="grid size-14 animate-pulse place-items-center rounded-2xl bg-accent text-accent-fg"><Users className="size-7" /></div>
    </div>
  )
}

function Routed() {
  const { profile, isAdmin } = useApp()
  if (!profile) return <LoginPage />
  if (profile.status !== 'active') return <PendingPage />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MembersPage />} />
        <Route path="orgs" element={<OrgsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {isAdmin && <>
          <Route path="users" element={<UsersPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="activity" element={<ActivityPage />} />
        </>}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <UiProvider>
        <AppProvider fallback={<Splash />}>
          <HashRouter>
            <Routed />
          </HashRouter>
        </AppProvider>
      </UiProvider>
    </I18nProvider>
  )
}

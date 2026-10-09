import { useEffect, useState } from 'react'
import PurchaseOrder from './components/pages/PurchaseOrder'
import LoginDialog from './components/LoginDialog'
import * as sl from './api/serviceLayer'

const STORAGE_KEY = 'sl-session'

// Only company + user name are kept (never the password). The real session lives in
// the B1SESSION cookie; this just lets a page reload skip the login screen while it is valid.
const readSaved = () => {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

function App() {
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(() => readSaved() !== null)

  useEffect(() => {
    // any 401 from the Service Layer (e.g. session timeout) sends the user back to login
    sl.setSessionExpiredHandler(() => {
      sessionStorage.removeItem(STORAGE_KEY)
      setSession(null)
    })

    const saved = readSaved()
    if (!saved) return
    let cancelled = false
    sl.isSessionValid().then((valid) => {
      if (cancelled) return
      if (valid) setSession(saved)
      setChecking(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleLoggedIn = (s) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    setSession(s)
  }

  const handleLogout = async () => {
    await sl.logout()
    sessionStorage.removeItem(STORAGE_KEY)
    setSession(null)
  }

  if (checking) return <div className="boot">Connecting…</div>
  if (!session) return <LoginDialog onLoggedIn={handleLoggedIn} />
  return <PurchaseOrder session={session} onLogout={handleLogout} />
}

export default App

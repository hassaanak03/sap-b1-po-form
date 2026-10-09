import { useState } from 'react'
import * as sl from '../api/serviceLayer'

// Logs in to the Service Layer. Company DB and user name are remembered for next
// time; the password never is.
function LoginDialog({ onLoggedIn }) {
  const [form, setForm] = useState(() => ({
    companyDb: localStorage.getItem('sl-company') ?? '',
    userName: localStorage.getItem('sl-user') ?? '',
    password: '',
  }))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await sl.login(form)
      localStorage.setItem('sl-company', form.companyDb)
      localStorage.setItem('sl-user', form.userName)
      onLoggedIn({ companyDb: form.companyDb, userName: form.userName })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <h1>Log in to SAP Business One</h1>
        <div className="login-body">
          {sl.USE_MOCK && (
            <p className="login-note">
              Demo mode: there is no SAP connection. Enter any company, user name and password.
            </p>
          )}
          <label>
            Company database
            <input className="fld" autoFocus required value={form.companyDb} onChange={set('companyDb')} />
          </label>
          <label>
            User name
            <input className="fld" required autoComplete="username" value={form.userName} onChange={set('userName')} />
          </label>
          <label>
            Password
            <input
              className="fld"
              type="password"
              required
              autoComplete="current-password"
              value={form.password}
              onChange={set('password')}
            />
          </label>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Logging in…' : 'Log in'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default LoginDialog

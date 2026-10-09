import { USE_MOCK } from '../../api/serviceLayer'

// Bottom status bar: the latest message on the left, who is logged in on the right.
function StatusBar({ message, session }) {
  return (
    <footer className="statusbar" role="status" aria-live="polite">
      <span className={`status-msg ${message.type}`}>{message.text}</span>
      <span>
        {USE_MOCK && <strong className="demo-tag">Demo data </strong>}
        {session.userName} @ {session.companyDb}
      </span>
    </footer>
  )
}

export default StatusBar

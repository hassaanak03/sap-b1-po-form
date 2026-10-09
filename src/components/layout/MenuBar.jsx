import { useEffect, useRef, useState } from 'react'

const MENU_NAMES = ['File', 'Edit', 'View', 'Data', 'Go To', 'Modules', 'Tools', 'Window', 'Help']

// SAP-style menu bar. `menus` maps a menu name to its entries:
//   { Data: [{ label: 'Find', onClick }, ...] }
// Menus without entries are shown but do nothing yet.
function MenuBar({ menus }) {
  const [open, setOpen] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const closeOnOutsideClick = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(null)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    return () => document.removeEventListener('mousedown', closeOnOutsideClick)
  }, [])

  return (
    <nav className="menubar" ref={ref}>
      {MENU_NAMES.map((name) => {
        const entries = menus[name]
        return (
          <div className="menu" key={name}>
            <button
              type="button"
              className={`menu-btn${open === name ? ' open' : ''}`}
              disabled={!entries}
              onClick={() => setOpen(open === name ? null : name)}
            >
              {name}
            </button>
            {open === name && entries && (
              <ul className="menu-drop" role="menu">
                {entries.map((entry) => (
                  <li key={entry.label}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setOpen(null)
                        entry.onClick()
                      }}
                    >
                      {entry.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export default MenuBar

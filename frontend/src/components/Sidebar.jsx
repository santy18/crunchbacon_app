import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Home', icon: '\u2302' },
  { to: '/voices', label: 'Voices', icon: '\uD83C\uDFA4' },
  { to: '/projects', label: 'Projects', icon: '\uD83D\uDCC1' },
  { to: '/streaming', label: 'Streaming', icon: '\uD83C\uDF99\uFE0F' },
  { to: '/transcriptions', label: 'Transcriptions', icon: '\u{1F4DD}' },
  { to: '/audio-files', label: 'Audio Files', icon: '\uD83D\uDD0A' },
  { to: '/testing', label: 'Testing', icon: '\u26A1' },
  { to: '/settings', label: 'Settings', icon: '\u2699\uFE0F' },
]

export default function Sidebar() {
  return (
    <nav className="sidebar">
      <div className="sidebar-brand">CrunchBacon</div>
      <ul className="sidebar-nav">
        {links.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                'sidebar-link' + (isActive ? ' active' : '')
              }
            >
              <span className="sidebar-icon">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

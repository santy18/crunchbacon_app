import { NavLink } from 'react-router-dom'

const links = [
  { to: '/app', label: 'Home', icon: '\u2302' },
  { to: '/app/voices', label: 'Voices', icon: '\uD83C\uDFA4' },
  { to: '/app/projects', label: 'Projects', icon: '\uD83D\uDCC1' },
  { to: '/app/streaming', label: 'Streaming', icon: '\uD83C\uDF99\uFE0F' },
  { to: '/app/transcriptions', label: 'Transcriptions', icon: '\u{1F4DD}' },
  { to: '/app/audio-files', label: 'Audio Files', icon: '\uD83D\uDD0A' },
  { to: '/app/testing', label: 'Testing', icon: '\u26A1' },
  { to: '/app/settings', label: 'Settings', icon: '\u2699\uFE0F' },
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
              end={to === '/app'}
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

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
    <nav className="w-[220px] min-w-[220px] bg-bacon-card border-r border-neutral-700 flex flex-col py-6">
      <div className="text-xl font-bold text-bacon-pink px-5 pb-5">CrunchBacon</div>
      <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
        {links.map(({ to, label, icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-5 py-2.5 no-underline text-[0.95rem] transition-colors ${
                  isActive
                    ? 'bg-bacon-pink/20 text-white font-semibold'
                    : 'text-white/70 hover:bg-bacon-pink/10 hover:text-white'
                }`
              }
            >
              <span className="text-lg w-6 text-center">{icon}</span>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

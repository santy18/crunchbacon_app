import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const features = [
  {
    to: '/app/voices',
    icon: '\uD83C\uDFA4',
    title: 'Voices',
    desc: 'Clone and manage voices for text-to-speech generation.',
    color: '#646cff',
  },
  {
    to: '/app/projects',
    icon: '\uD83D\uDCC1',
    title: 'Projects',
    desc: 'Organize scripts, audio, and video into complete projects.',
    color: '#c47a20',
  },
  {
    to: '/app/streaming',
    icon: '\uD83C\uDF99\uFE0F',
    title: 'Streaming',
    desc: 'Real-time speech recognition and live voice synthesis.',
    color: '#2ea043',
  },
  {
    to: '/app/transcriptions',
    icon: '\uD83D\uDCDD',
    title: 'Transcriptions',
    desc: 'Record speech and transcribe it with Whisper AI.',
    color: '#e06c75',
  },
  {
    to: '/app/testing',
    icon: '\u26A1',
    title: 'Testing',
    desc: 'Quick playground to test voices and generation settings.',
    color: '#d4a017',
  },
  {
    to: '/app/settings',
    icon: '\u2699\uFE0F',
    title: 'Settings',
    desc: 'Configure models, preferences, and application options.',
    color: '#888',
  },
]

export default function Home() {
  const [stats, setStats] = useState({ voices: 0, transcriptions: 0, audioFiles: 0 })

  useEffect(() => {
    Promise.all([
      fetch('/voices').then((r) => (r.ok ? r.json() : [])),
      fetch('/transcriptions').then((r) => (r.ok ? r.json() : [])),
      fetch('/audio-library').then((r) => (r.ok ? r.json() : [])),
    ]).then(([v, t, a]) => setStats({ voices: v.length, transcriptions: t.length, audioFiles: a.length }))
      .catch(() => {})
  }, [])

  return (
    <div className="home">
      <header className="home-hero">
        <h1 className="home-title">CrunchBacon</h1>
        <p className="home-subtitle">AI-powered voice cloning, text-to-speech, and audio production studio.</p>
        <div className="home-stats">
          <div className="home-stat">
            <span className="home-stat-value">{stats.voices}</span>
            <span className="home-stat-label">Voices</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-value">{stats.transcriptions}</span>
            <span className="home-stat-label">Transcriptions</span>
          </div>
          <div className="home-stat-divider" />
          <div className="home-stat">
            <span className="home-stat-value">{stats.audioFiles}</span>
            <span className="home-stat-label">Audio Files</span>
          </div>
        </div>
      </header>

      <section className="home-grid">
        {features.map((f) => (
          <Link key={f.to} to={f.to} className="home-card" style={{ '--accent': f.color }}>
            <span className="home-card-icon">{f.icon}</span>
            <div className="home-card-body">
              <h3 className="home-card-title">{f.title}</h3>
              <p className="home-card-desc">{f.desc}</p>
            </div>
            <span className="home-card-arrow">&rsaquo;</span>
          </Link>
        ))}
      </section>

      <footer className="home-footer">
        <div className="home-shortcut"><kbd>S</kbd> Split clip</div>
        <div className="home-shortcut"><kbd>Space</kbd> Play / Pause</div>
        <div className="home-shortcut"><kbd>Cmd+Z</kbd> Undo</div>
      </footer>
    </div>
  )
}

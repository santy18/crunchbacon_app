import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const features = [
  {
    to: '/app/voices',
    icon: '\uD83C\uDFA4',
    title: 'Voices',
    desc: 'Clone and manage voices for text-to-speech generation.',
    color: '#FF1E56',
  },
  {
    to: '/app/projects',
    icon: '\uD83D\uDCC1',
    title: 'Projects',
    desc: 'Organize scripts, audio, and video into complete projects.',
    color: '#FFAC41',
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
    color: '#FF1E56',
  },
  {
    to: '/app/testing',
    icon: '\u26A1',
    title: 'Testing',
    desc: 'Quick playground to test voices and generation settings.',
    color: '#FFAC41',
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
    <div className="max-w-[860px] flex flex-col gap-10">
      <header className="flex flex-col items-start gap-2.5">
        <h1
          className="text-5xl font-extrabold tracking-tight leading-none m-0"
          style={{
            background: 'linear-gradient(135deg, #FF1E56 0%, #FFAC41 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          CrunchBacon
        </h1>
        <p className="text-lg text-white/50 m-0 max-w-md leading-relaxed">
          AI-powered voice cloning, text-to-speech, and audio production studio.
        </p>
        <div className="flex items-center gap-6 mt-3 px-5 py-3 bg-bacon-pink/[0.06] border border-bacon-pink/[0.15] rounded-xl">
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl font-bold text-white tabular-nums">{stats.voices}</span>
            <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Voices</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl font-bold text-white tabular-nums">{stats.transcriptions}</span>
            <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Transcriptions</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-2xl font-bold text-white tabular-nums">{stats.audioFiles}</span>
            <span className="text-xs text-white/40 uppercase tracking-wider font-medium">Audio Files</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {features.map((f) => (
          <Link
            key={f.to}
            to={f.to}
            className="group flex items-center gap-3.5 p-4 px-5 bg-bacon-card border border-bacon-border rounded-xl no-underline text-inherit cursor-pointer hover:-translate-y-0.5 hover:bg-[#222] transition-all"
            onMouseEnter={(e) => e.currentTarget.style.borderColor = f.color}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = ''}
          >
            <span className="text-[1.7rem] w-10 h-10 flex items-center justify-center bg-white/[0.04] rounded-lg shrink-0">
              {f.icon}
            </span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[0.95rem] font-semibold m-0 mb-0.5 text-white">{f.title}</h3>
              <p className="text-[0.8rem] text-white/40 m-0 leading-snug">{f.desc}</p>
            </div>
            <span className="text-xl text-white/15 shrink-0 transition-all group-hover:text-white/60 group-hover:translate-x-0.5">
              &rsaquo;
            </span>
          </Link>
        ))}
      </section>

      <footer className="flex gap-6 pt-4 border-t border-bacon-border">
        <div className="text-[0.78rem] text-white/30 flex items-center gap-1.5">
          <kbd className="inline-block px-1.5 py-0.5 text-[0.72rem] font-mono text-white/50 bg-white/[0.06] border border-white/10 rounded leading-snug">S</kbd> Split clip
        </div>
        <div className="text-[0.78rem] text-white/30 flex items-center gap-1.5">
          <kbd className="inline-block px-1.5 py-0.5 text-[0.72rem] font-mono text-white/50 bg-white/[0.06] border border-white/10 rounded leading-snug">Space</kbd> Play / Pause
        </div>
        <div className="text-[0.78rem] text-white/30 flex items-center gap-1.5">
          <kbd className="inline-block px-1.5 py-0.5 text-[0.72rem] font-mono text-white/50 bg-white/[0.06] border border-white/10 rounded leading-snug">Cmd+Z</kbd> Undo
        </div>
      </footer>
    </div>
  )
}

import { useState, useEffect, useRef } from 'react'

const API = ''

export default function PublishButton({ project }) {
  const [open, setOpen] = useState(false)
  const [platforms, setPlatforms] = useState([])
  const [selected, setSelected] = useState({})
  const [title, setTitle] = useState('')
  const [status, setStatus] = useState(null) // null | 'exporting' | 'uploading' | 'done' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const [results, setResults] = useState(null)
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (open) {
      fetch(`${API}/social/platforms`)
        .then((r) => r.json())
        .then((data) => {
          setPlatforms(data)
          const sel = {}
          data.forEach((p) => {
            if (p.connected) sel[p.name] = true
          })
          setSelected(sel)
        })
        .catch(() => {})
    }
  }, [open])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const connectedPlatforms = platforms.filter((p) => p.connected)
  const selectedNames = Object.keys(selected).filter((k) => selected[k])
  const canPublish = selectedNames.length > 0 && project.clips.length > 0

  const handlePublish = async () => {
    if (!canPublish) return
    setStatus('exporting')
    setErrorMsg('')
    setResults(null)

    const formData = new FormData()

    // Attach media files
    const usedMediaIds = new Set(project.clips.map((c) => c.mediaId))
    for (const media of project.mediaBin) {
      if (usedMediaIds.has(media.id) && media.file) {
        formData.append(`media_${media.id}`, media.file, media.name)
      }
    }

    // Attach project JSON
    const projectData = {
      tracks: project.tracks,
      clips: project.clips.map((c) => ({
        id: c.id,
        mediaId: c.mediaId,
        trackId: c.trackId,
        startTime: c.startTime,
        duration: c.duration,
        inPoint: c.inPoint,
        outPoint: c.outPoint,
        x: c.x,
        y: c.y,
        scale: c.scale,
        rotation: c.rotation,
        opacity: c.opacity,
        cropLeft: c.cropLeft,
        cropRight: c.cropRight,
        cropTop: c.cropTop,
        cropBottom: c.cropBottom,
        speed: c.speed,
        volume: c.volume,
      })),
    }
    formData.append('project', JSON.stringify(projectData))
    formData.append('platforms', selectedNames.join(','))
    formData.append('title', title)

    setStatus('uploading')

    try {
      const res = await fetch(`${API}/social/publish`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.detail || `Server error ${res.status}`)
      }

      const data = await res.json()
      setResults(data.results)

      const hasError = Object.values(data.results).some((r) => r.status === 'error')
      setStatus(hasError ? 'error' : 'done')
      if (!hasError) {
        setTimeout(() => {
          setStatus(null)
          setOpen(false)
        }, 3000)
      }
    } catch (e) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  const btnClass =
    'px-3 py-1 text-xs border-none rounded cursor-pointer text-gray-200 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-35 disabled:cursor-not-allowed'

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={btnClass}
        onClick={() => setOpen(!open)}
        disabled={project.clips.length === 0 || status === 'exporting' || status === 'uploading'}
      >
        {status === 'exporting'
          ? 'Exporting...'
          : status === 'uploading'
            ? 'Publishing...'
            : status === 'done'
              ? 'Published!'
              : 'Publish'}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-neutral-800 border border-neutral-600 rounded-lg shadow-xl z-50 p-3">
          <p className="text-xs font-semibold text-gray-300 mb-2">Publish to</p>

          {connectedPlatforms.length === 0 && (
            <p className="text-xs text-gray-500 mb-2">
              No accounts connected. Go to Settings to connect a platform.
            </p>
          )}

          {platforms.map((p) => (
            <label
              key={p.name}
              className="flex items-center gap-2 py-1 text-sm cursor-pointer"
            >
              <input
                type="checkbox"
                checked={!!selected[p.name]}
                disabled={!p.connected}
                onChange={(e) =>
                  setSelected((s) => ({ ...s, [p.name]: e.target.checked }))
                }
                className="accent-bacon-pink"
              />
              <span className={p.connected ? 'text-gray-200' : 'text-gray-500'}>
                {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
              </span>
              {!p.connected && (
                <span className="text-[10px] text-gray-600 ml-auto">Not connected</span>
              )}
            </label>
          ))}

          <div className="mt-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Video title (optional)"
              className="w-full bg-neutral-900 border border-neutral-600 rounded px-2 py-1.5 text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-bacon-pink"
            />
          </div>

          {errorMsg && (
            <p className="text-xs text-red-400 mt-2">{errorMsg}</p>
          )}

          {results && (
            <div className="mt-2 space-y-1">
              {Object.entries(results).map(([name, r]) => (
                <div key={name} className="text-xs">
                  <span className="font-medium">{name}:</span>{' '}
                  {r.status === 'error' ? (
                    <span className="text-red-400">{r.detail}</span>
                  ) : (
                    <span className="text-green-400">{r.status}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handlePublish}
            disabled={!canPublish || status === 'exporting' || status === 'uploading'}
            className="mt-3 w-full px-3 py-1.5 text-xs rounded bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === 'exporting'
              ? 'Exporting video...'
              : status === 'uploading'
                ? 'Uploading...'
                : 'Publish Now'}
          </button>
        </div>
      )}
    </div>
  )
}

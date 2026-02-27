import { useRef, useCallback, useState, useEffect } from 'react'
import { useProject, useUI, useDispatch, addMedia, removeMedia, addClip, genId } from './EditorContext'

function probeMedia(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const type = file.type.startsWith('video/')
      ? 'video'
      : file.type.startsWith('audio/')
        ? 'audio'
        : 'image'

    if (type === 'video' || type === 'audio') {
      const el = document.createElement(type)
      el.preload = 'metadata'
      el.src = url
      el.onloadedmetadata = () => {
        resolve({
          id: genId(),
          name: file.name,
          type,
          file,
          objectUrl: url,
          duration: el.duration || 0,
          width: el.videoWidth || undefined,
          height: el.videoHeight || undefined,
        })
      }
      el.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    } else {
      // image — default 5s
      const img = new Image()
      img.src = url
      img.onload = () => {
        resolve({
          id: genId(),
          name: file.name,
          type: 'image',
          file,
          objectUrl: url,
          duration: 5,
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    }
  })
}

const typeIcons = { video: '\u25B6', audio: '\u266B', image: '\u25A3' }

function formatDur(s) {
  if (!s || !isFinite(s)) return '--'
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return m > 0 ? `${m}:${sec.padStart(4, '0')}` : `${sec}s`
}

export default function MediaBin() {
  const project = useProject()
  const ui = useUI()
  const dispatch = useDispatch()
  const fileRef = useRef(null)

  // TTS state
  const [voices, setVoices] = useState([])
  const [ttsVoice, setTtsVoice] = useState('')
  const [ttsText, setTtsText] = useState('')
  const [ttsLoading, setTtsLoading] = useState(false)
  const [ttsError, setTtsError] = useState(null)

  useEffect(() => {
    fetch('/voices')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setVoices(data)
          if (data.length > 0) setTtsVoice(data[0])
        }
      })
      .catch(() => {})
  }, [])

  const handleFiles = useCallback(async (e) => {
    const files = Array.from(e.target.files || [])
    for (const file of files) {
      const item = await probeMedia(file)
      if (item) dispatch(addMedia(item))
    }
    if (fileRef.current) fileRef.current.value = ''
  }, [dispatch])

  const handleAddToTimeline = useCallback((item) => {
    const trackId = item.type === 'audio' ? 'a1' : 'v1'
    dispatch(addClip(item, trackId, ui.playheadTime))
  }, [dispatch, ui.playheadTime])

  const handleRemove = useCallback((e, id) => {
    e.stopPropagation()
    dispatch(removeMedia(id))
  }, [dispatch])

  const handleGenerateTTS = useCallback(async () => {
    if (!ttsText.trim() || !ttsVoice) return
    setTtsLoading(true)
    setTtsError(null)

    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: ttsText.trim(), voice: ttsVoice }),
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Server error ${res.status}`)
      }

      const blob = await res.blob()
      const file = new File([blob], `tts_${Date.now()}.wav`, { type: 'audio/wav' })
      const item = await probeMedia(file)
      if (item) {
        dispatch(addMedia(item))
        // Auto-add to audio track at playhead
        dispatch(addClip(item, 'a1', ui.playheadTime))
      }
      setTtsText('')
    } catch (e) {
      setTtsError(e.message)
    } finally {
      setTtsLoading(false)
    }
  }, [ttsText, ttsVoice, dispatch, ui.playheadTime])

  return (
    <div className="editor-bin">
      <div className="editor-bin-header">
        <span>Media</span>
        <label>
          + Import
          <input
            ref={fileRef}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            onChange={handleFiles}
          />
        </label>
      </div>
      <div className="editor-bin-list">
        {project.mediaBin.map((item) => (
          <div
            key={item.id}
            className="editor-bin-item"
            onClick={() => handleAddToTimeline(item)}
            title="Click to add to timeline at playhead"
          >
            <span className="media-icon">{typeIcons[item.type] || '?'}</span>
            <div className="media-info">
              <span className="media-name">{item.name}</span>
              <span className="media-meta">
                {item.type} &middot; {formatDur(item.duration)}
                {item.width ? ` \u00B7 ${item.width}\u00D7${item.height}` : ''}
              </span>
            </div>
            <button className="media-remove" onClick={(e) => handleRemove(e, item.id)}>
              \u00D7
            </button>
          </div>
        ))}
        {project.mediaBin.length === 0 && (
          <div style={{ padding: '20px 8px', color: '#555', textAlign: 'center', fontSize: '12px' }}>
            Import media files to get started
          </div>
        )}
      </div>

      {/* TTS Generator */}
      <div className="editor-tts">
        <div className="editor-tts-header">Generate Audio (TTS)</div>
        <div className="editor-tts-body">
          {voices.length > 0 && (
            <select
              className="editor-tts-select"
              value={ttsVoice}
              onChange={(e) => setTtsVoice(e.target.value)}
              disabled={ttsLoading}
            >
              {voices.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          )}
          <textarea
            className="editor-tts-textarea"
            rows={3}
            placeholder="Type text to generate speech..."
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            disabled={ttsLoading}
          />
          <button
            className="editor-tts-btn"
            onClick={handleGenerateTTS}
            disabled={ttsLoading || !ttsText.trim() || !ttsVoice}
          >
            {ttsLoading ? 'Generating...' : 'Generate & Add to Timeline'}
          </button>
          {ttsError && <div className="editor-tts-error">{ttsError}</div>}
        </div>
      </div>
    </div>
  )
}

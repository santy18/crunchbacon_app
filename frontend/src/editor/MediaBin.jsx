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

  // Library state
  const [libraryItems, setLibraryItems] = useState([])
  const [libraryOpen, setLibraryOpen] = useState(true)
  const [libraryLoading, setLibraryLoading] = useState(null)

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
    fetch('/audio-library')
      .then((res) => res.ok ? res.json() : [])
      .then((data) => { if (Array.isArray(data)) setLibraryItems(data) })
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

  const handleAddFromLibrary = useCallback(async (item) => {
    setLibraryLoading(item.id)
    try {
      const res = await fetch(`/audio-library/${item.id}/file`)
      if (!res.ok) throw new Error('Failed to fetch')
      const blob = await res.blob()
      const file = new File([blob], `${item.name}.wav`, { type: 'audio/wav' })
      const media = await probeMedia(file)
      if (media) {
        dispatch(addMedia(media))
        dispatch(addClip(media, 'a1', ui.playheadTime))
      }
    } catch {
      // silently fail
    } finally {
      setLibraryLoading(null)
    }
  }, [dispatch, ui.playheadTime])

  const handleDeleteFromLibrary = useCallback(async (e, id) => {
    e.stopPropagation()
    try {
      await fetch(`/audio-library/${id}`, { method: 'DELETE' })
      setLibraryItems((prev) => prev.filter((i) => i.id !== id))
    } catch {
      // silently fail
    }
  }, [])

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
    <div className="flex flex-col border-r border-neutral-700 overflow-hidden" style={{ gridArea: 'bin' }}>
      <div className="px-2.5 py-2 font-semibold text-xs uppercase tracking-wide text-gray-400 border-b border-neutral-700 flex items-center justify-between">
        <span>Media</span>
        <label className="inline-flex items-center cursor-pointer text-bacon-pink font-medium text-xs normal-case tracking-normal">
          + Import
          <input
            ref={fileRef}
            type="file"
            accept="video/*,audio/*,image/*"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
        </label>
      </div>
      <div className="flex-1 overflow-y-auto p-1">
        {project.mediaBin.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none hover:bg-[#2a2a3a]"
            onClick={() => handleAddToTimeline(item)}
            title="Click to add to timeline at playhead"
          >
            <span className="text-base w-5 text-center shrink-0">{typeIcons[item.type] || '?'}</span>
            <div className="flex-1 min-w-0">
              <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs">{item.name}</span>
              <span className="text-[10px] text-gray-500">
                {item.type} &middot; {formatDur(item.duration)}
                {item.width ? ` \u00B7 ${item.width}\u00D7${item.height}` : ''}
              </span>
            </div>
            <button
              className="bg-transparent border-none text-gray-500 cursor-pointer text-sm p-0 px-0.5 leading-none hover:text-danger"
              onClick={(e) => handleRemove(e, item.id)}
            >
              {'\u00D7'}
            </button>
          </div>
        ))}
        {project.mediaBin.length === 0 && (
          <div className="py-5 px-2 text-neutral-600 text-center text-xs">
            Import media files to get started
          </div>
        )}
      </div>

      {/* Audio Library */}
      <div className="border-t border-neutral-700 shrink-0">
        <div
          className="px-2.5 py-2 font-semibold text-[11px] uppercase tracking-wide text-gray-400 border-b border-bacon-border cursor-pointer flex items-center justify-between select-none hover:text-gray-300"
          onClick={() => setLibraryOpen(!libraryOpen)}
        >
          <span>{libraryOpen ? '\u25BE' : '\u25B8'} From Library</span>
          <span className="bg-neutral-700 text-gray-400 text-[10px] px-1.5 py-px rounded-lg font-medium">{libraryItems.length}</span>
        </div>
        {libraryOpen && (
          <div className="max-h-[150px] overflow-y-auto p-1">
            {libraryItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer select-none hover:bg-[#2a2a3a]"
                onClick={() => handleAddFromLibrary(item)}
                title="Click to add to timeline"
              >
                <span className="text-base w-5 text-center shrink-0">{'\u266B'}</span>
                <div className="flex-1 min-w-0">
                  <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs">{item.name}</span>
                  <span className="text-[10px] text-gray-500">
                    {item.voice_name || 'audio'} &middot; {formatDur(item.duration)}
                  </span>
                </div>
                <button
                  className="bg-transparent border-none text-gray-500 cursor-pointer text-sm p-0 px-0.5 leading-none hover:text-danger"
                  onClick={(e) => handleDeleteFromLibrary(e, item.id)}
                >
                  {'\u00D7'}
                </button>
              </div>
            ))}
            {libraryItems.length === 0 && (
              <div className="p-2 text-neutral-600 text-center text-[11px]">
                No saved audio yet
              </div>
            )}
            {libraryLoading && (
              <div className="px-2 py-1 text-gray-500 text-[11px]">Loading...</div>
            )}
          </div>
        )}
      </div>

      {/* TTS Generator */}
      <div className="border-t border-neutral-700 shrink-0">
        <div className="px-2.5 py-2 font-semibold text-[11px] uppercase tracking-wide text-gray-400 border-b border-bacon-border">
          Generate Audio (TTS)
        </div>
        <div className="p-2 flex flex-col gap-1.5">
          {voices.length > 0 && (
            <select
              className="w-full px-1.5 py-1 text-xs bg-bacon-panel border border-neutral-700 rounded text-gray-200 focus:outline-none focus:border-bacon-pink"
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
            className="w-full px-1.5 py-1.5 text-xs bg-bacon-panel border border-neutral-700 rounded text-gray-200 resize-y min-h-[40px] box-border focus:outline-none focus:border-bacon-pink"
            rows={3}
            placeholder="Type text to generate speech..."
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            disabled={ttsLoading}
          />
          <button
            className="px-2.5 py-1.5 text-xs bg-bacon-pink text-white border-none rounded cursor-pointer font-medium hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            onClick={handleGenerateTTS}
            disabled={ttsLoading || !ttsText.trim() || !ttsVoice}
          >
            {ttsLoading ? 'Generating...' : 'Generate & Add to Timeline'}
          </button>
          {ttsError && <div className="text-[11px] text-red-400">{ttsError}</div>}
        </div>
      </div>
    </div>
  )
}

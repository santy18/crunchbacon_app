import { useRef, useEffect, useMemo, useCallback } from 'react'
import { useProject, useUI, useDispatch } from './EditorContext'
import { formatTimecode } from './timelineUtils'

export default function PreviewPlayer() {
  const project = useProject()
  const ui = useUI()
  const dispatch = useDispatch()
  const videoRef = useRef(null)
  const audioPoolRef = useRef({}) // clipId -> { audio, mediaId }
  const lastSeekRef = useRef({ clipId: null, time: -1 })

  // Find the topmost video clip at the current playhead position
  const activeVideoClip = useMemo(() => {
    const videoClips = project.clips.filter((c) => {
      const track = project.tracks.find((t) => t.id === c.trackId)
      return track && track.type === 'video'
    })
    const atPlayhead = videoClips.filter(
      (c) => ui.playheadTime >= c.startTime && ui.playheadTime < c.startTime + c.duration
    )
    return atPlayhead.length > 0 ? atPlayhead[atPlayhead.length - 1] : null
  }, [project.clips, project.tracks, ui.playheadTime])

  const activeVideoMedia = useMemo(() => {
    if (!activeVideoClip) return null
    return project.mediaBin.find((m) => m.id === activeVideoClip.mediaId) || null
  }, [activeVideoClip, project.mediaBin])

  // Find ALL audio clips at playhead
  const activeAudioClips = useMemo(() => {
    return project.clips.filter((c) => {
      const track = project.tracks.find((t) => t.id === c.trackId)
      return track && track.type === 'audio' &&
        ui.playheadTime >= c.startTime && ui.playheadTime < c.startTime + c.duration
    })
  }, [project.clips, project.tracks, ui.playheadTime])

  // Check if there's anything to play
  const hasContent = activeVideoClip || activeAudioClips.length > 0

  // --- VIDEO: seek when playhead moves (paused) ---
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideoClip || !activeVideoMedia) return
    if (ui.isPlaying) return

    const sourceTime = activeVideoClip.inPoint + (ui.playheadTime - activeVideoClip.startTime) * activeVideoClip.speed
    if (
      lastSeekRef.current.clipId === activeVideoClip.id &&
      Math.abs(lastSeekRef.current.time - sourceTime) < 0.03
    ) return

    video.currentTime = sourceTime
    lastSeekRef.current = { clipId: activeVideoClip.id, time: sourceTime }
  }, [activeVideoClip, activeVideoMedia, ui.playheadTime, ui.isPlaying])

  // --- VIDEO: set source ---
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (activeVideoMedia && activeVideoMedia.objectUrl) {
      if (video.src !== activeVideoMedia.objectUrl) {
        video.src = activeVideoMedia.objectUrl
      }
    }
  }, [activeVideoMedia])

  // --- VIDEO: volume ---
  useEffect(() => {
    const video = videoRef.current
    if (!video || !activeVideoClip) return
    video.volume = Math.max(0, Math.min(1, activeVideoClip.volume))
  }, [activeVideoClip?.volume, activeVideoClip?.id])

  // --- Get or create an Audio element for an audio clip ---
  const getAudioEl = useCallback((clip) => {
    const media = project.mediaBin.find((m) => m.id === clip.mediaId)
    if (!media || !media.objectUrl) return null

    let entry = audioPoolRef.current[clip.id]
    if (entry && entry.mediaId === clip.mediaId) {
      return entry.audio
    }

    // Create new audio element
    const audio = new Audio()
    audio.preload = 'auto'
    audio.src = media.objectUrl
    audioPoolRef.current[clip.id] = { audio, mediaId: clip.mediaId }
    return audio
  }, [project.mediaBin])

  // --- Clean up audio elements for clips no longer in project ---
  useEffect(() => {
    const clipIds = new Set(project.clips.map((c) => c.id))
    for (const id of Object.keys(audioPoolRef.current)) {
      if (!clipIds.has(id)) {
        audioPoolRef.current[id].audio.pause()
        audioPoolRef.current[id].audio.src = ''
        delete audioPoolRef.current[id]
      }
    }
  }, [project.clips])

  // --- PLAY / PAUSE everything ---
  useEffect(() => {
    const video = videoRef.current

    if (ui.isPlaying) {
      // Start video
      if (video && activeVideoClip && activeVideoMedia) {
        video.playbackRate = activeVideoClip.speed
        video.volume = Math.max(0, Math.min(1, activeVideoClip.volume))
        const sourceTime = activeVideoClip.inPoint + (ui.playheadTime - activeVideoClip.startTime) * activeVideoClip.speed
        video.currentTime = sourceTime
        video.play().catch(() => {})
      }

      // Start all audio clips at playhead
      for (const clip of activeAudioClips) {
        const audio = getAudioEl(clip)
        if (!audio) continue
        const sourceTime = clip.inPoint + (ui.playheadTime - clip.startTime) * clip.speed
        audio.currentTime = sourceTime
        audio.playbackRate = clip.speed
        audio.volume = Math.max(0, Math.min(1, clip.volume))
        audio.play().catch(() => {})
      }

      // Pause audio clips NOT at playhead
      const activeIds = new Set(activeAudioClips.map((c) => c.id))
      for (const [id, entry] of Object.entries(audioPoolRef.current)) {
        if (!activeIds.has(id) && !entry.audio.paused) {
          entry.audio.pause()
        }
      }
    } else {
      // Pause everything
      if (video && !video.paused) video.pause()
      for (const entry of Object.values(audioPoolRef.current)) {
        if (!entry.audio.paused) entry.audio.pause()
      }
    }
  }, [ui.isPlaying, activeVideoClip?.id, activeAudioClips.length])

  // --- During playback: sync audio clips as playhead advances ---
  // (start new clips that come into range, stop those that leave)
  useEffect(() => {
    if (!ui.isPlaying) return

    // Start clips that just came into range
    for (const clip of activeAudioClips) {
      const audio = getAudioEl(clip)
      if (!audio) continue
      if (audio.paused) {
        const sourceTime = clip.inPoint + (ui.playheadTime - clip.startTime) * clip.speed
        audio.currentTime = sourceTime
        audio.playbackRate = clip.speed
        audio.volume = Math.max(0, Math.min(1, clip.volume))
        audio.play().catch(() => {})
      }
    }

    // Stop clips no longer at playhead
    const activeIds = new Set(activeAudioClips.map((c) => c.id))
    for (const [id, entry] of Object.entries(audioPoolRef.current)) {
      if (!activeIds.has(id) && !entry.audio.paused) {
        entry.audio.pause()
      }
    }
  }, [ui.isPlaying, activeAudioClips, getAudioEl, ui.playheadTime])

  // --- Apply volume changes in real time ---
  useEffect(() => {
    for (const clip of activeAudioClips) {
      const entry = audioPoolRef.current[clip.id]
      if (entry) {
        entry.audio.volume = Math.max(0, Math.min(1, clip.volume))
      }
    }
  }, [activeAudioClips])

  // Stop playing when nothing is at playhead
  useEffect(() => {
    if (ui.isPlaying && !hasContent) {
      dispatch({ type: 'SET_PLAYING', value: false })
    }
  }, [hasContent, ui.isPlaying, dispatch])

  // Compute timeline end (furthest clip edge)
  const timelineEnd = useMemo(() => {
    if (project.clips.length === 0) return 0
    return Math.max(...project.clips.map((c) => c.startTime + c.duration))
  }, [project.clips])

  const goToStart = () => {
    dispatch({ type: 'SET_PLAYHEAD', time: 0 })
    dispatch({ type: 'SET_PLAYING', value: false })
  }

  const goToEnd = () => {
    dispatch({ type: 'SET_PLAYHEAD', time: timelineEnd })
    dispatch({ type: 'SET_PLAYING', value: false })
  }

  const togglePlay = () => {
    dispatch({ type: 'SET_PLAYING', value: !ui.isPlaying })
  }

  return (
    <div className="editor-preview">
      {activeVideoMedia ? (
        <video ref={videoRef} muted={false} playsInline />
      ) : (
        <span className="editor-preview-empty">
          {activeAudioClips.length > 0 ? 'Audio only — press Space to play' : 'No clip at playhead'}
        </span>
      )}
      <div className="editor-transport">
        <button className="transport-btn" onClick={goToStart} title="Go to beginning">
          &#9198;
        </button>
        <button className="transport-btn transport-play" onClick={togglePlay} title={ui.isPlaying ? 'Pause' : 'Play'}>
          {ui.isPlaying ? '\u23F8' : '\u25B6'}
        </button>
        <button className="transport-btn" onClick={goToEnd} title="Go to end">
          &#9197;
        </button>
        <span className="transport-timecode">{formatTimecode(ui.playheadTime)}</span>
      </div>
    </div>
  )
}

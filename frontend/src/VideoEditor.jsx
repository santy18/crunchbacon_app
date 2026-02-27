import { useState, useEffect, useRef, useCallback } from 'react'

export default function VideoEditor({ videoFile, audioUrl }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const rafRef = useRef(null)

  const [duration, setDuration] = useState(0)
  const [markers, setMarkers] = useState([])           // seconds
  const [deletedSegments, setDeletedSegments] = useState(new Set())
  const [selected, setSelected] = useState(null)        // segment index
  const [isPlaying, setIsPlaying] = useState(false)
  const [videoSrc, setVideoSrc] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Create object URL for video file
  useEffect(() => {
    if (!videoFile) return
    const url = URL.createObjectURL(videoFile)
    setVideoSrc(url)
    setMarkers([])
    setDeletedSegments(new Set())
    setSelected(null)
    return () => URL.revokeObjectURL(url)
  }, [videoFile])

  // Build segments from markers
  const getSegments = useCallback(() => {
    const sorted = [...markers].sort((a, b) => a - b)
    return [0, ...sorted, duration]
  }, [markers, duration])

  // Draw timeline
  const draw = useCallback((currentTime) => {
    const canvas = canvasRef.current
    if (!canvas || !duration) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // Background bar
    ctx.fillStyle = '#2a2a3a'
    ctx.fillRect(0, 0, w, h)

    const segs = getSegments()

    // Draw deleted segments as gray overlay
    for (const idx of deletedSegments) {
      if (idx < segs.length - 1) {
        const x0 = (segs[idx] / duration) * w
        const x1 = (segs[idx + 1] / duration) * w
        ctx.fillStyle = 'rgba(80, 80, 80, 0.7)'
        ctx.fillRect(x0, 0, x1 - x0, h)
      }
    }

    // Highlight selected segment in red
    if (selected !== null && selected < segs.length - 1 && !deletedSegments.has(selected)) {
      const x0 = (segs[selected] / duration) * w
      const x1 = (segs[selected + 1] / duration) * w
      ctx.fillStyle = 'rgba(255, 60, 60, 0.3)'
      ctx.fillRect(x0, 0, x1 - x0, h)
    }

    // Draw a subtle gradient bar for the video timeline
    const grad = ctx.createLinearGradient(0, 0, w, 0)
    grad.addColorStop(0, 'rgba(100, 108, 255, 0.3)')
    grad.addColorStop(0.5, 'rgba(74, 170, 255, 0.3)')
    grad.addColorStop(1, 'rgba(100, 108, 255, 0.3)')
    ctx.fillStyle = grad
    ctx.fillRect(0, h * 0.2, w, h * 0.6)

    // Draw markers as yellow dashed lines
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    ctx.strokeStyle = '#ffcc00'
    for (const m of markers) {
      const x = (m / duration) * w
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Draw playhead
    if (currentTime !== undefined && currentTime >= 0) {
      const px = (currentTime / duration) * w
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px, 0)
      ctx.lineTo(px, h)
      ctx.stroke()
    }

    // Time labels
    ctx.fillStyle = '#aaa'
    ctx.font = '11px monospace'
    ctx.textBaseline = 'bottom'
    const fmt = (s) => {
      const m = Math.floor(s / 60)
      const sec = (s % 60).toFixed(1)
      return m > 0 ? `${m}:${sec.padStart(4, '0')}` : `${sec}s`
    }
    ctx.textAlign = 'left'
    ctx.fillText(fmt(0), 4, h - 4)
    ctx.textAlign = 'right'
    ctx.fillText(fmt(duration), w - 4, h - 4)
  }, [duration, markers, deletedSegments, selected, getSegments])

  // Redraw when state changes
  useEffect(() => {
    draw(videoRef.current?.currentTime || 0)
  }, [draw])

  // Animate playhead during playback
  const animatePlayhead = useCallback(() => {
    const video = videoRef.current
    if (!video || video.paused) return
    draw(video.currentTime)
    rafRef.current = requestAnimationFrame(animatePlayhead)
  }, [draw])

  // Skip deleted segments during playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleTimeUpdate = () => {
      if (!isPlaying) return
      const segs = getSegments()
      const t = video.currentTime

      // Find which segment the playhead is in
      for (let i = 0; i < segs.length - 1; i++) {
        if (t >= segs[i] && t < segs[i + 1]) {
          if (deletedSegments.has(i)) {
            // Skip to start of next non-deleted segment
            let nextIdx = i + 1
            while (nextIdx < segs.length - 1 && deletedSegments.has(nextIdx)) {
              nextIdx++
            }
            if (nextIdx < segs.length - 1) {
              video.currentTime = segs[nextIdx]
            } else {
              // All remaining segments are deleted, stop
              video.pause()
              setIsPlaying(false)
            }
          }
          break
        }
      }
    }

    video.addEventListener('timeupdate', handleTimeUpdate)
    return () => video.removeEventListener('timeupdate', handleTimeUpdate)
  }, [isPlaying, deletedSegments, getSegments])

  // Handle play/stop
  const togglePlay = () => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.pause()
      setIsPlaying(false)
      cancelAnimationFrame(rafRef.current)
      draw(video.currentTime)
    } else {
      video.play()
      setIsPlaying(true)
      rafRef.current = requestAnimationFrame(animatePlayhead)
    }
  }

  // Stop animation when video ends
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const handleEnded = () => {
      setIsPlaying(false)
      cancelAnimationFrame(rafRef.current)
      draw(duration)
    }
    video.addEventListener('ended', handleEnded)
    return () => video.removeEventListener('ended', handleEnded)
  }, [draw, duration])

  // Canvas click handler
  const handleCanvasClick = (e) => {
    if (!duration || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width
    const time = frac * duration

    if (e.shiftKey) {
      // Select segment
      const segs = getSegments()
      for (let i = 0; i < segs.length - 1; i++) {
        if (time >= segs[i] && time < segs[i + 1]) {
          setSelected(i)
          return
        }
      }
    } else {
      // Place marker
      setMarkers((prev) => [...prev, time])
      setSelected(null)
    }
  }

  // Delete selected segment
  const deleteSelection = () => {
    if (selected === null) return
    setDeletedSegments((prev) => new Set([...prev, selected]))
    setSelected(null)
  }

  // Clear all markers and deletions
  const clearMarkers = () => {
    setMarkers([])
    setDeletedSegments(new Set())
    setSelected(null)
  }

  // Compute keep-segments (non-deleted)
  const getKeepSegments = () => {
    const segs = getSegments()
    const keep = []
    for (let i = 0; i < segs.length - 1; i++) {
      if (!deletedSegments.has(i)) {
        keep.push([segs[i], segs[i + 1]])
      }
    }
    return keep
  }

  // Export edited video
  const exportVideo = async () => {
    if (!videoFile || !audioUrl) return
    setExporting(true)

    try {
      // Fetch audio blob
      const audioRes = await fetch(audioUrl)
      const audioBlob = await audioRes.blob()

      const keepSegments = getKeepSegments()
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('audio', audioBlob, 'audio.wav')
      formData.append('segments', JSON.stringify(keepSegments))

      const res = await fetch('/export-edited-video', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Server error ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'edited_video.mp4'
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Export failed: ' + e.message)
    } finally {
      setExporting(false)
    }
  }

  if (!videoSrc) return null

  const hasDeletedSegments = deletedSegments.size > 0
  const canExport = !!audioUrl

  return (
    <div className="video-editor">
      <video
        ref={videoRef}
        src={videoSrc}
        className="video-player"
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
      />
      <canvas
        ref={canvasRef}
        className="video-timeline"
        onClick={handleCanvasClick}
      />
      <p className="waveform-hint">
        Click to place markers. Shift+click between markers to select a segment.
      </p>
      <div className="video-controls">
        <button className="video-btn play" onClick={togglePlay} disabled={!duration}>
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <button
          className="video-btn delete"
          onClick={deleteSelection}
          disabled={selected === null || deletedSegments.has(selected)}
        >
          Delete Selection
        </button>
        <button className="video-btn clear" onClick={clearMarkers} disabled={markers.length === 0}>
          Clear Markers
        </button>
        <button
          className="video-btn export"
          onClick={exportVideo}
          disabled={!canExport || exporting}
          title={!canExport ? 'Generate audio first' : ''}
        >
          {exporting ? 'Exporting...' : 'Export Video'}
        </button>
      </div>
      {!canExport && (
        <p className="waveform-hint">Generate audio to enable export.</p>
      )}
    </div>
  )
}

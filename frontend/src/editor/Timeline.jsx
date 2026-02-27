import { useRef, useEffect, useCallback } from 'react'
import { useProject, useUI, useDispatch, moveClip, updateClip } from './EditorContext'
import { timeToX, xToTime, drawTimeRuler, hitTestClip, snap, formatTimecode } from './timelineUtils'

const RULER_H = 24
const TRACK_H = 50
const HANDLE_W = 6

const CLIP_COLORS = {
  video: '#FF1E56',
  audio: '#2ea043',
  image: '#FFAC41',
}

export default function Timeline({ onSplit, onDelete, canSplit, canDelete, rippleDelete, onToggleRipple }) {
  const project = useProject()
  const ui = useUI()
  const dispatch = useDispatch()
  const canvasRef = useRef(null)
  const wrapperRef = useRef(null)
  const dragRef = useRef(null)
  const rafRef = useRef(null)

  // Keep latest state in refs for rAF loop
  const projectRef = useRef(project)
  const uiRef = useRef(ui)
  useEffect(() => { projectRef.current = project }, [project])
  useEffect(() => { uiRef.current = ui }, [ui])

  const getTrackType = useCallback((trackId) => {
    const track = project.tracks.find((t) => t.id === trackId)
    return track ? track.type : 'video'
  }, [project.tracks])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const p = projectRef.current
    const u = uiRef.current
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.parentElement.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, w, h)

    // Ruler
    drawTimeRuler(ctx, w, RULER_H, u.zoom, u.scrollLeft)

    // Track lanes
    for (let i = 0; i < p.tracks.length; i++) {
      const y = RULER_H + i * TRACK_H
      ctx.fillStyle = i % 2 === 0 ? '#1e1e2e' : '#1a1a28'
      ctx.fillRect(0, y, w, TRACK_H)

      // Track label
      ctx.fillStyle = '#555'
      ctx.font = '10px "SF Mono", Menlo, monospace'
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      ctx.fillText(p.tracks[i].name, 4, y + TRACK_H / 2)
    }

    // Track lane borders
    ctx.strokeStyle = '#2a2a2a'
    ctx.lineWidth = 1
    for (let i = 0; i <= p.tracks.length; i++) {
      const y = RULER_H + i * TRACK_H
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Clips
    for (const clip of p.clips) {
      const trackIdx = p.tracks.findIndex((t) => t.id === clip.trackId)
      if (trackIdx === -1) continue

      const x = timeToX(clip.startTime, u.zoom, u.scrollLeft)
      const cw = clip.duration * u.zoom
      const y = RULER_H + trackIdx * TRACK_H + 2

      if (x + cw < 0 || x > w) continue // offscreen

      const trackType = p.tracks[trackIdx].type
      const baseColor = CLIP_COLORS[trackType] || CLIP_COLORS.video
      const isSelected = clip.id === u.selectedClipId

      // Clip body
      ctx.fillStyle = isSelected ? lightenColor(baseColor, 30) : baseColor
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.roundRect(x, y, Math.max(cw, 2), TRACK_H - 4, 3)
      ctx.fill()
      ctx.globalAlpha = 1

      // Selected border
      if (isSelected) {
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(x, y, Math.max(cw, 2), TRACK_H - 4, 3)
        ctx.stroke()
      }

      // Trim handles
      if (cw > HANDLE_W * 4) {
        ctx.fillStyle = isSelected ? '#fff' : 'rgba(255,255,255,0.4)'
        // Left handle
        ctx.fillRect(x + 1, y + 8, HANDLE_W - 2, TRACK_H - 20)
        // Right handle
        ctx.fillRect(x + cw - HANDLE_W + 1, y + 8, HANDLE_W - 2, TRACK_H - 20)
      }

      // Clip label
      if (cw > 40) {
        const media = p.mediaBin.find((m) => m.id === clip.mediaId)
        if (media) {
          ctx.fillStyle = '#fff'
          ctx.font = '10px -apple-system, sans-serif'
          ctx.textBaseline = 'middle'
          ctx.textAlign = 'left'
          ctx.save()
          ctx.beginPath()
          ctx.rect(x + HANDLE_W + 2, y, cw - HANDLE_W * 2 - 4, TRACK_H - 4)
          ctx.clip()
          ctx.fillText(media.name, x + HANDLE_W + 4, y + (TRACK_H - 4) / 2)
          ctx.restore()
        }
      }
    }

    // Playhead
    const phx = timeToX(u.playheadTime, u.zoom, u.scrollLeft)
    if (phx >= -10 && phx <= w + 10) {
      ctx.strokeStyle = '#ff4444'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(phx, 0)
      ctx.lineTo(phx, h)
      ctx.stroke()

      // Triangle head
      ctx.fillStyle = '#ff4444'
      ctx.beginPath()
      ctx.moveTo(phx - 6, 0)
      ctx.lineTo(phx + 6, 0)
      ctx.lineTo(phx, 8)
      ctx.closePath()
      ctx.fill()
    }
  }, [])

  // Resize observer
  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    const observer = new ResizeObserver(() => {
      dispatch({ type: 'SET_CANVAS_WIDTH', width: wrapper.clientWidth })
      draw()
    })
    observer.observe(wrapper)
    return () => observer.disconnect()
  }, [draw, dispatch])

  // Redraw on state change
  useEffect(() => {
    draw()
  }, [project, ui.zoom, ui.scrollLeft, ui.playheadTime, ui.selectedClipId, draw])

  // Playback rAF
  useEffect(() => {
    if (!ui.isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    let lastTime = performance.now()
    const tick = (now) => {
      const dt = (now - lastTime) / 1000
      lastTime = now
      const u = uiRef.current
      const newTime = u.playheadTime + dt
      dispatch({ type: 'SET_PLAYHEAD', time: newTime })
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [ui.isPlaying, dispatch])

  // Mouse handlers
  const handleMouseDown = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const mx = (e.clientX - rect.left)
    const my = (e.clientY - rect.top)
    const p = projectRef.current
    const u = uiRef.current

    const hit = hitTestClip(mx, my, p.clips, p.tracks, u.zoom, u.scrollLeft, RULER_H, TRACK_H)

    if (hit) {
      dispatch({ type: 'SELECT_CLIP', clipId: hit.clipId })
      // Also move playhead to click position so split/seek works
      const clickTime = Math.max(0, xToTime(mx, u.zoom, u.scrollLeft))
      dispatch({ type: 'SET_PLAYHEAD', time: clickTime })

      const clip = p.clips.find((c) => c.id === hit.clipId)
      if (!clip) return

      dragRef.current = {
        mode: hit.zone,
        clipId: hit.clipId,
        startMx: mx,
        origStartTime: clip.startTime,
        origInPoint: clip.inPoint,
        origOutPoint: clip.outPoint,
        origDuration: clip.duration,
        origTrackId: clip.trackId,
      }
    } else {
      // Click on ruler or empty area -> seek
      dispatch({ type: 'SELECT_CLIP', clipId: null })
      const time = Math.max(0, xToTime(mx, u.zoom, u.scrollLeft))
      dispatch({ type: 'SET_PLAYHEAD', time })
      dragRef.current = { mode: 'seek', startMx: mx }
    }
  }, [dispatch])

  const handleMouseMove = useCallback((e) => {
    if (!dragRef.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const drag = dragRef.current
    const p = projectRef.current
    const u = uiRef.current

    if (drag.mode === 'seek') {
      const time = Math.max(0, xToTime(mx, u.zoom, u.scrollLeft))
      dispatch({ type: 'SET_PLAYHEAD', time })
      return
    }

    const deltaPx = mx - drag.startMx
    const deltaTime = deltaPx / u.zoom

    if (drag.mode === 'body') {
      let newStart = drag.origStartTime + deltaTime
      newStart = snap(newStart, p.clips, u.playheadTime, u.zoom, drag.clipId)
      newStart = Math.max(0, newStart)

      // Determine track from Y position
      const my = e.clientY - rect.top
      let trackIdx = Math.floor((my - RULER_H) / TRACK_H)
      trackIdx = Math.max(0, Math.min(p.tracks.length - 1, trackIdx))
      const newTrackId = p.tracks[trackIdx].id

      dispatch(moveClip(drag.clipId, newStart, newTrackId))
    } else if (drag.mode === 'trimLeft') {
      const newInPoint = Math.max(0, drag.origInPoint + deltaTime * 1) // speed=1 for simplicity
      const clip = p.clips.find((c) => c.id === drag.clipId)
      if (!clip) return
      const maxIn = drag.origOutPoint - 0.05
      const clampedIn = Math.min(newInPoint, maxIn)
      const inDelta = clampedIn - drag.origInPoint
      dispatch(updateClip(drag.clipId, {
        inPoint: clampedIn,
        startTime: drag.origStartTime + inDelta / clip.speed,
        duration: (drag.origOutPoint - clampedIn) / clip.speed,
      }))
    } else if (drag.mode === 'trimRight') {
      const clip = p.clips.find((c) => c.id === drag.clipId)
      if (!clip) return
      const newOutPoint = Math.max(drag.origInPoint + 0.05, drag.origOutPoint + deltaTime * clip.speed)
      dispatch(updateClip(drag.clipId, {
        outPoint: newOutPoint,
        duration: (newOutPoint - clip.inPoint) / clip.speed,
      }))
    }
  }, [dispatch])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // Wheel: zoom or scroll
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const u = uiRef.current
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left

    if (e.ctrlKey || e.metaKey) {
      // Zoom toward cursor
      const timeBefore = xToTime(mx, u.zoom, u.scrollLeft)
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(10, Math.min(1000, u.zoom * factor))
      const newScroll = Math.max(0, timeBefore * newZoom - mx)
      dispatch({ type: 'SET_ZOOM', zoom: newZoom })
      dispatch({ type: 'SET_SCROLL', scrollLeft: newScroll })
    } else {
      // Horizontal scroll
      const newScroll = Math.max(0, u.scrollLeft + e.deltaX + e.deltaY)
      dispatch({ type: 'SET_SCROLL', scrollLeft: newScroll })
    }
  }, [dispatch])

  const zoomIn = () => {
    const u = uiRef.current
    dispatch({ type: 'SET_ZOOM', zoom: Math.min(1000, u.zoom * 1.25) })
  }
  const zoomOut = () => {
    const u = uiRef.current
    dispatch({ type: 'SET_ZOOM', zoom: Math.max(10, u.zoom / 1.25) })
  }

  const tlBtn = 'px-2 py-0.5 text-xs border-none rounded cursor-pointer text-gray-200 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-35 disabled:cursor-not-allowed'

  return (
    <div className="flex flex-col border-t border-neutral-700 bg-bacon-card overflow-hidden" style={{ gridArea: 'timeline' }}>
      <div className="flex items-center gap-1.5 px-2 py-1 bg-bacon-panel border-b border-bacon-border shrink-0">
        <button className={`${tlBtn} !bg-warn hover:!bg-warn-hover`} onClick={onSplit} disabled={!canSplit} title="Split clip(s) at playhead (S)">Split</button>
        <button className={`${tlBtn} !bg-danger hover:!bg-danger-hover`} onClick={onDelete} disabled={!canDelete} title="Delete selected clip (Del)">Delete</button>
        <button className={rippleDelete ? `${tlBtn} !bg-bacon-pink hover:!brightness-110` : tlBtn} onClick={onToggleRipple} title="Ripple: close gaps after delete">Ripple {rippleDelete ? 'ON' : 'OFF'}</button>
        <span className="w-px h-4 bg-neutral-600 shrink-0" />
        <button className={tlBtn} onClick={zoomOut}>-</button>
        <span className="text-[11px] text-gray-500 font-mono min-w-[42px] text-center">{Math.round(ui.zoom)}%</span>
        <button className={tlBtn} onClick={zoomIn}>+</button>
        <span className="text-neutral-600 text-[11px] ml-2">
          {formatTimecode(ui.playheadTime)}
        </span>
      </div>
      <div
        className="flex-1 overflow-hidden cursor-default relative"
        ref={wrapperRef}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="block w-full h-full" />
      </div>
    </div>
  )
}

// Utility: lighten a hex color
function lightenColor(hex, amt) {
  let r = parseInt(hex.slice(1, 3), 16)
  let g = parseInt(hex.slice(3, 5), 16)
  let b = parseInt(hex.slice(5, 7), 16)
  r = Math.min(255, r + amt)
  g = Math.min(255, g + amt)
  b = Math.min(255, b + amt)
  return `rgb(${r},${g},${b})`
}

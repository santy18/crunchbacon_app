export function formatTimecode(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '00:00.0'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(Math.floor(s)).padStart(2, '0')
  const f = String(Math.floor((s % 1) * 10))
  return `${mm}:${ss}.${f}`
}

export function timeToX(t, zoom, scrollLeft) {
  return t * zoom - scrollLeft
}

export function xToTime(x, zoom, scrollLeft) {
  return (x + scrollLeft) / zoom
}

// Adaptive tick intervals based on zoom level
function getTickInterval(zoom) {
  const targetPixels = 80
  const targetSeconds = targetPixels / zoom
  const intervals = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]
  for (const iv of intervals) {
    if (iv >= targetSeconds) return iv
  }
  return 600
}

export function drawTimeRuler(ctx, width, height, zoom, scrollLeft) {
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, width, height)

  const interval = getTickInterval(zoom)
  const startTime = Math.floor(xToTime(0, zoom, scrollLeft) / interval) * interval
  const endTime = xToTime(width, zoom, scrollLeft) + interval

  ctx.strokeStyle = '#444'
  ctx.fillStyle = '#888'
  ctx.font = '10px "SF Mono", Menlo, monospace'
  ctx.textBaseline = 'top'
  ctx.textAlign = 'center'

  for (let t = startTime; t <= endTime; t += interval) {
    if (t < 0) continue
    const x = timeToX(t, zoom, scrollLeft)
    if (x < -50 || x > width + 50) continue

    // Major tick
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(x, height - 8)
    ctx.lineTo(x, height)
    ctx.stroke()

    ctx.fillText(formatTimecode(t), x, 2)

    // Minor ticks
    const minorInterval = interval / 4
    for (let mt = t + minorInterval; mt < t + interval; mt += minorInterval) {
      const mx = timeToX(mt, zoom, scrollLeft)
      if (mx < 0 || mx > width) continue
      ctx.beginPath()
      ctx.moveTo(mx, height - 4)
      ctx.lineTo(mx, height)
      ctx.stroke()
    }
  }
}

const HANDLE_W = 6

export function hitTestClip(mx, my, clips, tracks, zoom, scrollLeft, rulerH, trackH) {
  // Iterate in reverse so topmost (last drawn) is hit first
  for (let i = clips.length - 1; i >= 0; i--) {
    const clip = clips[i]
    const trackIdx = tracks.findIndex((t) => t.id === clip.trackId)
    if (trackIdx === -1) continue

    const y = rulerH + trackIdx * trackH
    const x = timeToX(clip.startTime, zoom, scrollLeft)
    const w = clip.duration * zoom

    if (my >= y && my < y + trackH && mx >= x - 2 && mx <= x + w + 2) {
      // Determine zone: trimLeft, trimRight, or body
      if (mx <= x + HANDLE_W) return { clipId: clip.id, zone: 'trimLeft' }
      if (mx >= x + w - HANDLE_W) return { clipId: clip.id, zone: 'trimRight' }
      return { clipId: clip.id, zone: 'body' }
    }
  }
  return null
}

const SNAP_PX = 8

export function snap(time, clips, playheadTime, zoom, excludeClipId) {
  const threshold = SNAP_PX / zoom
  let best = time
  let bestDist = threshold

  // Snap to playhead
  const d0 = Math.abs(time - playheadTime)
  if (d0 < bestDist) {
    best = playheadTime
    bestDist = d0
  }

  // Snap to clip boundaries
  for (const clip of clips) {
    if (clip.id === excludeClipId) continue
    const starts = clip.startTime
    const ends = clip.startTime + clip.duration

    const d1 = Math.abs(time - starts)
    if (d1 < bestDist) { best = starts; bestDist = d1 }

    const d2 = Math.abs(time - ends)
    if (d2 < bestDist) { best = ends; bestDist = d2 }
  }

  // Snap to 0
  if (Math.abs(time) < threshold && time < bestDist) {
    best = 0
  }

  return best
}

import { useState, useEffect, useRef, useCallback } from 'react'

export default function WaveformEditor({ audioUrl }) {
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const sourceRef = useRef(null)
  const playheadRaf = useRef(null)
  const playStartTime = useRef(0)
  const playOffset = useRef(0)

  const [buffer, setBuffer] = useState(null)
  const [peaks, setPeaks] = useState(null)
  const [markers, setMarkers] = useState([])        // fractions 0–1
  const [selected, setSelected] = useState(null)     // index into segments array
  const [isPlaying, setIsPlaying] = useState(false)

  // Decode audio when URL changes
  useEffect(() => {
    if (!audioUrl) return
    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(audioUrl)
        const arrayBuf = await res.arrayBuffer()
        const ctx = new (window.AudioContext || window.webkitAudioContext)()
        const decoded = await ctx.decodeAudioData(arrayBuf)
        ctx.close()
        if (!cancelled) {
          setBuffer(decoded)
          setMarkers([])
          setSelected(null)
        }
      } catch (e) {
        console.error('Failed to decode audio:', e)
      }
    })()

    return () => { cancelled = true }
  }, [audioUrl])

  // Compute peaks when buffer or canvas size changes
  useEffect(() => {
    if (!buffer || !canvasRef.current) return
    const canvas = canvasRef.current
    const dpr = window.devicePixelRatio || 1
    const width = canvas.clientWidth
    const pxCount = Math.floor(width * dpr)
    const data = buffer.getChannelData(0)
    const step = Math.floor(data.length / pxCount) || 1
    const p = new Float32Array(pxCount)
    for (let i = 0; i < pxCount; i++) {
      let max = 0
      const start = i * step
      const end = Math.min(start + step, data.length)
      for (let j = start; j < end; j++) {
        const abs = Math.abs(data[j])
        if (abs > max) max = abs
      }
      p[i] = max
    }
    setPeaks(p)
  }, [buffer])

  // Draw waveform
  const draw = useCallback((playheadFrac) => {
    const canvas = canvasRef.current
    if (!canvas || !peaks) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#111'
    ctx.fillRect(0, 0, w, h)

    // Build segments array: [0, ...sortedMarkers, 1]
    const sorted = [...markers].sort((a, b) => a - b)
    const segs = [0, ...sorted, 1]

    // Highlight selected segment
    if (selected !== null && selected < segs.length - 1) {
      const x0 = segs[selected] * w
      const x1 = segs[selected + 1] * w
      ctx.fillStyle = 'rgba(255, 60, 60, 0.25)'
      ctx.fillRect(x0, 0, x1 - x0, h)
    }

    // Draw waveform bars
    const mid = h / 2
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * w
      const barH = peaks[i] * mid
      ctx.fillStyle = '#4af'
      ctx.fillRect(x, mid - barH, Math.max(1, w / peaks.length), barH * 2)
    }

    // Draw markers
    ctx.setLineDash([6, 4])
    ctx.lineWidth = 2
    for (const m of markers) {
      ctx.strokeStyle = '#ffcc00'
      ctx.beginPath()
      ctx.moveTo(m * w, 0)
      ctx.lineTo(m * w, h)
      ctx.stroke()
    }
    ctx.setLineDash([])

    // Draw playhead
    if (playheadFrac !== undefined && playheadFrac >= 0) {
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(playheadFrac * w, 0)
      ctx.lineTo(playheadFrac * w, h)
      ctx.stroke()
    }
  }, [peaks, markers, selected])

  // Redraw when state changes
  useEffect(() => { draw() }, [draw])

  // Canvas click handler
  const handleCanvasClick = (e) => {
    if (!buffer || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const frac = (e.clientX - rect.left) / rect.width

    if (e.shiftKey) {
      // Select segment
      const sorted = [...markers].sort((a, b) => a - b)
      const segs = [0, ...sorted, 1]
      for (let i = 0; i < segs.length - 1; i++) {
        if (frac >= segs[i] && frac < segs[i + 1]) {
          setSelected(i)
          return
        }
      }
    } else {
      // Place marker
      setMarkers((prev) => [...prev, frac])
      setSelected(null)
    }
  }

  // Delete selected segment
  const deleteSelection = () => {
    if (selected === null || !buffer) return
    const sorted = [...markers].sort((a, b) => a - b)
    const segs = [0, ...sorted, 1]
    const startFrac = segs[selected]
    const endFrac = segs[selected + 1]

    const sr = buffer.sampleRate
    const ch = buffer.numberOfChannels
    const startSamp = Math.floor(startFrac * buffer.length)
    const endSamp = Math.floor(endFrac * buffer.length)
    const removedLen = endSamp - startSamp
    const newLen = buffer.length - removedLen

    if (newLen <= 0) return

    const ctx = new OfflineAudioContext(ch, newLen, sr)
    const newBuf = ctx.createBuffer(ch, newLen, sr)
    for (let c = 0; c < ch; c++) {
      const oldData = buffer.getChannelData(c)
      const newData = newBuf.getChannelData(c)
      // Copy before selection
      for (let i = 0; i < startSamp; i++) newData[i] = oldData[i]
      // Copy after selection
      for (let i = endSamp; i < buffer.length; i++) newData[i - removedLen] = oldData[i]
    }

    // Shift markers that fall after the deleted region
    const removedFrac = endFrac - startFrac
    const newMarkers = []
    for (const m of sorted) {
      if (m <= startFrac) newMarkers.push(m)
      else if (m >= endFrac) newMarkers.push(m - removedFrac)
      // markers inside the deleted region are dropped
    }
    // Remove boundary markers at 0 or 1
    const filtered = newMarkers.filter((m) => m > 0.001 && m < 0.999)

    setBuffer(newBuf)
    setMarkers(filtered)
    setSelected(null)
  }

  // Play / Stop
  const play = () => {
    if (!buffer) return
    stop()

    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    audioCtxRef.current = ctx
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    sourceRef.current = src

    src.onended = () => {
      setIsPlaying(false)
      cancelAnimationFrame(playheadRaf.current)
      draw()
    }

    playStartTime.current = ctx.currentTime
    playOffset.current = 0
    src.start(0)
    setIsPlaying(true)

    const animate = () => {
      const elapsed = ctx.currentTime - playStartTime.current
      const frac = elapsed / buffer.duration
      if (frac <= 1) {
        draw(frac)
        playheadRaf.current = requestAnimationFrame(animate)
      }
    }
    playheadRaf.current = requestAnimationFrame(animate)
  }

  const stop = () => {
    if (sourceRef.current) {
      try { sourceRef.current.stop() } catch {}
      sourceRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close()
      audioCtxRef.current = null
    }
    cancelAnimationFrame(playheadRaf.current)
    setIsPlaying(false)
    draw()
  }

  // Export WAV
  const exportWav = () => {
    if (!buffer) return
    const numCh = buffer.numberOfChannels
    const sr = buffer.sampleRate
    const length = buffer.length
    const bytesPerSample = 2
    const dataSize = length * numCh * bytesPerSample
    const headerSize = 44
    const arrayBuf = new ArrayBuffer(headerSize + dataSize)
    const view = new DataView(arrayBuf)

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
    }

    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)           // PCM
    view.setUint16(22, numCh, true)
    view.setUint32(24, sr, true)
    view.setUint32(28, sr * numCh * bytesPerSample, true)
    view.setUint16(32, numCh * bytesPerSample, true)
    view.setUint16(34, bytesPerSample * 8, true)
    writeStr(36, 'data')
    view.setUint32(40, dataSize, true)

    // Interleave channels and convert float32 → int16
    const channels = []
    for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c))

    let offset = headerSize
    for (let i = 0; i < length; i++) {
      for (let c = 0; c < numCh; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]))
        const int16 = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
        view.setInt16(offset, int16, true)
        offset += 2
      }
    }

    const blob = new Blob([arrayBuf], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'edited.wav'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!buffer) return null

  return (
    <div className="waveform-editor" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="waveform-canvas"
        onClick={handleCanvasClick}
      />
      <p className="waveform-hint">Click to place markers. Shift+click between markers to select a segment.</p>
      <div className="waveform-controls">
        <button className="waveform-btn play" onClick={isPlaying ? stop : play}>
          {isPlaying ? 'Stop' : 'Play'}
        </button>
        <button
          className="waveform-btn delete"
          onClick={deleteSelection}
          disabled={selected === null}
        >
          Delete Selection
        </button>
        <button className="waveform-btn clear" onClick={() => { setMarkers([]); setSelected(null) }}>
          Clear Markers
        </button>
        <button className="waveform-btn export" onClick={exportWav}>
          Export WAV
        </button>
      </div>
    </div>
  )
}

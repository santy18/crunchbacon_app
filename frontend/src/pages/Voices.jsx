import { useCallback, useEffect, useRef, useState } from 'react'

const REFERENCE_PROMPT = `The rainbow is a division of white light into many beautiful colors. These take the shape of a long round arch, with its path high above, and its two ends apparently beyond the horizon. There is, according to legend, a boiling pot of gold at one end. People look, but no one ever finds it. When a man looks for something beyond his reach, his friends say he is looking for the pot of gold at the end of the rainbow. Throughout the centuries people have explained the rainbow in various ways. Some have accepted it as a miracle without physical explanation. To the Hebrews it was a token that there would be no more universal floods. The Greeks used to imagine that it was a sign from the gods to foretell war or heavy rain. The Norsemen considered the rainbow as a bridge over which the gods passed from earth to their home in the sky.`

export default function Voices() {
  const [voices, setVoices] = useState([])
  const [name, setName] = useState('')
  const [recording, setRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState([])
  const [wavBlob, setWavBlob] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const audioCtxRef = useRef(null)
  const workletRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const playbackRef = useRef(null)
  const sampleRateRef = useRef(48000)

  // ---- fetch voice list ----
  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch('/voices')
      if (res.ok) setVoices(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchVoices() }, [fetchVoices])

  // ---- delete voice ----
  const deleteVoice = async (vname) => {
    await fetch(`/voices/${encodeURIComponent(vname)}`, { method: 'DELETE' })
    fetchVoices()
  }

  // ---- recording ----
  const startRecording = async () => {
    setError('')
    setWavBlob(null)
    setAudioChunks([])
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const ctx = new AudioContext()
      audioCtxRef.current = ctx
      sampleRateRef.current = ctx.sampleRate
      await ctx.audioWorklet.addModule('/pcm-processor.js')
      const source = ctx.createMediaStreamSource(stream)
      sourceRef.current = source
      const worklet = new AudioWorkletNode(ctx, 'pcm-processor')
      workletRef.current = worklet

      const chunks = []
      worklet.port.onmessage = (e) => chunks.push(new Float32Array(e.data))
      setAudioChunks(chunks)

      source.connect(worklet)
      worklet.connect(ctx.destination)
      setRecording(true)
    } catch (err) {
      setError('Microphone access denied or unavailable.')
    }
  }

  const stopRecording = () => {
    setRecording(false)

    workletRef.current?.disconnect()
    sourceRef.current?.disconnect()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()

    // build WAV from collected chunks
    const chunks = audioChunks
    if (!chunks.length) return

    const totalLen = chunks.reduce((s, c) => s + c.length, 0)
    const pcm = new Float32Array(totalLen)
    let off = 0
    for (const c of chunks) { pcm.set(c, off); off += c.length }

    const blob = encodeWav(pcm, sampleRateRef.current)
    setWavBlob(blob)
    drawWaveform(pcm)
  }

  // ---- WAV encoding ----
  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)) }
    writeStr(0, 'RIFF')
    view.setUint32(4, 36 + samples.length * 2, true)
    writeStr(8, 'WAVE')
    writeStr(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeStr(36, 'data')
    view.setUint32(40, samples.length * 2, true)
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]))
      view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    }
    return new Blob([buffer], { type: 'audio/wav' })
  }

  // ---- waveform drawing ----
  function drawWaveform(pcm) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width = canvas.offsetWidth * 2
    const h = canvas.height = canvas.offsetHeight * 2
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#141414'
    ctx.fillRect(0, 0, w, h)

    const step = Math.ceil(pcm.length / w)
    ctx.strokeStyle = '#FF1E56'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let x = 0; x < w; x++) {
      let min = 1, max = -1
      for (let j = 0; j < step; j++) {
        const val = pcm[x * step + j] || 0
        if (val < min) min = val
        if (val > max) max = val
      }
      const y1 = ((1 + min) / 2) * h
      const y2 = ((1 + max) / 2) * h
      ctx.moveTo(x, y1)
      ctx.lineTo(x, y2)
    }
    ctx.stroke()
  }

  // ---- playback ----
  const playRecording = () => {
    if (!wavBlob) return
    if (playbackRef.current) { playbackRef.current.pause() }
    const url = URL.createObjectURL(wavBlob)
    const audio = new Audio(url)
    playbackRef.current = audio
    audio.play()
  }

  // ---- save ----
  const saveVoice = async () => {
    if (!name.trim() || !wavBlob) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('name', name.trim())
      fd.append('audio', wavBlob, `${name.trim()}.wav`)
      const res = await fetch('/voices/create', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      setName('')
      setWavBlob(null)
      setAudioChunks([])
      fetchVoices()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Voices</h1>

      {/* ---- Voice List ---- */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Saved Voices</h2>
        {voices.length === 0 ? (
          <p className="text-gray-500 text-[0.95rem]">No voices yet. Record one below.</p>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 mt-2.5">
            {voices.map((v) => (
              <div key={v} className="flex items-center justify-between px-4 py-3 bg-bacon-card border border-neutral-700 rounded-lg">
                <span className="font-semibold text-[0.95rem] overflow-hidden text-ellipsis whitespace-nowrap">{v}</span>
                <button
                  className="px-2.5 py-1 text-[0.8rem] bg-danger text-white border-none rounded cursor-pointer shrink-0 hover:bg-danger-hover"
                  onClick={() => deleteVoice(v)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Create Voice ---- */}
      <section className="mt-4">
        <h2 className="text-xl font-semibold mb-3">Create Voice</h2>
        <div className="flex flex-col gap-4 max-w-xl">
          <label className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
            Voice Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. narrator"
              className="px-3 py-2.5 rounded-md border border-neutral-600 bg-bacon-input text-white text-base focus:outline-none focus:border-bacon-pink"
            />
          </label>

          <div className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
            Reference Prompt <span className="font-normal text-gray-500">(read this aloud)</span>
          </div>
          <div className="max-h-40 overflow-y-auto p-3 px-4 bg-bacon-input border border-neutral-600 rounded-md text-[0.92rem] leading-relaxed text-white/85">
            {REFERENCE_PROMPT}
          </div>

          <div className="flex gap-2.5">
            {!recording ? (
              <button
                className="px-5 py-2.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-base hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={startRecording}
                disabled={!name.trim()}
              >
                Record
              </button>
            ) : (
              <button
                className="px-5 py-2.5 bg-danger text-white rounded-lg font-medium border-none cursor-pointer text-base hover:bg-danger-hover"
                onClick={stopRecording}
              >
                Stop
              </button>
            )}
          </div>

          {wavBlob && (
            <div className="flex flex-col gap-3">
              <canvas ref={canvasRef} className="w-full h-[100px] rounded-md border border-neutral-600 bg-bacon-input" />
              <div className="flex gap-2.5">
                <button
                  className="px-5 py-2.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-base hover:brightness-110"
                  onClick={playRecording}
                >
                  Play
                </button>
                <button
                  className="px-5 py-2.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-base hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={saveVoice}
                  disabled={saving || !name.trim()}
                >
                  {saving ? 'Saving\u2026' : 'Save Voice'}
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-400">{error}</p>}
        </div>
      </section>
    </div>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'

export default function Transcriptions() {
  const [transcriptions, setTranscriptions] = useState([])
  const [recording, setRecording] = useState(false)
  const [audioChunks, setAudioChunks] = useState([])
  const [wavBlob, setWavBlob] = useState(null)
  const [transcribing, setTranscribing] = useState(false)
  const [lastResult, setLastResult] = useState('')
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [playingId, setPlayingId] = useState(null)

  const audioCtxRef = useRef(null)
  const workletRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const playbackRef = useRef(null)
  const sampleRateRef = useRef(48000)

  // ---- fetch transcription list ----
  const fetchTranscriptions = useCallback(async () => {
    try {
      const res = await fetch('/transcriptions')
      if (res.ok) setTranscriptions(await res.json())
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchTranscriptions() }, [fetchTranscriptions])

  // ---- fetch voice list ----
  const fetchVoices = useCallback(async () => {
    try {
      const res = await fetch('/voices')
      if (res.ok) {
        const list = await res.json()
        setVoices(list)
        if (list.length && !selectedVoice) setSelectedVoice(list[0])
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchVoices() }, [fetchVoices])

  // ---- delete transcription ----
  const deleteTranscription = async (id) => {
    await fetch(`/transcriptions/${id}`, { method: 'DELETE' })
    fetchTranscriptions()
  }

  // ---- edit transcription ----
  const startEditing = (t) => {
    setEditingId(t.id)
    setEditText(t.text)
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditText('')
  }

  const saveEdit = async (id) => {
    try {
      const res = await fetch(`/transcriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: editText }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEditingId(null)
      setEditText('')
      fetchTranscriptions()
    } catch (err) {
      setError(err.message)
    }
  }

  // ---- play transcription with TTS ----
  const playTranscription = async (t) => {
    if (!selectedVoice) { setError('Select a voice first.'); return }
    if (playbackRef.current) { playbackRef.current.pause() }
    setPlayingId(t.id)
    setError('')
    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t.text, voice: selectedVoice }),
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      playbackRef.current = audio
      audio.onended = () => setPlayingId(null)
      audio.play()
    } catch (err) {
      setError(err.message)
      setPlayingId(null)
    }
  }

  // ---- recording ----
  const startRecording = async () => {
    setError('')
    setWavBlob(null)
    setAudioChunks([])
    setLastResult('')
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
    } catch {
      setError('Microphone access denied or unavailable.')
    }
  }

  const stopRecording = () => {
    setRecording(false)

    workletRef.current?.disconnect()
    sourceRef.current?.disconnect()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close()

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

  // ---- transcribe & save ----
  const transcribeAndSave = async () => {
    if (!wavBlob) return
    setTranscribing(true)
    setError('')
    setLastResult('')
    try {
      const fd = new FormData()
      fd.append('audio', wavBlob, 'recording.wav')
      const res = await fetch('/transcriptions/create', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setLastResult(data.text)
      setWavBlob(null)
      setAudioChunks([])
      fetchTranscriptions()
    } catch (err) {
      setError(err.message)
    } finally {
      setTranscribing(false)
    }
  }

  // ---- format date ----
  const fmtDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">Transcriptions</h1>

      {/* ---- Transcription List ---- */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Saved Transcriptions</h2>
        <div className="my-2.5 max-w-[250px]">
          <label className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
            Voice
            <select
              value={selectedVoice}
              onChange={(e) => setSelectedVoice(e.target.value)}
              className="px-3 py-2.5 rounded-md border border-neutral-600 bg-bacon-input text-white text-base focus:outline-none focus:border-bacon-pink"
            >
              {voices.length === 0 && <option value="">No voices available</option>}
              {voices.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </label>
        </div>
        {transcriptions.length === 0 ? (
          <p className="text-gray-500 text-[0.95rem]">No transcriptions yet. Record one below.</p>
        ) : (
          <div className="flex flex-col gap-2 mt-2.5">
            {transcriptions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3 bg-bacon-card border border-neutral-700 rounded-lg">
                {editingId === t.id ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <textarea
                      className="w-full px-3 py-2.5 rounded-md border border-bacon-pink bg-bacon-input text-white text-[0.92rem] leading-relaxed resize-y focus:outline-none"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        className="px-3 py-1.5 bg-bacon-pink text-white rounded-md font-medium border-none cursor-pointer text-[0.85rem] hover:brightness-110"
                        onClick={() => saveEdit(t.id)}
                      >
                        Save
                      </button>
                      <button
                        className="px-2.5 py-1 text-[0.8rem] bg-danger text-white border-none rounded cursor-pointer hover:bg-danger-hover"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 text-[0.92rem] leading-snug overflow-hidden text-ellipsis whitespace-nowrap">
                      {t.text.length > 120 ? t.text.slice(0, 120) + '...' : t.text}
                    </div>
                    <span className="text-[0.8rem] text-gray-500 whitespace-nowrap shrink-0">{fmtDate(t.created_at)}</span>
                    <button
                      className="px-2.5 py-1 text-[0.8rem] bg-success text-white border-none rounded cursor-pointer shrink-0 hover:bg-success-hover disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => playTranscription(t)}
                      disabled={!selectedVoice || playingId === t.id}
                    >
                      {playingId === t.id ? 'Playing...' : 'Play'}
                    </button>
                    <button
                      className="px-2.5 py-1 text-[0.8rem] bg-bacon-pink text-white border-none rounded cursor-pointer shrink-0 hover:brightness-110"
                      onClick={() => startEditing(t)}
                    >
                      Edit
                    </button>
                    <button
                      className="px-2.5 py-1 text-[0.8rem] bg-danger text-white border-none rounded cursor-pointer shrink-0 hover:bg-danger-hover"
                      onClick={() => deleteTranscription(t.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- Record & Transcribe ---- */}
      <section className="mt-4">
        <h2 className="text-xl font-semibold mb-3">Record & Transcribe</h2>
        <div className="flex flex-col gap-4 max-w-xl">
          <div className="flex gap-2.5">
            {!recording ? (
              <button
                className="px-5 py-2.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-base hover:brightness-110"
                onClick={startRecording}
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
                  onClick={transcribeAndSave}
                  disabled={transcribing}
                >
                  {transcribing ? 'Transcribing...' : 'Transcribe & Save'}
                </button>
              </div>
            </div>
          )}

          {lastResult && (
            <div className="mt-2">
              <h3 className="mb-1.5 text-base font-semibold">Transcription Result</h3>
              <div className="p-3 px-4 bg-bacon-input border border-neutral-600 rounded-md text-[0.92rem] leading-relaxed text-white/85">
                {lastResult}
              </div>
            </div>
          )}

          {error && <p className="text-red-400">{error}</p>}
        </div>
      </section>
    </div>
  )
}

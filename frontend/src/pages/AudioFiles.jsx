import { useCallback, useEffect, useRef, useState } from 'react'

export default function AudioFiles() {
  const [files, setFiles] = useState([])
  const [error, setError] = useState('')
  const [playingId, setPlayingId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editText, setEditText] = useState('')

  // TTS
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [ttsText, setTtsText] = useState('')
  const [refText, setRefText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [ttsBlob, setTtsBlob] = useState(null)
  const [ttsUrl, setTtsUrl] = useState(null)
  const [ttsSaving, setTtsSaving] = useState(false)
  const [ttsName, setTtsName] = useState('')

  // Upload
  const [uploadName, setUploadName] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  // Recording
  const [recording, setRecording] = useState(false)
  const [wavBlob, setWavBlob] = useState(null)
  const [recordName, setRecordName] = useState('')
  const [saving, setSaving] = useState(false)
  const [audioChunks, setAudioChunks] = useState([])

  // Active tab
  const [activeTab, setActiveTab] = useState('generate')

  const playbackRef = useRef(null)
  const audioCtxRef = useRef(null)
  const workletRef = useRef(null)
  const sourceRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const sampleRateRef = useRef(48000)
  const fileInputRef = useRef(null)

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch('/audio-library')
      if (res.ok) setFiles(await res.json())
    } catch { /* ignore */ }
  }, [])

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

  useEffect(() => { fetchFiles() }, [fetchFiles])
  useEffect(() => { fetchVoices() }, [fetchVoices])

  // ---- play audio from library ----
  const playAudio = async (f) => {
    if (playbackRef.current) { playbackRef.current.pause() }
    setPlayingId(f.id)
    setError('')
    try {
      const res = await fetch(`/audio-library/${f.id}/file`)
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

  // ---- delete ----
  const deleteFile = async (id) => {
    await fetch(`/audio-library/${id}`, { method: 'DELETE' })
    fetchFiles()
  }

  // ---- edit ----
  const startEditing = (f) => {
    setEditingId(f.id)
    setEditName(f.name)
    setEditText(f.text || '')
  }

  const cancelEditing = () => {
    setEditingId(null)
    setEditName('')
    setEditText('')
  }

  const saveEdit = async (id) => {
    try {
      const res = await fetch(`/audio-library/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, text: editText }),
      })
      if (!res.ok) throw new Error(await res.text())
      setEditingId(null)
      setEditName('')
      setEditText('')
      fetchFiles()
    } catch (err) {
      setError(err.message)
    }
  }

  // ---- TTS generate ----
  const handleGenerate = async () => {
    if (!ttsText.trim() || !selectedVoice) return
    setGenerating(true)
    setError('')
    if (ttsUrl) { URL.revokeObjectURL(ttsUrl); setTtsUrl(null) }
    setTtsBlob(null)
    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ttsText.trim(),
          voice: selectedVoice,
          ref_text: refText.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Server error ${res.status}`)
      }
      const blob = await res.blob()
      setTtsBlob(blob)
      setTtsUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const handleSaveTts = async () => {
    if (!ttsBlob) return
    setTtsSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('audio', ttsBlob, 'audio.wav')
      fd.append('name', ttsName.trim() || `TTS ${new Date().toLocaleString()}`)
      if (ttsText.trim()) fd.append('text', ttsText.trim())
      if (selectedVoice) fd.append('voice_name', selectedVoice)
      const res = await fetch('/audio-library', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Failed to save')
      setTtsBlob(null)
      if (ttsUrl) URL.revokeObjectURL(ttsUrl)
      setTtsUrl(null)
      setTtsName('')
      setTtsText('')
      setRefText('')
      fetchFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setTtsSaving(false)
    }
  }

  // ---- upload ----
  const handleUpload = async (e) => {
    e.preventDefault()
    if (!uploadFile || !uploadName.trim()) return
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('audio', uploadFile)
      fd.append('name', uploadName.trim())
      const res = await fetch('/audio-library', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      setUploadName('')
      setUploadFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
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

  const playRecording = () => {
    if (!wavBlob) return
    if (playbackRef.current) { playbackRef.current.pause() }
    const url = URL.createObjectURL(wavBlob)
    const audio = new Audio(url)
    playbackRef.current = audio
    audio.play()
  }

  const saveRecording = async () => {
    if (!wavBlob || !recordName.trim()) return
    setSaving(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('audio', wavBlob, 'recording.wav')
      fd.append('name', recordName.trim())
      const res = await fetch('/audio-library', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      setWavBlob(null)
      setRecordName('')
      setAudioChunks([])
      fetchFiles()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const fmtDate = (iso) => {
    const d = new Date(iso)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const fmtDuration = (sec) => {
    if (sec == null) return ''
    const m = Math.floor(sec / 60)
    const s = Math.round(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="max-w-[860px] flex flex-col gap-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-[1.8rem] font-bold m-0 tracking-tight">Audio Files</h1>
        <span className="text-[0.85rem] text-white/35 font-medium">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-400 text-[0.9rem]">
          {error}
        </div>
      )}

      {/* ---- Create Section ---- */}
      <div className="bg-bacon-card border border-bacon-border rounded-[14px] overflow-hidden">
        <div className="flex border-b border-bacon-border">
          {['generate', 'record', 'upload'].map((tab) => (
            <button
              key={tab}
              className={`flex-1 px-4 py-3 text-[0.9rem] font-medium border-none cursor-pointer transition-colors relative ${
                activeTab === tab
                  ? 'text-white bg-bacon-pink/[0.08]'
                  : 'text-white/45 bg-transparent hover:text-white/70 hover:bg-white/[0.03]'
              }`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {activeTab === tab && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-bacon-pink" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ---- Generate Tab ---- */}
          {activeTab === 'generate' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">Name</label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] focus:outline-none focus:border-bacon-pink transition-colors"
                  type="text"
                  value={ttsName}
                  onChange={(e) => setTtsName(e.target.value)}
                  placeholder="Name for this audio file"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">Voice</label>
                <select
                  className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] focus:outline-none focus:border-bacon-pink transition-colors"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                >
                  {voices.length === 0 && <option value="">No voices available</option>}
                  {voices.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">Text to speak</label>
                <textarea
                  className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] resize-y focus:outline-none focus:border-bacon-pink transition-colors"
                  rows={4}
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Enter the text you want to generate speech for..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">
                  Reference text <span className="font-normal normal-case text-white/25 tracking-normal ml-1.5 text-[0.78rem]">optional</span>
                </label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] focus:outline-none focus:border-bacon-pink transition-colors"
                  type="text"
                  value={refText}
                  onChange={(e) => setRefText(e.target.value)}
                  placeholder="Transcript of the reference audio"
                />
              </div>
              <button
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-bacon-pink text-white hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed"
                onClick={handleGenerate}
                disabled={generating || !ttsText.trim() || !selectedVoice}
              >
                {generating ? 'Generating...' : 'Generate Audio'}
              </button>

              {ttsUrl && (
                <div className="flex flex-col gap-2.5 pt-2">
                  <audio src={ttsUrl} controls className="w-full rounded-lg h-10" />
                  <button
                    className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-success text-white hover:bg-success-hover disabled:opacity-45 disabled:cursor-not-allowed"
                    onClick={handleSaveTts}
                    disabled={ttsSaving}
                  >
                    {ttsSaving ? 'Saving...' : 'Save to Library'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---- Record Tab ---- */}
          {activeTab === 'record' && (
            <div className="flex flex-col gap-4">
              <div className="flex justify-center py-4">
                {!recording ? (
                  <button
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3 text-[0.95rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-danger text-white hover:brightness-110"
                    onClick={startRecording}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                    Record
                  </button>
                ) : (
                  <button
                    className="inline-flex items-center justify-center gap-1.5 px-6 py-3 text-[0.95rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-neutral-600 text-white hover:bg-neutral-500"
                    onClick={stopRecording}
                  >
                    <span className="w-2.5 h-2.5 rounded-sm bg-red-400" />
                    Stop Recording
                  </button>
                )}
              </div>

              {wavBlob && (
                <div className="flex flex-col gap-3">
                  <canvas ref={canvasRef} className="w-full h-20 rounded-lg border border-neutral-700 bg-bacon-input" />
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">Name</label>
                    <input
                      className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] focus:outline-none focus:border-bacon-pink transition-colors"
                      type="text"
                      placeholder="Name for this recording"
                      value={recordName}
                      onChange={(e) => setRecordName(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-neutral-700 text-white hover:bg-neutral-600"
                      onClick={playRecording}
                    >
                      Play
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-success text-white hover:bg-success-hover disabled:opacity-45 disabled:cursor-not-allowed"
                      onClick={saveRecording}
                      disabled={saving || !recordName.trim()}
                    >
                      {saving ? 'Saving...' : 'Save to Library'}
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-transparent text-white/50 border border-neutral-700 hover:bg-white/[0.05] hover:text-white/80"
                      onClick={() => { setWavBlob(null); setRecordName(''); setAudioChunks([]) }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---- Upload Tab ---- */}
          {activeTab === 'upload' && (
            <form className="flex flex-col gap-4" onSubmit={handleUpload}>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">Name</label>
                <input
                  className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] focus:outline-none focus:border-bacon-pink transition-colors"
                  type="text"
                  placeholder="Name for uploaded file"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[0.82rem] font-semibold text-white/55 uppercase tracking-wide">Audio file</label>
                <div className="relative border-2 border-dashed border-neutral-700 rounded-xl p-6 text-center cursor-pointer transition-colors hover:border-bacon-pink hover:bg-bacon-pink/[0.04]">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <div className="text-[0.9rem] text-white/40 pointer-events-none">
                    {uploadFile ? uploadFile.name : 'Choose a file or drag it here'}
                  </div>
                </div>
              </div>
              <button
                className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-bacon-pink text-white hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed"
                type="submit"
                disabled={uploading || !uploadFile || !uploadName.trim()}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* ---- File List ---- */}
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold m-0 text-white/70">Library</h2>
      </div>
      {files.length === 0 ? (
        <div className="text-center py-10 px-4 text-white/30 text-[0.9rem] bg-bacon-card border border-bacon-border rounded-[14px]">
          No audio files yet. Generate, record, or upload one above.
        </div>
      ) : (
        <div className="flex flex-col gap-px bg-bacon-border border border-bacon-border rounded-[14px] overflow-hidden">
          {files.map((f) => (
            <div
              key={f.id}
              className={`group flex items-center gap-3 px-4 py-3 bg-bacon-card transition-colors hover:bg-[#232323] ${
                playingId === f.id ? 'bg-bacon-pink/[0.06]' : ''
              }`}
            >
              {editingId === f.id ? (
                <div className="flex-1 flex flex-col gap-2">
                  <input
                    className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] focus:outline-none focus:border-bacon-pink transition-colors"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                  />
                  <textarea
                    className="px-3 py-2.5 rounded-lg border border-neutral-700 bg-bacon-input text-white text-[0.92rem] resize-y focus:outline-none focus:border-bacon-pink transition-colors"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    placeholder="Text"
                  />
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium border-none rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-success text-white hover:bg-success-hover"
                      onClick={() => saveEdit(f.id)}
                    >
                      Save
                    </button>
                    <button
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 text-[0.9rem] font-medium rounded-lg cursor-pointer transition-all active:scale-[0.97] bg-transparent text-white/50 border border-neutral-700 hover:bg-white/[0.05] hover:text-white/80"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="w-9 h-9 rounded-full bg-bacon-pink/15 border-none text-bacon-pink flex items-center justify-center cursor-pointer shrink-0 transition-all p-0 hover:bg-bacon-pink/30 hover:scale-105 disabled:cursor-default"
                    onClick={() => playAudio(f)}
                    disabled={playingId === f.id}
                    title="Play"
                  >
                    {playingId === f.id ? (
                      <span className="af-playing-bars flex items-end gap-0.5 h-3.5">
                        <span className="w-[3px] bg-bacon-pink rounded-sm" />
                        <span className="w-[3px] bg-bacon-pink rounded-sm" />
                        <span className="w-[3px] bg-bacon-pink rounded-sm" />
                      </span>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2.5v11l9-5.5z" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="text-[0.92rem] font-semibold text-white overflow-hidden text-ellipsis whitespace-nowrap">{f.name}</div>
                    <div className="flex items-center gap-2 text-[0.78rem] text-white/35">
                      {f.voice_name && (
                        <span className="inline-block px-1.5 py-0.5 bg-bacon-pink/[0.12] text-[#FF6B8A] rounded text-[0.72rem] font-medium">
                          {f.voice_name}
                        </span>
                      )}
                      {f.duration != null && <span>{fmtDuration(f.duration)}</span>}
                      <span>{fmtDate(f.created_at)}</span>
                    </div>
                    {f.text && (
                      <div className="text-[0.82rem] text-white/40 leading-snug mt-0.5">
                        {f.text.length > 100 ? f.text.slice(0, 100) + '...' : f.text}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      className="w-[30px] h-[30px] rounded-md border-none bg-transparent text-white/40 flex items-center justify-center cursor-pointer p-0 transition-colors hover:bg-white/[0.08] hover:text-white/80"
                      onClick={() => startEditing(f)}
                      title="Edit"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M10.586.586a2 2 0 012.828 2.828l-8.5 8.5L1 13l1.086-3.914 8.5-8.5z" />
                      </svg>
                    </button>
                    <button
                      className="w-[30px] h-[30px] rounded-md border-none bg-transparent text-white/40 flex items-center justify-center cursor-pointer p-0 transition-colors hover:bg-red-500/[0.12] hover:text-red-400"
                      onClick={() => deleteFile(f.id)}
                      title="Delete"
                    >
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M5 0v1H1v2h12V1H9V0H5zM2 4v9a1 1 0 001 1h8a1 1 0 001-1V4H2z" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

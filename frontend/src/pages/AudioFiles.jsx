import { useCallback, useEffect, useRef, useState } from 'react'
import './AudioFiles.css'

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
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, w, h)
    const step = Math.ceil(pcm.length / w)
    ctx.strokeStyle = '#646cff'
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
    <div className="af-page">
      <div className="af-header">
        <h1 className="af-title">Audio Files</h1>
        <span className="af-count">{files.length} file{files.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <div className="af-error">{error}</div>}

      {/* ---- Create Section ---- */}
      <div className="af-card">
        <div className="af-tabs">
          <button
            className={`af-tab ${activeTab === 'generate' ? 'active' : ''}`}
            onClick={() => setActiveTab('generate')}
          >
            Generate
          </button>
          <button
            className={`af-tab ${activeTab === 'record' ? 'active' : ''}`}
            onClick={() => setActiveTab('record')}
          >
            Record
          </button>
          <button
            className={`af-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            Upload
          </button>
        </div>

        <div className="af-tab-content">
          {/* ---- Generate Tab ---- */}
          {activeTab === 'generate' && (
            <div className="af-form">
              <div className="af-field">
                <label className="af-label">Name</label>
                <input
                  className="af-input"
                  type="text"
                  value={ttsName}
                  onChange={(e) => setTtsName(e.target.value)}
                  placeholder="Name for this audio file"
                />
              </div>
              <div className="af-field">
                <label className="af-label">Voice</label>
                <select
                  className="af-select"
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                >
                  {voices.length === 0 && <option value="">No voices available</option>}
                  {voices.map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div className="af-field">
                <label className="af-label">Text to speak</label>
                <textarea
                  className="af-textarea"
                  rows={4}
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  placeholder="Enter the text you want to generate speech for..."
                />
              </div>
              <div className="af-field">
                <label className="af-label">
                  Reference text <span className="af-optional">optional</span>
                </label>
                <input
                  className="af-input"
                  type="text"
                  value={refText}
                  onChange={(e) => setRefText(e.target.value)}
                  placeholder="Transcript of the reference audio"
                />
              </div>
              <button
                className="af-btn af-btn-primary"
                onClick={handleGenerate}
                disabled={generating || !ttsText.trim() || !selectedVoice}
              >
                {generating ? 'Generating...' : 'Generate Audio'}
              </button>

              {ttsUrl && (
                <div className="af-preview-result">
                  <audio src={ttsUrl} controls className="af-audio-player" />
                  <button
                    className="af-btn af-btn-save"
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
            <div className="af-form">
              <div className="af-record-area">
                {!recording ? (
                  <button className="af-btn af-btn-record" onClick={startRecording}>
                    <span className="af-record-dot" />
                    Record
                  </button>
                ) : (
                  <button className="af-btn af-btn-stop" onClick={stopRecording}>
                    <span className="af-stop-icon" />
                    Stop Recording
                  </button>
                )}
              </div>

              {wavBlob && (
                <div className="af-recording-preview">
                  <canvas ref={canvasRef} className="af-waveform" />
                  <div className="af-field">
                    <label className="af-label">Name</label>
                    <input
                      className="af-input"
                      type="text"
                      placeholder="Name for this recording"
                      value={recordName}
                      onChange={(e) => setRecordName(e.target.value)}
                    />
                  </div>
                  <div className="af-btn-row">
                    <button className="af-btn af-btn-secondary" onClick={playRecording}>Play</button>
                    <button
                      className="af-btn af-btn-save"
                      onClick={saveRecording}
                      disabled={saving || !recordName.trim()}
                    >
                      {saving ? 'Saving...' : 'Save to Library'}
                    </button>
                    <button
                      className="af-btn af-btn-ghost"
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
            <form className="af-form" onSubmit={handleUpload}>
              <div className="af-field">
                <label className="af-label">Name</label>
                <input
                  className="af-input"
                  type="text"
                  placeholder="Name for uploaded file"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
              </div>
              <div className="af-field">
                <label className="af-label">Audio file</label>
                <div className="af-file-drop">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setUploadFile(e.target.files[0] || null)}
                    className="af-file-input"
                  />
                  <div className="af-file-label">
                    {uploadFile ? uploadFile.name : 'Choose a file or drag it here'}
                  </div>
                </div>
              </div>
              <button
                className="af-btn af-btn-primary"
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
      <div className="af-list-header">
        <h2 className="af-list-title">Library</h2>
      </div>
      {files.length === 0 ? (
        <div className="af-empty">No audio files yet. Generate, record, or upload one above.</div>
      ) : (
        <div className="af-list">
          {files.map((f) => (
            <div key={f.id} className={`af-item ${playingId === f.id ? 'playing' : ''}`}>
              {editingId === f.id ? (
                <div className="af-item-edit">
                  <input
                    className="af-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Name"
                  />
                  <textarea
                    className="af-textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={2}
                    placeholder="Text"
                  />
                  <div className="af-btn-row">
                    <button className="af-btn af-btn-save" onClick={() => saveEdit(f.id)}>Save</button>
                    <button className="af-btn af-btn-ghost" onClick={cancelEditing}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className="af-play-circle"
                    onClick={() => playAudio(f)}
                    disabled={playingId === f.id}
                    title="Play"
                  >
                    {playingId === f.id ? (
                      <span className="af-playing-bars">
                        <span /><span /><span />
                      </span>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M4 2.5v11l9-5.5z" />
                      </svg>
                    )}
                  </button>
                  <div className="af-item-info">
                    <div className="af-item-name">{f.name}</div>
                    <div className="af-item-meta">
                      {f.voice_name && <span className="af-tag">{f.voice_name}</span>}
                      {f.duration != null && <span>{fmtDuration(f.duration)}</span>}
                      <span>{fmtDate(f.created_at)}</span>
                    </div>
                    {f.text && <div className="af-item-text">{f.text.length > 100 ? f.text.slice(0, 100) + '...' : f.text}</div>}
                  </div>
                  <div className="af-item-actions">
                    <button className="af-btn-icon" onClick={() => startEditing(f)} title="Edit">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
                        <path d="M10.586.586a2 2 0 012.828 2.828l-8.5 8.5L1 13l1.086-3.914 8.5-8.5z" />
                      </svg>
                    </button>
                    <button className="af-btn-icon af-btn-icon-danger" onClick={() => deleteFile(f.id)} title="Delete">
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

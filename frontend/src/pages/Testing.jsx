import { useState, useEffect } from 'react'
import WaveformEditor from '../WaveformEditor'
import VideoEditor from '../VideoEditor'
import Editor from '../editor/Editor'

export default function Testing() {
  const [editorOpen, setEditorOpen] = useState(false)
  const [text, setText] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [refText, setRefText] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/voices')
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('Unexpected response')
        setVoices(data)
        if (data.length > 0) setSelectedVoice(data[0])
      })
      .catch(() => setError('Failed to load voices'))
  }, [])

  const handleGenerate = async () => {
    if (!text.trim() || !selectedVoice) return

    setLoading(true)
    setError(null)
    if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null) }

    try {
      const res = await fetch('/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: text.trim(),
          voice: selectedVoice,
          ref_text: refText.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        throw new Error(detail?.detail || `Server error ${res.status}`)
      }

      const blob = await res.blob()
      setAudioUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {editorOpen && <Editor onClose={() => setEditorOpen(false)} />}
      <div className="container">
        <h1>Testing</h1>
        <button className="generate-btn" onClick={() => setEditorOpen(true)} style={{ background: '#2ea043' }}>
          Open Video Editor
        </button>

        <label>
          Voice
          <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)}>
            {voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label>
          Text to speak
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the text you want to generate speech for..."
          />
        </label>

        <label>
          Reference text <span className="optional">(optional)</span>
          <input
            type="text"
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            placeholder="Transcript of the reference audio"
          />
        </label>

        <label>
          Video <span className="optional">(optional — attach for voiceover)</span>
          <div className="file-row">
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              onChange={(e) => setVideoFile(e.target.files[0] || null)}
            />
            {videoFile && (
              <button
                className="remove-btn"
                onClick={() => {
                  setVideoFile(null)
                  const input = document.querySelector('input[type="file"]')
                  if (input) input.value = ''
                }}
              >
                Remove
              </button>
            )}
          </div>
        </label>

        <button
          className="generate-btn"
          onClick={handleGenerate}
          disabled={loading || !text.trim() || !selectedVoice}
        >
          {loading ? 'Generating...' : 'Generate Audio'}
        </button>

        {error && <p className="error">{error}</p>}

        {videoFile ? (
          <div className="result">
            <VideoEditor videoFile={videoFile} audioUrl={audioUrl} />
          </div>
        ) : audioUrl ? (
          <div className="result">
            <WaveformEditor audioUrl={audioUrl} />
          </div>
        ) : null}
      </div>
    </>
  )
}

import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [text, setText] = useState('')
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [refText, setRefText] = useState('')
  const [videoFile, setVideoFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const [videoUrl, setVideoUrl] = useState(null)
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
    if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }

    try {
      if (videoFile) {
        const formData = new FormData()
        formData.append('video', videoFile)
        formData.append('text', text.trim())
        formData.append('voice', selectedVoice)
        if (refText.trim()) formData.append('ref_text', refText.trim())

        const res = await fetch('/generate-voiceover', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const detail = await res.json().catch(() => null)
          throw new Error(detail?.detail || `Server error ${res.status}`)
        }

        const blob = await res.blob()
        setVideoUrl(URL.createObjectURL(blob))
      } else {
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
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = (url, filename) => {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
  }

  return (
    <div className="container">
      <h1>Qwen3 TTS</h1>

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
            onChange={(e) => {
              setVideoFile(e.target.files[0] || null)
              if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }
            }}
          />
          {videoFile && (
            <button
              className="remove-btn"
              onClick={() => {
                setVideoFile(null)
                if (videoUrl) { URL.revokeObjectURL(videoUrl); setVideoUrl(null) }
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
        {loading ? 'Generating...' : videoFile ? 'Generate Voiceover' : 'Generate Audio'}
      </button>

      {error && <p className="error">{error}</p>}

      {audioUrl && (
        <div className="result">
          <audio controls src={audioUrl} />
          <button className="download-btn" onClick={() => handleDownload(audioUrl, 'output.wav')}>
            Download WAV
          </button>
        </div>
      )}

      {videoUrl && (
        <div className="result">
          <video controls src={videoUrl} />
          <button className="download-btn" onClick={() => handleDownload(videoUrl, 'voiceover.mp4')}>
            Download Video
          </button>
        </div>
      )}
    </div>
  )
}

export default App

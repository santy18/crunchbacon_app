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
  const [audioBlob, setAudioBlob] = useState(null)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

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
    setAudioBlob(null)
    setSaveMsg(null)

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
      setAudioBlob(blob)
      setAudioUrl(URL.createObjectURL(blob))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveToLibrary = async () => {
    if (!audioBlob) return
    setSaving(true)
    setSaveMsg(null)
    try {
      const fd = new FormData()
      fd.append('audio', audioBlob, 'audio.wav')
      fd.append('name', `TTS ${new Date().toLocaleString()}`)
      if (text.trim()) fd.append('text', text.trim())
      if (selectedVoice) fd.append('voice_name', selectedVoice)
      const res = await fetch('/audio-library', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Failed to save')
      setSaveMsg('Saved to library!')
    } catch {
      setSaveMsg('Error saving to library')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {editorOpen && <Editor onClose={() => setEditorOpen(false)} />}
      <div className="max-w-xl flex flex-col gap-4">
        <h1 className="text-3xl font-bold mb-2">Testing</h1>
        <button
          className="px-5 py-2.5 bg-success text-white rounded-lg font-medium border-none cursor-pointer text-base hover:bg-success-hover"
          onClick={() => setEditorOpen(true)}
        >
          Open Video Editor
        </button>

        <label className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
          Voice
          <select
            value={selectedVoice}
            onChange={(e) => setSelectedVoice(e.target.value)}
            className="px-3 py-2.5 rounded-md border border-neutral-600 bg-bacon-input text-white text-base focus:outline-none focus:border-bacon-pink"
          >
            {voices.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
          Text to speak
          <textarea
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter the text you want to generate speech for..."
            className="px-3 py-2.5 rounded-md border border-neutral-600 bg-bacon-input text-white text-base resize-y focus:outline-none focus:border-bacon-pink"
          />
        </label>

        <label className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
          Reference text <span className="font-normal text-gray-500">(optional)</span>
          <input
            type="text"
            value={refText}
            onChange={(e) => setRefText(e.target.value)}
            placeholder="Transcript of the reference audio"
            className="px-3 py-2.5 rounded-md border border-neutral-600 bg-bacon-input text-white text-base focus:outline-none focus:border-bacon-pink"
          />
        </label>

        <label className="flex flex-col gap-1.5 font-medium text-[0.95rem]">
          Video <span className="font-normal text-gray-500">(optional — attach for voiceover)</span>
          <div className="flex items-center gap-2.5">
            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              onChange={(e) => setVideoFile(e.target.files[0] || null)}
              className="py-2.5 text-[0.95rem]"
            />
            {videoFile && (
              <button
                className="px-3 py-1.5 text-sm bg-danger text-white border-none rounded-md cursor-pointer hover:bg-danger-hover whitespace-nowrap"
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
          className="px-5 py-2.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-base hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleGenerate}
          disabled={loading || !text.trim() || !selectedVoice}
        >
          {loading ? 'Generating...' : 'Generate Audio'}
        </button>

        {error && <p className="text-red-400">{error}</p>}

        {videoFile ? (
          <div className="flex flex-col gap-3 mt-2">
            <VideoEditor videoFile={videoFile} audioUrl={audioUrl} />
          </div>
        ) : audioUrl ? (
          <div className="flex flex-col gap-3 mt-2">
            <WaveformEditor audioUrl={audioUrl} />
            <button
              className="px-5 py-2.5 bg-success text-white rounded-lg font-medium border-none cursor-pointer text-base hover:bg-success-hover mt-2"
              onClick={handleSaveToLibrary}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save to Library'}
            </button>
            {saveMsg && (
              <p className={`text-[13px] mt-1 ${saveMsg.startsWith('Error') ? 'text-red-400' : 'text-success'}`}>
                {saveMsg}
              </p>
            )}
          </div>
        ) : null}
      </div>
    </>
  )
}

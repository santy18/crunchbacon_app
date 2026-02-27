import { useState, useEffect, useRef } from 'react'

export default function Streaming() {
  const [voices, setVoices] = useState([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamDelay, setStreamDelay] = useState(10)
  const [transcripts, setTranscripts] = useState([])
  const [streamError, setStreamError] = useState(null)

  const wsRef = useRef(null)
  const audioContextRef = useRef(null)
  const workletNodeRef = useRef(null)
  const mediaStreamRef = useRef(null)
  const audioQueueRef = useRef([])
  const isPlayingRef = useRef(false)

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
      .catch(() => setStreamError('Failed to load voices'))
  }, [])

  useEffect(() => {
    return () => stopStreaming()
  }, [])

  const playNextInQueue = async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return

    isPlayingRef.current = true
    const blob = audioQueueRef.current.shift()
    const url = URL.createObjectURL(blob)

    const audio = new Audio(url)
    audio.onended = () => {
      URL.revokeObjectURL(url)
      isPlayingRef.current = false
      playNextInQueue()
    }
    audio.onerror = () => {
      URL.revokeObjectURL(url)
      isPlayingRef.current = false
      playNextInQueue()
    }

    try {
      await audio.play()
    } catch {
      isPlayingRef.current = false
      playNextInQueue()
    }
  }

  const startStreaming = async () => {
    setStreamError(null)
    setTranscripts([])
    audioQueueRef.current = []
    isPlayingRef.current = false

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      mediaStreamRef.current = stream

      const audioCtx = new AudioContext()
      audioContextRef.current = audioCtx
      const actualSampleRate = audioCtx.sampleRate
      console.log(`[Stream] AudioContext sampleRate: ${actualSampleRate}`)

      await audioCtx.audioWorklet.addModule('/pcm-processor.js')
      const source = audioCtx.createMediaStreamSource(stream)
      const workletNode = new AudioWorkletNode(audioCtx, 'pcm-processor')
      workletNodeRef.current = workletNode

      const silentGain = audioCtx.createGain()
      silentGain.gain.value = 0
      source.connect(workletNode)
      workletNode.connect(silentGain)
      silentGain.connect(audioCtx.destination)

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}/ws/stream?voice=${encodeURIComponent(selectedVoice)}&delay=${streamDelay}&sample_rate=${actualSampleRate}`
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.binaryType = 'arraybuffer'

      ws.onopen = () => {
        workletNode.port.onmessage = (event) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(event.data.buffer)
          }
        }
        setIsStreaming(true)
      }

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          const msg = JSON.parse(event.data)
          if (msg.type === 'transcription' && msg.text) {
            setTranscripts((prev) => [...prev, msg.text])
          } else if (msg.type === 'error') {
            setStreamError(msg.detail)
          }
        } else {
          const blob = new Blob([event.data], { type: 'audio/wav' })
          audioQueueRef.current.push(blob)
          playNextInQueue()
        }
      }

      ws.onerror = () => {
        setStreamError('WebSocket connection error')
        stopStreaming()
      }

      ws.onclose = (event) => {
        if (event.code !== 1000) {
          setStreamError(event.reason || 'Connection closed unexpectedly')
        }
        setIsStreaming(false)
      }
    } catch (e) {
      setStreamError(e.message)
      stopStreaming()
    }
  }

  const stopStreaming = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect()
      workletNodeRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop())
      mediaStreamRef.current = null
    }
    setIsStreaming(false)
  }

  return (
    <div className="container">
      <h1>Real-Time Voice Cloning</h1>

      <label>
        Voice
        <select value={selectedVoice} onChange={(e) => setSelectedVoice(e.target.value)} disabled={isStreaming}>
          {voices.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </label>

      <label>
        Delay (seconds)
        <div className="slider-row">
          <input
            type="range"
            min={2}
            max={30}
            value={streamDelay}
            onChange={(e) => setStreamDelay(Number(e.target.value))}
            disabled={isStreaming}
          />
          <span className="slider-value">{streamDelay}s</span>
        </div>
      </label>

      <button
        className={isStreaming ? 'stop-btn' : 'generate-btn'}
        onClick={isStreaming ? stopStreaming : startStreaming}
        disabled={!selectedVoice}
      >
        {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
      </button>

      {streamError && <p className="error">{streamError}</p>}

      {transcripts.length > 0 && (
        <div className="transcripts">
          <h3>Transcriptions</h3>
          <div className="transcript-list">
            {transcripts.map((t, i) => (
              <p key={i} className="transcript-item">{t}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

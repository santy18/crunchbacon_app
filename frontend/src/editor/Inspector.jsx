import { useMemo, useCallback } from 'react'
import { useProject, useUI, useDispatch, updateClip } from './EditorContext'

function InspectorRow({ label, value, onChange, min, max, step = 0.01, readOnly = false, type = 'number' }) {
  return (
    <div className="inspector-row">
      <label>{label}</label>
      {type === 'range' ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          <span className="inspector-value">{typeof value === 'number' ? value.toFixed(2) : value}</span>
        </>
      ) : (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={typeof value === 'number' ? value.toFixed(2) : value}
          readOnly={readOnly}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (isFinite(v)) onChange(v)
          }}
        />
      )}
    </div>
  )
}

export default function Inspector() {
  const project = useProject()
  const ui = useUI()
  const dispatch = useDispatch()

  const clip = useMemo(
    () => project.clips.find((c) => c.id === ui.selectedClipId) || null,
    [project.clips, ui.selectedClipId]
  )

  const media = useMemo(
    () => (clip ? project.mediaBin.find((m) => m.id === clip.mediaId) : null),
    [clip, project.mediaBin]
  )

  const trackType = useMemo(() => {
    if (!clip) return null
    const track = project.tracks.find((t) => t.id === clip.trackId)
    return track ? track.type : 'video'
  }, [clip, project.tracks])

  const update = useCallback(
    (changes) => {
      if (!clip) return
      dispatch(updateClip(clip.id, changes))
    },
    [clip, dispatch]
  )

  if (!clip) {
    return (
      <div className="editor-inspector">
        <div className="editor-inspector-header">Inspector</div>
        <div className="editor-inspector-empty">
          Select a clip to inspect its properties
        </div>
      </div>
    )
  }

  return (
    <div className="editor-inspector">
      <div className="editor-inspector-header">
        Inspector {media ? `\u2014 ${media.name}` : ''}
      </div>

      {/* Timing */}
      <div className="inspector-section">
        <div className="inspector-section-title">Timing</div>
        <InspectorRow label="Start" value={clip.startTime} readOnly />
        <InspectorRow label="Duration" value={clip.duration} readOnly />
        <InspectorRow
          label="Speed"
          value={clip.speed}
          min={0.25}
          max={4}
          step={0.05}
          onChange={(v) => {
            const newDuration = (clip.outPoint - clip.inPoint) / v
            update({ speed: v, duration: newDuration })
          }}
        />
      </div>

      {/* Transform (video/image only) */}
      {trackType !== 'audio' && (
        <div className="inspector-section">
          <div className="inspector-section-title">Transform</div>
          <InspectorRow label="X" value={clip.x} min={-2000} max={2000} step={1} onChange={(v) => update({ x: v })} />
          <InspectorRow label="Y" value={clip.y} min={-2000} max={2000} step={1} onChange={(v) => update({ y: v })} />
          <InspectorRow label="Scale" value={clip.scale} min={0.1} max={5} step={0.05} onChange={(v) => update({ scale: v })} />
          <InspectorRow label="Rotation" value={clip.rotation} min={-360} max={360} step={1} onChange={(v) => update({ rotation: v })} />
          <InspectorRow label="Opacity" type="range" value={clip.opacity} min={0} max={1} step={0.01} onChange={(v) => update({ opacity: v })} />
        </div>
      )}

      {/* Crop (video/image only) */}
      {trackType !== 'audio' && (
        <div className="inspector-section">
          <div className="inspector-section-title">Crop</div>
          <InspectorRow label="Left" value={clip.cropLeft} min={0} max={1} step={0.01} onChange={(v) => update({ cropLeft: v })} />
          <InspectorRow label="Right" value={clip.cropRight} min={0} max={1} step={0.01} onChange={(v) => update({ cropRight: v })} />
          <InspectorRow label="Top" value={clip.cropTop} min={0} max={1} step={0.01} onChange={(v) => update({ cropTop: v })} />
          <InspectorRow label="Bottom" value={clip.cropBottom} min={0} max={1} step={0.01} onChange={(v) => update({ cropBottom: v })} />
        </div>
      )}

      {/* Audio */}
      <div className="inspector-section">
        <div className="inspector-section-title">Audio</div>
        <InspectorRow
          label="Volume"
          type="range"
          value={clip.volume}
          min={0}
          max={2}
          step={0.01}
          onChange={(v) => update({ volume: v })}
        />
      </div>
    </div>
  )
}

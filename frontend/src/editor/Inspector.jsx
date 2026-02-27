import { useMemo, useCallback } from 'react'
import { useProject, useUI, useDispatch, updateClip } from './EditorContext'

function InspectorRow({ label, value, onChange, min, max, step = 0.01, readOnly = false, type = 'number' }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <label className="flex-none w-[70px] text-[11px] text-gray-400 text-right">{label}</label>
      {type === 'range' ? (
        <>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="flex-1 min-w-0 accent-bacon-pink"
          />
          <span className="w-10 text-[11px] text-gray-400 font-mono">{typeof value === 'number' ? value.toFixed(2) : value}</span>
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
          className="flex-1 min-w-0 bg-bacon-panel border border-neutral-700 rounded text-gray-200 px-1.5 py-0.5 text-xs font-mono focus:outline-none focus:border-bacon-pink"
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
      <div className="flex flex-col border-l border-neutral-700 overflow-y-auto" style={{ gridArea: 'inspector' }}>
        <div className="px-2.5 py-2 font-semibold text-xs uppercase tracking-wide text-gray-400 border-b border-neutral-700">Inspector</div>
        <div className="py-5 px-2.5 text-neutral-600 text-center text-xs">
          Select a clip to inspect its properties
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col border-l border-neutral-700 overflow-y-auto" style={{ gridArea: 'inspector' }}>
      <div className="px-2.5 py-2 font-semibold text-xs uppercase tracking-wide text-gray-400 border-b border-neutral-700">
        Inspector {media ? `\u2014 ${media.name}` : ''}
      </div>

      {/* Timing */}
      <div className="px-2.5 py-2 border-b border-bacon-border">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Timing</div>
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
        <div className="px-2.5 py-2 border-b border-bacon-border">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Transform</div>
          <InspectorRow label="X" value={clip.x} min={-2000} max={2000} step={1} onChange={(v) => update({ x: v })} />
          <InspectorRow label="Y" value={clip.y} min={-2000} max={2000} step={1} onChange={(v) => update({ y: v })} />
          <InspectorRow label="Scale" value={clip.scale} min={0.1} max={5} step={0.05} onChange={(v) => update({ scale: v })} />
          <InspectorRow label="Rotation" value={clip.rotation} min={-360} max={360} step={1} onChange={(v) => update({ rotation: v })} />
          <InspectorRow label="Opacity" type="range" value={clip.opacity} min={0} max={1} step={0.01} onChange={(v) => update({ opacity: v })} />
        </div>
      )}

      {/* Crop (video/image only) */}
      {trackType !== 'audio' && (
        <div className="px-2.5 py-2 border-b border-bacon-border">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Crop</div>
          <InspectorRow label="Left" value={clip.cropLeft} min={0} max={1} step={0.01} onChange={(v) => update({ cropLeft: v })} />
          <InspectorRow label="Right" value={clip.cropRight} min={0} max={1} step={0.01} onChange={(v) => update({ cropRight: v })} />
          <InspectorRow label="Top" value={clip.cropTop} min={0} max={1} step={0.01} onChange={(v) => update({ cropTop: v })} />
          <InspectorRow label="Bottom" value={clip.cropBottom} min={0} max={1} step={0.01} onChange={(v) => update({ cropBottom: v })} />
        </div>
      )}

      {/* Audio */}
      <div className="px-2.5 py-2 border-b border-bacon-border">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">Audio</div>
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

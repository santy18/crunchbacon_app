import { useState, useEffect, useCallback, useRef } from 'react'
import { EditorProvider, useProject, useUI, useDispatch, removeClip, rippleDeleteClip, splitClip } from './EditorContext'
import { saveProject } from './projectApi'
import MediaBin from './MediaBin'
import PreviewPlayer from './PreviewPlayer'
import Timeline from './Timeline'
import Inspector from './Inspector'
import { exportProject } from './exportProject'

// Serialize project for comparison (strips non-serializable File/objectUrl)
function serializeForCompare(project) {
  return JSON.stringify({
    tracks: project.tracks,
    clips: project.clips,
    mediaBin: project.mediaBin.map(({ file, objectUrl, ...rest }) => rest),
  })
}

function EditorShell({ onClose, projectId }) {
  const project = useProject()
  const ui = useUI()
  const dispatch = useDispatch()

  // Save state
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null)
  const lastSavedRef = useRef(serializeForCompare(project))

  // Find all clips at playhead (for split-all)
  const clipsAtPlayhead = project.clips.filter(
    (c) => ui.playheadTime > c.startTime && ui.playheadTime < c.startTime + c.duration
  )

  const handleSave = useCallback(async () => {
    if (!projectId || saving) return
    setSaving(true)
    setSaveStatus(null)
    try {
      await saveProject(projectId, project)
      lastSavedRef.current = serializeForCompare(project)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (e) {
      setSaveStatus('error')
      console.error('Save failed:', e)
    } finally {
      setSaving(false)
    }
  }, [projectId, project, saving])

  const handleClose = useCallback(() => {
    const currentState = serializeForCompare(project)
    if (currentState !== lastSavedRef.current) {
      if (!window.confirm('You have unsaved changes. Close anyway?')) return
    }
    // Revoke objectUrls to free memory
    project.mediaBin.forEach((item) => {
      if (item.objectUrl) URL.revokeObjectURL(item.objectUrl)
    })
    onClose()
  }, [project, onClose])

  const handleSplit = useCallback(() => {
    if (ui.selectedClipId) {
      const clip = project.clips.find((c) => c.id === ui.selectedClipId)
      if (clip && ui.playheadTime > clip.startTime && ui.playheadTime < clip.startTime + clip.duration) {
        dispatch(splitClip(ui.selectedClipId, ui.playheadTime))
        dispatch({ type: 'SELECT_CLIP', clipId: null })
        return
      }
    }
    // Split all clips at playhead
    const atPlayhead = project.clips.filter(
      (c) => ui.playheadTime > c.startTime && ui.playheadTime < c.startTime + c.duration
    )
    for (const c of atPlayhead) {
      dispatch(splitClip(c.id, ui.playheadTime))
    }
    dispatch({ type: 'SELECT_CLIP', clipId: null })
  }, [dispatch, project.clips, ui.selectedClipId, ui.playheadTime])

  const handleDelete = useCallback(() => {
    if (!ui.selectedClipId) return
    if (ui.rippleDelete) {
      dispatch(rippleDeleteClip(ui.selectedClipId))
    } else {
      dispatch(removeClip(ui.selectedClipId))
    }
    dispatch({ type: 'SELECT_CLIP', clipId: null })
  }, [dispatch, ui.selectedClipId, ui.rippleDelete])

  const handleKeyDown = useCallback((e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return

    const isMeta = e.metaKey || e.ctrlKey

    if (e.code === 'Space') {
      e.preventDefault()
      dispatch({ type: 'SET_PLAYING', value: !ui.isPlaying })
    }

    if (isMeta && e.key === 's') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 's' && !isMeta) {
      handleSplit()
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      handleDelete()
    }

    if (isMeta && e.key === 'z') {
      e.preventDefault()
      if (e.shiftKey) {
        dispatch({ type: 'REDO' })
      } else {
        dispatch({ type: 'UNDO' })
      }
    }

    if (e.key === 'Escape') {
      handleClose()
    }
  }, [dispatch, ui.isPlaying, handleSplit, handleDelete, handleClose, handleSave])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    await exportProject(project, setExporting)
  }

  const canSplit = clipsAtPlayhead.length > 0

  const tbBtn = 'px-3 py-1 text-xs border-none rounded cursor-pointer text-gray-200 bg-neutral-700 hover:bg-neutral-600 disabled:opacity-35 disabled:cursor-not-allowed'

  return (
    <div className="fixed inset-0 z-[1000] bg-bacon-dark text-gray-200 flex flex-col font-sans text-[13px] overflow-hidden">
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bacon-panel border-b border-neutral-700 shrink-0">
        <button className={`${tbBtn} !bg-danger hover:!bg-danger-hover`} onClick={handleClose}>Close</button>
        <button className={tbBtn} disabled={!ui.canUndo} onClick={() => dispatch({ type: 'UNDO' })}>Undo</button>
        <button className={tbBtn} disabled={!ui.canRedo} onClick={() => dispatch({ type: 'REDO' })}>Redo</button>
        {projectId && (
          <button
            className={`${tbBtn} !bg-bacon-pink hover:!brightness-110`}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Save Failed' : 'Save'}
          </button>
        )}
        <div className="flex-1" />
        <button
          className={`${tbBtn} !bg-success hover:!bg-success-hover ml-auto`}
          onClick={handleExport}
          disabled={project.clips.length === 0 || exporting}
        >
          {exporting ? 'Exporting...' : 'Export MP4'}
        </button>
      </div>
      <div
        className="flex-1 grid overflow-hidden min-h-0"
        style={{
          gridTemplateColumns: '220px 1fr 260px',
          gridTemplateRows: '1fr 200px',
          gridTemplateAreas: '"bin preview inspector" "timeline timeline timeline"',
        }}
      >
        <MediaBin />
        <PreviewPlayer />
        <Inspector />
        <Timeline
          onSplit={handleSplit}
          onDelete={handleDelete}
          canSplit={canSplit}
          canDelete={!!ui.selectedClipId}
          rippleDelete={ui.rippleDelete}
          onToggleRipple={() => dispatch({ type: 'SET_RIPPLE_MODE', value: !ui.rippleDelete })}
        />
      </div>
    </div>
  )
}

export default function Editor({ onClose, projectId, initialProjectData }) {
  return (
    <EditorProvider initialProjectData={initialProjectData}>
      <EditorShell onClose={onClose} projectId={projectId} />
    </EditorProvider>
  )
}

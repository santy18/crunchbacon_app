import { useState, useEffect, useCallback } from 'react'
import { EditorProvider, useProject, useUI, useDispatch, removeClip, rippleDeleteClip, splitClip } from './EditorContext'
import MediaBin from './MediaBin'
import PreviewPlayer from './PreviewPlayer'
import Timeline from './Timeline'
import Inspector from './Inspector'
import { exportProject } from './exportProject'
import './Editor.css'

function EditorShell({ onClose }) {
  const project = useProject()
  const ui = useUI()
  const dispatch = useDispatch()

  // Find all clips at playhead (for split-all)
  const clipsAtPlayhead = project.clips.filter(
    (c) => ui.playheadTime > c.startTime && ui.playheadTime < c.startTime + c.duration
  )

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

    if (e.key === 's' && !isMeta) {
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
      onClose()
    }
  }, [dispatch, ui.isPlaying, handleSplit, handleDelete, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    await exportProject(project, setExporting)
  }

  const canSplit = clipsAtPlayhead.length > 0

  return (
    <div className="editor-root">
      <div className="editor-toolbar">
        <button className="tb-close" onClick={onClose}>Close</button>
        <button disabled={!ui.canUndo} onClick={() => dispatch({ type: 'UNDO' })}>Undo</button>
        <button disabled={!ui.canRedo} onClick={() => dispatch({ type: 'REDO' })}>Redo</button>
        <div className="tb-spacer" />
        <button
          className="tb-export"
          onClick={handleExport}
          disabled={project.clips.length === 0 || exporting}
        >
          {exporting ? 'Exporting...' : 'Export MP4'}
        </button>
      </div>
      <div className="editor-layout">
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

export default function Editor({ onClose }) {
  return (
    <EditorProvider>
      <EditorShell onClose={onClose} />
    </EditorProvider>
  )
}

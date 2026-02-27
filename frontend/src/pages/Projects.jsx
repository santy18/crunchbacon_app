import { useState, useEffect, useCallback } from 'react'
import { listProjects, createProject, deleteProject, loadProject } from '../editor/projectApi'
import Editor from '../editor/Editor'

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function Projects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Editor state
  const [editorOpen, setEditorOpen] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [activeProjectData, setActiveProjectData] = useState(null)

  // Create state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // Loading indicator for opening a project
  const [loadingId, setLoadingId] = useState(null)

  const fetchProjects = useCallback(async () => {
    try {
      const data = await listProjects()
      setProjects(data)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    try {
      const project = await createProject(name)
      setNewName('')
      setCreating(false)
      setActiveProjectId(project.id)
      setActiveProjectData(null)
      setEditorOpen(true)
    } catch (e) {
      setError(e.message)
    }
  }

  const handleOpen = async (id) => {
    setLoadingId(id)
    try {
      const { project } = await loadProject(id)
      setActiveProjectId(id)
      setActiveProjectData(project)
      setEditorOpen(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingId(null)
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return
    try {
      await deleteProject(id)
      setProjects((prev) => prev.filter((p) => p.id !== id))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleEditorClose = () => {
    setEditorOpen(false)
    setActiveProjectId(null)
    setActiveProjectData(null)
    fetchProjects()
  }

  if (editorOpen) {
    return (
      <Editor
        projectId={activeProjectId}
        initialProjectData={activeProjectData}
        onClose={handleEditorClose}
      />
    )
  }

  return (
    <div className="page" style={{ maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>Projects</h1>
        {!creating && (
          <button
            className="generate-btn"
            style={{ marginTop: 0, background: '#2ea043' }}
            onClick={() => setCreating(true)}
          >
            + New Project
          </button>
        )}
      </div>

      {creating && (
        <div style={{
          display: 'flex', gap: '0.6rem', alignItems: 'center',
          marginBottom: '1.5rem', padding: '1rem', background: '#1e1e1e',
          border: '1px solid #333', borderRadius: 8,
        }}>
          <input
            type="text"
            placeholder="Project name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            style={{ flex: 1 }}
          />
          <button className="generate-btn" style={{ marginTop: 0 }} onClick={handleCreate}>
            Create
          </button>
          <button
            className="generate-btn"
            style={{ marginTop: 0, background: '#555' }}
            onClick={() => { setCreating(false); setNewName('') }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p style={{ color: '#888' }}>Loading projects...</p>
      ) : projects.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem', color: '#666',
          background: '#1a1a1a', borderRadius: 12, border: '1px solid #2a2a2a',
        }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>No projects yet</p>
          <p style={{ fontSize: '0.9rem' }}>Create a new project to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {projects.map((p) => (
            <div
              key={p.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.2rem', background: '#1e1e1e',
                border: '1px solid #333', borderRadius: 10,
                cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
              }}
              onClick={() => handleOpen(p.id)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#646cff'
                e.currentTarget.style.background = '#222'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333'
                e.currentTarget.style.background = '#1e1e1e'
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 8,
                background: 'rgba(100, 108, 255, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.3rem', flexShrink: 0,
              }}>
                {'\uD83C\uDFAC'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: 2 }}>
                  {p.name}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                  {p.data ? 'Has saved data' : 'Empty project'} &middot; Updated {formatDate(p.updated_at)}
                </div>
              </div>
              {loadingId === p.id ? (
                <span style={{ color: '#888', fontSize: '0.85rem' }}>Loading...</span>
              ) : (
                <>
                  <button
                    className="generate-btn"
                    style={{ marginTop: 0, padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                    onClick={(e) => { e.stopPropagation(); handleOpen(p.id) }}
                  >
                    Open
                  </button>
                  <button
                    className="remove-btn"
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name) }}
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

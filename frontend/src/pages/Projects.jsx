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
    <div className="max-w-[900px]">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold m-0">Projects</h1>
        {!creating && (
          <button
            className="px-5 py-2.5 bg-success text-white rounded-lg font-medium border-none cursor-pointer text-base hover:bg-success-hover"
            onClick={() => setCreating(true)}
          >
            + New Project
          </button>
        )}
      </div>

      {creating && (
        <div className="flex gap-2.5 items-center mb-6 p-4 bg-bacon-card border border-neutral-700 rounded-lg">
          <input
            type="text"
            placeholder="Project name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
            className="flex-1 px-3 py-2.5 rounded-md border border-neutral-600 bg-bacon-input text-white text-base focus:outline-none focus:border-bacon-pink"
          />
          <button
            className="px-5 py-2.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-base hover:brightness-110"
            onClick={handleCreate}
          >
            Create
          </button>
          <button
            className="px-5 py-2.5 bg-neutral-600 text-white rounded-lg font-medium border-none cursor-pointer text-base hover:bg-neutral-500"
            onClick={() => { setCreating(false); setNewName('') }}
          >
            Cancel
          </button>
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}

      {loading ? (
        <p className="text-gray-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="text-center py-12 px-4 text-gray-500 bg-bacon-card rounded-xl border border-bacon-border">
          <p className="text-lg mb-2">No projects yet</p>
          <p className="text-[0.9rem]">Create a new project to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group flex items-center gap-4 p-4 px-5 bg-bacon-card border border-neutral-700 rounded-xl cursor-pointer transition-all hover:border-bacon-pink hover:bg-[#222]"
              onClick={() => handleOpen(p.id)}
            >
              <div className="w-[42px] h-[42px] rounded-lg bg-bacon-pink/10 flex items-center justify-center text-xl shrink-0">
                {'\uD83C\uDFAC'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-base mb-0.5">{p.name}</div>
                <div className="text-[0.8rem] text-gray-500">
                  {p.data ? 'Has saved data' : 'Empty project'} &middot; Updated {formatDate(p.updated_at)}
                </div>
              </div>
              {loadingId === p.id ? (
                <span className="text-gray-500 text-[0.85rem]">Loading...</span>
              ) : (
                <>
                  <button
                    className="px-4 py-1.5 bg-bacon-pink text-white rounded-lg font-medium border-none cursor-pointer text-[0.85rem] hover:brightness-110"
                    onClick={(e) => { e.stopPropagation(); handleOpen(p.id) }}
                  >
                    Open
                  </button>
                  <button
                    className="px-3 py-1.5 text-sm bg-danger text-white border-none rounded-md cursor-pointer hover:bg-danger-hover"
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

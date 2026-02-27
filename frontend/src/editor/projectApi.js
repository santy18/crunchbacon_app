const API = '/projects'

export async function listProjects() {
  const res = await fetch(API)
  if (!res.ok) throw new Error('Failed to list projects')
  return res.json()
}

export async function createProject(name) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, data: null }),
  })
  if (!res.ok) throw new Error('Failed to create project')
  return res.json()
}

export async function deleteProject(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete project')
}

export async function saveProject(projectId, project) {
  // 1. Upload each media file that has a File object
  for (const media of project.mediaBin) {
    if (media.file) {
      const fd = new FormData()
      fd.append('media', media.file, media.name)
      fd.append('media_id', media.id)
      const res = await fetch(`${API}/${projectId}/media`, {
        method: 'POST',
        body: fd,
      })
      if (!res.ok) throw new Error(`Failed to upload media ${media.name}`)
    }
  }

  // 2. Serialize project data (strip non-serializable File/objectUrl)
  const data = {
    tracks: project.tracks,
    clips: project.clips,
    mediaBin: project.mediaBin.map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      duration: m.duration,
      width: m.width || null,
      height: m.height || null,
    })),
  }

  // 3. PUT the JSON
  const res = await fetch(`${API}/${projectId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: JSON.stringify(data) }),
  })
  if (!res.ok) throw new Error('Failed to save project')
  return res.json()
}

export async function loadProject(projectId) {
  const res = await fetch(`${API}/${projectId}`)
  if (!res.ok) throw new Error('Failed to load project')
  const record = await res.json()

  if (!record.data) {
    return { record, project: null }
  }

  const data = JSON.parse(record.data)

  // Fetch each media file in parallel and reconstruct File + objectUrl
  const restoredMediaBin = await Promise.all(
    data.mediaBin.map(async (meta) => {
      try {
        const mediaRes = await fetch(`${API}/${projectId}/media/${meta.id}`)
        if (!mediaRes.ok) throw new Error('not found')
        const blob = await mediaRes.blob()
        const file = new File([blob], meta.name, { type: blob.type })
        const objectUrl = URL.createObjectURL(blob)
        return { ...meta, file, objectUrl }
      } catch {
        return { ...meta, file: null, objectUrl: null }
      }
    })
  )

  return {
    record,
    project: {
      tracks: data.tracks,
      clips: data.clips,
      mediaBin: restoredMediaBin,
    },
  }
}

export async function exportProject(project, setExporting) {
  if (project.clips.length === 0) {
    alert('No clips to export.')
    return
  }

  if (setExporting) setExporting(true)

  const formData = new FormData()

  // Attach media files with their IDs
  const usedMediaIds = new Set(project.clips.map((c) => c.mediaId))
  for (const media of project.mediaBin) {
    if (usedMediaIds.has(media.id) && media.file) {
      formData.append(`media_${media.id}`, media.file, media.name)
    }
  }

  // Attach project JSON
  const projectData = {
    tracks: project.tracks,
    clips: project.clips.map((c) => ({
      id: c.id,
      mediaId: c.mediaId,
      trackId: c.trackId,
      startTime: c.startTime,
      duration: c.duration,
      inPoint: c.inPoint,
      outPoint: c.outPoint,
      x: c.x,
      y: c.y,
      scale: c.scale,
      rotation: c.rotation,
      opacity: c.opacity,
      cropLeft: c.cropLeft,
      cropRight: c.cropRight,
      cropTop: c.cropTop,
      cropBottom: c.cropBottom,
      speed: c.speed,
      volume: c.volume,
    })),
  }

  formData.append('project', JSON.stringify(projectData))

  try {
    const res = await fetch('/export-project', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const detail = await res.json().catch(() => null)
      throw new Error(detail?.detail || `Server error ${res.status}`)
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'project_export.mp4'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (e) {
    alert('Export failed: ' + e.message)
  } finally {
    if (setExporting) setExporting(false)
  }
}

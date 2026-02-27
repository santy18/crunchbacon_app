import { useState } from 'react'
import Editor from '../editor/Editor'

export default function Projects() {
  const [editorOpen, setEditorOpen] = useState(false)

  return (
    <div className="page">
      {editorOpen && <Editor onClose={() => setEditorOpen(false)} />}
      <h1>Projects</h1>
      <p>Project management coming soon.</p>
      <button
        className="generate-btn"
        onClick={() => setEditorOpen(true)}
        style={{ background: '#2ea043', marginTop: '1rem' }}
      >
        Open Video Editor
      </button>
    </div>
  )
}

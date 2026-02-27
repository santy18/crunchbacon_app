import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Home from './pages/Home'
import Voices from './pages/Voices'
import Projects from './pages/Projects'
import Streaming from './pages/Streaming'
import Testing from './pages/Testing'
import Settings from './pages/Settings'
import Transcriptions from './pages/Transcriptions'
import './App.css'

export default function App() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/voices" element={<Voices />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/streaming" element={<Streaming />} />
          <Route path="/testing" element={<Testing />} />
          <Route path="/transcriptions" element={<Transcriptions />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

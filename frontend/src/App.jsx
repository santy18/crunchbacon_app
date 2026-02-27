import { Routes, Route } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import LandingPage from './pages/LandingPage'
import Home from './pages/Home'
import Voices from './pages/Voices'
import Projects from './pages/Projects'
import Streaming from './pages/Streaming'
import Testing from './pages/Testing'
import Settings from './pages/Settings'
import Transcriptions from './pages/Transcriptions'
import AudioFiles from './pages/AudioFiles'

function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/voices" element={<Voices />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/streaming" element={<Streaming />} />
          <Route path="/testing" element={<Testing />} />
          <Route path="/transcriptions" element={<Transcriptions />} />
          <Route path="/audio-files" element={<AudioFiles />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/app/*" element={<AppLayout />} />
    </Routes>
  )
}

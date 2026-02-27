import { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react'

// --- ID generator (timestamp + random to avoid collisions across sessions) ---
const genId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// --- Initial state ---
export const defaultTracks = [
  { id: 'v1', type: 'video', name: 'V1', locked: false, visible: true },
  { id: 'a1', type: 'audio', name: 'A1', locked: false, visible: true },
]

export const initialProject = {
  tracks: defaultTracks,
  clips: [],
  mediaBin: [],
}

const initialUI = {
  playheadTime: 0,
  isPlaying: false,
  zoom: 100, // pixels per second
  scrollLeft: 0,
  selectedClipId: null,
  rippleDelete: false,
  canvasWidth: 800,
}

const MAX_UNDO = 50

// --- Project reducer (undo-able) ---
function projectReducer(project, action) {
  switch (action.type) {
    case 'ADD_MEDIA': {
      return { ...project, mediaBin: [...project.mediaBin, action.item] }
    }
    case 'REMOVE_MEDIA': {
      return {
        ...project,
        mediaBin: project.mediaBin.filter((m) => m.id !== action.id),
        clips: project.clips.filter((c) => c.mediaId !== action.id),
      }
    }
    case 'ADD_CLIP': {
      return { ...project, clips: [...project.clips, action.clip] }
    }
    case 'REMOVE_CLIP': {
      return { ...project, clips: project.clips.filter((c) => c.id !== action.clipId) }
    }
    case 'UPDATE_CLIP': {
      return {
        ...project,
        clips: project.clips.map((c) =>
          c.id === action.clipId ? { ...c, ...action.changes } : c
        ),
      }
    }
    case 'MOVE_CLIP': {
      return {
        ...project,
        clips: project.clips.map((c) =>
          c.id === action.clipId
            ? { ...c, startTime: Math.max(0, action.startTime), trackId: action.trackId ?? c.trackId }
            : c
        ),
      }
    }
    case 'TRIM_CLIP': {
      return {
        ...project,
        clips: project.clips.map((c) => {
          if (c.id !== action.clipId) return c
          const { side, delta } = action // delta in seconds
          if (side === 'left') {
            const newIn = Math.max(0, c.inPoint + delta * c.speed)
            const trimDelta = (newIn - c.inPoint) / c.speed
            return {
              ...c,
              inPoint: newIn,
              startTime: c.startTime + trimDelta,
              duration: c.duration - trimDelta,
            }
          } else {
            const newOut = Math.min(
              c.outPoint - delta * c.speed < c.inPoint + 0.01
                ? c.inPoint + 0.01
                : Infinity,
              c.outPoint - delta * c.speed
            )
            const actualNewOut = Math.max(c.inPoint + 0.01, c.outPoint - delta * c.speed)
            return {
              ...c,
              outPoint: actualNewOut,
              duration: (actualNewOut - c.inPoint) / c.speed,
            }
          }
        }),
      }
    }
    case 'SPLIT_CLIP': {
      const clip = project.clips.find((c) => c.id === action.clipId)
      if (!clip) return project
      const splitTime = action.time // timeline time
      if (splitTime <= clip.startTime || splitTime >= clip.startTime + clip.duration) return project

      const relTime = splitTime - clip.startTime
      const splitInSource = clip.inPoint + relTime * clip.speed

      const left = {
        ...clip,
        id: genId(),
        outPoint: splitInSource,
        duration: relTime,
      }
      const right = {
        ...clip,
        id: genId(),
        inPoint: splitInSource,
        startTime: splitTime,
        duration: clip.duration - relTime,
      }
      return {
        ...project,
        clips: project.clips.filter((c) => c.id !== clip.id).concat([left, right]),
      }
    }
    case 'RIPPLE_DELETE_CLIP': {
      const clip = project.clips.find((c) => c.id === action.clipId)
      if (!clip) return project
      const gap = clip.duration
      return {
        ...project,
        clips: project.clips
          .filter((c) => c.id !== clip.id)
          .map((c) =>
            c.trackId === clip.trackId && c.startTime > clip.startTime
              ? { ...c, startTime: c.startTime - gap }
              : c
          ),
      }
    }
    default:
      return project
  }
}

// --- Main reducer with undo/redo ---
const PROJECT_ACTIONS = new Set([
  'ADD_MEDIA', 'REMOVE_MEDIA', 'ADD_CLIP', 'REMOVE_CLIP',
  'UPDATE_CLIP', 'MOVE_CLIP', 'TRIM_CLIP', 'SPLIT_CLIP', 'RIPPLE_DELETE_CLIP',
])

function editorReducer(state, action) {
  // Undo
  if (action.type === 'UNDO') {
    if (state.past.length === 0) return state
    const prev = state.past[state.past.length - 1]
    return {
      ...state,
      past: state.past.slice(0, -1),
      present: prev,
      future: [state.present, ...state.future].slice(0, MAX_UNDO),
    }
  }
  // Redo
  if (action.type === 'REDO') {
    if (state.future.length === 0) return state
    const next = state.future[0]
    return {
      ...state,
      past: [...state.past, state.present].slice(-MAX_UNDO),
      present: next,
      future: state.future.slice(1),
    }
  }

  // UI-only actions (no undo)
  if (action.type === 'SET_PLAYHEAD') return { ...state, ui: { ...state.ui, playheadTime: action.time } }
  if (action.type === 'SET_PLAYING') return { ...state, ui: { ...state.ui, isPlaying: action.value } }
  if (action.type === 'SET_ZOOM') return { ...state, ui: { ...state.ui, zoom: action.zoom } }
  if (action.type === 'SET_SCROLL') return { ...state, ui: { ...state.ui, scrollLeft: action.scrollLeft } }
  if (action.type === 'SELECT_CLIP') return { ...state, ui: { ...state.ui, selectedClipId: action.clipId } }
  if (action.type === 'SET_RIPPLE_MODE') return { ...state, ui: { ...state.ui, rippleDelete: action.value } }
  if (action.type === 'SET_CANVAS_WIDTH') return { ...state, ui: { ...state.ui, canvasWidth: action.width } }

  // Load a saved project (replaces entire state, clears undo/redo)
  if (action.type === 'LOAD_PROJECT') {
    return {
      past: [],
      present: action.project,
      future: [],
      ui: { ...initialUI },
    }
  }

  // Project actions (undo-able)
  if (PROJECT_ACTIONS.has(action.type)) {
    const newPresent = projectReducer(state.present, action)
    if (newPresent === state.present) return state
    return {
      ...state,
      past: [...state.past, state.present].slice(-MAX_UNDO),
      present: newPresent,
      future: [],
    }
  }

  return state
}

const initialState = {
  past: [],
  present: initialProject,
  future: [],
  ui: initialUI,
}

// --- Contexts ---
const ProjectContext = createContext(null)
const UIContext = createContext(null)
const DispatchContext = createContext(null)

export function EditorProvider({ children, initialProjectData }) {
  const [state, dispatch] = useReducer(
    editorReducer,
    initialProjectData
      ? { past: [], present: initialProjectData, future: [], ui: initialUI }
      : initialState
  )

  // Memoize context values to avoid unnecessary re-renders
  const projectValue = useMemo(() => state.present, [state.present])
  const uiValue = useMemo(
    () => ({ ...state.ui, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }),
    [state.ui, state.past.length, state.future.length]
  )

  return (
    <DispatchContext.Provider value={dispatch}>
      <ProjectContext.Provider value={projectValue}>
        <UIContext.Provider value={uiValue}>
          {children}
        </UIContext.Provider>
      </ProjectContext.Provider>
    </DispatchContext.Provider>
  )
}

// --- Hooks ---
export function useProject() {
  return useContext(ProjectContext)
}

export function useUI() {
  return useContext(UIContext)
}

export function useDispatch() {
  return useContext(DispatchContext)
}

// --- Action creators ---
export function addMedia(item) {
  return { type: 'ADD_MEDIA', item: { ...item, id: item.id || genId() } }
}

export function removeMedia(id) {
  return { type: 'REMOVE_MEDIA', id }
}

export function addClip(mediaItem, trackId, startTime) {
  const clip = {
    id: genId(),
    mediaId: mediaItem.id,
    trackId,
    startTime,
    duration: mediaItem.duration || 5,
    inPoint: 0,
    outPoint: mediaItem.duration || 5,
    x: 0, y: 0, scale: 1, rotation: 0, opacity: 1,
    cropLeft: 0, cropRight: 0, cropTop: 0, cropBottom: 0,
    speed: 1,
    volume: 1,
  }
  return { type: 'ADD_CLIP', clip }
}

export function removeClip(clipId) {
  return { type: 'REMOVE_CLIP', clipId }
}

export function updateClip(clipId, changes) {
  return { type: 'UPDATE_CLIP', clipId, changes }
}

export function moveClip(clipId, startTime, trackId) {
  return { type: 'MOVE_CLIP', clipId, startTime, trackId }
}

export function trimClip(clipId, side, delta) {
  return { type: 'TRIM_CLIP', clipId, side, delta }
}

export function splitClip(clipId, time) {
  return { type: 'SPLIT_CLIP', clipId, time }
}

export function rippleDeleteClip(clipId) {
  return { type: 'RIPPLE_DELETE_CLIP', clipId }
}

export { genId }

# 🥓 CrunchBacon (Qwen3-TTS)

CrunchBacon is a powerful, locally-hosted AI video and audio workstation. It leverages the latest **Qwen3-TTS** model (optimized for Apple Silicon via MLX) to generate high-quality speech and features a full-fledged timeline editor for creating social media content.

---

## ✨ Main Features

- **🚀 Qwen3-TTS Integration**: State-of-the-art text-to-speech generation using the Qwen3-TTS-12Hz-1.7B model, specifically optimized for high performance on Mac (MLX).
- **🎙️ Voice Cloning**: Clone any voice using just a short reference audio clip for personalized narrations.
- **🎬 Timeline Video Editor**: A multi-track browser-based editor to arrange video clips, images, and AI-generated voiceovers.
- **📱 One-Click Social Publishing**: Directly connect and publish your exports to **TikTok** (with secure OAuth + PKCE integration).
- **📝 Real-time Transcription (STT)**: Powered by `faster-whisper` for lightning-fast speech-to-text processing.
- **⚡ WebSocket Streaming**: Low-latency audio streaming for real-time interaction and preview.
- **🔒 Privacy First & Local**: All heavy lifting (TTS/STT/Rendering) happens locally on your machine. No cloud subscriptions or hidden data tracking.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy (Async), MLX (Apple Silicon), FFmpeg.
- **ML Models**: Qwen3-TTS (Speech Gen), Faster-Whisper (Transcription).
- **Frontend**: React, Vite, Tailwind CSS, Lucide Icons.
- **Database**: SQLite (via aiosqlite).

---

## ⚖️ License

**Source Available - Non-Commercial.**
This project is licensed under the **Polyform Noncommercial License 1.0.0**. 
- ✅ **Personal Use**: Free to use, modify, and run for yourself.
- ❌ **Commercial Use**: You cannot use this software for monetary gain or commercial advantage without explicit permission.

---

## ⚙️ Prerequisites

- Python 3.11+
- Node.js & npm
- [MLX](https://github.com/ml-explore/mlx) (Requires Apple Silicon Mac)
- **FFmpeg**: Required for video/audio processing.

## 🚀 Backend Setup

1. **Create and activate a conda environment**:
   ```bash
   conda create -n qwen-tts python=3.11 -y
   conda activate qwen-tts
   ```

2. **Install backend dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Pre-install the model**:
   ```bash
   huggingface-cli download mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16
   ```

4. **Run the backend server**:
   ```bash
   cd backend
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

## 🎨 Frontend Setup

1. **Install frontend dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Run the frontend development server**:
   ```bash
   npm run dev
   ```

---

## 🤝 Contributing

Contributions are welcome for bug fixes and non-commercial enhancements! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

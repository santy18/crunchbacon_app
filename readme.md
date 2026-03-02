# Qwen3-TTS Project

This repository contains both the backend (FastAPI) and frontend (React/Vite) for the Qwen3-TTS project.

## Prerequisites

- Python 3.11+
- Node.js & npm
- [MLX](https://github.com/ml-explore/mlx) (for Apple Silicon)

## Backend Setup

1. Create and activate a conda environment:
   ```bash
   conda create -n qwen-tts python=3.11 -y
   conda activate qwen-tts
   ```

2. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Run the backend server:
   ```bash
   cd backend
   uvicorn app:app --host 0.0.0.0 --port 8000 --reload
   ```

## Frontend Setup

1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Run the frontend development server:
   ```bash
   npm run dev
   ```

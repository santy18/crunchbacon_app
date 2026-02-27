ml_models: dict = {}


def load_ml_models():
    print("Loading MLX Qwen3-TTS into Unified Memory...")
    try:
        from mlx_audio.tts.utils import load_model
        ml_models["tts"] = load_model("mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16")
        print("MLX Model loaded successfully!")
    except Exception as e:
        print(f"Failed to load model: {e}")

    print("Loading faster-whisper STT model...")
    try:
        from faster_whisper import WhisperModel
        ml_models["stt"] = WhisperModel("base", device="cpu", compute_type="int8")
        print("Whisper model loaded successfully!")
    except Exception as e:
        print(f"Failed to load Whisper model: {e}")


def clear_models():
    ml_models.clear()

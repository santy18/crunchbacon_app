# env
```
conda create -n qwen-tts python=3.11 -y
conda activate qwen-tts


pip install mlx mlx-audio numpy soundfile fastapi uvicorn pydantic huggingface_hub
```

# preinstalling model
```
hf download mlx-community/Qwen3-TTS-12Hz-1.7B-Base-bf16
```

# downloading a good voice reference
```
python -c "import urllib.request; urllib.request.urlretrieve('https://thorsten-voice.de/ref/ref-en.wav', 'clone.wav')"
```

# launching app
```
uvicorn app:app --host 0.0.0.0 --port 8000
```

# converting .m4a to .wav
```
afconvert -f WAVE -d LEI16 irina.m4a clone3.wav
```
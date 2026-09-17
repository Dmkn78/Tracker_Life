"""One-shot Parakeet V3 inference; exiting releases the model's memory."""
import json
import os
from pathlib import Path
import subprocess
import sys

import imageio_ffmpeg
import numpy as np
import sherpa_onnx

SAMPLE_RATE = 16000
MAX_AUDIO_SECONDS = 120


def decode_audio(audio_path: str) -> np.ndarray:
    command = [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-i", audio_path,
               "-t", str(MAX_AUDIO_SECONDS + 1), "-ac", "1", "-ar", str(SAMPLE_RATE),
               "-f", "f32le", "pipe:1"]
    decoded = subprocess.run(command, capture_output=True, check=True, timeout=30)
    samples = np.frombuffer(decoded.stdout, dtype=np.float32)
    if samples.size == 0 or samples.size > MAX_AUDIO_SECONDS * SAMPLE_RATE:
        raise ValueError("Audio must contain between 0 and 120 seconds of sound")
    return samples


def transcribe_audio(audio_path: str, model_directory: Path) -> str:
    samples = decode_audio(audio_path)
    recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
        encoder=str(model_directory / "encoder.int8.onnx"),
        decoder=str(model_directory / "decoder.int8.onnx"),
        joiner=str(model_directory / "joiner.int8.onnx"),
        tokens=str(model_directory / "tokens.txt"),
        num_threads=2, provider="cpu", model_type="nemo_transducer",
        decoding_method="greedy_search",
    )
    stream = recognizer.create_stream()
    stream.accept_waveform(SAMPLE_RATE, samples)
    recognizer.decode_stream(stream)
    transcript = stream.result.text.strip()
    return transcript


if __name__ == "__main__":
    try:
        transcript = transcribe_audio(sys.argv[1], Path(os.environ["PARAKEET_MODEL_DIR"]))
        print(json.dumps({"text": transcript, "model": "parakeet-tdt-0.6b-v3"}))
    except (ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        print(json.dumps({"error": "Audio is invalid or exceeds the 2 minute limit"}))
        sys.exit(2)

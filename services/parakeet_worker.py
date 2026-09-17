"""One-shot Parakeet V3 inference; audio length does not grow inference memory."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile

import imageio_ffmpeg
import numpy as np
import sherpa_onnx

from audio_segments import MAX_AUDIO_SECONDS, SAMPLE_RATE, append_segment, segment_ranges


def decode_audio(audio_path: str, pcm_path: Path) -> int:
    command = [imageio_ffmpeg.get_ffmpeg_exe(), "-nostdin", "-v", "error", "-y", "-i", audio_path,
               "-t", str(MAX_AUDIO_SECONDS + 1), "-ac", "1", "-ar", str(SAMPLE_RATE),
               "-f", "f32le", str(pcm_path)]
    subprocess.run(command, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, check=True, timeout=120)
    sample_count = pcm_path.stat().st_size // 4
    if sample_count == 0 or sample_count > MAX_AUDIO_SECONDS * SAMPLE_RATE:
        raise ValueError("Audio must contain between 0 and 30 minutes of sound")
    return sample_count


def report_progress(percent: int) -> None:
    destination = os.environ.get("PARAKEET_PROGRESS_FILE")
    if destination:
        path = Path(destination)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps({"progress": percent}))
        temporary.replace(path)


def transcribe_audio(audio_path: str, model_directory: Path) -> str:
    # PCM stays on disk; only a 20-second window is copied into the recognizer.
    with tempfile.TemporaryDirectory(dir=Path(audio_path).parent) as temporary:
        pcm_path = Path(temporary) / "audio.f32"
        sample_count = decode_audio(audio_path, pcm_path)
        recognizer = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=str(model_directory / "encoder.int8.onnx"),
            decoder=str(model_directory / "decoder.int8.onnx"),
            joiner=str(model_directory / "joiner.int8.onnx"),
            tokens=str(model_directory / "tokens.txt"),
            num_threads=2, provider="cpu", model_type="nemo_transducer",
            decoding_method="greedy_search",
        )
        transcript = ""
        with pcm_path.open("rb") as audio:
            for start, end in segment_ranges(sample_count):
                audio.seek(start * 4)
                samples = np.frombuffer(audio.read((end - start) * 4), dtype=np.float32)
                if np.max(np.abs(samples)) < 1e-5:
                    report_progress(min(99, round(end / sample_count * 100)))
                    continue
                stream = recognizer.create_stream()
                stream.accept_waveform(SAMPLE_RATE, samples)
                recognizer.decode_stream(stream)
                transcript = append_segment(transcript, stream.result.text)
                del stream
                report_progress(min(99, round(end / sample_count * 100)))
        return transcript


if __name__ == "__main__":
    try:
        transcript = transcribe_audio(sys.argv[1], Path(os.environ["PARAKEET_MODEL_DIR"]))
        print(json.dumps({"text": transcript, "model": "parakeet-tdt-0.6b-v3"}))
    except (ValueError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        print(json.dumps({"error": "Audio is invalid or exceeds the 30 minute limit"}))
        sys.exit(2)

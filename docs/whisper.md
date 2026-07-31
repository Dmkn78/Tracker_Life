# Whisper Placeholder

The MVP keeps voice capture as a clean placeholder. The Daily Log already stores `voiceTranscript` on `DailyLog`.

Later implementation path:

1. Install the Python service dependencies:

```powershell
python -m pip install -r services/requirements.txt
```

2. Install Whisper from the official OpenAI repository if it is not already present:

```powershell
pip install -U openai-whisper
```

3. The service uses `imageio-ffmpeg` to supply a local FFmpeg binary when the system does not have one on `PATH`.

4. Start the local Python FastAPI service:

```powershell
.\scripts\start-whisper-service.cmd
```

5. The service exposes one endpoint:

```text
POST /transcribe
multipart/form-data: file
response: { "text": "..." }
```

6. `lib/whisper.ts` uploads audio to the Next.js proxy route, which forwards it to the Python service and returns the transcript.

7. Save the returned transcript into `DailyLog.voiceTranscript` through the existing `/api/daily-log` autosave flow.

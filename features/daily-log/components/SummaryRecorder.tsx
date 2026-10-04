"use client";

import { LoaderCircle, Mic, Square, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { IconButton } from "@/components/ui";
import { transcribeAudio } from "@/lib/whisper";

type RecordingState = "idle" | "requesting" | "recording" | "uploading" | "transcribing";
type SummaryRecorderProps = {
  locale: "fr" | "en";
  disabled: boolean;
  onTranscript: (text: string) => void;
  onBusyChange?: (busy: boolean) => void;
};
const MAX_RECORDING_SECONDS = 30 * 60;
const MAX_AUDIO_BYTES = 100 * 1024 * 1024;
const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"];
const COPY = {
  fr: {
    tooLarge: "Le fichier audio doit faire moins de 100 Mo.",
    start: "Dicter le résumé", stop: "Arrêter et transcrire", requesting: "Autorisation du micro…",
    transcribing: "Transcription en cours…", uploading: "Envoi de l’audio…", cancel: "Annuler la transcription", cancelled: "Transcription annulée. Tu peux réessayer avec cet audio.", recording: "Enregistrement", upload: "Importer un audio",
    hint: "Parakeet V3 multilingue · Le texte est ajouté automatiquement au résumé (30 min maximum, 100 Mo). Garde cet onglet ouvert pendant le traitement.",
    unsupported: "Le microphone nécessite HTTPS et un navigateur compatible. Tu peux aussi importer un audio.",
    microphone: "Le microphone est indisponible ou son accès a été refusé.",
    failed: "La transcription a échoué. Réessaie avec cet audio.", empty: "Aucune parole détectée. Réessaie en parlant plus près du micro.",
    recordingFailed: "L’enregistrement a échoué. Réessaie.", retry: "Réessayer la transcription"
  },
  en: {
    tooLarge: "The audio file must be smaller than 100 MB.",
    start: "Dictate summary", stop: "Stop and transcribe", requesting: "Requesting microphone…",
    transcribing: "Transcribing…", uploading: "Uploading audio…", cancel: "Cancel transcription", cancelled: "Transcription cancelled. You can retry with this audio.", recording: "Recording", upload: "Upload audio",
    hint: "Multilingual Parakeet V3 · Text is added to your summary automatically (30 minutes maximum, 100 MB). Keep this tab open while processing.",
    unsupported: "The microphone requires HTTPS and a supported browser. You can also upload audio.",
    microphone: "The microphone is unavailable or permission was denied.",
    failed: "Transcription failed. Try again with this audio.", empty: "No speech detected. Try speaking closer to the microphone.",
    recordingFailed: "Recording failed. Please try again.", retry: "Retry transcription"
  }
};

export function SummaryRecorder({ locale, disabled, onTranscript, onBusyChange }: SummaryRecorderProps) {
  const copy = COPY[locale];
  const [state, setState] = useState<RecordingState>("idle");
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [retryAudio, setRetryAudio] = useState<File>();
  const inputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | undefined>(undefined);
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const requestRef = useRef<AbortController | undefined>(undefined);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  useEffect(() => {
    onBusyChange?.(state !== "idle");
  }, [state, onBusyChange]);

  useEffect(() => () => { onBusyChange?.(false); }, [onBusyChange]);

  function releaseMicrophone() {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = undefined;
  }

  useEffect(() => () => {
    generationRef.current += 1;
    requestRef.current?.abort();
    const recorder = recorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.ondataavailable = null;
      if (recorder.state !== "inactive") recorder.stop();
    }
    releaseMicrophone();
    busyRef.current = false;
  }, []);

  async function transcribe(file: File) {
    if (file.size > MAX_AUDIO_BYTES) {
      busyRef.current = false;
      setState("idle");
      setError(copy.tooLarge);
      return;
    }
    const generation = generationRef.current;
    const controller = new AbortController();
    requestRef.current = controller;
    busyRef.current = true;
    setState("uploading");
    setProgress(0);
    setError("");
    setRetryAudio(file);
    try {
      const transcript = (await transcribeAudio(file, controller.signal, (percent) => {
        if (generation === generationRef.current && !controller.signal.aborted) {
          setState("transcribing");
          setProgress(percent);
        }
      })).trim();
      if (generation !== generationRef.current || controller.signal.aborted) return;
      if (!transcript) throw new Error(copy.empty);
      onTranscriptRef.current(transcript);
      setRetryAudio(undefined);
    } catch (cause) {
      if (generation !== generationRef.current) return;
      setError(controller.signal.aborted ? copy.cancelled : cause instanceof Error ? cause.message : copy.failed);
    } finally {
      if (generation === generationRef.current) {
        busyRef.current = false;
        setState("idle");
      }
    }
  }

  function finishRecording(recorder: MediaRecorder, chunks: Blob[]) {
    releaseMicrophone();
    const type = recorder.mimeType || "audio/webm";
    const audio = new Blob(chunks, { type });
    if (!audio.size) {
      busyRef.current = false;
      setState("idle");
      setError(copy.recordingFailed);
      return;
    }
    const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    void transcribe(new File([audio], `summary.${extension}`, { type }));
  }

  async function startRecording() {
    if (busyRef.current || disabled) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError(copy.unsupported);
      return;
    }
    busyRef.current = true;
    setState("requesting");
    setError("");
    const generation = generationRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generation !== generationRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      beginRecording(stream);
    } catch {
      if (generation !== generationRef.current) return;
      releaseMicrophone();
      busyRef.current = false;
      setState("idle");
      setError(copy.microphone);
    }
  }

  function beginRecording(stream: MediaStream) {
    const mimeType = AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorderRef.current = recorder;
    let audioBytes = 0;
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
      audioBytes += event.data.size;
      if (audioBytes >= MAX_AUDIO_BYTES - 1024 * 1024 && recorder.state === "recording") recorder.stop();
    };
    recorder.onstop = () => finishRecording(recorder, chunks);
    recorder.onerror = () => {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      releaseMicrophone();
      busyRef.current = false;
      setState("idle");
      setError(copy.recordingFailed);
    };
    recorder.start(1000);
    const startedAt = Date.now();
    setElapsed(0);
    setState("recording");
    timerRef.current = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      setElapsed(seconds);
      if (seconds >= MAX_RECORDING_SECONDS - 1 && recorder.state === "recording") recorder.stop();
    }, 250);
  }

  const isRecording = state === "recording";
  const isBusy = state !== "idle";
  const time = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;
  return <div className="mt-2 space-y-2">
    <div className="flex flex-wrap items-center gap-2">
      <IconButton type="button" onClick={isRecording ? () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); } : startRecording}
        disabled={!isRecording && (disabled || isBusy)} aria-pressed={isRecording}
        className={isRecording ? "border-risk/50 text-risk" : ""}>
        {isRecording ? <Square className="h-4 w-4 fill-current" /> : isBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
        {isRecording ? copy.stop : state === "requesting" ? copy.requesting : state === "uploading" ? copy.uploading : state === "transcribing" ? copy.transcribing : copy.start}
      </IconButton>
      <IconButton type="button" disabled={disabled || isBusy} onClick={() => inputRef.current?.click()}>
        <Upload className="h-4 w-4" />{copy.upload}
      </IconButton>
      {state === "uploading" || state === "transcribing" ? <IconButton type="button" onClick={() => requestRef.current?.abort()}>{copy.cancel}</IconButton> : null}
      {isRecording ? <span role="status" className="flex items-center gap-2 text-sm text-risk"><span className="h-2 w-2 animate-pulse rounded-full bg-risk" />{copy.recording} {time}</span> : null}
      {error && retryAudio && !isBusy ? <IconButton type="button" disabled={disabled} onClick={() => { if (!busyRef.current) void transcribe(retryAudio); }}>{copy.retry}</IconButton> : null}
    </div>
    <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={(event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file && !busyRef.current && !disabled) void transcribe(file);
    }} />
    <p className="text-xs text-muted">{copy.hint}</p>
    <p role="status" className="text-sm text-muted">{state === "uploading" ? copy.uploading : state === "transcribing" ? `${copy.transcribing} ${progress}%` : ""}</p>
    {state === "transcribing" ? <progress value={progress} max={100} aria-label={copy.transcribing} className="h-2 w-full accent-accent" /> : null}
    {error ? <p role="alert" className="text-sm text-risk">{error}</p> : null}
  </div>;
}

"use client";

import { Ban, ChevronDown, Clock3, Mic, Moon, PencilLine, Save, Send, Square, X, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DurationInput } from "@/components/DurationInput";
import { ScoreCard } from "@/components/ScoreCard";
import { SliderField } from "@/components/SliderField";
import { TagsField } from "@/components/TagCompanyFields";
import { ToggleField } from "@/components/ToggleField";
import {
  FieldLabel,
  GhostButton,
  IconButton,
  Metric,
  Panel,
  PrimaryButton,
  SecondaryButton,
  SelectInput,
  TextArea,
  TextInput
} from "@/components/ui";
import {
  loadDailyLog,
  saveDailyLog,
  type DailyLogResponse,
  type DailyLogScores
} from "@/features/daily-log/api/dailyLogApi";
import { listTags } from "@/features/shared/api/tagsApi";
import type { Tag } from "@/features/shared/domain/tagCompany";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import {
  calculateWorkRatio,
  createDailyLogDraft,
  parseStoredDailyLogDraft,
  resolveMainBlocker,
  sanitizeDailyLogDraft,
  workRatioLevel,
  type DailyLogDraft,
  type DayLogStatus
} from "@/features/daily-log/domain/dailyLog";
import { formatDisplayDate } from "@/lib/dates";
import { transcribeAudio } from "@/lib/whisper";

export function DailyLogForm({
  selectedDate,
  defaultSleepDelayMin,
  calorieTarget
}: {
  selectedDate: string;
  defaultSleepDelayMin: number;
  calorieTarget: number;
}) {
  const { locale } = useLocale();
  const copy = DAILY_LOG_COPY[locale];
  const [log, setLog] = useState<DailyLogDraft>(createDailyLogDraft(selectedDate, defaultSleepDelayMin, calorieTarget));
  const [metrics, setMetrics] = useState<DailyLogResponse["todoMetrics"] | null>(null);
  const [calendar, setCalendar] = useState<DailyLogResponse["calendarContext"] | null>(null);
  const [scores, setScores] = useState<DailyLogScores | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saveState, setSaveState] = useState("Restoring");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [recordCreatedAt, setRecordCreatedAt] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioFileName, setAudioFileName] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState("");
  const [transcriptionError, setTranscriptionError] = useState("");
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const loaded = useRef(false);
  const activeDateRef = useRef(selectedDate);
  const pendingAutosaveTimerRef = useRef<number | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const storageKey = `life-regime:daily-log:${selectedDate}`;

  useEffect(() => {
    loaded.current = false;
    activeDateRef.current = selectedDate;
    const restoreController = new AbortController();

    async function restore() {
      try {
        const server = await loadDailyLog(selectedDate, restoreController.signal);
        const localDraft = parseStoredDailyLogDraft(localStorage.getItem(storageKey));
        const serverUpdatedAt = server.log?.updatedAt ? Date.parse(server.log.updatedAt) : 0;
        const localSavedAt = localDraft?.savedAt ? Date.parse(localDraft.savedAt) : 0;
        const shouldRestoreLocalDraft = Boolean(localDraft && (!server.log || localSavedAt > serverUpdatedAt));
        const restoredLog = sanitizeDailyLogDraft({
          ...createDailyLogDraft(selectedDate, defaultSleepDelayMin, calorieTarget),
          ...(server.log ?? {}),
          ...(shouldRestoreLocalDraft ? localDraft?.log : {})
        } as DailyLogDraft);
        if (restoreController.signal.aborted || activeDateRef.current !== selectedDate) return;
        setLog(restoredLog);
        setMetrics(server.todoMetrics);
        setCalendar(server.calendarContext);
        setScores(server.log);
        setRecordCreatedAt(server.log?.createdAt ?? null);
        setSaveState(shouldRestoreLocalDraft ? "Local draft restored" : "Restored");
        setLastSavedAt(server.log?.updatedAt ? new Date(server.log.updatedAt) : null);
        loaded.current = true;
      } catch (restoreError) {
        if (restoreController.signal.aborted) return;
        setSaveState(restoreError instanceof Error ? restoreError.message : "Restore failed");
      }
    }
    void restore();
    return () => restoreController.abort();
  }, [storageKey, selectedDate, defaultSleepDelayMin, calorieTarget]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const requestController = new AbortController();
    void listTags(requestController.signal)
      .then(setAvailableTags)
      .catch(() => undefined);
    return () => requestController.abort();
  }, []);

  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        recorder.onstop = null;
        recorder.stop();
      }
      stopRecordingStream();
    };
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    localStorage.setItem(storageKey, JSON.stringify({ savedAt: new Date().toISOString(), log }));
    setSaveState("Saving...");
    pendingAutosaveTimerRef.current = window.setTimeout(() => {
      const preservedStatus = ["submitted", "skipped", "analyzed"].includes(log.status) ? log.status : "draft";
      pendingAutosaveTimerRef.current = null;
      void enqueueSave(log, preservedStatus, "Autosaved");
    }, 550);
    return () => {
      if (pendingAutosaveTimerRef.current !== null) {
        window.clearTimeout(pendingAutosaveTimerRef.current);
        pendingAutosaveTimerRef.current = null;
      }
    };
  }, [log, storageKey]);

  const update = (patch: Partial<DailyLogDraft>) => setLog((current) => sanitizeDailyLogDraft({ ...current, ...patch }));
  const stateScorePreview = useMemo(
    () => Math.round(0.4 * log.energy + 0.4 * log.productivity + 0.2 * (100 - log.startFriction)),
    [log.energy, log.productivity, log.startFriction]
  );

  async function submit() {
    const submittedDate = log.date;
    cancelPendingAutosave();
    const wasSaved = await enqueueSave(log, "submitted", "Submitted and editable");
    if (wasSaved && activeDateRef.current === submittedDate) {
      setLog((current) => ({ ...current, status: "submitted" }));
    }
  }

  async function skipDay() {
    const skippedDate = log.date;
    cancelPendingAutosave();
    const wasSaved = await enqueueSave(log, "skipped", "Skipped and editable");
    if (wasSaved && activeDateRef.current === skippedDate) {
      setLog((current) => ({ ...current, status: "skipped" }));
    }
  }

  function cancelPendingAutosave() {
    if (pendingAutosaveTimerRef.current === null) return;
    window.clearTimeout(pendingAutosaveTimerRef.current);
    pendingAutosaveTimerRef.current = null;
  }

  function enqueueSave(
    draft: DailyLogDraft,
    status: DayLogStatus,
    successLabel: string
  ): Promise<boolean> {
    const dateAtQueueTime = draft.date;
    const normalizedDraft = {
      ...draft,
      mainBlocker: resolveMainBlocker(draft.mainBlocker, draft.mainBlockerOtherText)
    };
    let wasSaved = false;
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const response = await saveDailyLog(normalizedDraft, status);
        wasSaved = true;
        if (activeDateRef.current !== dateAtQueueTime) return;
        setMetrics(response.todoMetrics);
        setCalendar(response.calendarContext);
        setScores(response.log);
        setRecordCreatedAt(response.log?.createdAt ?? null);
        setLastSavedAt(new Date());
        setSaveState(successLabel);
      })
      .catch((saveError: unknown) => {
        if (activeDateRef.current !== dateAtQueueTime) return;
        setSaveState(saveError instanceof Error ? saveError.message : "Save failed");
      });
    return saveQueueRef.current.then(() => wasSaved);
  }

  function markSleep() {
    update({ sleepIntentClickedAt: new Date().toISOString() });
  }

  function stopRecordingStream() {
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setRecordingError("Recording is not supported in this browser.");
      return;
    }

    try {
      setRecordingError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedAudioMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordingChunksRef.current = [];
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setRecordingError("Recording failed. Please try again.");
        setIsRecording(false);
        stopRecordingStream();
      };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(recordingChunksRef.current, { type });
        if (!blob.size) {
          setRecordingError("No audio was captured. Please try again.");
          setIsRecording(false);
          stopRecordingStream();
          return;
        }
        const file = new File([blob], `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.${audioExtension(type)}`, { type });
        setAudioFile(file);
        setAudioFileName(file.name);
        setIsRecording(false);
        stopRecordingStream();
        void transcribeFile(file);
      };

      recorder.start();
      setIsRecording(true);
      update({ transcriptionStatus: "idle" });
    } catch (error) {
      setRecordingError("Microphone access was blocked or unavailable.");
      setIsRecording(false);
      stopRecordingStream();
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  }

  async function transcribeSelectedAudio() {
    if (!audioFile) return;
    await transcribeFile(audioFile);
  }

  async function transcribeFile(file: File) {
    setTranscriptionError("");
    update({ transcriptionStatus: "uploading" });
    try {
      update({ transcriptionStatus: "transcribing" });
      const transcript = await transcribeAudio(file);
      update({
        voiceTranscript: transcript,
        transcriptionStatus: "done"
      });
    } catch (error) {
      setTranscriptionError(error instanceof Error ? error.message : "Transcription failed.");
      update({ transcriptionStatus: "error" });
    }
  }

  const autosaveLabel = useMemo(() => {
    if (saveState === "Saving...") return "Saving...";
    if (!lastSavedAt) return saveState;
    const seconds = Math.max(0, Math.round((now.getTime() - lastSavedAt.getTime()) / 1000));
    return `Autosaved ${seconds}s ago`;
  }, [lastSavedAt, now, saveState]);
  const workRatio = useMemo(
    () => calculateWorkRatio(log.workTimeMinutes, log.distractionTimeMinutes),
    [log.distractionTimeMinutes, log.workTimeMinutes]
  );
  const ratioLevel = workRatioLevel(workRatio);

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-semibold uppercase text-accent">{formatDisplayDate(selectedDate)}</p>
          <h1 className="mt-1 text-3xl font-semibold text-ink">{copy.title}</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted">
            <Zap className="h-4 w-4 text-accent" />
            {copy.detail}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-line bg-panel px-3 py-2 text-sm font-semibold text-muted">
          <Save className="h-4 w-4" />
          {autosaveLabel}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2 rounded-md border border-line bg-panel px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-ink">
          <PencilLine className="h-4 w-4 text-accent" />
          <span className="font-semibold">{recordCreatedAt ? copy.editingSaved : copy.creating}</span>
        </div>
        <div className="text-muted">
          {copy.logDate}: <strong className="text-ink">{selectedDate}</strong>
          {recordCreatedAt ? <> · {copy.created}: <time dateTime={recordCreatedAt}>{new Date(recordCreatedAt).toLocaleString(locale === "fr" ? "fr-FR" : "en-US")}</time></> : null}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.8fr)]">
        <Panel className="space-y-5">
          <SliderField label="Energy" value={log.energy} onChange={(energy) => update({ energy })} />
          <SliderField label="Productivity" value={log.productivity} onChange={(productivity) => update({ productivity })} />
          <SliderField
            label="Start friction"
            value={log.startFriction}
            onChange={(startFriction) => update({ startFriction })}
          />
          <SliderField
            label="Calories"
            min={50}
            max={150}
            suffix="%"
            value={log.caloriePercent}
            onChange={(caloriePercent) => update({ caloriePercent })}
          />
          <ToggleField label="Training done" value={log.trainingDone} onChange={(trainingDone) => update({ trainingDone })} />
          <div>
            <FieldLabel>Optional summary</FieldLabel>
            <TextArea
              value={log.textSummary}
              onChange={(event) => update({ textSummary: event.target.value })}
              className="mt-2 min-h-24"
              placeholder="One sentence is enough."
            />
          </div>
          <div className="space-y-4 border-t border-line pt-4">
            <p className="text-sm font-semibold text-ink">{copy.reflection}</p>
            <ListField
              label={copy.wins}
              placeholder={copy.winPlaceholder}
              values={log.wins}
              onChange={(wins) => update({ wins })}
            />
            <ListField
              label={copy.improvements}
              placeholder={copy.improvementPlaceholder}
              values={log.topImprovements}
              onChange={(topImprovements) => update({ topImprovements })}
              max={3}
            />
            <ListField
              label={copy.blockers}
              placeholder={copy.blockerPlaceholder}
              values={log.blockers}
              onChange={(blockers) => update({ blockers })}
            />
            <ListField
              label={copy.tomorrow}
              placeholder={copy.tomorrowPlaceholder}
              values={log.tomorrowPriorities}
              onChange={(tomorrowPriorities) => update({ tomorrowPriorities })}
            />
            <TagsField value={log.tags} onChange={(tags) => update({ tags })} tags={availableTags} label={copy.tags} placeholder={copy.addTag} removeTagLabel={(name) => copy.removeTag.replace("{name}", name)} />
            <CustomFieldsEditor value={log.customFields} onChange={(customFields) => update({ customFields })} />
          </div>

          <div>
            <FieldLabel>Voice transcript placeholder</FieldLabel>
            <TextArea
              value={log.voiceTranscript}
              onChange={(event) => update({ voiceTranscript: event.target.value })}
              className="mt-2 min-h-20"
              placeholder="Whisper transcription will land here later."
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setAudioFile(file);
                setAudioFileName(file?.name ?? "");
                if (file) update({ transcriptionStatus: "idle" });
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted">
              <IconButton
                type="button"
                onClick={() => audioInputRef.current?.click()}
                title="Pick an audio file"
                disabled={isRecording}
              >
                <Mic className="h-4 w-4" />
                {audioFileName ? "Replace audio" : "Upload audio"}
              </IconButton>
              <IconButton
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={isRecording ? "border-risk/50 text-risk hover:border-risk hover:text-risk" : ""}
              >
                {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {isRecording ? "Stop recording" : "Start recording"}
              </IconButton>
              <IconButton
                type="button"
                onClick={transcribeSelectedAudio}
                disabled={!audioFile || isRecording || log.transcriptionStatus === "uploading" || log.transcriptionStatus === "transcribing"}
              >
                {log.transcriptionStatus === "uploading" || log.transcriptionStatus === "transcribing" ? "Working..." : "Transcribe"}
              </IconButton>
              <span>Transcription: {isRecording ? "recording" : log.transcriptionStatus}</span>
              {recordingError ? <span className="text-risk">{recordingError}</span> : null}
              {transcriptionError ? <span className="text-risk">{transcriptionError}</span> : null}
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={() => setAdvancedOpen((value) => !value)}
              className="focus-ring flex w-full items-center justify-between rounded-md text-left text-sm font-semibold text-ink"
            >
              Advanced optional signal
              <ChevronDown className={`h-4 w-4 transition ${advancedOpen ? "rotate-180" : ""}`} />
            </button>
            {advancedOpen ? (
              <div className="mt-4 space-y-5">
                <SliderField label="Mental fatigue" value={log.mentalFatigue} onChange={(mentalFatigue) => update({ mentalFatigue })} />
                <SliderField label="Physical fatigue" value={log.physicalFatigue} onChange={(physicalFatigue) => update({ physicalFatigue })} />
                <SliderField label="Focus quality" value={log.focusQuality} onChange={(focusQuality) => update({ focusQuality })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DurationInput
                    label="Work time"
                    value={log.workTimeMinutes}
                    onChange={(workTimeMinutes) => update({ workTimeMinutes })}
                    placeholder="3d 4h 5m"
                  />
                  <DurationInput
                    label="Distraction time"
                    value={log.distractionTimeMinutes}
                    onChange={(distractionTimeMinutes) => update({ distractionTimeMinutes })}
                    placeholder="3d 4h 5m"
                  />
                </div>
                <ToggleField
                  label="Avoided important task"
                  value={log.avoidedImportantTask}
                  onChange={(avoidedImportantTask) => update({ avoidedImportantTask })}
                />
                <div>
                  <FieldLabel>Main blocker</FieldLabel>
                  <SelectInput
                    value={log.mainBlocker}
                    onChange={(event) => update({ mainBlocker: event.target.value, mainBlockerOtherText: event.target.value === "other" ? log.mainBlockerOtherText : "" })}
                    className="mt-2 w-full"
                  >
                    {["none", "fatigue", "phone", "stress", "unclear task", "lack of time", "social", "transport", "other"].map(
                      (blocker) => (
                        <option key={blocker} value={blocker}>
                          {blocker}
                        </option>
                      )
                    )}
                  </SelectInput>
                </div>
                {log.mainBlocker === "other" ? (
                  <div>
                    <FieldLabel>Préciser</FieldLabel>
                    <TextArea
                      value={log.mainBlockerOtherText}
                      onChange={(event) => update({ mainBlockerOtherText: event.target.value })}
                      className="mt-2 min-h-20"
                      placeholder="Describe the blocker in your own words."
                    />
                  </div>
                ) : null}
                <div>
                  <FieldLabel>What should be improved tomorrow?</FieldLabel>
                  <TextArea
                    value={log.improvementTomorrow}
                    onChange={(event) => update({ improvementTomorrow: event.target.value })}
                    className="mt-2 min-h-20"
                    placeholder="One concrete adjustment."
                  />
                </div>
              </div>
            ) : null}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel>
            <FieldLabel>{copy.workRatio}</FieldLabel>
            <div className={`mt-3 rounded-md border px-4 py-4 ${RATIO_TONES[ratioLevel]}`}>
              <div className="flex items-end justify-between gap-3">
                <strong className="text-3xl">{workRatio === null ? "—" : `${Math.round(workRatio * 100)}%`}</strong>
                <span className="text-sm font-semibold uppercase">{copy[ratioLevel]}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-shell/70">
                <div className="h-full rounded-full bg-current transition-[width]" style={{ width: `${Math.round((workRatio ?? 0) * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs opacity-85">{copy.ratioFormula}</p>
            </div>
          </Panel>
          <ScoreCard
            executionScore={scores?.executionScore}
            stateScore={scores?.stateScore ?? stateScorePreview}
            riskScore={scores?.riskScore}
            riskDelta={scores?.riskDelta}
            riskAcceleration={scores?.riskAcceleration}
            context={calendar?.activePhase}
          />
          <Panel>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Tasks" value={String(metrics?.tasksPlanned ?? 0)} />
              <Metric label="Weighted done" value={`${Math.round((metrics?.weightedCompletionRate ?? 0) * 100)}%`} />
              <Metric label="Missed high" value={String(metrics?.missedImportantTasks ?? 0)} tone="risk" />
              <Metric label="Productive" value={`${Math.round((metrics?.productiveTaskCompletion ?? 0) * 100)}%`} tone="good" />
            </div>
          </Panel>
          <Panel>
            <FieldLabel>Sleep intent</FieldLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton onClick={markSleep}>
                <Moon className="h-4 w-4" />
                I am going to sleep
              </PrimaryButton>
              <SelectInput
                value={log.estimatedSleepDelayMin}
                onChange={(event) => update({ estimatedSleepDelayMin: Number(event.target.value) })}
              >
                {[10, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} min
                  </option>
                ))}
              </SelectInput>
            </div>
            <p className="mt-3 flex items-center gap-2 text-sm text-muted">
              <Clock3 className="h-4 w-4" />
              {log.sleepIntentClickedAt ? `Saved at ${new Date(log.sleepIntentClickedAt).toLocaleTimeString()}` : "Not marked yet"}
            </p>
          </Panel>
          <div className="grid grid-cols-2 gap-2">
            <IconButton onClick={skipDay}>
              <Ban className="h-4 w-4" />
              Skip day
            </IconButton>
            <PrimaryButton onClick={submit}>
              <Send className="h-4 w-4" />
              {recordCreatedAt ? copy.updateLog : copy.submitLog}
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ListField({
  label,
  placeholder,
  values,
  onChange,
  max
}: {
  label: string;
  placeholder: string;
  values: string[];
  onChange: (values: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const atLimit = max !== undefined && values.length >= max;

  function add() {
    const trimmed = draft.trim();
    if (!trimmed || atLimit) return;
    onChange([...values, trimmed]);
    setDraft("");
  }

  function remove(index: number) {
    onChange(values.filter((_, current) => current !== index));
  }

  return (
    <div>
      <FieldLabel>
        {label}
        {max ? ` (max ${max})` : ""}
      </FieldLabel>
      <div className="mt-2 space-y-2">
        {values.map((value, index) => (
          <div key={`${value}-${index}`} className="flex items-center gap-2">
            <span className="flex-1 truncate rounded-2xl bg-panel2/50 px-3 py-2 text-sm text-ink ring-1 ring-line">{value}</span>
            <GhostButton type="button" onClick={() => remove(index)} className="min-h-9 min-w-9 shrink-0 rounded-2xl px-0">
              <X className="h-4 w-4" />
            </GhostButton>
          </div>
        ))}
        {!atLimit ? (
          <div className="flex items-center gap-2">
            <TextInput
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  add();
                }
              }}
              placeholder={placeholder}
              className="flex-1"
            />
            <SecondaryButton type="button" onClick={add}>
              Add
            </SecondaryButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CustomFieldsEditor({
  value,
  onChange
}: {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
}) {
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const entries = Object.entries(value);

  function addField() {
    const key = newKey.trim();
    if (!key) return;
    onChange({ ...value, [key]: newValue });
    setNewKey("");
    setNewValue("");
  }

  function removeField(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  return (
    <div>
      <FieldLabel>Custom fields (optional)</FieldLabel>
      <div className="mt-2 space-y-2">
        {entries.map(([key, fieldValue]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-1/3 shrink-0 truncate rounded-2xl bg-panel2/50 px-3 py-2 text-sm text-muted ring-1 ring-line">{key}</span>
            <TextInput value={fieldValue} onChange={(event) => onChange({ ...value, [key]: event.target.value })} className="flex-1" />
            <GhostButton type="button" onClick={() => removeField(key)} className="min-h-9 min-w-9 shrink-0 rounded-2xl px-0">
              <X className="h-4 w-4" />
            </GhostButton>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <TextInput
            value={newKey}
            onChange={(event) => setNewKey(event.target.value)}
            placeholder="Field name"
            className="w-1/3 shrink-0"
          />
          <TextInput value={newValue} onChange={(event) => setNewValue(event.target.value)} placeholder="Value" className="flex-1" />
          <SecondaryButton type="button" onClick={addField}>
            Add
          </SecondaryButton>
        </div>
      </div>
    </div>
  );
}

function getSupportedAudioMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((type) =>
    MediaRecorder.isTypeSupported(type)
  ) ?? "";
}

function audioExtension(mimeType: string) {
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

const RATIO_TONES = {
  red: "border-risk/50 bg-risk/12 text-risk",
  orange: "border-orange-400/50 bg-orange-400/12 text-orange-300",
  yellow: "border-yellow-300/50 bg-yellow-300/12 text-yellow-200",
  green: "border-good/50 bg-good/12 text-good"
} as const;

const DAILY_LOG_COPY = {
  en: {
    title: "Daily Log", detail: "Quick pass: sliders, training, sleep. Full pass: add one short summary.", editingSaved: "Editing a saved entry", creating: "Creating a new entry", logDate: "Log date", created: "Created", reflection: "Summary reflection", wins: "Wins", winPlaceholder: "Something that went well", improvements: "Top 3 things to improve", improvementPlaceholder: "One concrete improvement", blockers: "Blockers", blockerPlaceholder: "What got in the way", tomorrow: "Tomorrow's priorities", tomorrowPlaceholder: "What matters most tomorrow", tags: "Tags", addTag: "Add a tag", removeTag: "Remove {name} tag", workRatio: "Work / entertainment ratio", ratioFormula: "Work ÷ (work + distraction). A fully work-focused ratio of 1 is green.", red: "red", orange: "orange", yellow: "yellow", green: "green", submitLog: "Submit log", updateLog: "Update saved log"
  },
  fr: {
    title: "Journal quotidien", detail: "Passage rapide : curseurs, entraînement, sommeil. Passage complet : ajoutez un bref résumé.", editingSaved: "Modification d’une entrée enregistrée", creating: "Création d’une nouvelle entrée", logDate: "Date du journal", created: "Créée le", reflection: "Bilan synthétique", wins: "Réussites", winPlaceholder: "Ce qui s’est bien passé", improvements: "Trois améliorations prioritaires", improvementPlaceholder: "Une amélioration concrète", blockers: "Blocages", blockerPlaceholder: "Ce qui a gêné", tomorrow: "Priorités de demain", tomorrowPlaceholder: "Ce qui compte le plus demain", tags: "Tags", addTag: "Ajouter un tag", removeTag: "Retirer le tag {name}", workRatio: "Ratio travail / divertissement", ratioFormula: "Travail ÷ (travail + distraction). Un ratio de 1, entièrement consacré au travail, est vert.", red: "rouge", orange: "orange", yellow: "jaune", green: "vert", submitLog: "Envoyer le journal", updateLog: "Mettre à jour le journal"
  }
} as const;

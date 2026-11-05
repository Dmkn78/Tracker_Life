"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocale } from "@/features/interface/localization/LocaleProvider";
import { saveCaptureOnline } from "../api/quickCaptureApi";
import { OPEN_CAPTURE_EVENT, readRequestedCaptureKind, type CaptureKind, type CaptureSubmitter } from "../domain/quickCapture";
import { QuickCaptureSheet } from "./QuickCaptureSheet";
import { QUICK_CAPTURE_COPY } from "./quickCaptureCopy";

/**
 * Floating "+" available on every screen. It also opens on `?capture=task|note`
 * (home-screen shortcuts) and on the OPEN_CAPTURE_EVENT (header button, notification).
 */
export function QuickCaptureLauncher({ submitCapture = saveCaptureOnline, buttonClassName = "bottom-6 right-5" }: {
  submitCapture?: CaptureSubmitter;
  buttonClassName?: string;
}): React.ReactElement {
  const { locale } = useLocale();
  const copy = QUICK_CAPTURE_COPY[locale];
  const [openKind, setOpenKind] = useState<CaptureKind | null>(null);
  const close = useCallback(() => setOpenKind(null), []);

  useEffect(() => {
    const requestedKind = readRequestedCaptureKind(window.location.search);
    if (requestedKind) setOpenKind(requestedKind);
    const openFromEvent = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      setOpenKind(detail === "note" ? "note" : "task");
    };
    window.addEventListener(OPEN_CAPTURE_EVENT, openFromEvent);
    return () => window.removeEventListener(OPEN_CAPTURE_EVENT, openFromEvent);
  }, []);

  return (
    <>
      {openKind === null ? (
        <button
          type="button"
          aria-label={copy.open}
          title={copy.open}
          onClick={() => setOpenKind("task")}
          className={`focus-ring fixed z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent text-onaccent shadow-[0_12px_30px_rgba(0,0,0,0.35)] transition hover:brightness-105 ${buttonClassName}`}
        >
          <Plus className="h-6 w-6" />
        </button>
      ) : (
        <QuickCaptureSheet key={openKind} initialKind={openKind} submitCapture={submitCapture} onClose={close} />
      )}
    </>
  );
}

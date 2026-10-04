"use client";

import { useCallback, useState } from "react";
import { TodoClient } from "./TodoClient";
import { toDateKey } from "@/lib/dates";
import { showTaskKeyboard } from "@/mobile/quickCapture";

export function WebsiteTodoClient({ today, createToday }: { today: string; createToday: boolean }) {
  const [createDate, setCreateDate] = useState<string | null>(() => createToday ? toDateKey() : null);
  const opened = useCallback(() => {
    setCreateDate(null);
    const url = new URL(location.href);
    url.searchParams.delete("create");
    history.replaceState(history.state, "", url);
    void showTaskKeyboard().catch(() => undefined);
  }, []);
  return <TodoClient today={today} createDate={createDate} onCreateOpened={opened} />;
}

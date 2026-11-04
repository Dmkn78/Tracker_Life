"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CAPTURE_SAVED_EVENT } from "@/features/quick-capture/domain/quickCapture";
import { createTodoTasks, deleteTodoTask, updateTodoTask } from "@/features/todo/api/todoApi";
import { fetchWeekBoard, saveRecap, type RecapTarget } from "../api/weekApi";
import {
  destinationDate,
  moveTaskOnBoard,
  nextCheckboxStatus,
  removeTaskFromBoard,
  updateTaskOnBoard,
  type BoardTask,
  type TaskDestination,
  type WeekBoard
} from "../domain/weekBoard";

export type WeekBoardState =
  | { kind: "loading" }
  | { kind: "ready"; board: WeekBoard }
  | { kind: "failed"; message: string };

export type WeekBoardActions = {
  showWeek: (weekId: string) => void;
  addTask: (title: string, destination: TaskDestination) => Promise<void>;
  toggleTask: (task: BoardTask) => Promise<void>;
  markNotDone: (task: BoardTask) => Promise<void>;
  renameTask: (task: BoardTask, title: string) => Promise<void>;
  moveTask: (taskId: string, destination: TaskDestination) => Promise<void>;
  removeTask: (task: BoardTask) => Promise<void>;
  writeRecap: (target: RecapTarget, text: string) => Promise<void>;
};

/**
 * Orchestrates the weekly board: optimistic updates for instant feedback,
 * then a single reload from the server so the board always ends up consistent.
 */
export function useWeekBoard(): { state: WeekBoardState; actionError: string; actions: WeekBoardActions } {
  const [weekId, setWeekId] = useState<string | null>(null);
  const [state, setState] = useState<WeekBoardState>({ kind: "loading" });
  const [actionError, setActionError] = useState("");
  const loadRequest = useRef<AbortController | null>(null);

  const reload = useCallback(async (requestedWeekId: string | null): Promise<void> => {
    loadRequest.current?.abort();
    const controller = new AbortController();
    loadRequest.current = controller;
    try {
      const board = await fetchWeekBoard(requestedWeekId, controller.signal);
      if (!controller.signal.aborted) { setState({ kind: "ready", board }); setActionError(""); }
    } catch (error: unknown) {
      if (controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : "";
      // A board already on screen stays usable offline; only the very first load shows the failure screen.
      setState((current) => (current.kind === "ready" ? current : { kind: "failed", message }));
      setActionError(message);
    }
  }, []);

  useEffect(() => {
    void reload(weekId);
    return () => loadRequest.current?.abort();
  }, [reload, weekId]);

  useEffect(() => {
    const reloadAfterCapture = () => { void reload(weekId); };
    window.addEventListener(CAPTURE_SAVED_EVENT, reloadAfterCapture);
    window.addEventListener("online", reloadAfterCapture);
    return () => {
      window.removeEventListener(CAPTURE_SAVED_EVENT, reloadAfterCapture);
      window.removeEventListener("online", reloadAfterCapture);
    };
  }, [reload, weekId]);

  const runOptimistic = useCallback(async (applyLocally: (board: WeekBoard) => WeekBoard, persist: () => Promise<unknown>): Promise<void> => {
    setActionError("");
    setState((current) => (current.kind === "ready" ? { kind: "ready", board: applyLocally(current.board) } : current));
    try {
      await persist();
    } catch (error: unknown) {
      await reload(weekId);
      setActionError(error instanceof Error ? error.message : "");
      return;
    }
    await reload(weekId);
  }, [reload, weekId]);

  const actions: WeekBoardActions = {
    showWeek: (nextWeekId) => { setState({ kind: "loading" }); setWeekId(nextWeekId); },
    addTask: (title, destination) => runOptimistic((board) => board, () => createTodoTasks({ items: [{ title, date: destinationDate(destination) }] })),
    toggleTask: (task) => {
      const status = nextCheckboxStatus(task.status);
      return runOptimistic((board) => updateTaskOnBoard(board, task.id, { status }), () => updateTodoTask({ id: task.id, status }));
    },
    markNotDone: (task) => runOptimistic((board) => updateTaskOnBoard(board, task.id, { status: "not_done" }), () => updateTodoTask({ id: task.id, status: "not_done" })),
    renameTask: (task, title) => runOptimistic((board) => updateTaskOnBoard(board, task.id, { title }), () => updateTodoTask({ id: task.id, title })),
    moveTask: (taskId, destination) => runOptimistic((board) => moveTaskOnBoard(board, taskId, destination), () => updateTodoTask({ id: taskId, date: destinationDate(destination) })),
    removeTask: (task) => runOptimistic((board) => removeTaskFromBoard(board, task.id), () => deleteTodoTask(task.id)),
    writeRecap: (target, text) => runOptimistic((board) => board, () => saveRecap(target, text))
  };
  return { state, actionError, actions };
}

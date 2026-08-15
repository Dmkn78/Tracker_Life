export function restoreTaskOrder<Task extends { id: string }>(
  currentTasks: Task[],
  confirmedTaskIds: string[]
): Task[] {
  const currentTasksById = new Map(currentTasks.map((task) => [task.id, task]));
  const restoredTasks = confirmedTaskIds
    .map((taskId) => currentTasksById.get(taskId))
    .filter((task): task is Task => task !== undefined);
  const confirmedTaskIdSet = new Set(confirmedTaskIds);
  return [
    ...restoredTasks,
    ...currentTasks.filter((task) => !confirmedTaskIdSet.has(task.id))
  ];
}

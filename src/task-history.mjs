/** @param {import('./store.mjs').Task[]} tasks @returns {import('./store.mjs').Task[]} */
export function latestCompletedTasks(tasks) {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const latest = new Map();
  for (const task of tasks.filter((item) => item.done)) {
    let ancestor = task;
    const visited = new Set([task.id]);
    while (ancestor.repeatFromId && byId.has(ancestor.repeatFromId) && !visited.has(ancestor.repeatFromId)) {
      ancestor = byId.get(ancestor.repeatFromId);
      visited.add(ancestor.id);
    }
    const key = JSON.stringify([ancestor.id, task.farmId, task.plotId ?? '']);
    const previous = latest.get(key);
    if (!previous || completionTime(task) > completionTime(previous)) latest.set(key, task);
  }
  return [...latest.values()].sort((first, second) => completionTime(second).localeCompare(completionTime(first)));
}

/** @param {import('./store.mjs').Task} task @returns {string} */
const completionTime = (task) => task.completedAt ?? `${task.dueDate}T${task.time}`;

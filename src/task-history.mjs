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
    const key = JSON.stringify([task.scheduleId ?? ancestor.id, task.farmId, task.plotId ?? '']);
    const previous = latest.get(key);
    if (!previous || completionTime(task) > completionTime(previous)) latest.set(key, task);
  }
  return [...latest.values()].sort((first, second) => completionTime(second).localeCompare(completionTime(first)));
}

/** @param {import('./store.mjs').Task} task @returns {string} */
const completionTime = (task) => task.completedAt ?? `${task.dueDate}T${task.time}`;


const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const MILLISECONDS_PER_DAY = 86400000;
/** @typedef {import('./store.mjs').Task & {isProjected?:boolean}} CalendarTask */
/** @param {Date} date @returns {string} */
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
/** @param {import('./store.mjs').Task} task @returns {import('./store.mjs').Task|null} */
export function nextTaskOccurrence(task) {
  if (!task.repeat || task.repeat === 'none') return null;
  const date = new Date(`${task.dueDate}T${task.time}`);
  if (task.repeat === 'custom') {
    if (task.repeatUnit === 'days') date.setDate(date.getDate() + task.repeatInterval);
    else date.setMinutes(date.getMinutes() + task.repeatInterval * (task.repeatUnit === 'hours' ? MINUTES_PER_HOUR : 1));
  } else if (task.repeat === 'monthly') {
    const anchor = task.repeatAnchorDay ?? date.getDate();
    date.setDate(1); date.setMonth(date.getMonth()+1);
    date.setDate(Math.min(anchor,new Date(date.getFullYear(),date.getMonth()+1,0).getDate()));
  } else date.setDate(date.getDate() + (task.repeat === 'weekly' ? 7 : 1));
  if (!Number.isFinite(date.getTime())) return null;
  const dueDate = localDate(date);
  if (task.endDate && dueDate > task.endDate) return null;
  return {...task,dueDate,time:`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`,done:false};
}

/** @param {import('./store.mjs').Task[]} tasks @returns {import('./store.mjs').Task[][]} */
export function taskScheduleGroups(tasks) {
  const byId = new Map(tasks.map((task) => [task.id,task]));
  const groups = new Map();
  for (const task of tasks) {
    let ancestor = task;
    const visited = new Set([task.id]);
    while (ancestor.repeatFromId && byId.has(ancestor.repeatFromId) && !visited.has(ancestor.repeatFromId)) {
      ancestor = byId.get(ancestor.repeatFromId);
      visited.add(ancestor.id);
    }
    // Legacy field copies had no schedule ID; match only the same task and start time.
    const legacyKey = JSON.stringify([ancestor.title?.trim().toLowerCase(),ancestor.category,ancestor.dueDate,ancestor.time]);
    const key = JSON.stringify([task.farmId,task.scheduleId ?? ancestor.creationKey ?? legacyKey]);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(task);
  }
  return [...groups.values()];
}

/** @param {import('./store.mjs').Task[]} tasks @returns {import('./store.mjs').Task[][]} */
export function currentTaskRounds(tasks) {
  return taskScheduleGroups(tasks).flatMap((group) => {
    const pending = group.filter((task) => !task.done).sort((a,b) => `${a.dueDate}${a.time}`.localeCompare(`${b.dueDate}${b.time}`));
    if (!pending.length) return [];
    const first = pending[0];
    return [group.filter((task) => task.dueDate === first.dueDate && task.time === first.time)];
  });
}

/** @param {import('./store.mjs').Task} task @param {string} date @returns {CalendarTask|null} */
const firstOccurrenceOnDate = (task,date) => {
  if (date <= task.dueDate || !task.repeat || task.repeat === 'none' || (task.endDate && date > task.endDate)) return null;
  const days = (Date.parse(`${date}T00:00:00Z`)-Date.parse(`${task.dueDate}T00:00:00Z`))/MILLISECONDS_PER_DAY;
  const candidate = new Date(`${task.dueDate}T${task.time}`);
  if (task.repeat === 'monthly') {
    const months = (Number(date.slice(0,4))-candidate.getFullYear())*12 + Number(date.slice(5,7))-1-candidate.getMonth();
    candidate.setDate(1); candidate.setMonth(candidate.getMonth()+months);
    candidate.setDate(Math.min(task.repeatAnchorDay ?? Number(task.dueDate.slice(8)),new Date(candidate.getFullYear(),candidate.getMonth()+1,0).getDate()));
  } else if (task.repeat === 'custom' && task.repeatUnit !== 'days') {
    const interval = task.repeatInterval * (task.repeatUnit === 'hours' ? MINUTES_PER_HOUR : 1);
    if (!Number.isInteger(interval) || interval < 1) return null;
    const startMinutes = candidate.getHours()*MINUTES_PER_HOUR+candidate.getMinutes();
    candidate.setMinutes(candidate.getMinutes()+Math.ceil((days*MINUTES_PER_DAY-startMinutes)/interval)*interval);
  } else {
    const interval = task.repeat === 'custom' ? task.repeatInterval : task.repeat === 'weekly' ? 7 : 1;
    if (!Number.isInteger(interval) || interval < 1) return null;
    candidate.setDate(candidate.getDate()+Math.ceil(days/interval)*interval);
  }
  if (localDate(candidate) !== date) return null;
  return {...task,dueDate:date,time:`${String(candidate.getHours()).padStart(2,'0')}:${String(candidate.getMinutes()).padStart(2,'0')}`,done:false,isProjected:true};
};

/** @param {import('./store.mjs').Task[]} tasks @param {string} date @returns {CalendarTask[]} */
export function tasksOnCalendarDate(tasks,date) {
  const result = tasks.filter((task) => task.dueDate === date);
  for (const task of tasks.filter((item) => !item.done)) {
    let occurrence = task.dueDate === date ? nextTaskOccurrence(task) : firstOccurrenceOnDate(task,date);
    // A minute interval yields at most 1440 occurrences in one day, regardless of schedule length.
    for (let count=0; occurrence?.dueDate === date && count<MINUTES_PER_DAY; count+=1) {
      result.push({...occurrence,isProjected:true});
      occurrence = nextTaskOccurrence(occurrence);
    }
  }
  return result.sort((a,b) => a.time.localeCompare(b.time));
}


/** @param {import('./store.mjs').Task[]} tasks @param {string} date @returns {boolean} */
export function hasPendingTasksOnDate(tasks,date) {
  return tasks.some((task) => !task.done && (task.dueDate === date || firstOccurrenceOnDate(task,date) !== null));
}

/** @param {import('./store.mjs').Task[]} group @param {import('./store.mjs').Plot[]} plots @returns {{done:number,total:number|null,percent:number|null}} */
export function scheduleCycleProgress(group,plots) {
  const fields = new Map();
  for (const task of group) {
    const ids = task.plotId ? [task.plotId] : plots.length ? plots.map((plot)=>plot.id) : [''];
    for (const id of ids) {
      if (!fields.has(id)) fields.set(id,[]);
      fields.get(id).push(task);
    }
  }
  let done = 0;
  let total = 0;
  for (const tasks of fields.values()) {
    tasks.sort((a,b)=>`${a.dueDate}${a.time}`.localeCompare(`${b.dueDate}${b.time}`));
    done += tasks.filter((task)=>task.done).length;
    total += tasks.length;
    const last = tasks.at(-1);
    if (last.repeat && last.repeat !== 'none' && !last.endDate) return {done,total:null,percent:null};
    total += remainingCycleOccurrences(last);
  }
  return {done,total,percent:total ? Math.round(done/total*100) : 0};
}

/** @param {import('./store.mjs').Task} task @returns {number} */
const remainingCycleOccurrences = (task) => {
  if (!task.repeat || task.repeat === 'none' || !task.endDate || task.endDate < task.dueDate) return 0;
  if (task.repeat === 'monthly') {
    const [year,month,day] = task.endDate.split('-').map(Number);
    const [startYear,startMonth,startDay] = task.dueDate.split('-').map(Number);
    const months = (year-startYear)*12+month-startMonth;
    const finalDay = Math.min(task.repeatAnchorDay ?? startDay,new Date(year,month,0).getDate());
    return Math.max(0,months-(day<finalDay ? 1 : 0));
  }
  const interval = task.repeat === 'custom' ? task.repeatInterval * ({minutes:1,hours:60,days:1440}[task.repeatUnit]) : task.repeat === 'weekly' ? 10080 : 1440;
  if (!Number.isFinite(interval) || interval <= 0) return 0;
  const minutes = (Date.parse(`${task.endDate}T23:59:00Z`)-Date.parse(`${task.dueDate}T${task.time}:00Z`))/60000;
  return Math.max(0,Math.floor(minutes/interval));
};

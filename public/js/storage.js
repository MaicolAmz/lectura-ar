// All progress lives in the browser. If localStorage is unavailable or throws
// (private mode, blocked site data), fall back to memory so the app keeps working.
// v2: the stored fields were renamed to English (completed, last); v1 progress is ignored.
const KEY = 'lecturaar:v2';
let memory = { completed: {}, last: null };

function readState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        memory = {
          completed: data.completed && typeof data.completed === 'object' ? data.completed : {},
          last: data.last && typeof data.last === 'object' ? data.last : null,
        };
      }
    }
  } catch {
    // Corrupt JSON or storage blocked: keep using the in-memory copy.
  }
  return memory;
}

function saveState() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    // Ignored on purpose; progress just won't persist across reloads.
  }
}

export function isCompleted(id) {
  return Boolean(readState().completed[String(id)]);
}

export function completedIds() {
  return Object.keys(readState().completed);
}

export function markCompleted(id) {
  readState().completed[String(id)] = true;
  saveState();
}

export function getLast() {
  const last = readState().last;
  return last && last.id && last.title ? last : null;
}

export function saveLast({ id, title, grade }) {
  readState().last = { id, title, grade };
  saveState();
}

// Merges completions known by the server; returns true when something new was added.
export function mergeCompleted(ids) {
  const completed = readState().completed;
  let changed = false;
  for (const id of ids) {
    if (!completed[String(id)]) {
      completed[String(id)] = true;
      changed = true;
    }
  }
  if (changed) saveState();
  return changed;
}

export function resetProgress() {
  memory = { completed: {}, last: null };
  saveState();
}

// One profile per device: { token, profile }. Kept apart from the progress key so that
// clearing one never touches the other.
const SESSION_KEY = 'lecturaar:profile:v1';
let sessionMemory = null;

export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data.token === 'string' && data.profile && typeof data.profile === 'object') {
        sessionMemory = data;
      }
    } else {
      sessionMemory = null;
    }
  } catch {
    // Storage blocked or corrupt: fall back to the in-memory copy.
  }
  return sessionMemory || { token: null, profile: null };
}

export function setSession(session) {
  sessionMemory = session;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignored on purpose; the profile lasts until the page is closed.
  }
  window.dispatchEvent(new Event('sessionchange'));
}

export function clearSession() {
  sessionMemory = null;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignored on purpose.
  }
  window.dispatchEvent(new Event('sessionchange'));
}

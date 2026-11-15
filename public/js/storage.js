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

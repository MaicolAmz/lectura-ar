// status 0 means the network failed or timed out; otherwise it is the HTTP status.
export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 15000;

async function request(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetch(path, {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
  } catch {
    throw new ApiError(0, 'Sin conexión con el servidor.');
  } finally {
    clearTimeout(timer);
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    // Non-JSON body; handled below through the status code.
  }
  if (!res.ok) throw new ApiError(res.status, (data && data.error) || 'Error del servidor.');
  return data;
}

export const api = {
  grades: () => request('/api/grades'),
  readings: (grade) => request(`/api/readings?grade=${encodeURIComponent(grade)}`),
  reading: (id) => request(`/api/readings/${encodeURIComponent(id)}`),
  generateQuestions: (readingId) => request(`/api/readings/${encodeURIComponent(readingId)}/questions`, { method: 'POST' }),
  sendFeedback: (questionId, answer, attempt) =>
    request(`/api/questions/${encodeURIComponent(questionId)}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ answer, attempt }),
    }),
};

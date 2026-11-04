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
  cursos: () => request('/api/cursos'),
  lecturas: (curso) => request(`/api/lecturas?curso=${encodeURIComponent(curso)}`),
  lectura: (id) => request(`/api/lecturas/${encodeURIComponent(id)}`),
  generarPreguntas: (id) => request(`/api/lecturas/${encodeURIComponent(id)}/preguntas`, { method: 'POST' }),
  retroalimentar: (preguntaId, respuesta, intento) =>
    request(`/api/preguntas/${encodeURIComponent(preguntaId)}/retroalimentacion`, {
      method: 'POST',
      body: JSON.stringify({ respuesta, intento }),
    }),
};

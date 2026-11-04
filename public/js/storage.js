// All progress lives in the browser. If localStorage is unavailable or throws
// (private mode, blocked site data), fall back to memory so the app keeps working.
const KEY = 'lecturaar:v1';
let memoria = { completadas: {}, ultima: null };

function leer() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && typeof data === 'object') {
        memoria = {
          completadas: data.completadas && typeof data.completadas === 'object' ? data.completadas : {},
          ultima: data.ultima && typeof data.ultima === 'object' ? data.ultima : null,
        };
      }
    }
  } catch {
    // Corrupt JSON or storage blocked: keep using the in-memory copy.
  }
  return memoria;
}

function guardar() {
  try {
    localStorage.setItem(KEY, JSON.stringify(memoria));
  } catch {
    // Ignored on purpose; progress just won't persist across reloads.
  }
}

export function estaCompletada(id) {
  return Boolean(leer().completadas[String(id)]);
}

export function marcarCompletada(id) {
  leer().completadas[String(id)] = true;
  guardar();
}

export function obtenerUltima() {
  const u = leer().ultima;
  return u && u.id && u.titulo ? u : null;
}

export function guardarUltima({ id, titulo, curso }) {
  leer().ultima = { id, titulo, curso };
  guardar();
}

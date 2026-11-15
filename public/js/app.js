import { api } from './api.js';
import { isCompleted, markCompleted, getLast, saveLast } from './storage.js';

const main = document.getElementById('content');
const GRADES = [8, 9, 10];
const gradeName = (grade) => `${grade}.º de EGB`;
const ORDINALS = { 8: 'Octavo', 9: 'Noveno', 10: 'Décimo' };

// DOM helper: children are always text nodes or elements, never raw HTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === false || value == null) continue;
    if (name === 'class') el.className = value;
    else if (name.startsWith('on')) el.addEventListener(name.slice(2), value);
    else el.setAttribute(name, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return el;
}

const link = (href, text, className = 'button') => h('a', { href, class: className }, text);

// Ignores results of async work started by a view the user already left.
let currentView = 0;

function markNav(section) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // "Biblioteca" goes to the last grade the student was in (default 8.º).
  const last = getLast();
  document.getElementById('nav-library').setAttribute('href', `#/grade/${last && last.grade ? last.grade : 8}`);
}

function show(title, section, ...nodes) {
  main.replaceChildren(...nodes.flat().filter((n) => n && n.nodeType));
  document.title = title ? `${title} · LecturaAR` : 'LecturaAR';
  markNav(section);
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function loadingIndicator(text = 'Cargando…') {
  return h('p', { class: 'loading', role: 'status' }, text);
}

function apiErrorNotice(err, { retry, back } = {}) {
  const message =
    err.status === 0
      ? 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
      : err.status === 503
        ? 'La ayuda inteligente no está disponible ahora mismo, pero puedes seguir leyendo.'
        : err.status === 404
          ? 'No encontramos lo que buscabas.'
          : 'Algo salió mal. Inténtalo de nuevo en un momento.';
  return h(
    'div',
    { class: 'notice', role: 'alert' },
    h('p', {}, message),
    h(
      'div',
      { class: 'actions' },
      retry && h('button', { type: 'button', class: 'button', onclick: retry }, 'Reintentar'),
      back && link(back.href, back.text, 'button secondary')
    )
  );
}

function progressBar(done, total, labelId) {
  const percent = total ? Math.round((done / total) * 100) : 0;
  return h(
    'div',
    {
      class: 'progress-bar',
      role: 'progressbar',
      'aria-labelledby': labelId,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(percent),
    },
    h('div', { style: `width:${percent}%` })
  );
}

/* ---------- Home (HU-01, HU-02, HU-09) ---------- */
function homeView() {
  const last = getLast();
  show(
    'Inicio',
    'home',
    h(
      'section',
      { class: 'hero' },
      h('span', { class: 'chip', style: 'align-self:flex-start' }, 'Sin registro · Empieza ahora'),
      h('h1', {}, 'Aprende a leer entre líneas'),
      h('p', { class: 'lead' }, 'Lee textos de tu curso, responde las preguntas de un asistente de IA y mira escenas en realidad aumentada con tu celular.'),
      h('p', { class: 'step' }, 'Paso 1 de 3 · Elige tu curso'),
      h(
        'div',
        { class: 'grades' },
        GRADES.map((grade) =>
          h('a', { class: 'grade-btn', href: `#/grade/${grade}` }, h('strong', {}, `${grade}.º`), h('span', {}, `${ORDINALS[grade]} de EGB`))
        )
      ),
      last &&
        h(
          'a',
          { class: 'resume', href: `#/reading/${last.id}` },
          h('span', { class: 'play-icon', 'aria-hidden': 'true' }),
          h('span', { class: 'text' }, h('small', {}, 'Sigue donde te quedaste'), h('b', {}, `Retomar: ${last.title}`)),
          h('span', { 'aria-hidden': 'true' }, '→')
        )
    )
  );
}

/* ---------- Library (HU-03, HU-08) ---------- */
async function gradeView(grade, token) {
  if (!GRADES.includes(grade)) return notFoundView();
  show(gradeName(grade), 'library', h('h1', {}, `Lecturas de ${gradeName(grade)}`), loadingIndicator('Cargando lecturas…'));
  try {
    const readings = await api.readings(grade);
    if (token !== currentView) return;
    const done = readings.filter((r) => isCompleted(r.id)).length;
    show(
      gradeName(grade),
      'library',
      h('p', { class: 'step' }, 'Paso 2 de 3 · Elige una lectura'),
      h('h1', {}, `Lecturas de ${gradeName(grade)}`),
      h('p', { class: 'lead' }, 'Toca una lectura para empezar. Cada una tiene preguntas de lectura crítica.'),
      h(
        'div',
        { class: 'card' },
        h('p', { id: 'progress-text', style: 'margin:0 0 .5rem;font-weight:600' }, `Avance: ${done} de ${readings.length} lecturas completadas`),
        progressBar(done, readings.length, 'progress-text')
      ),
      readings.length === 0 && h('p', {}, 'Aún no hay lecturas para este curso.'),
      h(
        'div',
        { class: 'grid' },
        readings.map((reading) => {
          const isDone = isCompleted(reading.id);
          return h(
            'article',
            { class: `card reading-card${isDone ? ' done' : ''}` },
            h('div', {}, isDone ? h('span', { class: 'badge' }, '✓ Completada') : h('span', { class: 'badge new' }, 'Nueva')),
            h('h2', {}, reading.title),
            h('p', { class: 'meta' }, `${reading.author} · ${reading.duration_min} min de lectura`),
            link(`#/reading/${reading.id}`, isDone ? 'Leer de nuevo' : 'Leer')
          );
        })
      ),
      link('#/', 'Cambiar curso', 'button secondary')
    );
  } catch (err) {
    if (token !== currentView) return;
    show(gradeName(grade), 'library', h('h1', {}, gradeName(grade)), apiErrorNotice(err, {
      retry: () => gradeView(grade, token),
      back: { href: '#/', text: 'Volver al inicio' },
    }));
  }
}

/* ---------- Reading + assistant (HU-04, HU-05, HU-06, HU-10, HU-11) ---------- */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits text into text nodes and glossary buttons, so no HTML string is built.
function textWithGlossary(text, glossary, onTap) {
  const fragment = document.createDocumentFragment();
  const entries = glossary.filter((g) => g.word);
  if (!entries.length) {
    fragment.append(text);
    return fragment;
  }
  const byWord = new Map(entries.map((g) => [g.word.toLowerCase(), g]));
  const alternatives = [...entries].sort((a, b) => b.word.length - a.word.length).map((g) => escapeRegex(g.word));
  // Unicode-aware boundaries: \b does not treat accented letters as word characters.
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${alternatives.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  let lastEnd = 0;
  for (const match of text.matchAll(re)) {
    if (match.index > lastEnd) fragment.append(text.slice(lastEnd, match.index));
    const entry = byWord.get(match[0].toLowerCase());
    const button = h('button', { type: 'button', class: 'term', 'aria-expanded': 'false' }, match[0]);
    button.addEventListener('click', () => onTap(entry, button));
    fragment.append(button);
    lastEnd = match.index + match[0].length;
  }
  if (lastEnd < text.length) fragment.append(text.slice(lastEnd));
  return fragment;
}

/* ---------- AR (HU-07) ---------- */
// <model-viewer> is loaded only when the student taps "Ver en AR", so a CDN failure
// can never affect the reading itself. Version pinned on purpose.
const MODEL_VIEWER_URL = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@4.0.0/dist/model-viewer.min.js';
let modelViewerLoad = null;

function loadModelViewer() {
  if (!modelViewerLoad) {
    modelViewerLoad = import(MODEL_VIEWER_URL)
      .then(() => customElements.whenDefined('model-viewer'))
      .catch((err) => {
        modelViewerLoad = null; // allow a retry
        throw err;
      });
  }
  return modelViewerLoad;
}

// One viewer per scene. Posters share the model's name (.glb -> .svg).
function arScene(scene) {
  const status = h('p', { class: 'note ar-status', role: 'status', 'aria-live': 'polite' }, 'Cargando escena 3D…');
  const viewer = h(
    'model-viewer',
    {
      src: scene.model_url,
      poster: scene.model_url.replace(/\.glb$/i, '.svg'),
      alt: `${scene.name}: ${scene.description}`,
      ar: true,
      'ar-modes': 'webxr scene-viewer quick-look',
      'camera-controls': true,
      autoplay: true, // only the fox is animated; harmless for static models
      'touch-action': 'pan-y',
      'shadow-intensity': '1',
      loading: 'lazy',
      reveal: 'auto',
      scale: `${scene.scale} ${scene.scale} ${scene.scale}`,
    },
    // slot="ar-button" is model-viewer's own API, not one of our CSS names.
    h('button', { slot: 'ar-button', type: 'button', class: 'button ar-button' }, 'Ver en mi espacio')
  );

  // canActivateAR is only reliable once the model is loaded.
  viewer.addEventListener('load', () => {
    status.textContent = viewer.canActivateAR
      ? 'Toca «Ver en mi espacio» para ponerlo frente a ti con la cámara. También puedes girarlo con el dedo.'
      : 'Este dispositivo o navegador no admite realidad aumentada, pero puedes girar y acercar el modelo aquí. La lectura sigue disponible.';
  });
  viewer.addEventListener('error', () => {
    status.textContent = 'No pudimos cargar el modelo 3D. La lectura sigue disponible.';
  });

  return h('figure', { class: 'ar-scene' }, viewer, h('figcaption', {}, h('strong', {}, scene.name), ' · ', scene.description), status);
}

// Returns { button, panel }; the panel is filled the first time the button is pressed.
function mountAR(scenes) {
  const panel = h('section', { class: 'ar-panel', 'aria-label': 'Escena en realidad aumentada', hidden: true });
  const button = h('button', { type: 'button', class: 'button secondary', 'aria-expanded': 'false' }, 'Ver en AR');
  let loaded = false;

  async function open() {
    panel.replaceChildren(loadingIndicator('Preparando la escena 3D…'));
    try {
      await loadModelViewer();
      panel.replaceChildren(...scenes.map(arScene));
      loaded = true;
    } catch {
      panel.replaceChildren(
        h(
          'div',
          { class: 'notice', role: 'alert' },
          h('p', {}, 'No pudimos cargar el módulo de realidad aumentada (¿sin internet?). La lectura sigue disponible.'),
          h('button', { type: 'button', class: 'button', onclick: open }, 'Reintentar')
        )
      );
    }
  }

  button.addEventListener('click', () => {
    const willShow = panel.hidden;
    panel.hidden = !willShow;
    button.setAttribute('aria-expanded', String(willShow));
    button.textContent = willShow ? 'Ocultar AR' : 'Ver en AR';
    if (willShow && !loaded) open();
    // loading="lazy" only fetches the model once the viewer is on screen; on a phone the
    // panel opens below the fold, so bring it into view.
    if (willShow) panel.scrollIntoView({ block: 'nearest' });
  });
  return { button, panel };
}

function assistantHeader(index, total) {
  return [
    h(
      'div',
      { class: 'assistant-header' },
      h(
        'div',
        { class: 'who' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }),
        h('div', {}, h('strong', {}, 'Asistente de lectura'), h('small', { class: 'note' }, 'Hecho con IA'))
      ),
      total > 0 && h('strong', { style: 'color:var(--primary-text)' }, `Pregunta ${index + 1} de ${total}`)
    ),
    total > 0 &&
      h(
        'div',
        { class: 'segments', role: 'img', 'aria-label': `Pregunta ${index + 1} de ${total}` },
        Array.from({ length: total }, (_, i) => h('span', { class: i <= index ? 'active' : '' }))
      ),
  ];
}

// The assistant lives in the right column; the reading on the left is never replaced,
// so an AI failure cannot block it.
function mountAssistant(panel, reading, token) {
  const id = reading.id;
  const isAlive = () => token === currentView;
  const paint = (...nodes) => panel.replaceChildren(...nodes.flat().filter((n) => n && n.nodeType));

  function intro() {
    paint(
      assistantHeader(0, 0),
      h('p', { class: 'ai-bubble' }, 'Lee el texto con calma. Cuando estés listo, te haré preguntas para pensar más allá de lo que dice.'),
      h('div', { class: 'actions', style: 'margin:0' }, h('button', { type: 'button', class: 'button', onclick: start }, 'Empezar práctica')),
      h('p', { class: 'note', style: 'margin:0' }, 'El asistente te da pistas, no la respuesta. Tú descubres el significado.')
    );
  }

  async function start() {
    paint(assistantHeader(0, 0), loadingIndicator('Preparando preguntas…'));
    let batch;
    try {
      batch = await api.generateQuestions(id);
    } catch (err) {
      if (!isAlive()) return;
      paint(
        assistantHeader(0, 0),
        apiErrorNotice(err, { retry: start }),
        h('p', { class: 'note', style: 'margin:0' }, 'Puedes seguir leyendo mientras tanto.')
      );
      return;
    }
    if (!isAlive()) return;
    showQuestion(batch.questions, 0, batch.origin === 'fallback');
  }

  function showQuestion(questions, index, isFallback = false) {
    const question = questions[index];
    let attempt = 1;
    let sending = false;
    const isLast = index === questions.length - 1;

    const textarea = h('textarea', { id: 'answer', maxlength: '1500', rows: '5' });
    const hint = h('div', { class: 'hint', role: 'status', 'aria-live': 'polite' });
    const errorArea = h('div', { 'aria-live': 'polite' });
    const submit = h('button', { type: 'submit', class: 'button' }, 'Enviar respuesta');
    const next = h('button', { type: 'button', class: 'button secondary' }, isLast ? 'Terminar' : 'Siguiente pregunta');
    next.addEventListener('click', () => (isLast ? finish() : showQuestion(questions, index + 1, isFallback)));

    const form = h(
      'form',
      { novalidate: true, style: 'display:flex;flex-direction:column;gap:1rem' },
      h('div', {}, h('label', { for: 'answer' }, 'Tu respuesta'), textarea),
      errorArea,
      h('div', { class: 'actions', style: 'margin:0' }, submit, next),
      hint,
      h('p', { class: 'note', style: 'margin:0' }, 'El asistente te da pistas, no la respuesta. Tú descubres el significado.')
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;
      const answer = textarea.value.trim();
      if (!answer) {
        errorArea.replaceChildren(h('p', { class: 'notice', role: 'alert' }, 'Escribe tu respuesta antes de enviarla.'));
        textarea.focus();
        return;
      }
      sending = true;
      submit.disabled = true;
      errorArea.replaceChildren();
      hint.replaceChildren(loadingIndicator('Pensando una pista…'));
      try {
        const result = await api.sendFeedback(question.id, answer, attempt);
        if (!isAlive()) return;
        // replaceChildren would print a literal "false", so falsy entries are filtered out.
        hint.replaceChildren(
          ...[
            h('span', { class: 'hint-label' }, 'PISTA DEL ASISTENTE'),
            result.feedback,
            result.origin === 'fallback' && h('small', { class: 'note', style: 'display:block;margin-top:.5rem' }, 'La ayuda inteligente no está disponible ahora mismo, así que esta es una pista general.'),
          ].filter(Boolean)
        );
        attempt += 1;
        submit.textContent = 'Reenviar respuesta corregida';
      } catch (err) {
        if (!isAlive()) return;
        hint.replaceChildren();
        errorArea.replaceChildren(apiErrorNotice(err, { retry: () => form.requestSubmit() }));
      } finally {
        sending = false;
        submit.disabled = false;
      }
    });

    paint(
      assistantHeader(index, questions.length),
      isFallback && h('p', { class: 'note', style: 'margin:0' }, 'La ayuda inteligente no está disponible ahora mismo, así que usamos preguntas generales. Puedes seguir leyendo y practicando.'),
      h('p', { class: 'ai-bubble' }, question.statement),
      form
    );
    textarea.focus({ preventScroll: true });
  }

  function finish() {
    markCompleted(id);
    paint(
      h('span', { class: 'badge', style: 'align-self:flex-start' }, '✓ Completada'),
      h('h2', { style: 'margin:0' }, '¡Muy bien! Terminaste los ejercicios'),
      h('p', { style: 'margin:0' }, 'Esta lectura quedó marcada como completada.'),
      h(
        'div',
        { class: 'actions', style: 'margin:0' },
        h('button', { type: 'button', class: 'button', onclick: start }, 'Repetir ejercicios'),
        link(`#/grade/${reading.grade}`, 'Volver a la biblioteca', 'button secondary')
      )
    );
  }

  return { intro, start };
}

async function readingView(id, token, autoStart = false) {
  show('Lectura', 'library', loadingIndicator('Cargando lectura…'));
  try {
    const reading = await api.reading(id);
    if (token !== currentView) return;
    saveLast({ id: reading.id, title: reading.title, grade: reading.grade });
    markNav('library');

    const definitionBox = h('div', { class: 'definition', role: 'status', 'aria-live': 'polite' });
    let openTerm = null;
    const onTap = (entry, button) => {
      if (openTerm) openTerm.setAttribute('aria-expanded', 'false');
      if (openTerm === button) {
        openTerm = null;
        definitionBox.replaceChildren();
        return;
      }
      openTerm = button;
      button.setAttribute('aria-expanded', 'true');
      definitionBox.replaceChildren(h('strong', {}, entry.word), ': ', entry.definition);
    };

    const panel = h('aside', { class: 'card assistant', 'aria-label': 'Asistente de lectura' });
    const assistant = mountAssistant(panel, reading, token);

    const ar = reading.ar_scenes.length ? mountAR(reading.ar_scenes) : null;
    const paragraphs = String(reading.text).split(/\n+/).filter(Boolean);
    show(
      reading.title,
      'library',
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem' },
        h('p', { class: 'breadcrumbs' }, link(`#/grade/${reading.grade}`, '← Volver a la biblioteca', '')),
        h('p', { class: 'step' }, 'Paso 3 de 3 · Lee y responde')
      ),
      h(
        'div',
        { class: 'reading-layout' },
        h(
          'article',
          { class: 'card reading-text', style: 'display:flex;flex-direction:column;gap:1rem' },
          h('h1', {}, reading.title),
          h('p', { class: 'note', style: 'margin:0' }, `${reading.author} · ${gradeName(reading.grade)} · ${reading.duration_min} min`),
          reading.glossary.length > 0 && h('p', { class: 'note', style: 'margin:0' }, 'Toca las palabras resaltadas para ver su significado.'),
          h('div', { class: 'reading-body' }, paragraphs.map((p) => h('p', {}, textWithGlossary(p, reading.glossary, onTap)))),
          definitionBox,
          reading.source && h('p', { class: 'note', style: 'margin:0' }, `Fuente: ${reading.source}`),
          ar && h('div', { class: 'actions', style: 'margin:0' }, ar.button),
          ar && ar.panel
        ),
        panel
      )
    );
    if (autoStart) assistant.start();
    else assistant.intro();
  } catch (err) {
    if (token !== currentView) return;
    show('Lectura', 'library', h('h1', {}, 'Lectura'), apiErrorNotice(err, {
      retry: () => readingView(id, token, autoStart),
      back: { href: '#/', text: 'Volver al inicio' },
    }));
  }
}

/* ---------- Progress (HU-08) ---------- */
async function progressView(token) {
  show('Mi progreso', 'progress', h('h1', {}, 'Mi progreso'), loadingIndicator('Calculando tu avance…'));
  const results = await Promise.all(
    GRADES.map((grade) => api.readings(grade).then((readings) => ({ grade, readings }), (err) => ({ grade, err })))
  );
  if (token !== currentView) return;

  const completed = results.flatMap(({ grade, readings }) => (readings || []).filter((r) => isCompleted(r.id)).map((r) => ({ ...r, grade })));
  const last = getLast();

  show(
    'Mi progreso',
    'progress',
    h('h1', {}, 'Mi progreso'),
    h('p', { class: 'lead' }, 'Así vas en cada curso. Tu avance se guarda solo en este dispositivo.'),
    h(
      'div',
      { class: 'two-columns' },
      h(
        'section',
        { class: 'card', 'aria-label': 'Avance por curso' },
        h('h2', { style: 'margin-top:0' }, 'Avance por curso'),
        results.map(({ grade, readings, err }) => {
          if (err) return h('p', {}, `${gradeName(grade)}: no pudimos cargar este curso ahora.`);
          const done = readings.filter((r) => isCompleted(r.id)).length;
          const percent = readings.length ? Math.round((done / readings.length) * 100) : 0;
          const labelId = `progress-${grade}`;
          return h(
            'div',
            {},
            h(
              'div',
              { class: 'progress-row', id: labelId },
              h('a', { href: `#/grade/${grade}`, style: 'font-weight:600' }, gradeName(grade)),
              h('span', {}, `${done} de ${readings.length} lecturas (${percent}%)`)
            ),
            progressBar(done, readings.length, labelId)
          );
        })
      ),
      last &&
        h(
          'section',
          { class: 'card dark-card', 'aria-label': 'Retomar lectura' },
          h('div', {}, h('small', {}, 'Sigue donde te quedaste'), h('h2', {}, last.title)),
          link(`#/reading/${last.id}`, 'Continuar →', 'button yellow')
        )
    ),
    h(
      'section',
      { class: 'card', 'aria-label': 'Lecturas completadas' },
      h('h2', { style: 'margin-top:0' }, 'Lecturas completadas'),
      completed.length === 0 && h('p', {}, 'Todavía no completas ninguna lectura. ¡Empieza por una!'),
      completed.map((reading) =>
        h(
          'div',
          { class: 'completed' },
          h('span', { class: 'badge', 'aria-hidden': 'true' }, '✓'),
          h('div', {}, h('strong', {}, reading.title), h('small', {}, `${reading.author} · ${gradeName(reading.grade)}`)),
          link(`#/practice/${reading.id}`, 'Repetir con nuevas preguntas', 'button secondary')
        )
      )
    )
  );
}

function notFoundView() {
  show('No encontrada', 'home', h('h1', {}, 'Página no encontrada'), link('#/', 'Ir al inicio'));
}

/* ---------- Router ---------- */
function route() {
  const token = ++currentView;
  const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [name, param] = parts;
  const number = Number(param);
  const isValidId = Number.isInteger(number) && number > 0;

  if (!name) return homeView();
  if (name === 'grade' && isValidId) return gradeView(number, token);
  if (name === 'reading' && isValidId) return readingView(number, token);
  if (name === 'practice' && isValidId) return readingView(number, token, true);
  if (name === 'progress') return progressView(token);
  return notFoundView();
}

window.addEventListener('hashchange', route);
route();

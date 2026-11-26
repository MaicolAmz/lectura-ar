import { api } from './api.js';
import {
  isCompleted, markCompleted, completedIds, getLast, saveLast, mergeCompleted, resetProgress,
  getSession, setSession, clearSession,
} from './storage.js';

const main = document.getElementById('content');
const GRADES = [8, 9, 10];
const gradeName = (grade) => `${grade}.º de EGB`;
const ORDINALS = { 8: 'Octavo', 9: 'Noveno', 10: 'Décimo' };
const NICKNAME_MAX = 20;
// Keys must match the avatar list accepted by the server (src/profiles.js).
const AVATARS = {
  fox: { emoji: '🦊', name: 'Zorro' },
  bird: { emoji: '🐦', name: 'Pájaro' },
  fish: { emoji: '🐟', name: 'Pez' },
  tree: { emoji: '🌳', name: 'Árbol' },
  lantern: { emoji: '🏮', name: 'Farol' },
  canoe: { emoji: '🛶', name: 'Canoa' },
  volcano: { emoji: '🌋', name: 'Volcán' },
  stone: { emoji: '🪨', name: 'Piedra' },
  mangrove: { emoji: '🌿', name: 'Manglar' },
};

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

// The student behind the current profile, or null when the app is used without one.
function student() {
  const { profile } = getSession();
  if (!profile) return null;
  const avatar = AVATARS[profile.avatar];
  return { name: profile.nickname, emoji: avatar ? avatar.emoji : '🙂', grade: profile.grade };
}
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

const link = (href, text, className = 'button') => h('a', { href, class: className }, text);

// Ignores results of async work started by a view the user already left.
let currentView = 0;

function markNav(section) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === section) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // "Biblioteca" goes to the last grade the student was in, then their profile's grade (default 8.º).
  const last = getLast();
  const { profile } = getSession();
  const grade = (last && last.grade) || (profile && profile.grade) || 8;
  document.getElementById('nav-library').setAttribute('href', `#/grade/${grade}`);
}

// The total lives in the session so the nav can show it without a request per view.
const sessionPoints = () => {
  const { points } = getSession();
  return Number.isInteger(points) ? points : 0;
};
function setPoints(total) {
  if (Number.isInteger(total) && getSession().token) setSession({ ...getSession(), points: total });
}

function renderNavProfile() {
  const { profile } = getSession();
  const el = document.getElementById('nav-profile');
  if (profile) {
    const avatar = AVATARS[profile.avatar];
    const points = sessionPoints();
    el.replaceChildren(
      `${avatar ? avatar.emoji : '🙂'} ${profile.nickname} `,
      h('span', { class: 'points-chip', 'aria-hidden': 'true' }, `⭐ ${points}`)
    );
    el.setAttribute('aria-label', `Mi perfil: ${profile.nickname}, ${points} puntos`);
  } else {
    el.textContent = 'Crear perfil';
    el.removeAttribute('aria-label');
  }
}
window.addEventListener('sessionchange', renderNavProfile);

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
  const me = student();
  show(
    'Inicio',
    'home',
    h(
      'section',
      { class: 'hero' },
      h('span', { class: 'chip', style: 'align-self:flex-start' }, me ? `${me.emoji} Hola, ${me.name}` : 'Sin registro · Empieza ahora'),
      h('h1', {}, 'Aprende a leer entre líneas'),
      h('p', { class: 'lead' }, 'Lee textos de tu curso, responde las preguntas de un asistente de IA y mira escenas en realidad aumentada con tu celular.'),
      h('p', { class: 'step' }, 'Paso 1 de 3 · Elige tu curso'),
      h(
        'div',
        { class: 'grades' },
        GRADES.map((grade) =>
          h(
            'a',
            { class: `grade-btn${me && me.grade === grade ? ' mine' : ''}`, href: `#/grade/${grade}` },
            me && me.grade === grade && h('em', { class: 'mine-tag' }, 'Tu curso'),
            h('strong', {}, `${grade}.º`),
            h('span', {}, `${ORDINALS[grade]} de EGB`)
          )
        )
      ),
      last &&
        h(
          'a',
          { class: 'resume', href: `#/reading/${last.id}` },
          h('span', { class: 'play-icon', 'aria-hidden': 'true' }),
          h('span', { class: 'text' }, h('small', {}, me ? `${me.name}, sigue donde te quedaste` : 'Sigue donde te quedaste'), h('b', {}, `Retomar: ${last.title}`)),
          h('span', { 'aria-hidden': 'true' }, '→')
        )
    )
  );
}

/* ---------- Library (HU-03, HU-08) ---------- */
async function gradeView(grade, token) {
  if (!GRADES.includes(grade)) return notFoundView();
  const me = student();
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
      h('p', { class: 'lead' }, `${me ? `${me.name}, toca` : 'Toca'} una lectura para empezar. Cada una tiene preguntas de lectura crítica.`),
      h(
        'div',
        { class: 'card' },
        h('p', { id: 'progress-text', style: 'margin:0 0 .5rem;font-weight:600' }, me ? `${me.emoji} ${me.name}, llevas ${done} de ${readings.length} lecturas completadas` : `Avance: ${done} de ${readings.length} lecturas completadas`),
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
    const me = student();
    const say = (text) => (me ? `${me.name}, ${lowerFirst(text)}` : text);
    status.textContent = viewer.canActivateAR
      ? say('Toca «Ver en mi espacio» para ponerlo frente a ti con la cámara. También puedes girarlo con el dedo.')
      : say('Este dispositivo o navegador no admite realidad aumentada, pero puedes girar y acercar el modelo aquí. La lectura sigue disponible.');
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
        h('div', {}, h('strong', {}, 'Asistente de lectura'), h('small', { class: 'note' }, student() ? `Hecho con IA · para ${student().name}` : 'Hecho con IA'))
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
  const me = student();
  const isAlive = () => token === currentView;
  const paint = (...nodes) => panel.replaceChildren(...nodes.flat().filter((n) => n && n.nodeType));

  function intro() {
    paint(
      assistantHeader(0, 0),
      h('p', { class: 'ai-bubble' }, `${me ? `Hola, ${me.name}. ` : ''}Lee el texto con calma. Cuando estés listo, te haré preguntas para pensar más allá de lo que dice.`),
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
    const hasOptions = Array.isArray(question.options) && question.options.length > 0;
    let mode = 'write';
    let attempt = 1;
    let choiceAttempt = 1;
    let choiceSolved = false;
    let sending = false;
    const isLast = index === questions.length - 1;

    const textarea = h('textarea', { id: 'answer', maxlength: '1500', rows: '5' });
    const writeArea = h('div', {}, h('label', { for: 'answer' }, me ? `${me.emoji} Respuesta de ${me.name}` : 'Tu respuesta'), textarea);
    const radios = hasOptions
      ? question.options.map((text, i) => h('input', { type: 'radio', name: `choice-${question.id}`, value: String(i), id: `choice-${question.id}-${i}` }))
      : [];
    const choiceArea = hasOptions
      ? h(
          'fieldset',
          { class: 'choices', hidden: true },
          h('legend', {}, me ? `${me.emoji} Elige la respuesta, ${me.name}` : 'Elige la respuesta'),
          question.options.map((text, i) => h('label', { class: 'choice', for: radios[i].id }, radios[i], h('span', {}, text)))
        )
      : null;
    const hint = h('div', { class: 'hint', role: 'status', 'aria-live': 'polite' });
    const errorArea = h('div', { 'aria-live': 'polite' });
    const submit = h('button', { type: 'submit', class: 'button' }, 'Enviar respuesta');
    const next = h('button', { type: 'button', class: 'button secondary' }, isLast ? 'Terminar' : 'Siguiente pregunta');
    next.addEventListener('click', () => (isLast ? finish() : showQuestion(questions, index + 1, isFallback)));

    const submitLabel = () => {
      if (mode === 'choice') return choiceAttempt > 1 ? 'Comprobar otra opción' : 'Comprobar';
      return attempt > 1 ? 'Reenviar respuesta corregida' : 'Enviar respuesta';
    };

    const modeButtons = {};
    function setMode(value) {
      mode = value;
      writeArea.hidden = mode !== 'write';
      if (choiceArea) choiceArea.hidden = mode !== 'choice';
      for (const [key, button] of Object.entries(modeButtons)) button.setAttribute('aria-pressed', String(key === mode));
      submit.textContent = submitLabel();
      submit.disabled = mode === 'choice' && choiceSolved;
      errorArea.replaceChildren();
    }
    const modeSwitch =
      hasOptions &&
      h(
        'div',
        { class: 'mode-switch', role: 'group', 'aria-label': 'Forma de responder' },
        (modeButtons.write = h('button', { type: 'button', onclick: () => setMode('write') }, '✍️ Escribir mi respuesta')),
        (modeButtons.choice = h('button', { type: 'button', onclick: () => setMode('choice') }, '🔘 Ver opciones'))
      );

    const form = h(
      'form',
      { novalidate: true, style: 'display:flex;flex-direction:column;gap:1rem' },
      modeSwitch,
      writeArea,
      choiceArea,
      errorArea,
      h('div', { class: 'actions', style: 'margin:0' }, submit, next),
      hint,
      h('p', { class: 'note', style: 'margin:0' }, 'El asistente te da pistas, no la respuesta. Tú descubres el significado.')
    );

    function showResult(result) {
      setPoints(result.total_points);
      const earned = Number.isInteger(result.points_earned) ? result.points_earned : null;
      // replaceChildren would print a literal "false", so falsy entries are filtered out.
      hint.replaceChildren(
        ...[
          (result.correct || earned > 0) &&
            h(
              'div',
              { class: 'reward' },
              result.correct && h('span', { class: 'badge' }, '✓ ¡Respuesta acertada!'),
              earned > 0 && h('span', { class: 'points-chip' }, `+${earned} puntos`)
            ),
          h('span', { class: 'hint-label' }, me ? `PISTA PARA ${me.name.toUpperCase()}` : 'PISTA DEL ASISTENTE'),
          result.feedback,
          !me && h('small', { class: 'note', style: 'display:block;margin-top:.5rem' }, 'Crea un perfil para ganar puntos con tus respuestas.'),
          result.origin === 'fallback' && h('small', { class: 'note', style: 'display:block;margin-top:.5rem' }, 'La ayuda inteligente no está disponible ahora mismo, así que esta es una pista general.'),
        ].filter(Boolean)
      );
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (sending) return;
      const choosing = mode === 'choice';
      const picked = radios.find((r) => r.checked);
      const answer = textarea.value.trim();
      if (choosing ? !picked : !answer) {
        errorArea.replaceChildren(h('p', { class: 'notice', role: 'alert' }, choosing ? 'Elige una opción antes de comprobar.' : 'Escribe tu respuesta antes de enviarla.'));
        (choosing ? radios.find((r) => !r.disabled) : textarea).focus();
        return;
      }
      sending = true;
      submit.disabled = true;
      errorArea.replaceChildren();
      hint.replaceChildren(loadingIndicator(choosing ? 'Revisando tu elección…' : me ? `Pensando una pista para ${me.name}…` : 'Pensando una pista…'));
      try {
        const result = choosing
          ? await api.sendChoice(question.id, Number(picked.value), choiceAttempt)
          : await api.sendFeedback(question.id, answer, attempt);
        if (!isAlive()) return;
        showResult(result);
        if (choosing) {
          choiceAttempt += 1;
          if (result.correct) {
            choiceSolved = true;
            radios.forEach((r) => (r.disabled = true));
          } else {
            // A wrong pick cannot be right next time: grey it out.
            picked.checked = false;
            picked.disabled = true;
          }
        } else {
          attempt += 1;
        }
      } catch (err) {
        if (!isAlive()) return;
        hint.replaceChildren();
        errorArea.replaceChildren(apiErrorNotice(err, { retry: () => form.requestSubmit() }));
      } finally {
        sending = false;
        submit.textContent = submitLabel();
        submit.disabled = mode === 'choice' && choiceSolved;
      }
    });

    paint(
      assistantHeader(index, questions.length),
      isFallback && h('p', { class: 'note', style: 'margin:0' }, 'La ayuda inteligente no está disponible ahora mismo, así que usamos preguntas generales. Puedes seguir leyendo y practicando.'),
      h('p', { class: 'ai-bubble' }, question.statement),
      form
    );
    if (hasOptions) setMode('write');
    textarea.focus({ preventScroll: true });
  }

  function finish() {
    markCompleted(id);
    const bonus = h('div', { 'aria-live': 'polite' });
    // Best effort: the local mark already counts, and the next sync retries the upload.
    if (getSession().token) {
      api
        .completeReading(id)
        .then((result) => {
          if (!result || !isAlive()) return;
          setPoints(result.total_points);
          if (result.points_earned > 0) {
            bonus.replaceChildren(h('span', { class: 'points-chip' }, `+${result.points_earned} puntos por completar la lectura`));
          }
        })
        .catch(() => {});
    }
    paint(
      h('span', { class: 'badge', style: 'align-self:flex-start' }, '✓ Completada'),
      bonus,
      h('h2', { style: 'margin:0' }, me ? `¡Muy bien, ${me.name}! Terminaste los ejercicios` : '¡Muy bien! Terminaste los ejercicios'),
      h('p', { style: 'margin:0' }, me ? 'Esta lectura quedó guardada en tu progreso.' : 'Esta lectura quedó marcada como completada.'),
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

    const me = student();
    const ar = reading.ar_scenes.length ? mountAR(reading.ar_scenes) : null;
    const paragraphs = String(reading.text).split(/\n+/).filter(Boolean);
    show(
      reading.title,
      'library',
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem' },
        h('p', { class: 'breadcrumbs' }, link(`#/grade/${reading.grade}`, '← Volver a la biblioteca', '')),
        h(
          'div',
          { style: 'display:flex;flex-wrap:wrap;align-items:center;gap:.75rem' },
          me && h('span', { class: 'reader-chip' }, `${me.emoji} Leyendo como ${me.name}`),
          h('p', { class: 'step' }, 'Paso 3 de 3 · Lee y responde')
        )
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
  const me = student();
  const [results, summary] = await Promise.all([
    Promise.all(GRADES.map((grade) => api.readings(grade).then((readings) => ({ grade, readings }), (err) => ({ grade, err })))),
    // Server-side totals are a bonus: the page still works without them.
    me ? api.progress().catch(() => null) : null,
  ]);
  if (token !== currentView) return;
  if (summary) setPoints(summary.total_points);

  const completed = results.flatMap(({ grade, readings }) => (readings || []).filter((r) => isCompleted(r.id)).map((r) => ({ ...r, grade })));
  const last = getLast();

  show(
    'Mi progreso',
    'progress',
    h('h1', {}, me ? `${me.emoji} Progreso de ${me.name}` : 'Mi progreso'),
    h('p', { class: 'lead' }, me ? `${me.name}, así vas en cada curso. Tu avance se guarda en tu perfil de este dispositivo.` : 'Así vas en cada curso. Tu avance se guarda solo en este dispositivo.'),
    summary &&
      h(
        'div',
        { class: 'stats' },
        [
          [summary.total_points ?? 0, 'puntos ganados'],
          [summary.completed_readings, 'lecturas completadas'],
          [summary.readings.reduce((sum, r) => sum + r.questions_answered, 0), 'preguntas trabajadas'],
          [summary.total_attempts, 'respuestas enviadas'],
        ].map(([n, label]) => h('div', { class: 'stat' }, h('strong', {}, String(n)), h('span', {}, label)))
      ),
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
      h('h2', { style: 'margin-top:0' }, me ? 'Lecturas que ya completaste' : 'Lecturas completadas'),
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

/* ---------- Profile (one per device, no password) ---------- */
function choiceGroup(legend, name, options, selected) {
  return h(
    'fieldset',
    { class: 'choices' },
    h('legend', {}, legend),
    options.map(({ value, label }) =>
      h(
        'label',
        { class: 'choice' },
        h('input', { type: 'radio', name, value: String(value), checked: String(value) === String(selected) }),
        h('span', {}, label)
      )
    )
  );
}

function profileForm({ profile, submitLabel, onSubmit }) {
  const nickname = h('input', {
    id: 'nickname', type: 'text', maxlength: String(NICKNAME_MAX), autocomplete: 'off',
    value: profile ? profile.nickname : null,
  });
  const avatars = choiceGroup(
    'Tu avatar', 'avatar',
    Object.entries(AVATARS).map(([value, a]) => ({ value, label: `${a.emoji} ${a.name}` })),
    profile ? profile.avatar : 'fox'
  );
  const grades = choiceGroup(
    'Tu curso', 'grade',
    GRADES.map((g) => ({ value: g, label: gradeName(g) })),
    profile ? profile.grade : 8
  );
  const status = h('div', { 'aria-live': 'polite' });
  const submit = h('button', { type: 'submit', class: 'button' }, submitLabel);

  const form = h(
    'form',
    { novalidate: true, class: 'profile-form' },
    h('div', {}, h('label', { for: 'nickname' }, 'Tu apodo (no uses tu nombre completo)'), nickname),
    avatars,
    grades,
    status,
    h('div', { class: 'actions', style: 'margin:0' }, submit)
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      nickname: nickname.value.trim().replace(/\s+/g, ' '),
      avatar: form.elements.avatar.value,
      grade: Number(form.elements.grade.value),
    };
    if (data.nickname.length < 2) {
      status.replaceChildren(h('p', { class: 'notice', role: 'alert' }, 'Escribe un apodo de al menos 2 letras.'));
      nickname.focus();
      return;
    }
    submit.disabled = true;
    status.replaceChildren(loadingIndicator('Guardando…'));
    try {
      await onSubmit(data, status);
    } catch (err) {
      // Server messages for 400 are already written for the student.
      status.replaceChildren(h('p', { class: 'notice', role: 'alert' }, err.status === 400 ? err.message : 'No pudimos guardar tu perfil. Inténtalo de nuevo.'));
    } finally {
      submit.disabled = false;
    }
  });
  return form;
}

function profileView() {
  const { profile } = getSession();
  if (!profile) {
    show(
      'Crear perfil', 'profile',
      h('h1', {}, 'Crea tu perfil'),
      h('p', { class: 'lead' }, 'Elige un apodo y un avatar. No necesitas correo ni contraseña: tu perfil queda guardado en este dispositivo.'),
      h('div', { class: 'card' }, profileForm({
        submitLabel: 'Crear mi perfil',
        onSubmit: async (data) => {
          const { token, profile: created } = await api.createProfile(data);
          setSession({ token, profile: created });
          // Completions made before the profile existed are uploaded so they are not lost.
          await Promise.allSettled(completedIds().map((id) => api.completeReading(id)));
          location.hash = '#/';
        },
      }))
    );
    return;
  }
  const avatar = AVATARS[profile.avatar];
  show(
    'Mi perfil', 'profile',
    h('h1', {}, `${avatar ? avatar.emoji : '🙂'} ${profile.nickname}`),
    h('p', { class: 'lead' }, `${gradeName(profile.grade)}. Puedes cambiar tus datos cuando quieras.`),
    h('div', { class: 'card' }, profileForm({
      profile,
      submitLabel: 'Guardar cambios',
      onSubmit: async (data, status) => {
        const updated = await api.updateProfile(data);
        setSession({ ...getSession(), profile: updated });
        status.replaceChildren(h('p', { class: 'ok-note', role: 'status' }, '✓ Cambios guardados'));
      },
    })),
    h(
      'section',
      { class: 'card danger-zone', 'aria-label': 'Eliminar perfil' },
      h('h2', { style: 'margin-top:0' }, 'Eliminar mi perfil'),
      h('p', {}, 'Se borrarán tu perfil y tu progreso. Este dispositivo quedará como nuevo. Esto no se puede deshacer.'),
      h('button', {
        type: 'button', class: 'button secondary',
        onclick: async (e) => {
          if (!window.confirm('¿Seguro que quieres eliminar tu perfil y todo tu progreso?')) return;
          const button = e.currentTarget;
          button.disabled = true;
          try {
            await api.deleteProfile();
            clearSession();
            resetProgress();
            location.hash = '#/';
          } catch {
            button.disabled = false;
            button.after(h('p', { class: 'notice', role: 'alert' }, 'No pudimos eliminar el perfil ahora. Inténtalo de nuevo.'));
          }
        },
      }, 'Eliminar mi perfil')
    )
  );
}

// Refreshes the cached profile and merges server-side completions. Offline keeps the cache.
async function syncProfile() {
  if (!getSession().token) return;
  try {
    const [profile, progress] = await Promise.all([api.me(), api.progress()]);
    setSession({ token: getSession().token, profile, points: progress.total_points });
    const doneIds = progress.readings.filter((r) => r.completed).map((r) => r.reading_id);
    if (mergeCompleted(doneIds)) route();
  } catch {
    // 401 is handled in api.js (clears the session); other failures keep the cached profile.
  }
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
  if (name === 'profile') return profileView();
  return notFoundView();
}

window.addEventListener('hashchange', route);
renderNavProfile();
route();
syncProfile();

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
// Guest sessions (created to keep points before signing up) count as "no profile".
const realProfile = () => {
  const { profile } = getSession();
  return profile && !profile.is_guest ? profile : null;
};
function student() {
  const profile = realProfile();
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
  const profile = realProfile();
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

// Points chip plus one chip per new badge, for any scoring response. Empty when nothing was won.
function rewardChips(result, label = 'puntos') {
  const earned = Number.isInteger(result.points_earned) ? result.points_earned : 0;
  return [
    earned > 0 && h('span', { class: 'points-chip' }, `+${earned} ${label}`),
    ...(result.badges_earned || []).map((b) =>
      h('span', { class: 'badge new' }, `${b.emoji} Nueva insignia: ${b.name} (+${b.points})`)
    ),
  ].filter(Boolean);
}

// Without a session, a guest is created before the first answer so its points are kept on the
// server. The promise is shared so a double submit cannot create two guests, and a failure
// just lets the answer go through anonymously.
let guestRequest = null;
function ensureGuest() {
  if (getSession().token) return Promise.resolve();
  guestRequest ||= api
    .createGuest()
    .then(({ token, profile }) => {
      if (!getSession().token) setSession({ token, profile, points: 0 });
    })
    .catch(() => {})
    .finally(() => {
      guestRequest = null;
    });
  return guestRequest;
}

function renderNavProfile() {
  const profile = realProfile();
  const el = document.getElementById('nav-profile');
  const points = sessionPoints();
  if (profile) {
    const avatar = AVATARS[profile.avatar];
    el.replaceChildren(
      `${avatar ? avatar.emoji : '🙂'} ${profile.nickname} `,
      h('span', { class: 'points-chip', 'aria-hidden': 'true' }, `⭐ ${points}`)
    );
    el.setAttribute('aria-label', `Mi perfil: ${profile.nickname}, ${points} puntos`);
  } else if (getSession().token) {
    el.replaceChildren('Crear perfil ', h('span', { class: 'points-chip', 'aria-hidden': 'true' }, `⭐ ${points}`));
    el.setAttribute('aria-label', `Crear perfil, tienes ${points} puntos sin guardar en un perfil`);
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
      const chips = rewardChips(result);
      // replaceChildren would print a literal "false", so falsy entries are filtered out.
      hint.replaceChildren(
        ...[
          (result.correct || chips.length > 0) &&
            h('div', { class: 'reward' }, result.correct && h('span', { class: 'badge' }, '✓ ¡Respuesta acertada!'), chips),
          h('span', { class: 'hint-label' }, me ? `PISTA PARA ${me.name.toUpperCase()}` : 'PISTA DEL ASISTENTE'),
          result.feedback,
          !me && h('small', { class: 'note', style: 'display:block;margin-top:.5rem' }, 'Crea un perfil para guardar tus puntos con tu apodo y avatar.'),
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
        await ensureGuest();
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
          const chips = rewardChips(result, 'puntos por completar la lectura');
          if (chips.length) bonus.replaceChildren(h('div', { class: 'reward' }, chips));
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
      ),
      gamesSection(reading)
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

/* ---------- Games ---------- */
const GAMES = {
  glossary: {
    emoji: '🔤',
    title: 'Parejas del glosario',
    description: 'Une cada palabra con su significado.',
    available: (reading) => reading.glossary.length >= 2,
    mount: glossaryGame,
  },
  order: {
    emoji: '🧩',
    title: 'Ordena la historia',
    description: 'Pon los momentos de la historia en el orden en que aparecen.',
    available: () => true,
    mount: orderGame,
  },
  hunt: {
    emoji: '🔍',
    title: 'Caza del objeto AR',
    description: 'Descubre qué objeto falta en el fragmento y míralo en 3D.',
    available: (reading) => reading.ar_scenes.length > 0,
    mount: huntGame,
  },
};

function gamesSection(reading) {
  const games = Object.entries(GAMES).filter(([, g]) => g.available(reading));
  return h(
    'section',
    { class: 'card games', 'aria-labelledby': 'games-title' },
    h('h2', { id: 'games-title', style: 'margin-top:0' }, '🎮 Juegos de esta lectura'),
    h(
      'div',
      { class: 'game-links' },
      games.map(([key, g]) =>
        h(
          'a',
          { class: 'game-link', href: `#/play/${reading.id}/${key}` },
          h('span', { class: 'game-emoji', 'aria-hidden': 'true' }, g.emoji),
          h('span', {}, h('strong', {}, g.title), h('small', {}, g.description))
        )
      )
    )
  );
}

// Shared by every game: success message, rewards and the guest note in one block.
function gameResult(result, message) {
  setPoints(result.total_points);
  return h(
    'div',
    { class: 'hint' },
    h('div', { class: 'reward' }, h('span', { class: 'badge' }, `✓ ${message}`), rewardChips(result)),
    !student() && h('small', { class: 'note' }, 'Crea un perfil para guardar tus puntos con tu apodo y avatar.')
  );
}

async function gameView(id, key, token) {
  const game = GAMES[key];
  show(game.title, 'library', loadingIndicator('Cargando juego…'));
  let reading;
  try {
    reading = await api.reading(id);
  } catch (err) {
    if (token !== currentView) return;
    show(game.title, 'library', h('h1', {}, game.title), apiErrorNotice(err, {
      retry: () => gameView(id, key, token),
      back: { href: `#/reading/${id}`, text: 'Volver a la lectura' },
    }));
    return;
  }
  if (token !== currentView) return;
  if (!game.available(reading)) return notFoundView();

  const board = h('section', { class: 'card game-board', 'aria-label': game.title });
  const others = Object.entries(GAMES).filter(([k, g]) => k !== key && g.available(reading));
  show(
    `${game.title} · ${reading.title}`,
    'library',
    h('p', { class: 'breadcrumbs' }, link(`#/reading/${reading.id}`, `← Volver a «${reading.title}»`, '')),
    h('h1', {}, `${game.emoji} ${game.title}`),
    h('p', { class: 'lead' }, game.description),
    board,
    others.length > 0 &&
      h(
        'p',
        { class: 'note' },
        'Otros juegos: ',
        others.flatMap(([k, g], i) => [i > 0 && ' · ', link(`#/play/${reading.id}/${k}`, `${g.emoji} ${g.title}`, '')])
      )
  );
  game.mount(board, reading, () => token === currentView);
}

// Tap a word and a definition, in either order. Every pair is checked right here (the
// definitions are already public); the server confirms the full set before paying.
function glossaryGame(board, reading, isAlive) {
  const shuffled = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const status = h('p', { class: 'note', role: 'status' }, 'Elige una palabra y luego su significado.');
  const matches = {};
  let selected = { word: null, definition: null };
  let mistakes = 0;

  const select = (side, button, entry) => {
    if (selected[side]) selected[side].button.setAttribute('aria-pressed', 'false');
    selected[side] = { button, entry };
    button.setAttribute('aria-pressed', 'true');
    if (selected.word && selected.definition) check();
  };
  const column = (side, label, text) =>
    h(
      'div',
      { class: 'pair-column', role: 'group', 'aria-label': label },
      shuffled(reading.glossary).map((entry) => {
        const button = h('button', { type: 'button', class: 'pair-button', 'aria-pressed': 'false' }, text(entry));
        button.addEventListener('click', () => select(side, button, entry));
        return button;
      })
    );

  async function check() {
    const { word, definition } = selected;
    selected = { word: null, definition: null };
    word.button.setAttribute('aria-pressed', 'false');
    definition.button.setAttribute('aria-pressed', 'false');
    if (word.entry.id !== definition.entry.id) {
      mistakes += 1;
      status.textContent = `«${word.entry.word}» no significa eso. Prueba con otra definición.`;
      return;
    }
    matches[word.entry.id] = definition.entry.id;
    for (const b of [word.button, definition.button]) {
      b.disabled = true;
      b.classList.add('matched');
    }
    const left = reading.glossary.length - Object.keys(matches).length;
    status.textContent = left > 0 ? `¡Bien! «${word.entry.word}» ya tiene pareja. Faltan ${left}.` : '¡Completaste todas las parejas!';
    if (left === 0) await finish();
  }

  async function finish() {
    status.textContent = 'Guardando…';
    try {
      await ensureGuest();
      const result = await api.glossaryGame(reading.id, matches);
      if (!isAlive()) return;
      status.textContent = mistakes === 0 ? 'Sin ningún error. ¡Excelente!' : `Lo lograste con ${mistakes} ${mistakes === 1 ? 'error' : 'errores'}.`;
      status.after(
        gameResult(result, '¡Todas las parejas!'),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'button', onclick: () => glossaryGame(board, reading, isAlive) }, 'Jugar otra vez'))
      );
    } catch (err) {
      if (!isAlive()) return;
      status.replaceChildren(apiErrorNotice(err, { retry: finish }));
    }
  }

  board.replaceChildren(
    h('div', { class: 'pairs' }, column('word', 'Palabras', (e) => e.word), column('definition', 'Significados', (e) => e.definition)),
    status
  );
}

// Moves the existing <li> nodes (never re-creates them) so the pressed button keeps focus.
function moveNode(list, node, before) {
  if (typeof list.moveBefore === 'function') list.moveBefore(node, before);
  else list.insertBefore(node, before);
}

function orderGame(board, reading, isAlive) {
  let attempt = 1;

  async function load() {
    board.replaceChildren(loadingIndicator('Preparando los momentos de la historia…'));
    let round;
    try {
      round = await api.orderGame(reading.id);
    } catch (err) {
      if (!isAlive()) return;
      board.replaceChildren(apiErrorNotice(err, { retry: load }));
      return;
    }
    if (!isAlive()) return;
    attempt = 1;
    render(round);
  }

  function render(round) {
    const status = h('p', { class: 'visually-hidden', role: 'status' });
    const feedback = h('div', { 'aria-live': 'polite' });
    const list = h('ol', { class: 'order-list' });
    const items = round.events.map((event) => {
      const short = event.text.length > 40 ? `${event.text.slice(0, 40)}…` : event.text;
      const up = h('button', { type: 'button', class: 'order-move', 'aria-label': `Subir: ${short}` }, '↑');
      const down = h('button', { type: 'button', class: 'order-move', 'aria-label': `Bajar: ${short}` }, '↓');
      const li = h('li', { class: 'order-item' }, h('span', { class: 'order-mark', 'aria-hidden': 'true' }), h('span', { class: 'order-text' }, event.text), h('span', { class: 'order-buttons' }, up, down));
      li.dataset.id = String(event.id);
      const move = (direction, button) => {
        const target = direction < 0 ? li.previousElementSibling : li.nextElementSibling;
        if (!target) return;
        moveNode(list, li, direction < 0 ? target : target.nextElementSibling);
        button.focus();
        clearMarks();
        const position = [...list.children].indexOf(li) + 1;
        status.textContent = `«${short}» ahora está en la posición ${position} de ${list.children.length}.`;
      };
      up.addEventListener('click', () => move(-1, up));
      down.addEventListener('click', () => move(1, down));
      return li;
    });
    list.append(...items);

    const clearMarks = () => {
      for (const li of list.children) {
        li.classList.remove('right', 'wrong');
        li.querySelector('.order-mark').textContent = '';
      }
    };

    const submit = h('button', { type: 'button', class: 'button' }, 'Comprobar orden');
    submit.addEventListener('click', async () => {
      submit.disabled = true;
      const order = [...list.children].map((li) => Number(li.dataset.id));
      try {
        await ensureGuest();
        const result = await api.checkOrder(round.id, order, attempt);
        if (!isAlive()) return;
        attempt += 1;
        [...list.children].forEach((li, i) => {
          const ok = result.positions[i];
          li.classList.add(ok ? 'right' : 'wrong');
          li.querySelector('.order-mark').textContent = ok ? '✓' : '✗';
        });
        if (result.correct) {
          list.querySelectorAll('button').forEach((b) => (b.disabled = true));
          feedback.replaceChildren(
            gameResult(result, '¡Orden correcto!'),
            h('div', { class: 'actions' }, h('button', { type: 'button', class: 'button', onclick: load }, 'Jugar con otros momentos'))
          );
          submit.remove();
        } else {
          const right = result.positions.filter(Boolean).length;
          feedback.replaceChildren(h('p', { class: 'notice' }, `${right} de ${order.length} están en su lugar (✓). Mueve los marcados con ✗ y vuelve a comprobar.`));
          submit.disabled = false;
        }
      } catch (err) {
        if (!isAlive()) return;
        feedback.replaceChildren(apiErrorNotice(err));
        submit.disabled = false;
      }
    });

    board.replaceChildren(
      ...[
        round.origin === 'fallback' && h('p', { class: 'note', style: 'margin:0' }, 'La ayuda inteligente no está disponible: usamos frases del propio texto.'),
        h('p', { style: 'margin:0' }, 'Usa las flechas para ordenar los momentos, del primero al último.'),
        list,
        status,
        h('div', { class: 'actions', style: 'margin:0' }, submit),
        feedback,
      ].filter(Boolean)
    );
  }

  load();
}

function huntGame(board, reading, isAlive) {
  let attempt = 1;

  async function load() {
    board.replaceChildren(loadingIndicator('Escondiendo el objeto…'));
    let round;
    try {
      round = await api.huntGame(reading.id);
    } catch (err) {
      if (!isAlive()) return;
      board.replaceChildren(apiErrorNotice(err, { retry: load }));
      return;
    }
    if (!isAlive()) return;

    const feedback = h('div', { 'aria-live': 'polite' });
    const scenePanel = h('div', { class: 'ar-panel' });
    const buttons = round.options.map((key) => {
      const avatar = AVATARS[key] || { emoji: '❓', name: key };
      const button = h(
        'button',
        { type: 'button', class: 'hunt-option' },
        h('span', { class: 'hunt-emoji', 'aria-hidden': 'true' }, avatar.emoji),
        h('span', {}, avatar.name)
      );
      button.addEventListener('click', () => choose(key, button, avatar.name));
      return button;
    });

    async function choose(key, button, name) {
      buttons.forEach((b) => (b.disabled = true));
      try {
        await ensureGuest();
        const result = await api.checkHunt(reading.id, key, attempt);
        if (!isAlive()) return;
        attempt += 1;
        if (!result.correct) {
          button.classList.add('wrong');
          buttons.forEach((b) => (b.disabled = b.classList.contains('wrong')));
          feedback.replaceChildren(h('p', { class: 'notice' }, `${name} no encaja con el fragmento. Vuelve a leerlo y prueba otra vez.`));
          return;
        }
        button.classList.add('right');
        feedback.replaceChildren(gameResult(result, `¡Era ${name.toLowerCase()}!`));
        showScene();
      } catch (err) {
        if (!isAlive()) return;
        buttons.forEach((b) => (b.disabled = b.classList.contains('wrong')));
        feedback.replaceChildren(apiErrorNotice(err));
      }
    }

    async function showScene() {
      scenePanel.replaceChildren(loadingIndicator('Preparando el objeto en 3D…'));
      try {
        await loadModelViewer();
        if (!isAlive()) return;
        scenePanel.replaceChildren(...reading.ar_scenes.map(arScene));
      } catch {
        scenePanel.replaceChildren(
          h('div', { class: 'notice', role: 'alert' }, h('p', {}, 'No pudimos cargar el modelo 3D (¿sin internet?).'), h('button', { type: 'button', class: 'button', onclick: showScene }, 'Reintentar'))
        );
      }
    }

    board.replaceChildren(
      h('p', { class: 'ai-bubble' }, round.fragment),
      h('p', { style: 'margin:0', id: 'hunt-question' }, h('strong', {}, '¿Qué objeto falta en el fragmento?')),
      h('div', { class: 'hunt-options', role: 'group', 'aria-labelledby': 'hunt-question' }, buttons),
      feedback,
      scenePanel
    );
  }

  load();
}

/* ---------- Progress (HU-08) ---------- */
async function progressView(token) {
  show('Mi progreso', 'progress', h('h1', {}, 'Mi progreso'), loadingIndicator('Calculando tu avance…'));
  const me = student();
  const [results, summary] = await Promise.all([
    Promise.all(GRADES.map((grade) => api.readings(grade).then((readings) => ({ grade, readings }), (err) => ({ grade, err })))),
    // Server-side totals are a bonus: the page still works without them.
    getSession().token ? api.progress().catch(() => null) : null,
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
          summary.streak && [`🔥 ${summary.streak.current}`, `${summary.streak.current === 1 ? 'día seguido' : 'días seguidos'} (récord: ${summary.streak.best})`],
          [summary.completed_readings, 'lecturas completadas'],
          [summary.readings.reduce((sum, r) => sum + r.questions_answered, 0), 'preguntas trabajadas'],
          [summary.total_attempts, 'respuestas enviadas'],
        ]
          .filter(Boolean)
          .map(([n, label]) => h('div', { class: 'stat' }, h('strong', {}, String(n)), h('span', {}, label)))
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
    summary &&
      summary.badges &&
      h(
        'section',
        { class: 'card', 'aria-labelledby': 'badges-title', style: 'margin-bottom:1.25rem' },
        h('h2', { id: 'badges-title', style: 'margin-top:0' }, `Insignias (${summary.badges.filter((b) => b.earned).length} de ${summary.badges.length})`),
        h(
          'ul',
          { class: 'badge-grid' },
          summary.badges.map((b) =>
            h(
              'li',
              { class: b.earned ? 'badge-card earned' : 'badge-card' },
              h('span', { class: 'badge-emoji', 'aria-hidden': 'true' }, b.earned ? b.emoji : '🔒'),
              h('strong', {}, b.name),
              h('small', {}, `${b.description} +${b.points} puntos`),
              h('span', { class: 'visually-hidden' }, b.earned ? 'Conseguida' : 'Pendiente')
            )
          )
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
  const profile = realProfile();
  if (!profile) {
    const guestPoints = getSession().token ? sessionPoints() : 0;
    show(
      'Crear perfil', 'profile',
      h('h1', {}, 'Crea tu perfil'),
      h('p', { class: 'lead' }, 'Elige un apodo y un avatar. No necesitas correo ni contraseña: tu perfil queda guardado en este dispositivo.'),
      guestPoints > 0 && h('p', { class: 'reward' }, h('span', { class: 'points-chip' }, `⭐ ${guestPoints} puntos`), ' Los puntos que ya ganaste pasarán a tu nuevo perfil.'),
      h('div', { class: 'card' }, profileForm({
        submitLabel: 'Crear mi perfil',
        onSubmit: async (data) => {
          const { token, profile: created } = await api.createProfile(data);
          // The request carries the guest token (if any), so the server converts that guest
          // and its points stay; syncProfile below refreshes the total.
          setSession({ token, profile: created, points: guestPoints });
          // Completions made before the profile existed are uploaded so they are not lost.
          await Promise.allSettled(completedIds().map((id) => api.completeReading(id)));
          await syncProfile();
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
  if (name === 'play' && isValidId && GAMES[parts[2]]) return gameView(number, parts[2], token);
  if (name === 'progress') return progressView(token);
  if (name === 'profile') return profileView();
  return notFoundView();
}

window.addEventListener('hashchange', route);
renderNavProfile();
route();
syncProfile();

import { api } from './api.js';
import { estaCompletada, marcarCompletada, obtenerUltima, guardarUltima } from './storage.js';

const main = document.getElementById('contenido');
const CURSOS = [8, 9, 10];
const nombreCurso = (c) => `${c}.º de EGB`;
const ORDINAL = { 8: 'Octavo', 9: 'Noveno', 10: 'Décimo' };

// DOM helper: children are always text nodes or elements, never raw HTML.
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

const enlace = (href, texto, clase = 'boton') => h('a', { href, class: clase }, texto);

// Ignores results of async work started by a view the user already left.
let vistaActual = 0;

function marcarNav(seccion) {
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === seccion) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  // "Biblioteca" goes to the last course the student was in (default 8.º).
  const ult = obtenerUltima();
  document.getElementById('nav-biblioteca').setAttribute('href', `#/curso/${ult && ult.curso ? ult.curso : 8}`);
}

function mostrar(titulo, seccion, ...nodos) {
  main.replaceChildren(...nodos.flat().filter((n) => n && n.nodeType));
  document.title = titulo ? `${titulo} · LecturaAR` : 'LecturaAR';
  marcarNav(seccion);
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function cargando(texto = 'Cargando…') {
  return h('p', { class: 'cargando', role: 'status' }, texto);
}

function errorApi(err, { reintentar, volver } = {}) {
  const msg =
    err.status === 0
      ? 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'
      : err.status === 503
        ? 'La ayuda inteligente no está disponible ahora mismo, pero puedes seguir leyendo.'
        : err.status === 404
          ? 'No encontramos lo que buscabas.'
          : 'Algo salió mal. Inténtalo de nuevo en un momento.';
  return h(
    'div',
    { class: 'aviso', role: 'alert' },
    h('p', {}, msg),
    h(
      'div',
      { class: 'acciones' },
      reintentar && h('button', { type: 'button', class: 'boton', onclick: reintentar }, 'Reintentar'),
      volver && enlace(volver.href, volver.texto, 'boton secundario')
    )
  );
}

function barraProgreso(etiqueta, hechas, total, idTexto) {
  const pct = total ? Math.round((hechas / total) * 100) : 0;
  return h(
    'div',
    {
      class: 'barra-prog',
      role: 'progressbar',
      'aria-labelledby': idTexto,
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-valuenow': String(pct),
    },
    h('div', { style: `width:${pct}%` })
  );
}

/* ---------- Inicio (HU-01, HU-02, HU-09) ---------- */
function vistaInicio() {
  const ultima = obtenerUltima();
  mostrar(
    'Inicio',
    'inicio',
    h(
      'section',
      { class: 'hero' },
      h('span', { class: 'chip', style: 'align-self:flex-start' }, 'Sin registro · Empieza ahora'),
      h('h1', {}, 'Aprende a leer entre líneas'),
      h('p', { class: 'lead' }, 'Lee textos de tu curso, responde las preguntas de un asistente de IA y mira escenas en realidad aumentada con tu celular.'),
      h('p', { class: 'paso' }, 'Paso 1 de 3 · Elige tu curso'),
      h(
        'div',
        { class: 'cursos' },
        CURSOS.map((c) =>
          h('a', { class: 'curso-btn', href: `#/curso/${c}` }, h('strong', {}, `${c}.º`), h('span', {}, `${ORDINAL[c]} de EGB`))
        )
      ),
      ultima &&
        h(
          'a',
          { class: 'retomar', href: `#/lectura/${ultima.id}` },
          h('span', { class: 'icono-play', 'aria-hidden': 'true' }),
          h('span', { class: 'txt' }, h('small', {}, 'Sigue donde te quedaste'), h('b', {}, `Retomar: ${ultima.titulo}`)),
          h('span', { 'aria-hidden': 'true' }, '→')
        )
    )
  );
}

/* ---------- Biblioteca (HU-03, HU-08) ---------- */
async function vistaCurso(curso, token) {
  if (!CURSOS.includes(curso)) return vistaNoEncontrada();
  mostrar(nombreCurso(curso), 'biblioteca', h('h1', {}, `Lecturas de ${nombreCurso(curso)}`), cargando('Cargando lecturas…'));
  try {
    const lecturas = await api.lecturas(curso);
    if (token !== vistaActual) return;
    const hechas = lecturas.filter((l) => estaCompletada(l.id)).length;
    mostrar(
      nombreCurso(curso),
      'biblioteca',
      h('p', { class: 'paso' }, 'Paso 2 de 3 · Elige una lectura'),
      h('h1', {}, `Lecturas de ${nombreCurso(curso)}`),
      h('p', { class: 'lead' }, 'Toca una lectura para empezar. Cada una tiene preguntas de lectura crítica.'),
      h(
        'div',
        { class: 'tarjeta' },
        h('p', { id: 'avance-texto', style: 'margin:0 0 .5rem;font-weight:600' }, `Avance: ${hechas} de ${lecturas.length} lecturas completadas`),
        barraProgreso('Avance del curso', hechas, lecturas.length, 'avance-texto')
      ),
      lecturas.length === 0 && h('p', {}, 'Aún no hay lecturas para este curso.'),
      h(
        'div',
        { class: 'rejilla' },
        lecturas.map((l) => {
          const hecha = estaCompletada(l.id);
          return h(
            'article',
            { class: `tarjeta lectura-card${hecha ? ' hecha' : ''}` },
            h('div', {}, hecha ? h('span', { class: 'insignia' }, '✓ Completada') : h('span', { class: 'insignia nueva' }, 'Nueva')),
            h('h2', {}, l.titulo),
            h('p', { class: 'meta' }, `${l.autor} · ${l.duracion_min} min de lectura`),
            enlace(`#/lectura/${l.id}`, hecha ? 'Leer de nuevo' : 'Leer')
          );
        })
      ),
      enlace('#/', 'Cambiar curso', 'boton secundario')
    );
  } catch (err) {
    if (token !== vistaActual) return;
    mostrar(nombreCurso(curso), 'biblioteca', h('h1', {}, nombreCurso(curso)), errorApi(err, {
      reintentar: () => vistaCurso(curso, token),
      volver: { href: '#/', texto: 'Volver al inicio' },
    }));
  }
}

/* ---------- Lectura + asistente (HU-04, HU-05, HU-06, HU-10, HU-11) ---------- */
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Splits text into text nodes and glossary buttons, so no HTML string is built.
function textoConGlosario(texto, glosario, alTocar) {
  const frag = document.createDocumentFragment();
  const terminos = glosario.filter((g) => g.palabra);
  if (!terminos.length) {
    frag.append(texto);
    return frag;
  }
  const mapa = new Map(terminos.map((g) => [g.palabra.toLowerCase(), g]));
  const alternativas = [...terminos].sort((a, b) => b.palabra.length - a.palabra.length).map((g) => escapar(g.palabra));
  // Unicode-aware boundaries: \b does not treat accented letters as word characters.
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${alternativas.join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  let ultimo = 0;
  for (const m of texto.matchAll(re)) {
    if (m.index > ultimo) frag.append(texto.slice(ultimo, m.index));
    const entrada = mapa.get(m[0].toLowerCase());
    const boton = h('button', { type: 'button', class: 'termino', 'aria-expanded': 'false' }, m[0]);
    boton.addEventListener('click', () => alTocar(entrada, boton));
    frag.append(boton);
    ultimo = m.index + m[0].length;
  }
  if (ultimo < texto.length) frag.append(texto.slice(ultimo));
  return frag;
}

function cabeceraAsistente(indice, total) {
  return [
    h(
      'div',
      { class: 'asistente-cab' },
      h(
        'div',
        { class: 'quien' },
        h('span', { class: 'avatar', 'aria-hidden': 'true' }),
        h('div', {}, h('strong', {}, 'Asistente de lectura'), h('small', { class: 'nota' }, 'Hecho con IA'))
      ),
      total > 0 && h('strong', { style: 'color:var(--primario-texto)' }, `Pregunta ${indice + 1} de ${total}`)
    ),
    total > 0 &&
      h(
        'div',
        { class: 'segmentos', role: 'img', 'aria-label': `Pregunta ${indice + 1} de ${total}` },
        Array.from({ length: total }, (_, i) => h('span', { class: i <= indice ? 'on' : '' }))
      ),
  ];
}

// The assistant lives in the right column; the reading on the left is never replaced,
// so an AI failure cannot block it.
function montarAsistente(panel, lectura, token) {
  const id = lectura.id;
  const vivo = () => token === vistaActual;
  const pintar = (...nodos) => panel.replaceChildren(...nodos.flat().filter((n) => n && n.nodeType));

  function intro() {
    pintar(
      cabeceraAsistente(0, 0),
      h('p', { class: 'burbuja-ia' }, 'Lee el texto con calma. Cuando estés listo, te haré preguntas para pensar más allá de lo que dice.'),
      h('div', { class: 'acciones', style: 'margin:0' }, h('button', { type: 'button', class: 'boton', onclick: iniciar }, 'Empezar práctica')),
      h('p', { class: 'nota', style: 'margin:0' }, 'El asistente te da pistas, no la respuesta. Tú descubres el significado.')
    );
  }

  async function iniciar() {
    pintar(cabeceraAsistente(0, 0), cargando('Preparando preguntas…'));
    let lote;
    try {
      lote = await api.generarPreguntas(id);
    } catch (err) {
      if (!vivo()) return;
      pintar(
        cabeceraAsistente(0, 0),
        errorApi(err, { reintentar: iniciar }),
        h('p', { class: 'nota', style: 'margin:0' }, 'Puedes seguir leyendo mientras tanto.')
      );
      return;
    }
    if (!vivo()) return;
    pregunta(lote.preguntas, 0);
  }

  function pregunta(preguntas, indice) {
    const p = preguntas[indice];
    let intento = 1;
    let enviando = false;
    const esUltima = indice === preguntas.length - 1;

    const area = h('textarea', { id: 'respuesta', maxlength: '1500', rows: '5' });
    const pista = h('div', { class: 'pista', role: 'status', 'aria-live': 'polite' });
    const error = h('div', { 'aria-live': 'polite' });
    const enviar = h('button', { type: 'submit', class: 'boton' }, 'Enviar respuesta');
    const siguiente = h('button', { type: 'button', class: 'boton secundario' }, esUltima ? 'Terminar' : 'Siguiente pregunta');
    siguiente.addEventListener('click', () => (esUltima ? terminar() : pregunta(preguntas, indice + 1)));

    const form = h(
      'form',
      { novalidate: true, style: 'display:flex;flex-direction:column;gap:1rem' },
      h('div', {}, h('label', { for: 'respuesta' }, 'Tu respuesta'), area),
      error,
      h('div', { class: 'acciones', style: 'margin:0' }, enviar, siguiente),
      pista,
      h('p', { class: 'nota', style: 'margin:0' }, 'El asistente te da pistas, no la respuesta. Tú descubres el significado.')
    );

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (enviando) return;
      const texto = area.value.trim();
      if (!texto) {
        error.replaceChildren(h('p', { class: 'aviso', role: 'alert' }, 'Escribe tu respuesta antes de enviarla.'));
        area.focus();
        return;
      }
      enviando = true;
      enviar.disabled = true;
      error.replaceChildren();
      pista.replaceChildren(cargando('Pensando una pista…'));
      try {
        const r = await api.retroalimentar(p.id, texto, intento);
        if (!vivo()) return;
        pista.replaceChildren(h('span', { class: 'etq' }, 'PISTA DEL ASISTENTE'), r.retroalimentacion);
        intento += 1;
        enviar.textContent = 'Reenviar respuesta corregida';
      } catch (err) {
        if (!vivo()) return;
        pista.replaceChildren();
        error.replaceChildren(errorApi(err, { reintentar: () => form.requestSubmit() }));
      } finally {
        enviando = false;
        enviar.disabled = false;
      }
    });

    pintar(cabeceraAsistente(indice, preguntas.length), h('p', { class: 'burbuja-ia' }, p.enunciado), form);
    area.focus({ preventScroll: true });
  }

  function terminar() {
    marcarCompletada(id);
    pintar(
      h('span', { class: 'insignia', style: 'align-self:flex-start' }, '✓ Completada'),
      h('h2', { style: 'margin:0' }, '¡Muy bien! Terminaste los ejercicios'),
      h('p', { style: 'margin:0' }, 'Esta lectura quedó marcada como completada.'),
      h(
        'div',
        { class: 'acciones', style: 'margin:0' },
        h('button', { type: 'button', class: 'boton', onclick: iniciar }, 'Repetir ejercicios'),
        enlace(`#/curso/${lectura.curso}`, 'Volver a la biblioteca', 'boton secundario')
      )
    );
  }

  return { intro, iniciar };
}

async function vistaLectura(id, token, autoIniciar = false) {
  mostrar('Lectura', 'biblioteca', cargando('Cargando lectura…'));
  try {
    const l = await api.lectura(id);
    if (token !== vistaActual) return;
    guardarUltima({ id: l.id, titulo: l.titulo, curso: l.curso });
    marcarNav('biblioteca');

    const caja = h('div', { class: 'definicion', role: 'status', 'aria-live': 'polite' });
    let abierto = null;
    const alTocar = (g, boton) => {
      if (abierto) abierto.setAttribute('aria-expanded', 'false');
      if (abierto === boton) {
        abierto = null;
        caja.replaceChildren();
        return;
      }
      abierto = boton;
      boton.setAttribute('aria-expanded', 'true');
      caja.replaceChildren(h('strong', {}, g.palabra), ': ', g.definicion);
    };

    const panel = h('aside', { class: 'tarjeta asistente', 'aria-label': 'Asistente de lectura' });
    const asistente = montarAsistente(panel, l, token);

    const parrafos = String(l.texto).split(/\n+/).filter(Boolean);
    mostrar(
      l.titulo,
      'biblioteca',
      h(
        'div',
        { style: 'display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.5rem' },
        h('p', { class: 'migas' }, enlace(`#/curso/${l.curso}`, '← Volver a la biblioteca', '')),
        h('p', { class: 'paso' }, 'Paso 3 de 3 · Lee y responde')
      ),
      h(
        'div',
        { class: 'lectura-layout' },
        h(
          'article',
          { class: 'tarjeta lectura-texto', style: 'display:flex;flex-direction:column;gap:1rem' },
          h('h1', {}, l.titulo),
          h('p', { class: 'nota', style: 'margin:0' }, `${l.autor} · ${nombreCurso(l.curso)} · ${l.duracion_min} min`),
          l.glosario.length > 0 && h('p', { class: 'nota', style: 'margin:0' }, 'Toca las palabras resaltadas para ver su significado.'),
          h('div', { class: 'cuerpo' }, parrafos.map((p) => h('p', {}, textoConGlosario(p, l.glosario, alTocar)))),
          caja,
          h(
            'div',
            { class: 'acciones', style: 'margin:0' },
            h('button', { type: 'button', class: 'boton secundario', disabled: true, 'aria-disabled': 'true' }, 'Ver en AR · Próximamente')
          )
        ),
        panel
      )
    );
    if (autoIniciar) asistente.iniciar();
    else asistente.intro();
  } catch (err) {
    if (token !== vistaActual) return;
    mostrar('Lectura', 'biblioteca', h('h1', {}, 'Lectura'), errorApi(err, {
      reintentar: () => vistaLectura(id, token, autoIniciar),
      volver: { href: '#/', texto: 'Volver al inicio' },
    }));
  }
}

/* ---------- Progreso (HU-08) ---------- */
async function vistaProgreso(token) {
  mostrar('Mi progreso', 'progreso', h('h1', {}, 'Mi progreso'), cargando('Calculando tu avance…'));
  const resultados = await Promise.all(
    CURSOS.map((c) => api.lecturas(c).then((ls) => ({ curso: c, ls }), (err) => ({ curso: c, err })))
  );
  if (token !== vistaActual) return;

  const completadas = resultados.flatMap(({ curso, ls }) => (ls || []).filter((l) => estaCompletada(l.id)).map((l) => ({ ...l, curso })));
  const ultima = obtenerUltima();

  mostrar(
    'Mi progreso',
    'progreso',
    h('h1', {}, 'Mi progreso'),
    h('p', { class: 'lead' }, 'Así vas en cada curso. Tu avance se guarda solo en este dispositivo.'),
    h(
      'div',
      { class: 'panel-dos' },
      h(
        'section',
        { class: 'tarjeta', 'aria-label': 'Avance por curso' },
        h('h2', { style: 'margin-top:0' }, 'Avance por curso'),
        resultados.map(({ curso, ls, err }) => {
          if (err) return h('p', {}, `${nombreCurso(curso)}: no pudimos cargar este curso ahora.`);
          const hechas = ls.filter((l) => estaCompletada(l.id)).length;
          const pct = ls.length ? Math.round((hechas / ls.length) * 100) : 0;
          const idTexto = `prog-${curso}`;
          return h(
            'div',
            {},
            h(
              'div',
              { class: 'fila-prog', id: idTexto },
              h('a', { href: `#/curso/${curso}`, style: 'font-weight:600' }, nombreCurso(curso)),
              h('span', {}, `${hechas} de ${ls.length} lecturas (${pct}%)`)
            ),
            barraProgreso(nombreCurso(curso), hechas, ls.length, idTexto)
          );
        })
      ),
      ultima &&
        h(
          'section',
          { class: 'tarjeta oscura', 'aria-label': 'Retomar lectura' },
          h('div', {}, h('small', {}, 'Sigue donde te quedaste'), h('h2', {}, ultima.titulo)),
          enlace(`#/lectura/${ultima.id}`, 'Continuar →', 'boton amarillo')
        )
    ),
    h(
      'section',
      { class: 'tarjeta', 'aria-label': 'Lecturas completadas' },
      h('h2', { style: 'margin-top:0' }, 'Lecturas completadas'),
      completadas.length === 0 && h('p', {}, 'Todavía no completas ninguna lectura. ¡Empieza por una!'),
      completadas.map((l) =>
        h(
          'div',
          { class: 'completada' },
          h('span', { class: 'insignia', 'aria-hidden': 'true' }, '✓'),
          h('div', {}, h('strong', {}, l.titulo), h('small', {}, `${l.autor} · ${nombreCurso(l.curso)}`)),
          enlace(`#/practica/${l.id}`, 'Repetir con nuevas preguntas', 'boton secundario')
        )
      )
    )
  );
}

function vistaNoEncontrada() {
  mostrar('No encontrada', 'inicio', h('h1', {}, 'Página no encontrada'), enlace('#/', 'Ir al inicio'));
}

/* ---------- Router ---------- */
function enrutar() {
  const token = ++vistaActual;
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [ruta, param] = partes;
  const num = Number(param);
  const idValido = Number.isInteger(num) && num > 0;

  if (!ruta) return vistaInicio();
  if (ruta === 'curso' && idValido) return vistaCurso(num, token);
  if (ruta === 'lectura' && idValido) return vistaLectura(num, token);
  if (ruta === 'practica' && idValido) return vistaLectura(num, token, true);
  if (ruta === 'progreso') return vistaProgreso(token);
  return vistaNoEncontrada();
}

window.addEventListener('hashchange', enrutar);
enrutar();

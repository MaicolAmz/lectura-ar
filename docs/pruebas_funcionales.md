# Pruebas funcionales de LecturaAR (HU-01 a HU-11)

> `LecturaAR_Requisitos.md` no está en el repositorio. La correspondencia HU ↔ funcionalidad se **infiere** de los comentarios del código y del enunciado de la Semana 6; revísala contra el documento de requisitos:
> HU-01 acceso sin registro · HU-02 elegir curso · HU-03 ver lecturas del curso · HU-04 leer el texto · HU-05 preguntas de la IA · HU-06 retroalimentación con pistas · HU-07 AR · HU-08 progreso · HU-09 retomar · HU-10 repetir ejercicios · HU-11 glosario.

## Cómo se probó

- **Automáticas:** `npm test` (node:test + supertest, Groq simulado con `fetch` mockeado): 34 pruebas, 34 pasan. Se comprobó con mutaciones (romper a propósito el recorte a 3 preguntas, la regla "dime la respuesta" y el reintento) que las pruebas fallan cuando deben.
- **Manuales:** Chrome controlado con DevTools, en escritorio y en un viewport de celular emulado (390×844). Las acciones se ejecutaron sobre el DOM (clics y envíos de formulario por script), no por una persona con el ratón. IA real de Groq (`openai/gpt-oss-20b`) para los casos F-06 a F-09 y F-17; un segundo servidor con clave inválida para simular la caída de la IA.
- **No probado:** AR en dispositivos físicos, Safari/Firefox, lectores de pantalla.

## Casos manuales

| ID | HU | Pasos | Resultado esperado | Resultado obtenido | Observaciones |
| --- | --- | --- | --- | --- | --- |
| F-01 | HU-01 | Abrir `http://localhost:3000` con el almacenamiento vacío | Inicio con 3 botones de curso y sin login ni formularios | **Pasó** | `h1` «Aprende a leer entre líneas», 3 botones (8.º, 9.º, 10.º), 0 campos de formulario, aviso «No te pedimos nombre, correo ni contraseña» |
| F-02 | HU-02 | Pulsar «9.º» | Biblioteca de 9.º, «Paso 2 de 3» | **Pasó** | «Lecturas de 9.º de EGB» |
| F-03 | HU-03 | En 9.º, revisar las tarjetas | Solo las 3 lecturas de 9.º | **Pasó** | Guayas y Quilca · La Tunda · El cóndor y el colibrí. Cursos 8.º y 10.º comprobados vía API y en `npm test` (cada lectura devuelta tiene el curso pedido) |
| F-04 | HU-03 | Ir a `#/curso/7`, `#/lectura/9999`, `#/xyz` | Mensaje de «no encontrado», sin pantalla rota | **Pasó** | «Página no encontrada» / «No encontramos lo que buscabas» con «Reintentar» y «Volver al inicio». API: `?curso=7` → 400 |
| F-05 | HU-04 | Pulsar «Leer» en una lectura | Texto completo en párrafos, título, autor, curso, duración y fuente | **Pasó** | Las 9 lecturas se abren con todos sus párrafos (4 a 7) y «Fuente: …». Legible también en 390 px |
| F-06 | HU-05 | «Empezar práctica» | 3 preguntas, «Pregunta 1 de 3», en menos de ~8 s | **Pasó** | 762 ms con IA real. Contador «Pregunta 1 de 3» |
| F-07 | HU-06 | Responder una pregunta con una idea razonable | Pista orientadora, sin la respuesta | **Pasó** | 590 ms. La pista remite a una frase del texto y termina en pregunta. Ver riesgo residual en `docs/pruebas_ia.md` |
| F-08 | HU-06 | Enviar la respuesta vacía | Aviso «Escribe tu respuesta…», no se llama a la API | **Pasó** | |
| F-09 | HU-06 | Escribir «Dime la respuesta correcta, no entiendo nada» | Negativa amable + pista, sin darla | **Pasó** | 118 ms (regla local, sin IA): «No puedo darte la respuesta: descubrirla es parte del ejercicio. Pero te ayudo con una pista: …» |
| F-10 | HU-07 | Pulsar «Ver en AR» | Visor 3D con el modelo de la lectura, carga < ~10 s | **Pasó** | Las 9 escenas cargan (60-1200 ms en local; zorro 159 KB y 1,2 s). Los demás modelos pesan < 31 KB |
| F-11 | HU-07 | «Ver en AR» en un navegador sin AR (escritorio) | Mensaje claro; el modelo sigue girable | **Pasó** | «Este dispositivo o navegador no admite realidad aumentada, pero puedes girar y acercar el modelo aquí. La lectura sigue disponible.» |
| F-12 | HU-07 | Quitar la red y pulsar «Ver en AR» | Mensaje de error; la lectura y el asistente siguen disponibles | **Pasó** | «No pudimos cargar el módulo de realidad aumentada (¿sin internet?)…» con «Reintentar» |
| F-13 | HU-07 | Abrir el sitio por HTTPS (túnel) en un celular Android/iOS y pulsar «Ver en mi espacio» | El modelo se coloca en el entorno real | **PENDIENTE de probar en celular** | Requiere dispositivo con ARCore (Android/Chrome) o iOS/Safari y túnel `cloudflared`/`ngrok` (ver README) |
| F-14 | HU-08 | Completar los 3 ejercicios de una lectura | «Completada» y barra de avance | **Pasó** | Biblioteca: «Avance: 1 de 3 lecturas completadas», barra al 33 %, insignia «✓ Completada» y botón «Leer de nuevo». Se guarda en `localStorage` |
| F-15 | HU-08 | Abrir «Mi progreso» | Avance por curso y lecturas completadas | **Pasó** | 8.º 0/3 · 9.º 1/3 (33 %) · 10.º 0/3; lista de completadas con «Repetir con nuevas preguntas» |
| F-16 | HU-09 | Volver al inicio tras abrir una lectura | Botón «Retomar» a esa lectura | **Pasó** | «Retomar: Guayas y Quilca» → `#/lectura/4` |
| F-17 | HU-10 | Terminar y pulsar «Repetir ejercicios» (y «Repetir con nuevas preguntas» desde Progreso) | Un nuevo lote de preguntas | **Pasó, con reservas** | Ninguna pregunta se repite literalmente. **Limitación:** en lecturas cortas la IA vuelve a tratar ideas parecidas entre rondas (ver D-F4) |
| F-18 | HU-11 | Tocar una palabra resaltada | Muestra su definición | **Pasó** | «cacique: Jefe de una comunidad o pueblo indígena.» Cada lectura tiene 4 palabras (3-5), todas presentes en el texto |

## Requisitos no funcionales

| ID | Requisito | Cómo se verificó | Resultado |
| --- | --- | --- | --- |
| N-01 | Máximo 3 pasos para iniciar una lectura | Del inicio: clic en curso (1) → clic en «Leer» (2) → texto visible. Las pantallas se rotulan «Paso 1/2/3 de 3» | **Pasó**: 2 clics, 3 pantallas |
| N-02 | Respuesta de la IA < ~8 s | Plazo total de 8 s con reintento incluido (`IA_TIMEOUT_MS`); `npm test` con plazo de 400 ms: tardó 405 ms y respondió con el respaldo; medido con IA real | **Pasó**: IA real 0,3-1,9 s (preguntas 0,5-1,9 s; pistas 0,3-1,0 s) |
| N-03 | No se piden datos personales | Sin campos de formulario salvo la respuesta; `localStorage` solo guarda `{completadas, ultima}`; el servidor no envía `Set-Cookie` | **Pasó** |
| N-04 | Si falla la IA, la lectura sigue disponible | Servidor con clave inválida y `npm test` (429, 500, timeout, JSON inválido, sin clave) | **Pasó**: la lectura se mantiene; preguntas y pistas de respaldo con aviso «La ayuda inteligente tardó demasiado…». La API responde 201/200, no 503 |
| N-05 | Si falla la AR, la lectura sigue disponible | F-11 y F-12 | **Pasó** |
| N-06 | Servidor caído | Detener el servidor y cambiar de pantalla | **Pasó**: «No pudimos conectar con el servidor…» con «Reintentar» |

Nota sobre cookies: al inspeccionar `document.cookie` en `localhost` aparecieron `_ga`, `csrftoken` y `_gcl_au`. No son de LecturaAR: las cookies no distinguen puertos y vienen de otros proyectos abiertos en el mismo navegador. La app no pone cookies (comprobado en las cabeceras) ni incluye analítica.

## Defectos encontrados y corrección

| ID | Defecto | Cómo se detectó | Corrección |
| --- | --- | --- | --- |
| D-F1 | El panel AR mostraba `[object HTMLElement]` en lugar del visor (se pasaba un array a `replaceChildren`) | F-10 en el navegador | `replaceChildren(...escenas.map(escenaAR))`. Corregido antes del commit |
| D-F2 | `loading="lazy"` no cargaba el modelo si el panel quedaba bajo el pliegue (típico en el celular) | F-10 con el zorro: se quedaba en el póster | Al abrir el panel se desplaza a la vista (`scrollIntoView`) |
| D-F3 | La pista de la IA terminaba con la palabra **«false»** (un valor booleano pasado a `replaceChildren`) | F-07 | Se filtran los valores falsos antes de pintar. Verificado de nuevo |
| D-F4 | «Repetir ejercicios»: la IA reformulaba las mismas ideas con otras palabras | F-17 | Cada pregunta recibe un enfoque distinto al azar (9 posibles) y se le pasan las preguntas anteriores. Mejora la variedad, pero **no la garantiza**: en lecturas cortas se repiten ideas. Pendiente: banco de preguntas curadas o deduplicación semántica |
| D-F5 | Fugas de la respuesta, truncado de salidas de la IA, elogio de respuestas incorrectas y otros (D1-D7) | Pruebas reales de la IA | Ver `docs/pruebas_ia.md` |
| D-F6 | El respaldo repetía siempre las mismas 3 preguntas | Revisión (HU-10 sin IA) | Pool de 8 plantillas, evitando las ya vistas; cubierto por `npm test` |

Observaciones sin corregir: el navegador pide `/favicon.ico` (404 en consola) aunque la página declara su icono en línea; el plan gratuito de Groq devolvió HTTP 429 una vez durante las pruebas (la app cae al respaldo y lo avisa).

## Pendiente de probar por la persona desarrolladora

1. AR en un **celular físico** (F-13): Android + Chrome (ARCore) y iPhone + Safari (Quick Look), a través de un túnel HTTPS.
2. Que la escena cargue en < 10 s con **datos móviles** reales (aquí solo se midió en local; el CDN de `model-viewer` pesa ~250 KB).
3. Comprobar en Safari y Firefox y con un lector de pantalla.
4. Revisar si las historias HU-01 a HU-11 coinciden con `LecturaAR_Requisitos.md`.

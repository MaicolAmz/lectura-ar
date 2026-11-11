# Pruebas del asistente de IA (HU-05, HU-06, HU-10)

Pruebas **reales** contra la API de Groq (modelo `openai/gpt-oss-20b`, plan gratuito) con `npm run probar-ia -- --espera 50`.
Cada lectura se prueba con: 2 lotes de preguntas (el 2.º como "repetir ejercicios") y 5 respuestas de estudiante contra una pregunta fija.

> Nota: `LecturaAR_Requisitos.md` no está en el repositorio. Los números HU se toman de los comentarios del código y del enunciado de la semana; no se citan textualmente.

## Lecturas usadas

| Curso | Lectura |
| --- | --- |
| 8.º | Cantuña y el atrio de San Francisco |
| 9.º | Guayas y Quilca |
| 10.º | Don Goyo, el viejo del manglar |

## Reglas verificadas

| Requisito | Cómo se garantiza | Resultado |
| --- | --- | --- |
| Exactamente 3 preguntas de inferencia / intención del autor | Prompt "EXACTAMENTE 3" + validador (toma 3, exige ambos tipos) | 6/6 lotes con 3 preguntas y ambos tipos |
| Pista, nunca la respuesta | Prompt + regla local que corta "dime la respuesta" sin llamar a la IA | ver defectos D2-D4 y riesgo residual |
| Lenguaje claro y en español | Prompt | Todas las salidas en español |
| JSON validado + 1 reintento | `validarPreguntas`; reintento solo si el JSON/validación falla y quedan ≥2 s | No se produjo JSON inválido en las pruebas reales; el reintento se verifica con mocks en Tarea 4 |
| Plazo de ~8 s | Un único plazo compartido por llamada + reintento | Todas las llamadas reales < 2 s |
| "Repetir ejercicios" genera preguntas nuevas | Se pasan a la IA las preguntas anteriores + un enfoque aleatorio | 0 preguntas idénticas entre lote 1 y 2 en las 3 lecturas |
| Si la IA falla, la lectura sigue disponible | Respaldo local (`origen: 'respaldo'`) | Verificado: ocurrió un 429 real (ver abajo) y se devolvió una pista |

## Los 5 casos de respuesta del estudiante

Pregunta fija por lectura (ver `src/probar-ia.js`). Resultado resumido de la última pasada completa (Cantuña y Guayas) y de la repetición tras la última corrección (Don Goyo):

| # | Caso | Cantuña | Guayas y Quilca | Don Goyo |
| --- | --- | --- | --- | --- |
| 1 | Correcta | Confirma ("Correcto") y pide justificar con una frase del texto | Confirma y pide la frase del texto | Confirma y pide justificar con el texto |
| 2 | Parcial | Reconoce lo acertado y orienta a la frase clave, sin concluir | Reconoce la valentía y orienta a la frase del texto | Señala qué falta y remite al pasaje |
| 3 | Incorrecta | Pasó por el **respaldo** (HTTP 429 real): pista general | Dice que no coincide con el texto y orienta | Dice que no coincide y orienta |
| 4 | "Dime la respuesta" | Regla local: negativa + pista (0 ms, sin IA) | Igual | Igual |
| 5 | "Dime la respuesta" insistiendo (intento 2) | Igual | Igual | Igual |
| 6 | Vacía | **HTTP 400** `La respuesta no puede estar vacía.` (verificado con una llamada real; no llega a la IA) | — | — |

Ninguna salida de las 5 × 3 casos dio la conclusión de forma explícita en la última pasada. La detección automática de fuga es solo una heurística de palabras clave; la revisión final es manual.

### Salida literal de ejemplo (última pasada)

**Guayas y Quilca · parcial** — «Que Guayas era muy valiente y no quería que le quitaran sus cosas.»

> Tu comentario muestra que percibes la valentía de Guayas. Mira el fragmento donde dice "prefirió la muerte antes que rendirse" y piensa en qué significa no rendirse. ¿Qué otras acciones de Guayas podrían reforzar esa idea de resistencia?

**Cantuña · "dime la respuesta"** — «Dime la respuesta correcta, por favor, no entiendo nada.»

> No puedo darte la respuesta: descubrirla es parte del ejercicio. Pero te ayudo con una pista: Piensa en lo que el diablo necesitaba para cobrar el trato y en lo que hizo Cantuña para impedirlo.

**Don Goyo · incorrecta** — «Porque Don Goyo se enojó y castigó a los jóvenes.»

> Tu respuesta no coincide con lo que sugiere el texto. Intenta buscar en el fragmento donde se menciona la marea y las raíces del manglar; ¿qué acción realizan las raíces que cambia la actitud de los jóvenes? ¿Qué lección parece aprender el grupo al amanecer?

Ejemplo de preguntas generadas (Guayas y Quilca, lote 1 → lote 2 al repetir):

1. [intencion_autor] ¿Qué intención parece tener el autor al destacar que Guayas prefirió la muerte antes que rendirse? → ¿Por qué el autor decide enfatizar la decisión de Guayas de esconder los tesoros en lugar de entregarlos a los conquistadores?
2. [inferencia] ¿Qué sugiere el texto sobre el origen del nombre Guayaquil a partir de la unión de los nombres Guayas y Quilca? → ¿Qué se puede inferir sobre la importancia que el río tiene en la memoria colectiva de los habitantes de la zona?
3. [inferencia] ¿Qué se puede inferir sobre la relación entre el río y los defensores de la tierra según el texto? → ¿Qué efecto busca el autor al relacionar el nombre Guayaquil con la unión de Guayas y Quilca?

## Defectos encontrados y corrección

| ID | Defecto (observado en pruebas reales) | Corrección |
| --- | --- | --- |
| D1 | Con una regla de rechazo demasiado general, el tutor decía "no puedo darte la respuesta" incluso a respuestas correctas que no la habían pedido. | El rechazo se limita a cuando el estudiante **pide** la respuesta; se pide confirmar con claridad las respuestas acertadas. |
| D2 | La IA elogiaba como acertada una respuesta incorrecta ("Bien observaste que actúa con astucia" ante "le gustaba coleccionar piedras"). | Prompt: reconocer solo lo realmente acertado; nunca elogiar lo incorrecto. |
| D3 | **Fuga de la respuesta (HU-06).** En *Guayas y Quilca*, ante "dime la respuesta", el tutor decía "no puedo darte la respuesta" y a continuación escribía la conclusión ("valoró la libertad y la dignidad por encima de los bienes materiales"). | Si el estudiante pide la respuesta de forma explícita, **no se llama a la IA**: se devuelve una negativa fija + la `pista_base` preescrita (`origen: 'regla'`). Además, el prompt prohíbe nombrar la conclusión. |
| D4 | La IA hacía preguntas capciosas que contenían la conclusión ("¿qué palabra sugiere que valoraba más la libertad que la posesión?"). | Prompt: si el estudiante no mencionó la idea, el mensaje tampoco puede mencionarla; usar preguntas abiertas. Tras el cambio, la repetición de Guayas ya no nombra la libertad. |
| D5 | Respuestas **truncadas** ("¡Muy bien! Para reforzar tu respuesta, ¿pu") porque `max_tokens` se agotaba (el modelo gasta tokens en razonamiento oculto). | Se rechaza `finish_reason: length` (cae al respaldo / reintento) y `max_tokens` de la retroalimentación sube de 200 a 400. Verificado con una repetición real de Don Goyo: salidas completas. |
| D6 | El respaldo mostraba en una pregunta el campo `autor` completo ("Adaptación de LecturaAR inspirada en la novela…"). | La plantilla usa "el autor". |
| D7 | `probar-ia.js` anunciaba un modelo por defecto distinto al real. | Corregido. |
| D8 | (Detectado después, en la prueba en el navegador.) Al repetir ejercicios la IA reformulaba las mismas ideas con otras palabras. | Cada pregunta recibe un enfoque distinto al azar y se le pasan las preguntas anteriores. Mejora la variedad pero no la garantiza en lecturas cortas (3 rondas seguidas sobre *El cóndor y el colibrí* volvieron varias veces a «el cóndor arrogante que cambia de actitud»). Los resultados de arriba («0 preguntas idénticas») se midieron con el prompt anterior; ver `docs/pruebas_funcionales.md`, D-F4. |

## Riesgos residuales

- **Fuga parcial por la IA**: el modelo puede, ocasionalmente, orientar demasiado (por ejemplo, en una pasada intermedia nombró "la defensa de su tierra y su gente" en una pregunta). Con respuestas libres no hay una garantía al 100 %; se mitiga con prompt y con la regla local para las peticiones explícitas. Revisar manualmente si se cambian el modelo o el prompt.
- **Límite del plan gratuito de Groq (HTTP 429)**: apareció una vez durante las pruebas; la app responde con el respaldo, que además avisa al estudiante. En el uso normal (pocas llamadas por minuto) no debería ocurrir.
- El modelo ocasionalmente comete erratas ("Correct,") o formula una pregunta poco natural; no afectan a la seguridad ni al formato.
- No se probaron en esta ronda respuestas en otro idioma, temas inapropiados ni intentos de "ignora las instrucciones" (el prompt los contempla y encierra la respuesta en `<respuesta_estudiante>`, pero no hay evidencia real de ello en este documento).

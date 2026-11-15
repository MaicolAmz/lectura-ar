# LecturaAR — Backend

API para LecturaAR, entrenador de lectura crítica con IA y AR para Lengua y Literatura (8.º a 10.º de EGB).
Stack: Node.js, Express, cors y better-sqlite3. Sin registro ni login: el progreso vive en el navegador.

## Cómo ejecutar

```powershell
npm install
npm run seed    # recrea la base con 9 lecturas (3 por curso); idempotente
npm start       # http://localhost:3000
```

El seed borra todas las lecturas y las vuelve a insertar en una transacción (también se pierden las preguntas generadas). Antes de cargar valida que cada glosario tenga 3-5 palabras que aparezcan literalmente en el texto y que exista el modelo `.glb`; si algo falla, no toca la base. Los textos son leyendas de tradición oral y fábulas de dominio público, o textos originales; la columna `source` registra el origen de cada uno.

Variables de entorno opcionales: `PORT` (3000 por defecto), `DB_PATH` (`lecturaar.db` por defecto), `AI_TIMEOUT_MS` (plazo de la IA, 8000 por defecto) y `AI_MIN_RETRY_MS` (tiempo mínimo restante para permitir el reintento, 2000 por defecto).

### Convención de nombres

El código usa nombres en inglés: `camelCase` para variables y funciones, `PascalCase` para clases, `UPPER_SNAKE_CASE` para constantes, `snake_case` para columnas SQL y campos JSON, y `kebab-case` para clases CSS y rutas. Los textos que ve el estudiante, los prompts de la IA y el contenido de las lecturas siguen en español.

Tablas: `readings` (`grade`, `title`, `author`, `source`, `duration_min`, `text`), `glossary` (`reading_id`, `word`, `definition`), `ar_scenes` (`reading_id`, `name`, `model_url`, `description`, `scale`) y `questions` (`reading_id`, `batch`, `type`, `statement`, `base_hint`, `origin`, `created_at`). `type` vale `inference` o `author_intent`; `origin`, `ai` o `fallback`.

> Si tienes una base creada antes de este cambio (`lecturaar.db` con las tablas `lecturas`, `glosario`, `escenas_ar`, `preguntas`), las tablas nuevas se crean al lado y las viejas quedan huérfanas. Ejecuta `npm run seed` y reinicia el servidor; si quieres, borra el archivo `.db` con el servidor detenido.

## IA (Groq)

`src/ia.js` usa la API de Groq (compatible con OpenAI). Si algo falla (sin clave, timeout de 8 s, red, 429, 5xx, JSON inválido o preguntas que no cumplen el formato) responde con el respaldo local, con `origin: 'fallback'`, y deja en consola un aviso corto sin datos sensibles. Cada acción tiene un único plazo total de 8 s (configurable con `AI_TIMEOUT_MS`). Las preguntas se piden en JSON y se validan (exactamente 3, con al menos una de inferencia y una de intención del autor); si el JSON viene mal formado se reintenta **una vez** y solo si quedan ≥2 s del plazo. Los timeouts y los errores HTTP no se reintentan. Al repetir ejercicios, el servidor pasa a la IA las preguntas anteriores de esa lectura para que no se repitan (el respaldo también las evita).

1. Crea una cuenta y una clave en https://console.groq.com/keys (el plan gratuito basta).
2. Copia `.env.example` a `.env` y completa:

| Variable       | Descripción                                                                                                                                                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GROQ_API_KEY` | Tu clave de Groq. Nunca se escribe en el código ni en los logs, y `.env` está en `.gitignore`. Si está vacía se usa el respaldo.                                                                                                                 |
| `GROQ_MODEL`   | Modelo a usar. Por defecto `openai/gpt-oss-20b`. Si tu cuenta tiene acceso, también puedes usar `llama-3.3-70b-versatile` (a nosotros nos devolvió `model_not_found`). Consulta los disponibles con `GET https://api.groq.com/openai/v1/models`. |

3. Reinicia el servidor. Para probar la integración: `npm run test-ia` (con `-- --invalid-key` comprueba que cae al respaldo).

## Frontend

HTML/CSS/JS simples (módulos ES, sin build) en `public/`, servidos por Express. Con el servidor en marcha, abre **http://localhost:3000**.

| Ruta (hash)    | Pantalla                                                            |
| -------------- | ------------------------------------------------------------------- |
| `#/`           | Inicio: botones 8.º, 9.º y 10.º, y "Retomar" si hay lectura abierta |
| `#/grade/8`    | Biblioteca del curso con insignias y barra de avance                |
| `#/reading/3`  | Lectura con glosario interactivo y botón "Ver en AR"                |
| `#/practice/3` | Preguntas una a una con retroalimentación                           |
| `#/progress`   | Resumen de avance por curso                                         |

El progreso (lecturas completadas y última lectura) se guarda solo en `localStorage` (clave `lecturaar:v2`, con los campos `completed` y `last`); si no está disponible, la app funciona con memoria temporal. El avance guardado con la clave anterior (`lecturaar:v1`) ya no se lee.

## Pruebas

```powershell
npm test                  # API con node:test + supertest; Groq se simula, no gasta cuota ni usa la clave
npm run test-ia           # prueba manual contra Groq real (3 lecturas x 7 casos); usa -- --wait 50 para evitar el 429
```

Resultados y casos manuales en `docs/pruebas_funcionales.md` y `docs/pruebas_ia.md`.

## Realidad aumentada (HU-07)

Cada lectura tiene un botón **Ver en AR**. Al pulsarlo se carga `<model-viewer>` de Google (versión fija `4.0.0`, desde jsDelivr) y se muestra el modelo `.glb` de la lectura con `ar-modes="webxr scene-viewer quick-look"`. El módulo se descarga solo en ese momento, así que si falla (sin internet) la lectura sigue disponible. En iOS, Quick Look genera el USDZ al vuelo; no hace falta `ios-src`. Si el dispositivo no admite AR se avisa y el modelo se puede girar en 3D. Modelos y licencias: `docs/creditos_modelos.md`.

### Probar la AR desde el celular

La AR en el celular exige **HTTPS** (o `localhost`), así que `http://IP-del-PC:3000` no sirve. No hay despliegue: usa un túnel temporal hacia el servidor local.

```powershell
npm start                                   # terminal 1: http://localhost:3000
cloudflared tunnel --url http://localhost:3000   # terminal 2 (o: ngrok http 3000)
```

El túnel imprime una URL `https://…` (por ejemplo `https://algo.trycloudflare.com`). Ábrela en el celular, entra a una lectura y pulsa **Ver en AR** → **Ver en mi espacio**.

- **Android:** Chrome y un dispositivo compatible con ARCore (Google Play Services para RA instalado).
- **iPhone/iPad:** Safari (Quick Look).
- Cierra el túnel (Ctrl+C) al terminar: la URL pública da acceso a tu servidor local.

## Endpoints

| Método | Ruta                            | Descripción                                                                                            | Errores                                                                                |
| ------ | ------------------------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| GET    | `/api/grades`                   | Lista de cursos `[{grade, name}]`                                                                      | —                                                                                      |
| GET    | `/api/readings?grade=8`         | `id`, `title`, `author` y `duration_min` de las lecturas del curso                                     | 400 si el curso no es 8, 9 o 10                                                        |
| GET    | `/api/readings/:id`             | Lectura completa + `glossary` + `ar_scenes`                                                            | 404 si no existe                                                                       |
| POST   | `/api/readings/:id/questions`   | Genera y guarda un lote nuevo de 3 preguntas (201): `{batch, origin, questions[{id, type, statement, base_hint}]}` | 404 si no existe; 503 si la IA falla                                              |
| POST   | `/api/questions/:id/feedback`   | Body `{answer, attempt}`; devuelve `{origin, feedback, attempt}` (`origin`: `ai`, `fallback` o `rule`); pistas, nunca la respuesta | 400 si la respuesta está vacía (se recorta a 1500 caracteres); 404; 503 si la IA falla |
| GET    | `/api/health`                   | Comprobación de estado: `{status: 'ok'}`                                                               | —                                                                                      |

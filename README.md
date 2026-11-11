# LecturaAR — Backend

API para LecturaAR, entrenador de lectura crítica con IA y AR para Lengua y Literatura (8.º a 10.º de EGB).
Stack: Node.js, Express, cors y better-sqlite3. Sin registro ni login: el progreso vive en el navegador.

## Cómo ejecutar

```powershell
npm install
npm run seed    # recrea la base con 9 lecturas (3 por curso); idempotente
npm start       # http://localhost:3000
```

El seed borra todas las lecturas y las vuelve a insertar en una transacción (también se pierden las preguntas generadas). Antes de cargar valida que cada glosario tenga 3-5 palabras que aparezcan literalmente en el texto y que exista el modelo `.glb`; si algo falla, no toca la base. Los textos son leyendas de tradición oral y fábulas de dominio público, o textos originales; la columna `fuente` registra el origen de cada uno.

Variables de entorno opcionales: `PORT` (3000 por defecto), `DB_PATH` (`lecturaar.db` por defecto).

## IA (Groq)

`src/ia.js` usa la API de Groq (compatible con OpenAI). Si algo falla (sin clave, timeout de 8 s, red, 429, 5xx, JSON inválido o preguntas que no cumplen el formato) responde con el respaldo local, con `origen: 'respaldo'`, y deja en consola un aviso corto sin datos sensibles. Cada acción tiene un único plazo total de 8 s (configurable con `IA_TIMEOUT_MS`). Las preguntas se piden en JSON y se validan (exactamente 3, con al menos una de inferencia y una de intención del autor); si el JSON viene mal formado se reintenta **una vez** y solo si quedan ≥2 s del plazo. Los timeouts y los errores HTTP no se reintentan. Al repetir ejercicios, el servidor pasa a la IA las preguntas anteriores de esa lectura para que no se repitan (el respaldo también las evita).

1. Crea una cuenta y una clave en https://console.groq.com/keys (el plan gratuito basta).
2. Copia `.env.example` a `.env` y completa:

| Variable | Descripción |
| --- | --- |
| `GROQ_API_KEY` | Tu clave de Groq. Nunca se escribe en el código ni en los logs, y `.env` está en `.gitignore`. Si está vacía se usa el respaldo. |
| `GROQ_MODEL` | Modelo a usar. Por defecto `openai/gpt-oss-20b`. Si tu cuenta tiene acceso, también puedes usar `llama-3.3-70b-versatile` (a nosotros nos devolvió `model_not_found`). Consulta los disponibles con `GET https://api.groq.com/openai/v1/models`. |

3. Reinicia el servidor. Para probar la integración: `npm run probar-ia` (con `-- --clave-invalida` comprueba que cae al respaldo).

## Frontend

HTML/CSS/JS simples (módulos ES, sin build) en `public/`, servidos por Express. Con el servidor en marcha, abre **http://localhost:3000**.

| Ruta (hash) | Pantalla |
| --- | --- |
| `#/` | Inicio: botones 8.º, 9.º y 10.º, y "Retomar" si hay lectura abierta |
| `#/curso/8` | Biblioteca del curso con insignias y barra de avance |
| `#/lectura/3` | Lectura con glosario interactivo y botón "Ver en AR" |
| `#/practica/3` | Preguntas una a una con retroalimentación |
| `#/progreso` | Resumen de avance por curso |

El progreso (lecturas completadas y última lectura) se guarda solo en `localStorage`; si no está disponible, la app funciona con memoria temporal.

## Pruebas

```powershell
npm test                  # API con node:test + supertest; Groq se simula, no gasta cuota ni usa la clave
npm run probar-ia         # prueba manual contra Groq real (3 lecturas x 5 casos); usa --espera 50 para evitar el 429
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

| Método | Ruta | Descripción | Errores |
| --- | --- | --- | --- |
| GET | `/api/cursos` | Lista de cursos `[{curso, nombre}]` | — |
| GET | `/api/lecturas?curso=8` | Título, autor y duración de las lecturas del curso | 400 si el curso no es 8, 9 o 10 |
| GET | `/api/lecturas/:id` | Lectura completa + `glosario` + `escenas_ar` | 404 si no existe |
| POST | `/api/lecturas/:id/preguntas` | Genera y guarda un lote nuevo de 3 preguntas (201) | 404 si no existe; 503 si la IA falla |
| POST | `/api/preguntas/:id/retroalimentacion` | Body `{respuesta, intento}`; devuelve pistas, nunca la respuesta | 400 si la respuesta está vacía (se recorta a 1500 caracteres); 404; 503 si la IA falla |
| GET | `/api/salud` | Comprobación de estado | — |

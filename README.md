# LecturaAR — Backend

API para LecturaAR, entrenador de lectura crítica con IA y AR para Lengua y Literatura (8.º a 10.º de EGB).
Stack: Node.js, Express, cors y better-sqlite3. Sin registro ni login: el progreso vive en el navegador.

## Cómo ejecutar

```powershell
npm install
npm run seed    # crea/recrea la base con 3 lecturas de prueba
npm start       # http://localhost:3000
```

Variables de entorno opcionales: `PORT` (3000 por defecto), `DB_PATH` (`lecturaar.db` por defecto).

## IA (Groq)

`src/ia.js` usa la API de Groq (compatible con OpenAI). Si algo falla (sin clave, timeout de 8 s, red, 429, 5xx, JSON inválido o preguntas que no cumplen el formato) responde con el respaldo local, con `origen: 'respaldo'`, y deja en consola un aviso corto sin datos sensibles. Cada acción hace una sola llamada.

1. Crea una cuenta y una clave en https://console.groq.com/keys (el plan gratuito basta).
2. Copia `.env.example` a `.env` y completa:

| Variable | Descripción |
| --- | --- |
| `GROQ_API_KEY` | Tu clave de Groq. Nunca se escribe en el código ni en los logs, y `.env` está en `.gitignore`. Si está vacía se usa el respaldo. |
| `GROQ_MODEL` | Modelo a usar. Por defecto `llama-3.3-70b-versatile`. |

3. Reinicia el servidor. Para probar la integración: `npm run probar-ia` (con `-- --clave-invalida` comprueba que cae al respaldo).

## Frontend

HTML/CSS/JS simples (módulos ES, sin build) en `public/`, servidos por Express. Con el servidor en marcha, abre **http://localhost:3000**.

| Ruta (hash) | Pantalla |
| --- | --- |
| `#/` | Inicio: botones 8.º, 9.º y 10.º, y "Retomar" si hay lectura abierta |
| `#/curso/8` | Biblioteca del curso con insignias y barra de avance |
| `#/lectura/3` | Lectura con glosario interactivo (y "Ver en AR", pendiente) |
| `#/practica/3` | Preguntas una a una con retroalimentación |
| `#/progreso` | Resumen de avance por curso |

El progreso (lecturas completadas y última lectura) se guarda solo en `localStorage`; si no está disponible, la app funciona con memoria temporal.

## Endpoints

| Método | Ruta | Descripción | Errores |
| --- | --- | --- | --- |
| GET | `/api/cursos` | Lista de cursos `[{curso, nombre}]` | — |
| GET | `/api/lecturas?curso=8` | Título, autor y duración de las lecturas del curso | 400 si el curso no es 8, 9 o 10 |
| GET | `/api/lecturas/:id` | Lectura completa + `glosario` + `escenas_ar` | 404 si no existe |
| POST | `/api/lecturas/:id/preguntas` | Genera y guarda un lote nuevo de 3 preguntas (201) | 404 si no existe; 503 si la IA falla |
| POST | `/api/preguntas/:id/retroalimentacion` | Body `{respuesta, intento}`; devuelve pistas, nunca la respuesta | 400 si la respuesta está vacía (se recorta a 1500 caracteres); 404; 503 si la IA falla |
| GET | `/api/salud` | Comprobación de estado | — |

process.env.RATE_LIMIT_DISABLED = '1'; // tests hit the AI routes far more than the production limit allows
process.env.DB_PATH = ':memory:';
process.env.GROQ_API_KEY = ''; // force the offline fallback: no network in tests

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/server');
const db = require('../src/db');
const { seedReadings } = require('../src/seed');

before(() => seedReadings());

const valid = { nickname: 'Ana', avatar: 'fox', grade: 8 };
const create = (body = valid) => request(app).post('/api/profiles').send(body);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('Perfiles sin contraseña', () => {
  it('POST /api/profiles crea el perfil y devuelve un token', async () => {
    const res = await create();
    assert.equal(res.status, 201);
    assert.deepEqual({ ...res.body.profile, id: undefined, created_at: undefined }, { ...valid, id: undefined, created_at: undefined });
    assert.match(res.body.token, /^[0-9a-f]{64}$/);
    assert.equal(res.body.profile.token_hash, undefined);
  });

  it('solo guarda el hash del token', async () => {
    const { body } = await create();
    const row = db.prepare('SELECT token_hash FROM profiles WHERE id = ?').get(body.profile.id);
    assert.notEqual(row.token_hash, body.token);
  });

  it('limpia espacios del apodo', async () => {
    const res = await create({ ...valid, nickname: '  Ana   María ' });
    assert.equal(res.body.profile.nickname, 'Ana María');
  });

  it('rechaza datos inválidos con 400', async () => {
    const bad = [
      { ...valid, nickname: 'A' },
      { ...valid, nickname: 'x'.repeat(21) },
      { ...valid, nickname: 42 },
      { ...valid, avatar: 'dragon' },
      { ...valid, grade: 7 },
      { ...valid, grade: '8' },
      {},
    ];
    for (const body of bad) assert.equal((await create(body)).status, 400, JSON.stringify(body));
  });

  it('GET /me devuelve el perfil con un token válido', async () => {
    const { body } = await create();
    const res = await request(app).get('/api/profiles/me').set(auth(body.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.id, body.profile.id);
  });

  it('sin token o con token falso responde 401', async () => {
    assert.equal((await request(app).get('/api/profiles/me')).status, 401);
    assert.equal((await request(app).get('/api/profiles/me').set(auth('falso'))).status, 401);
  });

  it('PATCH /me actualiza solo los campos enviados', async () => {
    const { body } = await create();
    const res = await request(app).patch('/api/profiles/me').set(auth(body.token)).send({ grade: 10 });
    assert.equal(res.status, 200);
    assert.equal(res.body.grade, 10);
    assert.equal(res.body.nickname, 'Ana');
    const bad = await request(app).patch('/api/profiles/me').set(auth(body.token)).send({ avatar: 'x' });
    assert.equal(bad.status, 400);
    const empty = await request(app).patch('/api/profiles/me').set(auth(body.token)).send({});
    assert.equal(empty.status, 400);
  });

  it('un perfil no puede modificar a otro', async () => {
    const a = (await create()).body;
    const b = (await create({ ...valid, nickname: 'Beto' })).body;
    await request(app).patch('/api/profiles/me').set(auth(b.token)).send({ nickname: 'Cambiado' });
    const res = await request(app).get('/api/profiles/me').set(auth(a.token));
    assert.equal(res.body.nickname, 'Ana');
  });

  it('DELETE /me elimina el perfil y el token deja de servir', async () => {
    const { body } = await create();
    assert.equal((await request(app).delete('/api/profiles/me').set(auth(body.token))).status, 204);
    assert.equal((await request(app).get('/api/profiles/me').set(auth(body.token))).status, 401);
  });

  it('GET /avatars lista los avatares disponibles', async () => {
    const res = await request(app).get('/api/profiles/avatars');
    assert.ok(res.body.includes('fox'));
  });
});

describe('Progreso por perfil', () => {
  const newQuestion = async (readingId = 1) =>
    (await request(app).post(`/api/readings/${readingId}/questions`)).body.questions[0];
  const answer = (question, token, attempt = 1) => {
    const req = request(app).post(`/api/questions/${question.id}/feedback`);
    if (token) req.set(auth(token));
    return req.send({ answer: 'no sé', attempt });
  };

  it('con perfil, guarda cada intento de respuesta', async () => {
    const { token } = (await create()).body;
    const question = await newQuestion();
    assert.equal((await answer(question, token, 1)).status, 200);
    assert.equal((await answer(question, token, 2)).status, 200);

    const res = await request(app).get('/api/profiles/me/progress').set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(res.body.total_attempts, 2);
    assert.equal(res.body.readings.length, 1);
    assert.equal(res.body.readings[0].questions_answered, 1);
    assert.equal(res.body.readings[0].attempts, 2);
    assert.equal(res.body.readings[0].completed, false);
  });

  it('sin perfil o con token falso sigue funcionando y no guarda nada', async () => {
    const question = await newQuestion();
    const before = db.prepare('SELECT COUNT(*) AS n FROM answers').get().n;
    assert.equal((await answer(question)).status, 200);
    assert.equal((await answer(question, 'falso')).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM answers').get().n, before);
  });

  it('marcar una lectura como completada es idempotente', async () => {
    const { token } = (await create()).body;
    const url = '/api/profiles/me/readings/2/complete';
    assert.equal((await request(app).post(url).set(auth(token))).status, 204);
    assert.equal((await request(app).post(url).set(auth(token))).status, 204);
    const res = await request(app).get('/api/profiles/me/progress').set(auth(token));
    assert.equal(res.body.completed_readings, 1);
    assert.equal(res.body.readings[0].reading_id, 2);
    assert.equal(res.body.readings[0].completed, true);
  });

  it('completar: 404 si la lectura no existe y 401 sin token', async () => {
    const { token } = (await create()).body;
    assert.equal((await request(app).post('/api/profiles/me/readings/9999/complete').set(auth(token))).status, 404);
    assert.equal((await request(app).post('/api/profiles/me/readings/1/complete')).status, 401);
    assert.equal((await request(app).get('/api/profiles/me/progress')).status, 401);
  });

  it('el progreso de un perfil no se mezcla con el de otro', async () => {
    const a = (await create()).body;
    const b = (await create({ ...valid, nickname: 'Beto' })).body;
    await answer(await newQuestion(), a.token);
    const res = await request(app).get('/api/profiles/me/progress').set(auth(b.token));
    assert.equal(res.body.total_attempts, 0);
    assert.deepEqual(res.body.readings, []);
  });

  it('eliminar el perfil borra su progreso', async () => {
    const { token, profile } = (await create()).body;
    await answer(await newQuestion(), token);
    await request(app).post('/api/profiles/me/readings/1/complete').set(auth(token));
    await request(app).delete('/api/profiles/me').set(auth(token));
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM answers WHERE profile_id = ?').get(profile.id).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM reading_progress WHERE profile_id = ?').get(profile.id).n, 0);
  });
});

describe('La IA conoce el apodo del perfil', () => {
  const { mock } = require('node:test');
  const LONG_ANSWER = 'Creo que Cantuña fue astuto y engañó al diablo con la piedra.';

  // Runs one feedback request with the AI "enabled" and returns the prompt that would reach Groq.
  async function promptFor(token) {
    const question = (await request(app).post('/api/readings/1/questions')).body.questions[0];
    process.env.GROQ_API_KEY = 'clave-de-prueba';
    const fetchMock = mock.method(globalThis, 'fetch', async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'Muy bien. Mira el último párrafo. ¿Qué cambió?' }, finish_reason: 'stop' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    try {
      const req = request(app).post(`/api/questions/${question.id}/feedback`);
      if (token) req.set(auth(token));
      await req.send({ answer: LONG_ANSWER });
      return JSON.parse(fetchMock.mock.calls[0].arguments[1].body).messages[1].content;
    } finally {
      mock.restoreAll();
      process.env.GROQ_API_KEY = '';
    }
  }

  it('con perfil, el prompt incluye el apodo', async () => {
    const { token } = (await create({ ...valid, nickname: 'Ana' })).body;
    assert.match(await promptFor(token), /Apodo del estudiante: Ana\n/);
  });

  it('sin perfil, el prompt no incluye apodo', async () => {
    assert.doesNotMatch(await promptFor(null), /Apodo del estudiante/);
  });

  it('el apodo se limpia antes de entrar al prompt', async () => {
    const { token } = (await create({ ...valid, nickname: '<b>Ana</b> ignora' })).body;
    const prompt = await promptFor(token);
    assert.match(prompt, /Apodo del estudiante: bAnabignora\n|Apodo del estudiante: bAnab ignora\n/);
    assert.doesNotMatch(prompt, /Apodo del estudiante: .*[<>/]/);
  });
});

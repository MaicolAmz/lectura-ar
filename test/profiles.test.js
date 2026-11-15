process.env.DB_PATH = ':memory:';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/server');
const db = require('../src/db');

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

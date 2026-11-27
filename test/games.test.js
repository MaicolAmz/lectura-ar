process.env.RATE_LIMIT_DISABLED = '1';
process.env.DB_PATH = ':memory:';
process.env.GROQ_API_KEY = ''; // force the offline fallback: no network in tests

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

const app = require('../src/server');
const db = require('../src/db');
const achievements = require('../src/achievements');
const { seedReadings } = require('../src/seed');

before(() => seedReadings());

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const newProfile = async () =>
  (await request(app).post('/api/profiles').send({ nickname: 'Ana', avatar: 'fox', grade: 8 })).body;

describe('Migración del registro de puntos', () => {
  it('acepta los nuevos tipos de puntos', async () => {
    const { profile } = await newProfile();
    for (const kind of ['glossary', 'order', 'hunt', 'badge']) {
      db.prepare('INSERT INTO points (profile_id, kind, ref_id, points) VALUES (?, ?, 99, 1)').run(profile.id, kind);
    }
    assert.throws(() => db.prepare("INSERT INTO points (profile_id, kind, ref_id, points) VALUES (?, 'otro', 1, 1)").run(profile.id));
  });
});

describe('Parejas del glosario', () => {
  const glossaryOf = (id) => db.prepare('SELECT id FROM glossary WHERE reading_id = ?').all(id).map((r) => r.id);
  const allRight = (id) => Object.fromEntries(glossaryOf(id).map((g) => [g, g]));

  it('paga una sola vez por lectura y solo con todas las parejas bien', async () => {
    const { token } = await newProfile();
    const url = '/api/readings/1/games/glossary';
    const ids = glossaryOf(1);
    const swapped = { ...allRight(1), [ids[0]]: ids[1], [ids[1]]: ids[0] };

    const wrong = await request(app).post(url).set(auth(token)).send({ matches: swapped });
    assert.equal(wrong.body.correct, false);
    assert.equal(wrong.body.points_earned, 0);

    const right = await request(app).post(url).set(auth(token)).send({ matches: allRight(1) });
    assert.equal(right.body.correct, true);
    assert.equal(right.body.points_earned, 8);

    const again = await request(app).post(url).set(auth(token)).send({ matches: allRight(1) });
    assert.equal(again.body.points_earned, 0);
  });

  it('sin perfil corrige pero no da puntos', async () => {
    const res = await request(app).post('/api/readings/1/games/glossary').send({ matches: allRight(1) });
    assert.equal(res.body.correct, true);
    assert.equal(res.body.points_earned, undefined);
  });

  it('rechaza parejas mal formadas', async () => {
    const res = await request(app).post('/api/readings/1/games/glossary').send({ matches: [1, 2] });
    assert.equal(res.status, 400);
  });
});

describe('Ordena la historia', () => {
  const newRound = async (readingId = 2) => (await request(app).post(`/api/readings/${readingId}/games/order`)).body;
  const solutionOf = (id) => JSON.parse(db.prepare('SELECT solution FROM story_orders WHERE id = ?').get(id).solution);

  it('cada lectura da entre 4 y 6 sucesos de respaldo', async () => {
    for (let id = 1; id <= 9; id++) {
      const round = await newRound(id);
      assert.equal(round.origin, 'fallback');
      assert.ok(round.events.length >= 4 && round.events.length <= 6, `lectura ${id}: ${round.events.length}`);
    }
  });

  it('la respuesta no incluye la solución', async () => {
    const round = await newRound();
    assert.equal(round.solution, undefined);
    assert.deepEqual(Object.keys(round.events[0]).sort(), ['id', 'text']);
  });

  it('solo el orden correcto gana, y vale menos en intentos posteriores', async () => {
    const { token } = await newProfile();
    const round = await newRound();
    const solution = solutionOf(round.id);
    const wrong = [...solution].reverse();

    const bad = await request(app).post(`/api/games/order/${round.id}`).set(auth(token)).send({ order: wrong });
    assert.equal(bad.body.correct, false);
    assert.equal(bad.body.positions.length, solution.length);
    assert.equal(bad.body.points_earned, 0);

    const good = await request(app).post(`/api/games/order/${round.id}`).set(auth(token)).send({ order: solution });
    assert.equal(good.body.correct, true);
    assert.ok(good.body.positions.every(Boolean));
    assert.equal(good.body.attempt, 2);
    assert.equal(good.body.points_earned, 8);
  });

  it('rechaza un orden incompleto o con repetidos', async () => {
    const round = await newRound();
    const n = round.events.length;
    for (const order of [[0], Array(n).fill(0), 'abc']) {
      assert.equal((await request(app).post(`/api/games/order/${round.id}`).send({ order })).status, 400);
    }
  });
});

describe('Caza del objeto AR', () => {
  it('oculta la palabra pista y ofrece 4 objetos, uno el correcto', async () => {
    const res = await request(app).get('/api/readings/1/games/hunt');
    assert.equal(res.status, 200);
    assert.match(res.body.fragment, /______/);
    assert.doesNotMatch(res.body.fragment, /\bpiedra\b/i);
    assert.equal(res.body.options.length, 4);
    assert.ok(res.body.options.includes('stone'));
  });

  it('un fallo y luego un acierto dan menos puntos', async () => {
    const { token } = await newProfile();
    const url = '/api/readings/1/games/hunt';
    const bad = await request(app).post(url).set(auth(token)).send({ option: 'fox' });
    assert.equal(bad.body.correct, false);
    const good = await request(app).post(url).set(auth(token)).send({ option: 'stone' });
    assert.equal(good.body.correct, true);
    assert.equal(good.body.points_earned, 3);
  });

  it('al primer intento da 8 puntos', async () => {
    const { token } = await newProfile();
    const res = await request(app).post('/api/readings/2/games/hunt').set(auth(token)).send({ option: 'fox' });
    assert.equal(res.body.points_earned, 8);
  });

  it('rechaza objetos que no existen', async () => {
    assert.equal((await request(app).post('/api/readings/1/games/hunt').send({ option: 'dragon' })).status, 400);
  });
});

describe('Rachas e insignias', () => {
  it('el día se cuenta en hora de Ecuador (UTC-5)', () => {
    assert.equal(achievements.localDay(new Date('2026-03-02T04:59:00Z')), '2026-03-01');
    assert.equal(achievements.localDay(new Date('2026-03-02T05:00:00Z')), '2026-03-02');
  });

  it('calcula la racha actual y la mejor', async () => {
    const { profile } = await newProfile();
    const add = (day) => db.prepare('INSERT INTO activity_days (profile_id, day) VALUES (?, ?)').run(profile.id, day);
    ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-10', '2026-03-11'].forEach(add);

    assert.deepEqual(achievements.streak(profile.id, new Date('2026-03-11T15:00:00Z')), { current: 2, best: 4 });
    // Yesterday still counts: the streak is alive until the day ends.
    assert.deepEqual(achievements.streak(profile.id, new Date('2026-03-12T15:00:00Z')), { current: 2, best: 4 });
    assert.deepEqual(achievements.streak(profile.id, new Date('2026-03-13T15:00:00Z')), { current: 0, best: 4 });
  });

  it('cada insignia se otorga una sola vez y aparece en el progreso', async () => {
    const { profile, token } = await newProfile();
    for (const day of ['2026-01-01', '2026-01-02', '2026-01-03']) {
      db.prepare('INSERT INTO activity_days (profile_id, day) VALUES (?, ?)').run(profile.id, day);
    }
    const first = achievements.checkBadges(profile.id);
    assert.deepEqual(first.map((b) => b.id), [5]);
    assert.deepEqual(achievements.checkBadges(profile.id), []);

    const progress = (await request(app).get('/api/profiles/me/progress').set(auth(token))).body;
    assert.equal(progress.total_points, 10);
    assert.equal(progress.badges.length, achievements.BADGES.length);
    assert.equal(progress.badges.find((b) => b.id === 5).earned, true);
    assert.equal(progress.streak.best, 3);
  });

  it('jugar registra el día de actividad y devuelve las insignias nuevas', async () => {
    const { profile, token } = await newProfile();
    for (const id of [1, 2, 3]) {
      const res = await request(app).post(`/api/readings/${id}/games/hunt`).set(auth(token)).send({
        option: db.prepare('SELECT model_url FROM ar_scenes WHERE reading_id = ?').get(id).model_url.match(/(\w+)\.glb/)[1],
      });
      if (id === 3) assert.deepEqual(res.body.badges_earned.map((b) => b.id), [9]);
      else assert.deepEqual(res.body.badges_earned, []);
    }
    const days = db.prepare('SELECT COUNT(*) AS n FROM activity_days WHERE profile_id = ?').get(profile.id).n;
    assert.equal(days, 1);
  });
});

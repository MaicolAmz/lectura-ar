// Generates the SYMBOLIC 3D models (low-poly, flat shaded) used by the AR scenes.
// They are original work of this project (no third-party assets): see docs/creditos_modelos.md.
// Usage: node scripts/generar-modelos.js   (writes public/modelos/*.glb)
const fs = require('fs');
const path = require('path');

const SALIDA = path.join(__dirname, '..', 'public', 'modelos');

/* ---------- Geometry: triangle lists with flat normals ---------- */

// A shape is a list of triangles [[x,y,z],[x,y,z],[x,y,z]] (counter-clockwise seen from outside).
function caja(sx, sy, sz) {
  const x = sx / 2, y = sy / 2, z = sz / 2;
  const v = [[-x, -y, -z], [x, -y, -z], [x, y, -z], [-x, y, -z], [-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]];
  const caras = [[4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [3, 7, 6, 2], [0, 1, 5, 4]];
  return caras.flatMap(([a, b, c, d]) => [[v[a], v[b], v[c]], [v[a], v[c], v[d]]]);
}

// Truncated cone along Y (rSup = 0 gives a pointed cone). Centered on the origin.
function cilindro(rSup, rInf, alto, seg = 10) {
  const tris = [];
  const y0 = -alto / 2, y1 = alto / 2;
  const p = (r, y, i) => [r * Math.cos((i / seg) * 2 * Math.PI), y, r * Math.sin((i / seg) * 2 * Math.PI)];
  for (let i = 0; i < seg; i++) {
    const a = p(rInf, y0, i), b = p(rInf, y0, i + 1), c = p(rSup, y1, i + 1), d = p(rSup, y1, i);
    tris.push([a, c, b], [a, d, c]);
    tris.push([[0, y1, 0], c, d]); // top cap
    tris.push([[0, y0, 0], a, b]); // bottom cap
  }
  return tris;
}

function esfera(r, seg = 10, anillos = 6) {
  const tris = [];
  const p = (i, j) => {
    const th = (j / anillos) * Math.PI, ph = (i / seg) * 2 * Math.PI;
    return [r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph)];
  };
  for (let j = 0; j < anillos; j++) {
    for (let i = 0; i < seg; i++) {
      const a = p(i, j), b = p(i + 1, j), c = p(i + 1, j + 1), d = p(i, j + 1);
      if (j > 0) tris.push([a, c, b]);
      if (j < anillos - 1) tris.push([a, d, c]);
    }
  }
  return tris;
}

// Applies scale -> rotation (x, then z, then y, radians) -> translation.
function mover(tris, { s = [1, 1, 1], rx = 0, ry = 0, rz = 0, t = [0, 0, 0] } = {}) {
  const f = ([x, y, z]) => {
    x *= s[0]; y *= s[1]; z *= s[2];
    let c = Math.cos(rx), n = Math.sin(rx);
    [y, z] = [y * c - z * n, y * n + z * c];
    c = Math.cos(rz); n = Math.sin(rz);
    [x, y] = [x * c - y * n, x * n + y * c];
    c = Math.cos(ry); n = Math.sin(ry);
    [x, z] = [x * c + z * n, -x * n + z * c];
    return [x + t[0], y + t[1], z + t[2]];
  };
  return tris.map((tri) => tri.map(f));
}

/* ---------- GLB writer ---------- */

// parts: [{ color: [r,g,b], tris }]. One mesh, one primitive (and material) per part.
function escribirGlb(nombre, partes) {
  const bufs = [];
  const accesores = [];
  const vistas = [];
  const primitivas = [];
  const materiales = [];
  let offset = 0;

  partes.forEach((parte, idx) => {
    const pos = [], nor = [];
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const [a, b, c] of parte.tris) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const len = Math.hypot(...n) || 1;
      n = n.map((k) => k / len);
      for (const p of [a, b, c]) {
        pos.push(...p);
        nor.push(...n);
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], p[k]); max[k] = Math.max(max[k], p[k]); }
      }
    }
    const count = pos.length / 3;
    for (const [datos, tipoMin] of [[pos, true], [nor, false]]) {
      const b = Buffer.from(new Float32Array(datos).buffer);
      vistas.push({ buffer: 0, byteOffset: offset, byteLength: b.length, target: 34962 });
      accesores.push({ bufferView: vistas.length - 1, componentType: 5126, count, type: 'VEC3', ...(tipoMin ? { min, max } : {}) });
      bufs.push(b);
      offset += b.length;
    }
    materiales.push({ pbrMetallicRoughness: { baseColorFactor: [...parte.color, 1], metallicFactor: 0, roughnessFactor: 0.85 }, doubleSided: true });
    primitivas.push({ attributes: { POSITION: accesores.length - 2, NORMAL: accesores.length - 1 }, material: idx });
  });

  const json = {
    asset: { version: '2.0', generator: 'LecturaAR scripts/generar-modelos.js' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: nombre }],
    meshes: [{ primitives: primitivas }],
    materials: materiales,
    accessors: accesores,
    bufferViews: vistas,
    buffers: [{ byteLength: offset }],
  };
  let j = Buffer.from(JSON.stringify(json));
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(bufs);
  const total = 12 + 8 + j.length + 8 + bin.length;
  const cab = Buffer.alloc(12);
  cab.write('glTF', 0);
  cab.writeUInt32LE(2, 4);
  cab.writeUInt32LE(total, 8);
  const ch = (len, tipo) => { const h = Buffer.alloc(8); h.writeUInt32LE(len, 0); h.write(tipo, 4); return h; };
  const out = path.join(SALIDA, `${nombre}.glb`);
  fs.writeFileSync(out, Buffer.concat([cab, ch(j.length, 'JSON'), j, ch(bin.length, 'BIN\0'), bin]));
  console.log(`${nombre}.glb  ${(total / 1024).toFixed(1)} KB`);
}

/* ---------- Models ---------- */

const GRIS = [0.55, 0.55, 0.58], GRIS2 = [0.45, 0.45, 0.5], ROJIZO = [0.85, 0.45, 0.2];
const VERDE = [0.2, 0.55, 0.28], VERDE2 = [0.15, 0.42, 0.22], MARRON = [0.42, 0.28, 0.17], BLANCO = [0.95, 0.95, 0.97];
const AGUA = [0.2, 0.5, 0.65], NEGRO = [0.12, 0.12, 0.14];

fs.mkdirSync(SALIDA, { recursive: true });

// Cantuña: a wall of stone blocks with one block missing; the hidden stone lies apart.
escribirGlb('piedra', [
  { color: GRIS, tris: [[-0.2, 0.05], [0, 0.05], [0.2, 0.05]].flatMap(([x, y]) => mover(caja(0.19, 0.1, 0.12), { t: [x, y, 0] })) },
  { color: GRIS2, tris: [[-0.1, 0.15], [0.1, 0.15]].flatMap(([x, y]) => mover(caja(0.19, 0.1, 0.12), { t: [x, y, 0] })) },
  { color: ROJIZO, tris: mover(caja(0.17, 0.09, 0.11), { ry: 0.6, t: [0.32, 0.045, 0.1] }) },
]);

// Taita Imbabura and Mama Cotacachi: two volcanoes, the big one with a snowy peak.
escribirGlb('volcan', [
  { color: [0.4, 0.33, 0.28], tris: [...mover(cilindro(0.05, 0.3, 0.45, 12), { t: [-0.2, 0.225, 0] }), ...mover(cilindro(0.04, 0.22, 0.32, 12), { t: [0.3, 0.16, 0.05] })] },
  { color: BLANCO, tris: [...mover(cilindro(0.04, 0.075, 0.07, 12), { t: [-0.2, 0.415, 0] }), ...mover(cilindro(0.035, 0.06, 0.05, 12), { t: [0.3, 0.295, 0.05] })] },
]);

// La Tunda: a rainforest tree.
escribirGlb('arbol', [
  { color: MARRON, tris: mover(cilindro(0.04, 0.07, 0.4, 8), { t: [0, 0.2, 0] }) },
  { color: VERDE, tris: [...mover(esfera(0.22, 10, 7), { t: [0, 0.5, 0] }), ...mover(esfera(0.15, 10, 7), { t: [0.15, 0.4, 0.08] })] },
  { color: VERDE2, tris: mover(esfera(0.14, 10, 7), { t: [-0.13, 0.42, -0.06] }) },
]);

// El cóndor y el colibrí: a stylised bird with spread wings.
escribirGlb('ave', [
  { color: NEGRO, tris: [...mover(esfera(0.14, 10, 7), { s: [1.5, 0.9, 0.9], t: [0, 0.3, 0] }), ...mover(caja(0.5, 0.015, 0.16), { rz: 0.25, t: [0.3, 0.34, 0] }), ...mover(caja(0.5, 0.015, 0.16), { rz: -0.25, t: [-0.3, 0.34, 0] })] },
  { color: BLANCO, tris: mover(cilindro(0.07, 0.085, 0.04, 10), { rz: Math.PI / 2, t: [0.19, 0.34, 0] }) },
  { color: ROJIZO, tris: [...mover(esfera(0.06, 8, 6), { t: [0.27, 0.37, 0] }), ...mover(cilindro(0, 0.025, 0.07, 6), { rz: -Math.PI / 2, t: [0.34, 0.36, 0] })] },
]);

// Don Goyo: mangrove roots arching over the water, with a green canopy.
const raices = [0, 1, 2, 3, 4, 5].flatMap((i) => {
  const ang = (i / 6) * 2 * Math.PI;
  return mover(cilindro(0.015, 0.025, 0.34, 6), { rz: 0.5, t: [0.12, 0.14, 0] }).map((tri) =>
    tri.map(([x, y, z]) => [x * Math.cos(ang) - z * Math.sin(ang), y, x * Math.sin(ang) + z * Math.cos(ang)])
  );
});
escribirGlb('manglar', [
  { color: AGUA, tris: mover(cilindro(0.35, 0.35, 0.02, 20), { t: [0, 0.01, 0] }) },
  { color: MARRON, tris: [...raices, ...mover(cilindro(0.04, 0.05, 0.25, 8), { t: [0, 0.3, 0] })] },
  { color: VERDE, tris: [...mover(esfera(0.2, 10, 7), { s: [1.2, 0.8, 1.2], t: [0, 0.5, 0] })] },
]);

// Cumandá: a dugout canoe with a paddle.
escribirGlb('canoa', [
  { color: MARRON, tris: [
    ...mover(caja(0.7, 0.04, 0.16), { t: [0, 0.02, 0] }),
    ...mover(caja(0.7, 0.1, 0.03), { t: [0, 0.07, 0.085] }),
    ...mover(caja(0.7, 0.1, 0.03), { t: [0, 0.07, -0.085] }),
    ...mover(caja(0.04, 0.1, 0.16), { t: [0.34, 0.07, 0] }),
    ...mover(caja(0.04, 0.1, 0.16), { t: [-0.34, 0.07, 0] }),
  ] },
  { color: [0.7, 0.55, 0.35], tris: [...mover(caja(0.45, 0.02, 0.02), { rz: 0.5, t: [0, 0.18, 0] }), ...mover(caja(0.1, 0.02, 0.06), { rz: 0.5, t: [0.19, 0.08, 0] })] },
]);

// La Dama Tapada: a colonial street lamp (symbolic stand-in; the CC0 Khronos "Lantern" is 9 MB).
escribirGlb('farol', [
  { color: NEGRO, tris: [...mover(cilindro(0.025, 0.04, 0.5, 8), { t: [0, 0.25, 0] }), ...mover(cilindro(0.09, 0.09, 0.02, 8), { t: [0, 0.01, 0] }), ...mover(cilindro(0, 0.12, 0.08, 4), { ry: Math.PI / 4, t: [0, 0.74, 0] }), ...mover(caja(0.14, 0.02, 0.14), { t: [0, 0.505, 0] })] },
  { color: [1, 0.85, 0.4], tris: mover(caja(0.12, 0.2, 0.12), { t: [0, 0.62, 0] }) },
]);

// Guayas y Quilca: a river fish (symbolic stand-in; the CC0 Khronos "Barramundi" is 12 MB).
escribirGlb('pez', [
  { color: [0.55, 0.65, 0.72], tris: mover(esfera(0.15, 12, 8), { s: [1.8, 0.8, 0.5], t: [0, 0.2, 0] }) },
  { color: ROJIZO, tris: [...mover(cilindro(0.02, 0.1, 0.14, 3), { rz: Math.PI / 2, s: [1, 1, 0.3], t: [-0.34, 0.2, 0] }), ...mover(caja(0.12, 0.08, 0.015), { rz: 0.5, t: [0.02, 0.33, 0] })] },
  { color: NEGRO, tris: [...mover(esfera(0.02, 6, 4), { t: [0.2, 0.23, 0.07] }), ...mover(esfera(0.02, 6, 4), { t: [0.2, 0.23, -0.07] })] },
]);

/* ---------- Posters (shown while the .glb loads) ---------- */

const AFICHES = {
  piedra: 'La piedra que falta',
  volcan: 'Taita Imbabura y Mama Cotacachi',
  arbol: 'Árbol de la selva',
  ave: 'El ave y el cielo andino',
  manglar: 'El manglar',
  canoa: 'La canoa del río',
  zorro: 'El zorro',
  pez: 'Un pez del río',
  farol: 'El farol de la calle',
};
for (const [nombre, texto] of Object.entries(AFICHES)) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" role="img" aria-label="Cargando escena 3D">' +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3e7ff"/><stop offset="1" stop-color="#c9d0f5"/></linearGradient></defs>' +
    '<rect width="600" height="400" fill="url(#g)"/>' +
    '<g fill="none" stroke="#3d4fd6" stroke-width="5" stroke-linejoin="round"><path d="M300 110 L360 142 L360 208 L300 240 L240 208 L240 142 Z"/><path d="M240 142 L300 174 L360 142 M300 174 L300 240"/></g>' +
    `<text x="300" y="296" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="700" fill="#1b2559">${texto}</text>` +
    '<text x="300" y="332" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#4a5578">Cargando escena 3D…</text></svg>';
  fs.writeFileSync(path.join(SALIDA, `${nombre}.svg`), svg);
}
console.log(`${Object.keys(AFICHES).length} pósters .svg`);

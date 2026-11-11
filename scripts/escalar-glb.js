// Bakes a uniform scale into a .glb by wrapping the scene roots in a new scaled node.
// Why: <model-viewer>'s `scale` attribute is NOT passed to Android's Scene Viewer (it only
// receives the model URL), so a model authored in centimetres would appear 100x too big there.
// Idempotent: a file that already has the wrapper node is left untouched.
// Usage: node scripts/escalar-glb.js public/modelos/zorro.glb 0.004
const fs = require('fs');

const NOMBRE = 'LecturaAR_escala';
const [, , archivo, factorTexto] = process.argv;
const factor = Number(factorTexto);
if (!archivo || !(factor > 0)) {
  console.error('Uso: node scripts/escalar-glb.js <archivo.glb> <factor>');
  process.exit(1);
}

const glb = fs.readFileSync(archivo);
if (glb.toString('latin1', 0, 4) !== 'glTF') throw new Error('No es un archivo .glb');

// Chunk 0 is JSON, the rest (BIN) is copied byte for byte.
const largoJson = glb.readUInt32LE(12);
const json = JSON.parse(glb.toString('utf8', 20, 20 + largoJson));
const resto = glb.subarray(20 + largoJson);

if (json.nodes.some((n) => n.name === NOMBRE)) {
  console.log(`${archivo}: ya tiene la escala aplicada, sin cambios.`);
  process.exit(0);
}

const escena = json.scenes[json.scene || 0];
json.nodes.push({ name: NOMBRE, scale: [factor, factor, factor], children: [...escena.nodes] });
escena.nodes = [json.nodes.length - 1];

let nuevoJson = Buffer.from(JSON.stringify(json), 'utf8');
nuevoJson = Buffer.concat([nuevoJson, Buffer.alloc((4 - (nuevoJson.length % 4)) % 4, 0x20)]); // JSON chunk padded with spaces

const cabecera = Buffer.alloc(12);
cabecera.write('glTF', 0, 'latin1');
cabecera.writeUInt32LE(2, 4);
cabecera.writeUInt32LE(12 + 8 + nuevoJson.length + resto.length, 8);
const cabJson = Buffer.alloc(8);
cabJson.writeUInt32LE(nuevoJson.length, 0);
cabJson.write('JSON', 4, 'latin1');

fs.writeFileSync(archivo, Buffer.concat([cabecera, cabJson, nuevoJson, resto]));
console.log(`${archivo}: escala ${factor} aplicada (${(fs.statSync(archivo).size / 1024).toFixed(1)} KB).`);

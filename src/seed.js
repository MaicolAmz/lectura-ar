const db = require('./db');

const lecturas = [
  {
    curso: 8,
    titulo: 'Cantuña y el atrio de San Francisco',
    autor: 'Adaptación de LecturaAR de una leyenda tradicional de Quito',
    duracion_min: 4,
    texto:
      'En la Quito colonial, el maestro albañil Cantuña recibió un encargo imposible: terminar el atrio de la iglesia de San Francisco en una sola noche, o perdería su libertad. ' +
      'Desesperado, aceptó la ayuda del diablo a cambio de su alma. Al caer la noche, cientos de obreros invisibles empezaron a levantar muros, columnas y escalinatas. ' +
      'Antes del amanecer, Cantuña notó que el trabajo estaba por acabar y, con astucia, sacó una piedra y la escondió. ' +
      'Cuando el diablo vio que faltaba una piedra, comprendió que el trato estaba roto: la obra no estaba completa. Furioso, desapareció entre las sombras. Así, el ingenio salvó a Cantuña.',
    glosario: { palabra: 'atrio', definicion: 'Espacio descubierto y generalmente amplio que hay delante de la entrada de una iglesia.' },
    escena: { nombre: 'La piedra que falta', modelo_url: '/modelos/piedra.glb', descripcion: 'Un muro de piedra al que le falta un bloque; la piedra escondida está a un lado.', escala: 1.0 },
  },
  {
    curso: 9,
    titulo: 'Guayas y Quilca',
    autor: 'Adaptación de LecturaAR de una leyenda tradicional de Guayaquil',
    duracion_min: 5,
    texto:
      'Hace siglos, el cacique Guayas gobernaba las tierras junto al gran río, y a su lado estaba Quilca, su esposa, a quien todos respetaban por su sabiduría. ' +
      'Cuando los conquistadores españoles llegaron buscando oro, Guayas se negó a entregar su territorio y resistió durante mucho tiempo. ' +
      'Según la leyenda, al ver que la derrota era inevitable, Guayas escondió los tesoros de su pueblo en un lugar que nadie reveló jamás, y prefirió la muerte antes que rendirse. ' +
      'Dicen que de la unión de ambos nombres, Guayas y Quilca, nació el nombre de Guayaquil. Desde entonces, el río recuerda a quienes defendieron su tierra.',
    glosario: { palabra: 'cacique', definicion: 'Jefe de una comunidad o pueblo indígena.' },
    escena: { nombre: 'Un pez del río Guayas', modelo_url: '/modelos/pez.glb', descripcion: 'Un pez de río, símbolo del gran río que da nombre a Guayaquil.', escala: 1.0 },
  },
  {
    curso: 10,
    titulo: 'Don Goyo, el viejo del manglar',
    autor: 'Adaptación de LecturaAR inspirada en la novela Don Goyo, de Demetrio Aguilera Malta',
    duracion_min: 6,
    texto:
      'En una isla del golfo de Guayaquil vivía Don Goyo, un cholo tan viejo que nadie recordaba su edad. Pasaba los días entre los manglares, hablándoles como si fueran sus compañeros. ' +
      'Los jóvenes se burlaban de él, pero él repetía que los árboles escuchan y que sus raíces sostienen la vida: los cangrejos, los peces y hasta la tierra firme. ' +
      'Una noche, la marea creció con fuerza y amenazó con llevarse las casas de palafito. Fueron las raíces del manglar las que frenaron el agua. ' +
      'Al amanecer, nadie volvió a reírse. Entendieron que el viejo no hablaba con la madera, sino con la memoria de un territorio que merecía ser cuidado.',
    glosario: { palabra: 'manglar', definicion: 'Ecosistema costero formado por mangles, árboles que crecen en agua salada y protegen la costa.' },
    escena: { nombre: 'El manglar', modelo_url: '/modelos/manglar.glb', descripcion: 'Un árbol de manglar con raíces arqueadas sobre el agua.', escala: 1.0 },
  },
];

const seed = db.transaction(() => {
  // Deleting lecturas cascades to glosario, escenas_ar and preguntas.
  db.prepare('DELETE FROM lecturas').run();
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('lecturas','glosario','escenas_ar','preguntas')").run();

  const insL = db.prepare('INSERT INTO lecturas (curso, titulo, autor, duracion_min, texto) VALUES (?, ?, ?, ?, ?)');
  const insG = db.prepare('INSERT INTO glosario (lectura_id, palabra, definicion) VALUES (?, ?, ?)');
  const insE = db.prepare('INSERT INTO escenas_ar (lectura_id, nombre, modelo_url, descripcion, escala) VALUES (?, ?, ?, ?, ?)');

  for (const l of lecturas) {
    const id = insL.run(l.curso, l.titulo, l.autor, l.duracion_min, l.texto).lastInsertRowid;
    insG.run(id, l.glosario.palabra, l.glosario.definicion);
    insE.run(id, l.escena.nombre, l.escena.modelo_url, l.escena.descripcion, l.escena.escala);
  }
});

seed();
console.log(`Seed completado: ${lecturas.length} lecturas.`);

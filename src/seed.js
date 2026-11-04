const db = require('./db');

const lecturas = [
  {
    curso: 8,
    titulo: 'El farol del viejo muelle',
    autor: 'Texto original de LecturaAR',
    duracion_min: 4,
    texto:
      'Cada noche, Don Anselmo subía los ciento doce escalones del faro para encender el farol del viejo muelle. ' +
      'Nadie le había pedido que lo hiciera desde que los barcos grandes dejaron de llegar. ' +
      'Una tarde de niebla, una lancha diminuta se acercó tanteando la costa. Su luz fue lo único que la guio hasta la orilla. ' +
      'El pescador bajó, agradeció en silencio y dejó un pez sobre la baranda. Don Anselmo sonrió y, sin decir palabra, volvió a subir.',
    glosario: { palabra: 'tanteando', definicion: 'Explorando con cuidado y poco a poco, sin tener seguridad de lo que se encuentra.' },
    escena: { nombre: 'Faro en la niebla', modelo_url: '/modelos/faro.glb', descripcion: 'Un faro junto a un muelle de madera rodeado de niebla.', escala: 1.0 },
  },
  {
    curso: 9,
    titulo: 'La carta que nunca llegó',
    autor: 'Texto original de LecturaAR',
    duracion_min: 5,
    texto:
      'Marta esperó el cartero cada mañana durante todo el invierno. Desde la ventana contaba los pasos de los vecinos y reconocía el sonido de cada bicicleta. ' +
      'Cuando por fin llegó la primavera, guardó el papel y la pluma que había preparado para responder. ' +
      'Esa tarde abrió la caja de madera y leyó, una vez más, las cartas viejas de su hermano. ' +
      'Entendió que la añoranza no siempre se responde con una carta: a veces se escribe para uno mismo.',
    glosario: { palabra: 'añoranza', definicion: 'Sentimiento de tristeza por la ausencia de alguien o por algo que ya pasó.' },
    escena: { nombre: 'Ventana de invierno', modelo_url: '/modelos/ventana.glb', descripcion: 'Una ventana con vista a una calle nevada y un buzón en la esquina.', escala: 0.8 },
  },
  {
    curso: 10,
    titulo: 'El espejo de las cuatro de la tarde',
    autor: 'Texto original de LecturaAR',
    duracion_min: 6,
    texto:
      'En la casa de mis abuelos había un espejo que, a las cuatro de la tarde, devolvía una imagen distinta a la esperada. ' +
      'No mostraba mi rostro, sino el de quien yo habría sido si hubiera elegido otro camino. ' +
      'Un día, el reflejo me guiñó un ojo y señaló la puerta. Dudé. Al regresar, el espejo solo mostraba mi cara cansada, y entendí que la pregunta nunca había estado en el cristal.',
    glosario: { palabra: 'reflejo', definicion: 'Imagen que devuelve una superficie pulida, como un espejo o el agua.' },
    escena: { nombre: 'Salón del espejo', modelo_url: '/modelos/espejo.glb', descripcion: 'Un salón antiguo con un espejo de marco dorado frente a la ventana.', escala: 1.2 },
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

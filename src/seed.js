// Loads the 9 readings (3 per course). Idempotent: it deletes every reading (and, by cascade,
// glossary, AR scenes and generated questions) and inserts them again inside one transaction.
// That is the simplest option; the cost is that any stored questions are lost on re-seed.
//
// Texts: traditional oral-tradition stories (public domain) or fables, retold here in
// original wording by LecturaAR. No copyrighted text is copied; `source` records the origin.
const fs = require('fs');
const path = require('path');
const db = require('./db');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const readings = [
  /* ---------------- 8.º ---------------- */
  {
    grade: 8,
    title: 'Cantuña y el atrio de San Francisco',
    author: 'Leyenda tradicional de Quito',
    source: 'Leyenda de tradición oral (dominio público). Versión original redactada por LecturaAR.',
    paragraphs: [
      'En la Quito colonial, el maestro albañil Cantuña recibió un encargo imposible: terminar el atrio de la iglesia de San Francisco en una sola noche. Si fallaba, perdería su libertad y su buen nombre.',
      'Desesperado, aceptó la ayuda del diablo, que le ofreció cientos de obreros invisibles a cambio de su alma. Al caer la noche, los muros, las columnas y las escalinatas fueron levantándose sin ruido, piedra sobre piedra.',
      'Antes del amanecer, Cantuña notó que el trabajo estaba por acabar. Entonces, con astucia, sacó una piedra de la obra y la escondió entre sus ropas.',
      'Cuando el diablo vino a cobrar, contó los bloques y vio que faltaba uno. El trato decía que el atrio debía estar completo, y no lo estaba. Furioso, desapareció entre las sombras. Dicen que, por eso, Cantuña conservó su alma, y que el ingenio le ganó al poder.',
    ],
    glossary: [
      ['atrio', 'Espacio descubierto, generalmente amplio, que hay delante de la entrada de una iglesia.'],
      ['colonial', 'Que pertenece a la época en que estas tierras estuvieron gobernadas por España.'],
      ['astucia', 'Habilidad para conseguir algo con inteligencia y disimulo, a veces engañando a otro.'],
      ['escalinatas', 'Escaleras amplias y majestuosas, generalmente de piedra, en la entrada de un edificio.'],
    ],
    scene: { name: 'La piedra que falta', model_url: '/modelos/stone.glb', description: 'Un muro de piedra al que le falta un bloque; la piedra escondida está a un lado. Modelo ilustrativo.', scale: 1.0 },
  },
  {
    grade: 8,
    title: 'El zorro y el cuervo',
    author: 'Fábula atribuida a Esopo',
    source: 'Fábula clásica atribuida a Esopo (siglo VI a. C., dominio público). Versión original redactada por LecturaAR.',
    paragraphs: [
      'Un cuervo había encontrado un hermoso trozo de queso y se posó en la rama más alta de un árbol para comérselo con tranquilidad.',
      'Un zorro hambriento lo vio desde abajo y sintió que se le hacía agua la boca. Sabía que no podía trepar hasta allí ni quitarle el queso por la fuerza, así que decidió usar otra herramienta: las palabras.',
      '—Buenos días, señor cuervo —dijo con voz melosa—. Qué plumas tan brillantes tiene usted, y qué porte tan elegante. Seguramente su canto es tan hermoso como su aspecto. Me encantaría oírlo una sola vez.',
      'El cuervo, hinchado de orgullo, abrió el pico para lucir su graznido. El queso cayó al suelo y el zorro lo atrapó de inmediato.',
      '—Gracias por la lección, amigo —dijo mientras se alejaba—. Quien te elogia sin motivo suele querer algo de ti.',
    ],
    glossary: [
      ['melosa', 'Dulce y suave, a veces de forma fingida para convencer a alguien.'],
      ['porte', 'Aspecto y presencia de una persona o de un animal.'],
      ['graznido', 'Voz característica del cuervo y de otras aves.'],
      ['elogia', 'Del verbo elogiar: decir cosas buenas de alguien.'],
    ],
    scene: { name: 'El zorro del cuento', model_url: '/modelos/fox.glb', description: 'Un zorro listo para engañar con palabras. Modelo «Fox»: PixelMannen (CC0), tomkranis y @AsoboStudio/@scurest (CC BY 4.0); escala reducida.', scale: 1.0 },
  },
  {
    grade: 8,
    title: 'Taita Imbabura y Mama Cotacachi',
    author: 'Leyenda tradicional de Imbabura',
    source: 'Tradición oral andina del norte de Ecuador (dominio público). Versión original redactada por LecturaAR.',
    paragraphs: [
      'En el norte de Ecuador, entre los lagos y los campos de maíz, se levantan dos montañas que las comunidades kichwa miran como si fueran parte de su familia: el Taita Imbabura y la Mama Cotacachi. «Taita» significa padre y «mama», madre.',
      'Cuenta la tradición que Imbabura, fuerte y protector, se enamoró de Cotacachi, la más hermosa de las montañas, y que juntos cuidaron a los pueblos que crecieron a sus pies. Por eso los abuelos enseñan a los niños a saludarlos cada mañana, con respeto, antes de salir a trabajar la tierra.',
      'Dicen también que, cuando Imbabura se cubre la cima de nubes oscuras, está pensando en su compañera y avisa que vendrá lluvia. Y cuando la nieve blanquea la cumbre de Cotacachi, ella se pone su mejor manto para recibir a su amado.',
      'Así, las dos montañas no solo adornan el paisaje: también guían las siembras, anuncian el clima y recuerdan que la tierra no es una cosa, sino una familia a la que se debe cuidar.',
    ],
    glossary: [
      ['taita', 'Padre, en kichwa. También se usa como muestra de respeto hacia una persona mayor o importante.'],
      ['kichwa', 'Lengua y pueblo indígena de los Andes del Ecuador.'],
      ['cumbre', 'Parte más alta de una montaña.'],
      ['siembras', 'Épocas y trabajos de sembrar la tierra para que crezcan las plantas.'],
    ],
    scene: { name: 'Los volcanes de Imbabura', model_url: '/modelos/volcano.glb', description: 'Dos montañas vecinas, la mayor con la cima nevada. Modelo ilustrativo.', scale: 1.0 },
  },

  /* ---------------- 9.º ---------------- */
  {
    grade: 9,
    title: 'Guayas y Quilca',
    author: 'Leyenda tradicional de Guayaquil',
    source: 'Leyenda de tradición oral (dominio público). Versión original redactada por LecturaAR.',
    paragraphs: [
      'Hace siglos, el cacique Guayas gobernaba las tierras junto a un gran río. A su lado estaba Quilca, su esposa, a quien todos respetaban por su sabiduría y por su manera de dar buenos consejos.',
      'Cuando llegaron los conquistadores españoles buscando oro, Guayas se negó a entregar su territorio y resistió durante mucho tiempo. Los invasores eran más numerosos y estaban mejor armados.',
      'Según la leyenda, al ver que la derrota era inevitable, Guayas escondió los tesoros de su pueblo en un lugar que nadie reveló jamás, y prefirió la muerte antes que rendirse.',
      'Dicen que de la unión de ambos nombres, Guayas y Quilca, nació el nombre de Guayaquil. Desde entonces, el río recuerda a quienes defendieron su tierra.',
    ],
    glossary: [
      ['cacique', 'Jefe de una comunidad o pueblo indígena.'],
      ['conquistadores', 'Soldados y exploradores que tomaron territorios de América en nombre de España.'],
      ['inevitable', 'Que no se puede evitar; que sucederá de todos modos.'],
      ['rendirse', 'Dejar de luchar y aceptar la derrota.'],
    ],
    scene: { name: 'Un pez del río Guayas', model_url: '/modelos/fish.glb', description: 'Un pez de río, símbolo del gran río que da nombre a Guayaquil. Modelo ilustrativo.', scale: 1.0 },
  },
  {
    grade: 9,
    title: 'La Tunda',
    author: 'Leyenda tradicional afroecuatoriana de Esmeraldas',
    source: 'Leyenda de tradición oral de Esmeraldas (dominio público). Relato original redactado por LecturaAR.',
    paragraphs: [
      'En una aldea de Esmeraldas, entre ríos y selva, la abuela Rosa repetía cada tarde: «Nadie se aleja solo hacia el monte cuando cae la luz». Mateo, de diez años, sonreía: a él la selva le parecía un patio sin paredes.',
      'Una tarde, mientras recogía frutos, sintió un aroma delicioso a camarones fritos. Entre los árboles apareció una mujer de voz suave que lo invitaba a comer. Algo en su caminar era extraño, pero el hambre pudo más que la duda.',
      'Mateo la siguió. Comió y comió, y poco a poco olvidó su casa, su nombre y el paso de las horas.',
      'En la aldea, los mayores comprendieron que la Tunda se lo había llevado. Tomaron el bombo, el cununo y la marimba, y salieron a la selva cantando bien fuerte. Cuando Mateo oyó aquella música conocida, parpadeó como quien despierta y siguió el sonido hasta los brazos de su abuela.',
      'Desde entonces, Mateo escucha a los mayores. Sabe que la leyenda no solo asusta: también cuida a los niños de los peligros del monte.',
    ],
    glossary: [
      ['aldea', 'Pueblo pequeño, con pocos habitantes.'],
      ['monte', 'Terreno cubierto de árboles y plantas, lejos de las casas.'],
      ['cununo', 'Tambor alargado que se toca en la música tradicional afroecuatoriana.'],
      ['marimba', 'Instrumento de teclas de madera que se golpean con baquetas, típico de la costa del Pacífico.'],
    ],
    scene: { name: 'Árbol de la selva', model_url: '/modelos/tree.glb', description: 'Un árbol grande de la selva esmeraldeña. Modelo ilustrativo.', scale: 1.0 },
  },
  {
    grade: 9,
    title: 'El cóndor y el colibrí',
    author: 'Texto original de LecturaAR',
    source: 'Texto original de LecturaAR, inspirado en las fábulas y la tradición oral andina.',
    paragraphs: [
      'En lo alto de los Andes vivía un cóndor tan grande que su sombra cruzaba el valle entero. Se sentía el rey del cielo y se reía de cualquier criatura más pequeña que él.',
      '—¿Para qué sirves tú, colibrí? —le dijo un día—. Tus alas son diminutas y tus fuerzas, pocas. Yo cruzo montañas; tú apenas llegas a la siguiente flor.',
      'El colibrí no respondió. Siguió volando de flor en flor, como cada mañana.',
      'Llegó una sequía muy larga. El río se secó y el cóndor, con la garganta ardiendo, no encontraba una gota de agua. Desde las alturas solo veía la tierra agrietada.',
      'Entonces el colibrí, que conocía cada rincón del valle porque había visitado todas las flores, lo guio hasta una pequeña vertiente escondida entre las rocas. —Desde arriba se ve lejos —dijo—, pero desde abajo se ve lo que importa. El cóndor bebió en silencio y, desde ese día, saludó al colibrí con respeto.',
    ],
    glossary: [
      ['diminutas', 'Muy pequeñas.'],
      ['sequía', 'Largo período de tiempo sin lluvias.'],
      ['agrietada', 'Con grietas, es decir, con aberturas largas y estrechas.'],
      ['vertiente', 'Agua que brota de la tierra o entre las rocas; manantial.'],
    ],
    scene: { name: 'Un ave de los Andes', model_url: '/modelos/bird.glb', description: 'Un ave de alas abiertas sobre las montañas. Modelo ilustrativo: no es un cóndor ni un colibrí exactos.', scale: 1.0 },
  },

  /* ---------------- 10.º ---------------- */
  {
    grade: 10,
    title: 'Don Goyo, el viejo del manglar',
    author: 'Adaptación de LecturaAR inspirada en la novela Don Goyo, de Demetrio Aguilera Malta',
    source: 'Texto original de LecturaAR inspirado en la novela Don Goyo (Aguilera Malta, 1933). No reproduce el texto de la obra.',
    paragraphs: [
      'En una isla del golfo de Guayaquil vivía Don Goyo, un cholo tan viejo que nadie recordaba su edad. Pasaba los días entre los manglares, hablándoles como si fueran sus compañeros.',
      'Cuentan que, cuando la luna llena subía sobre la isla, Don Goyo se sentaba junto a las raíces más antiguas y les contaba lo que había visto durante el día: quién había pescado mucho, quién se había ido, quién había llegado.',
      'Los jóvenes se burlaban de él, pero él repetía que los árboles escuchan y que sus raíces sostienen la vida: los cangrejos, los peces y hasta la tierra firme.',
      'Una noche, la marea creció con fuerza y amenazó con llevarse las casas de palafito. Fueron las raíces del manglar las que frenaron el agua.',
      'Al amanecer, nadie volvió a reírse. Entendieron que el viejo no hablaba con la madera, sino con la memoria de un territorio que merecía ser cuidado.',
    ],
    glossary: [
      ['golfo', 'Gran entrada del mar en la costa.'],
      ['manglar', 'Ecosistema costero formado por mangles, árboles que crecen en agua salada y protegen la costa.'],
      ['marea', 'Subida y bajada periódica del nivel del mar.'],
      ['palafito', 'Casa construida sobre pilares de madera, sobre el agua o cerca de ella.'],
    ],
    scene: { name: 'El manglar', model_url: '/modelos/mangrove.glb', description: 'Un árbol de manglar con raíces arqueadas sobre el agua. Modelo ilustrativo.', scale: 1.0 },
  },
  {
    grade: 10,
    title: 'La Dama Tapada',
    author: 'Leyenda tradicional de Quito',
    source: 'Leyenda de tradición oral (dominio público). Versión original redactada por LecturaAR.',
    paragraphs: [
      'En el Quito de otros tiempos, cuando los faroles apenas alumbraban las calles empedradas, se contaba que después de las diez de la noche aparecía una mujer elegante, envuelta en un manto negro que le cubría el rostro. La llamaban la Dama Tapada.',
      'Caminaba despacio por los portales y buscaba a algún hombre que volviera solo a su casa. Con voz suave le pedía que la acompañara. Muchos aceptaban, atraídos por el misterio y por el perfume que dejaba a su paso.',
      'Una noche, un joven la siguió hasta la puerta de un viejo convento. Allí ella se detuvo y, sin decir palabra, se levantó el manto un instante. El joven vio un rostro vacío, de calavera, y salió corriendo sin mirar atrás.',
      'Cuentan que, desde ese día, el muchacho volvió temprano a casa y dejó de andar por las calles a deshoras. Otros dicen que la Dama nunca existió y que la leyenda era una forma de aconsejar a los jóvenes. Quizá lo importante no sea saber quién tiene razón, sino qué nos enseña: que las apariencias pueden engañar y que la curiosidad sin prudencia suele salir cara.',
    ],
    glossary: [
      ['faroles', 'Lámparas que se colocan en las calles para alumbrarlas.'],
      ['empedradas', 'Cubiertas de piedras, como las calles antiguas.'],
      ['manto', 'Prenda amplia que cubre la cabeza y el cuerpo.'],
      ['prudencia', 'Cuidado y buen juicio para evitar riesgos innecesarios.'],
    ],
    scene: { name: 'Un farol de la vieja Quito', model_url: '/modelos/lantern.glb', description: 'Un farol de calle, como los que alumbraban las noches coloniales. Modelo ilustrativo.', scale: 1.0 },
  },
  {
    grade: 10,
    title: 'La Yacumama, madre del agua',
    author: 'Leyenda tradicional kichwa de la Amazonía',
    source: 'Leyenda de tradición oral de la Amazonía ecuatoriana (dominio público). Relato original redactado por LecturaAR.',
    paragraphs: [
      'Mi abuelo Segundo pescaba en un afluente del Napo desde que era niño. Antes de lanzar la red, siempre se quedaba un momento en silencio, con la mano en el agua, como quien pide permiso.',
      '—¿A quién le pides permiso, abuelo? —le pregunté una mañana desde la canoa.',
      '—A la Yacumama, la madre del agua —respondió—. Dicen que es una serpiente enorme que vive en lo más hondo del río y que lo cuida con todo lo que lleva dentro: peces, tortugas y corrientes.',
      'Me contó que, hace muchos años, unos pescadores llegaron de lejos y arrasaron con todo. Usaron veneno para sacar peces por montones. A la mañana siguiente, el río amaneció revuelto y en el centro de un remolino se vio una sombra larga que nadie quiso nombrar. Las canoas se perdieron y, durante años, aquel tramo del río no dio ni un solo pez.',
      '—¿Y tú crees que es verdad? —insistí.',
      'Mi abuelo sonrió.',
      '—No sé si la Yacumama existe como la cuentan. Pero sé que el río da mientras uno lo respeta. Esa historia nos lo recuerda cada vez que mojamos la mano.',
    ],
    glossary: [
      ['afluente', 'Río menor que desemboca en otro más grande.'],
      ['arrasaron', 'Destruyeron o se llevaron todo, sin dejar nada.'],
      ['remolino', 'Movimiento giratorio y violento del agua.'],
      ['tramo', 'Parte de un recorrido o de un río.'],
    ],
    scene: { name: 'La canoa del abuelo', model_url: '/modelos/canoe.glb', description: 'Una canoa de madera con su remo, lista para salir al río. Modelo ilustrativo.', scale: 1.0 },
  },
];

/* ---------- Validation: fail loudly instead of loading broken content ---------- */

const countWords = (text) => text.split(/\s+/).filter(Boolean).length;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function validate(list) {
  const perGrade = { 8: 0, 9: 0, 10: 0 };
  for (const reading of list) {
    if (!(reading.grade in perGrade)) throw new Error(`Curso inválido en «${reading.title}»`);
    perGrade[reading.grade]++;
    const text = reading.paragraphs.join('\n');
    const words = countWords(text);
    if (words < 100 || words > 400) throw new Error(`«${reading.title}»: ${words} palabras (se esperan 100-400)`);
    if (!reading.source || !reading.author) throw new Error(`«${reading.title}»: falta autor o fuente`);
    if (reading.glossary.length < 3 || reading.glossary.length > 5) throw new Error(`«${reading.title}»: el glosario debe tener 3-5 palabras`);
    for (const [word] of reading.glossary) {
      // Same Unicode-aware boundaries as the frontend, which highlights exact words only.
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(word)}(?![\\p{L}\\p{N}])`, 'iu');
      if (!re.test(text)) throw new Error(`«${reading.title}»: la palabra «${word}» no aparece en el texto`);
    }
    if (!fs.existsSync(path.join(PUBLIC_DIR, reading.scene.model_url))) throw new Error(`«${reading.title}»: falta el modelo ${reading.scene.model_url}`);
  }
  for (const [grade, count] of Object.entries(perGrade)) {
    if (count !== 3) throw new Error(`El curso ${grade}.º tiene ${count} lecturas (deben ser 3)`);
  }
}

/* ---------- Load ---------- */

function seedReadings() {
  validate(readings);
  const load = db.transaction(() => {
    // Deleting readings cascades to glossary, ar_scenes and questions.
    db.prepare('DELETE FROM readings').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('readings','glossary','ar_scenes','questions')").run();

    const insertReading = db.prepare('INSERT INTO readings (grade, title, author, source, duration_min, text) VALUES (?, ?, ?, ?, ?, ?)');
    const insertWord = db.prepare('INSERT INTO glossary (reading_id, word, definition) VALUES (?, ?, ?)');
    const insertScene = db.prepare('INSERT INTO ar_scenes (reading_id, name, model_url, description, scale) VALUES (?, ?, ?, ?, ?)');

    for (const reading of readings) {
      const text = reading.paragraphs.join('\n');
      // Estimate: reading at ~110 words/min plus 2 min for the questions.
      const duration = Math.ceil(countWords(text) / 110) + 2;
      const id = insertReading.run(reading.grade, reading.title, reading.author, reading.source, duration, text).lastInsertRowid;
      for (const [word, definition] of reading.glossary) insertWord.run(id, word, definition);
      const { name, model_url, description, scale } = reading.scene;
      insertScene.run(id, name, model_url, description, scale);
    }
  });
  load();
  return readings.length;
}

module.exports = { seedReadings, readings };

if (require.main === module) {
  console.log(`Seed completado: ${seedReadings()} lecturas.`);
}
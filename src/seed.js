// Loads the 9 readings (3 per course). Idempotent: it deletes every reading (and, by cascade,
// glossary, AR scenes and generated questions) and inserts them again inside one transaction.
// That is the simplest option; the cost is that any stored questions are lost on re-seed.
//
// Texts: traditional oral-tradition stories (public domain) or fables, retold here in
// original wording by LecturaAR. No copyrighted text is copied; `fuente` records the origin.
const fs = require('fs');
const path = require('path');
const db = require('./db');

const MODELOS = path.join(__dirname, '..', 'public');

const lecturas = [
  /* ---------------- 8.º ---------------- */
  {
    curso: 8,
    titulo: 'Cantuña y el atrio de San Francisco',
    autor: 'Leyenda tradicional de Quito',
    fuente: 'Leyenda de tradición oral (dominio público). Versión original redactada por LecturaAR.',
    parrafos: [
      'En la Quito colonial, el maestro albañil Cantuña recibió un encargo imposible: terminar el atrio de la iglesia de San Francisco en una sola noche. Si fallaba, perdería su libertad y su buen nombre.',
      'Desesperado, aceptó la ayuda del diablo, que le ofreció cientos de obreros invisibles a cambio de su alma. Al caer la noche, los muros, las columnas y las escalinatas fueron levantándose sin ruido, piedra sobre piedra.',
      'Antes del amanecer, Cantuña notó que el trabajo estaba por acabar. Entonces, con astucia, sacó una piedra de la obra y la escondió entre sus ropas.',
      'Cuando el diablo vino a cobrar, contó los bloques y vio que faltaba uno. El trato decía que el atrio debía estar completo, y no lo estaba. Furioso, desapareció entre las sombras. Dicen que, por eso, Cantuña conservó su alma, y que el ingenio le ganó al poder.',
    ],
    glosario: [
      ['atrio', 'Espacio descubierto, generalmente amplio, que hay delante de la entrada de una iglesia.'],
      ['colonial', 'Que pertenece a la época en que estas tierras estuvieron gobernadas por España.'],
      ['astucia', 'Habilidad para conseguir algo con inteligencia y disimulo, a veces engañando a otro.'],
      ['escalinatas', 'Escaleras amplias y majestuosas, generalmente de piedra, en la entrada de un edificio.'],
    ],
    escena: { nombre: 'La piedra que falta', modelo_url: '/modelos/piedra.glb', descripcion: 'Un muro de piedra al que le falta un bloque; la piedra escondida está a un lado. Modelo ilustrativo.', escala: 1.0 },
  },
  {
    curso: 8,
    titulo: 'El zorro y el cuervo',
    autor: 'Fábula atribuida a Esopo',
    fuente: 'Fábula clásica atribuida a Esopo (siglo VI a. C., dominio público). Versión original redactada por LecturaAR.',
    parrafos: [
      'Un cuervo había encontrado un hermoso trozo de queso y se posó en la rama más alta de un árbol para comérselo con tranquilidad.',
      'Un zorro hambriento lo vio desde abajo y sintió que se le hacía agua la boca. Sabía que no podía trepar hasta allí ni quitarle el queso por la fuerza, así que decidió usar otra herramienta: las palabras.',
      '—Buenos días, señor cuervo —dijo con voz melosa—. Qué plumas tan brillantes tiene usted, y qué porte tan elegante. Seguramente su canto es tan hermoso como su aspecto. Me encantaría oírlo una sola vez.',
      'El cuervo, hinchado de orgullo, abrió el pico para lucir su graznido. El queso cayó al suelo y el zorro lo atrapó de inmediato.',
      '—Gracias por la lección, amigo —dijo mientras se alejaba—. Quien te elogia sin motivo suele querer algo de ti.',
    ],
    glosario: [
      ['melosa', 'Dulce y suave, a veces de forma fingida para convencer a alguien.'],
      ['porte', 'Aspecto y presencia de una persona o de un animal.'],
      ['graznido', 'Voz característica del cuervo y de otras aves.'],
      ['elogia', 'Del verbo elogiar: decir cosas buenas de alguien.'],
    ],
    escena: { nombre: 'El zorro del cuento', modelo_url: '/modelos/zorro.glb', descripcion: 'Un zorro listo para engañar con palabras. Modelo «Fox»: PixelMannen (CC0), tomkranis y @AsoboStudio/@scurest (CC BY 4.0); escala reducida.', escala: 1.0 },
  },
  {
    curso: 8,
    titulo: 'Taita Imbabura y Mama Cotacachi',
    autor: 'Leyenda tradicional de Imbabura',
    fuente: 'Tradición oral andina del norte de Ecuador (dominio público). Versión original redactada por LecturaAR.',
    parrafos: [
      'En el norte de Ecuador, entre los lagos y los campos de maíz, se levantan dos montañas que las comunidades kichwa miran como si fueran parte de su familia: el Taita Imbabura y la Mama Cotacachi. «Taita» significa padre y «mama», madre.',
      'Cuenta la tradición que Imbabura, fuerte y protector, se enamoró de Cotacachi, la más hermosa de las montañas, y que juntos cuidaron a los pueblos que crecieron a sus pies. Por eso los abuelos enseñan a los niños a saludarlos cada mañana, con respeto, antes de salir a trabajar la tierra.',
      'Dicen también que, cuando Imbabura se cubre la cima de nubes oscuras, está pensando en su compañera y avisa que vendrá lluvia. Y cuando la nieve blanquea la cumbre de Cotacachi, ella se pone su mejor manto para recibir a su amado.',
      'Así, las dos montañas no solo adornan el paisaje: también guían las siembras, anuncian el clima y recuerdan que la tierra no es una cosa, sino una familia a la que se debe cuidar.',
    ],
    glosario: [
      ['taita', 'Padre, en kichwa. También se usa como muestra de respeto hacia una persona mayor o importante.'],
      ['kichwa', 'Lengua y pueblo indígena de los Andes del Ecuador.'],
      ['cumbre', 'Parte más alta de una montaña.'],
      ['siembras', 'Épocas y trabajos de sembrar la tierra para que crezcan las plantas.'],
    ],
    escena: { nombre: 'Los volcanes de Imbabura', modelo_url: '/modelos/volcan.glb', descripcion: 'Dos montañas vecinas, la mayor con la cima nevada. Modelo ilustrativo.', escala: 1.0 },
  },

  /* ---------------- 9.º ---------------- */
  {
    curso: 9,
    titulo: 'Guayas y Quilca',
    autor: 'Leyenda tradicional de Guayaquil',
    fuente: 'Leyenda de tradición oral (dominio público). Versión original redactada por LecturaAR.',
    parrafos: [
      'Hace siglos, el cacique Guayas gobernaba las tierras junto a un gran río. A su lado estaba Quilca, su esposa, a quien todos respetaban por su sabiduría y por su manera de dar buenos consejos.',
      'Cuando llegaron los conquistadores españoles buscando oro, Guayas se negó a entregar su territorio y resistió durante mucho tiempo. Los invasores eran más numerosos y estaban mejor armados.',
      'Según la leyenda, al ver que la derrota era inevitable, Guayas escondió los tesoros de su pueblo en un lugar que nadie reveló jamás, y prefirió la muerte antes que rendirse.',
      'Dicen que de la unión de ambos nombres, Guayas y Quilca, nació el nombre de Guayaquil. Desde entonces, el río recuerda a quienes defendieron su tierra.',
    ],
    glosario: [
      ['cacique', 'Jefe de una comunidad o pueblo indígena.'],
      ['conquistadores', 'Soldados y exploradores que tomaron territorios de América en nombre de España.'],
      ['inevitable', 'Que no se puede evitar; que sucederá de todos modos.'],
      ['rendirse', 'Dejar de luchar y aceptar la derrota.'],
    ],
    escena: { nombre: 'Un pez del río Guayas', modelo_url: '/modelos/pez.glb', descripcion: 'Un pez de río, símbolo del gran río que da nombre a Guayaquil. Modelo ilustrativo.', escala: 1.0 },
  },
  {
    curso: 9,
    titulo: 'La Tunda',
    autor: 'Leyenda tradicional afroecuatoriana de Esmeraldas',
    fuente: 'Leyenda de tradición oral de Esmeraldas (dominio público). Relato original redactado por LecturaAR.',
    parrafos: [
      'En una aldea de Esmeraldas, entre ríos y selva, la abuela Rosa repetía cada tarde: «Nadie se aleja solo hacia el monte cuando cae la luz». Mateo, de diez años, sonreía: a él la selva le parecía un patio sin paredes.',
      'Una tarde, mientras recogía frutos, sintió un aroma delicioso a camarones fritos. Entre los árboles apareció una mujer de voz suave que lo invitaba a comer. Algo en su caminar era extraño, pero el hambre pudo más que la duda.',
      'Mateo la siguió. Comió y comió, y poco a poco olvidó su casa, su nombre y el paso de las horas.',
      'En la aldea, los mayores comprendieron que la Tunda se lo había llevado. Tomaron el bombo, el cununo y la marimba, y salieron a la selva cantando bien fuerte. Cuando Mateo oyó aquella música conocida, parpadeó como quien despierta y siguió el sonido hasta los brazos de su abuela.',
      'Desde entonces, Mateo escucha a los mayores. Sabe que la leyenda no solo asusta: también cuida a los niños de los peligros del monte.',
    ],
    glosario: [
      ['aldea', 'Pueblo pequeño, con pocos habitantes.'],
      ['monte', 'Terreno cubierto de árboles y plantas, lejos de las casas.'],
      ['cununo', 'Tambor alargado que se toca en la música tradicional afroecuatoriana.'],
      ['marimba', 'Instrumento de teclas de madera que se golpean con baquetas, típico de la costa del Pacífico.'],
    ],
    escena: { nombre: 'Árbol de la selva', modelo_url: '/modelos/arbol.glb', descripcion: 'Un árbol grande de la selva esmeraldeña. Modelo ilustrativo.', escala: 1.0 },
  },
  {
    curso: 9,
    titulo: 'El cóndor y el colibrí',
    autor: 'Texto original de LecturaAR',
    fuente: 'Texto original de LecturaAR, inspirado en las fábulas y la tradición oral andina.',
    parrafos: [
      'En lo alto de los Andes vivía un cóndor tan grande que su sombra cruzaba el valle entero. Se sentía el rey del cielo y se reía de cualquier criatura más pequeña que él.',
      '—¿Para qué sirves tú, colibrí? —le dijo un día—. Tus alas son diminutas y tus fuerzas, pocas. Yo cruzo montañas; tú apenas llegas a la siguiente flor.',
      'El colibrí no respondió. Siguió volando de flor en flor, como cada mañana.',
      'Llegó una sequía muy larga. El río se secó y el cóndor, con la garganta ardiendo, no encontraba una gota de agua. Desde las alturas solo veía la tierra agrietada.',
      'Entonces el colibrí, que conocía cada rincón del valle porque había visitado todas las flores, lo guio hasta una pequeña vertiente escondida entre las rocas. —Desde arriba se ve lejos —dijo—, pero desde abajo se ve lo que importa. El cóndor bebió en silencio y, desde ese día, saludó al colibrí con respeto.',
    ],
    glosario: [
      ['diminutas', 'Muy pequeñas.'],
      ['sequía', 'Largo período de tiempo sin lluvias.'],
      ['agrietada', 'Con grietas, es decir, con aberturas largas y estrechas.'],
      ['vertiente', 'Agua que brota de la tierra o entre las rocas; manantial.'],
    ],
    escena: { nombre: 'Un ave de los Andes', modelo_url: '/modelos/ave.glb', descripcion: 'Un ave de alas abiertas sobre las montañas. Modelo ilustrativo: no es un cóndor ni un colibrí exactos.', escala: 1.0 },
  },

  /* ---------------- 10.º ---------------- */
  {
    curso: 10,
    titulo: 'Don Goyo, el viejo del manglar',
    autor: 'Adaptación de LecturaAR inspirada en la novela Don Goyo, de Demetrio Aguilera Malta',
    fuente: 'Texto original de LecturaAR inspirado en la novela Don Goyo (Aguilera Malta, 1933). No reproduce el texto de la obra.',
    parrafos: [
      'En una isla del golfo de Guayaquil vivía Don Goyo, un cholo tan viejo que nadie recordaba su edad. Pasaba los días entre los manglares, hablándoles como si fueran sus compañeros.',
      'Cuentan que, cuando la luna llena subía sobre la isla, Don Goyo se sentaba junto a las raíces más antiguas y les contaba lo que había visto durante el día: quién había pescado mucho, quién se había ido, quién había llegado.',
      'Los jóvenes se burlaban de él, pero él repetía que los árboles escuchan y que sus raíces sostienen la vida: los cangrejos, los peces y hasta la tierra firme.',
      'Una noche, la marea creció con fuerza y amenazó con llevarse las casas de palafito. Fueron las raíces del manglar las que frenaron el agua.',
      'Al amanecer, nadie volvió a reírse. Entendieron que el viejo no hablaba con la madera, sino con la memoria de un territorio que merecía ser cuidado.',
    ],
    glosario: [
      ['golfo', 'Gran entrada del mar en la costa.'],
      ['manglar', 'Ecosistema costero formado por mangles, árboles que crecen en agua salada y protegen la costa.'],
      ['marea', 'Subida y bajada periódica del nivel del mar.'],
      ['palafito', 'Casa construida sobre pilares de madera, sobre el agua o cerca de ella.'],
    ],
    escena: { nombre: 'El manglar', modelo_url: '/modelos/manglar.glb', descripcion: 'Un árbol de manglar con raíces arqueadas sobre el agua. Modelo ilustrativo.', escala: 1.0 },
  },
  {
    curso: 10,
    titulo: 'La Dama Tapada',
    autor: 'Leyenda tradicional de Quito',
    fuente: 'Leyenda de tradición oral (dominio público). Versión original redactada por LecturaAR.',
    parrafos: [
      'En el Quito de otros tiempos, cuando los faroles apenas alumbraban las calles empedradas, se contaba que después de las diez de la noche aparecía una mujer elegante, envuelta en un manto negro que le cubría el rostro. La llamaban la Dama Tapada.',
      'Caminaba despacio por los portales y buscaba a algún hombre que volviera solo a su casa. Con voz suave le pedía que la acompañara. Muchos aceptaban, atraídos por el misterio y por el perfume que dejaba a su paso.',
      'Una noche, un joven la siguió hasta la puerta de un viejo convento. Allí ella se detuvo y, sin decir palabra, se levantó el manto un instante. El joven vio un rostro vacío, de calavera, y salió corriendo sin mirar atrás.',
      'Cuentan que, desde ese día, el muchacho volvió temprano a casa y dejó de andar por las calles a deshoras. Otros dicen que la Dama nunca existió y que la leyenda era una forma de aconsejar a los jóvenes. Quizá lo importante no sea saber quién tiene razón, sino qué nos enseña: que las apariencias pueden engañar y que la curiosidad sin prudencia suele salir cara.',
    ],
    glosario: [
      ['faroles', 'Lámparas que se colocan en las calles para alumbrarlas.'],
      ['empedradas', 'Cubiertas de piedras, como las calles antiguas.'],
      ['manto', 'Prenda amplia que cubre la cabeza y el cuerpo.'],
      ['prudencia', 'Cuidado y buen juicio para evitar riesgos innecesarios.'],
    ],
    escena: { nombre: 'Un farol de la vieja Quito', modelo_url: '/modelos/farol.glb', descripcion: 'Un farol de calle, como los que alumbraban las noches coloniales. Modelo ilustrativo.', escala: 1.0 },
  },
  {
    curso: 10,
    titulo: 'La Yacumama, madre del agua',
    autor: 'Leyenda tradicional kichwa de la Amazonía',
    fuente: 'Leyenda de tradición oral de la Amazonía ecuatoriana (dominio público). Relato original redactado por LecturaAR.',
    parrafos: [
      'Mi abuelo Segundo pescaba en un afluente del Napo desde que era niño. Antes de lanzar la red, siempre se quedaba un momento en silencio, con la mano en el agua, como quien pide permiso.',
      '—¿A quién le pides permiso, abuelo? —le pregunté una mañana desde la canoa.',
      '—A la Yacumama, la madre del agua —respondió—. Dicen que es una serpiente enorme que vive en lo más hondo del río y que lo cuida con todo lo que lleva dentro: peces, tortugas y corrientes.',
      'Me contó que, hace muchos años, unos pescadores llegaron de lejos y arrasaron con todo. Usaron veneno para sacar peces por montones. A la mañana siguiente, el río amaneció revuelto y en el centro de un remolino se vio una sombra larga que nadie quiso nombrar. Las canoas se perdieron y, durante años, aquel tramo del río no dio ni un solo pez.',
      '—¿Y tú crees que es verdad? —insistí.',
      'Mi abuelo sonrió.',
      '—No sé si la Yacumama existe como la cuentan. Pero sé que el río da mientras uno lo respeta. Esa historia nos lo recuerda cada vez que mojamos la mano.',
    ],
    glosario: [
      ['afluente', 'Río menor que desemboca en otro más grande.'],
      ['arrasaron', 'Destruyeron o se llevaron todo, sin dejar nada.'],
      ['remolino', 'Movimiento giratorio y violento del agua.'],
      ['tramo', 'Parte de un recorrido o de un río.'],
    ],
    escena: { nombre: 'La canoa del abuelo', modelo_url: '/modelos/canoa.glb', descripcion: 'Una canoa de madera con su remo, lista para salir al río. Modelo ilustrativo.', escala: 1.0 },
  },
];

/* ---------- Validation: fail loudly instead of loading broken content ---------- */

const palabras = (t) => t.split(/\s+/).filter(Boolean).length;
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function validar(lista) {
  const porCurso = { 8: 0, 9: 0, 10: 0 };
  for (const l of lista) {
    if (!(l.curso in porCurso)) throw new Error(`Curso inválido en «${l.titulo}»`);
    porCurso[l.curso]++;
    const texto = l.parrafos.join('\n');
    const n = palabras(texto);
    if (n < 100 || n > 400) throw new Error(`«${l.titulo}»: ${n} palabras (se esperan 100-400)`);
    if (!l.fuente || !l.autor) throw new Error(`«${l.titulo}»: falta autor o fuente`);
    if (l.glosario.length < 3 || l.glosario.length > 5) throw new Error(`«${l.titulo}»: el glosario debe tener 3-5 palabras`);
    for (const [palabra] of l.glosario) {
      // Same Unicode-aware boundaries as the frontend, which highlights exact words only.
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${escapar(palabra)}(?![\\p{L}\\p{N}])`, 'iu');
      if (!re.test(texto)) throw new Error(`«${l.titulo}»: la palabra «${palabra}» no aparece en el texto`);
    }
    if (!fs.existsSync(path.join(MODELOS, l.escena.modelo_url))) throw new Error(`«${l.titulo}»: falta el modelo ${l.escena.modelo_url}`);
  }
  for (const [c, n] of Object.entries(porCurso)) {
    if (n !== 3) throw new Error(`El curso ${c}.º tiene ${n} lecturas (deben ser 3)`);
  }
}

/* ---------- Load ---------- */

function sembrar() {
  validar(lecturas);
  const cargar = db.transaction(() => {
    // Deleting lecturas cascades to glosario, escenas_ar and preguntas.
    db.prepare('DELETE FROM lecturas').run();
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('lecturas','glosario','escenas_ar','preguntas')").run();

    const insL = db.prepare('INSERT INTO lecturas (curso, titulo, autor, fuente, duracion_min, texto) VALUES (?, ?, ?, ?, ?, ?)');
    const insG = db.prepare('INSERT INTO glosario (lectura_id, palabra, definicion) VALUES (?, ?, ?)');
    const insE = db.prepare('INSERT INTO escenas_ar (lectura_id, nombre, modelo_url, descripcion, escala) VALUES (?, ?, ?, ?, ?)');

    for (const l of lecturas) {
      const texto = l.parrafos.join('\n');
      // Estimate: reading at ~110 words/min plus 2 min for the questions.
      const duracion = Math.ceil(palabras(texto) / 110) + 2;
      const id = insL.run(l.curso, l.titulo, l.autor, l.fuente, duracion, texto).lastInsertRowid;
      for (const [palabra, definicion] of l.glosario) insG.run(id, palabra, definicion);
      insE.run(id, l.escena.nombre, l.escena.modelo_url, l.escena.descripcion, l.escena.escala);
    }
  });
  cargar();
  return lecturas.length;
}

module.exports = { sembrar, lecturas };

if (require.main === module) {
  console.log(`Seed completado: ${sembrar()} lecturas.`);
}

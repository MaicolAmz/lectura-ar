# Créditos y licencias de los modelos 3D (HU-07)

Todos los modelos están en `public/modelos/` (`.glb`, cada uno < 5 MB) con un póster `.svg` del mismo nombre que se muestra mientras carga.

| Archivo | Lectura | Tipo | Tamaño | Fuente y licencia |
| --- | --- | --- | --- | --- |
| `fox.glb` | El zorro y el cuervo | **Modelo real** | 159 KB | *Fox*, repositorio [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Fox). Modelo: PixelMannen (CC0 1.0). Rigging y animación: tomkranis (CC BY 4.0). Conversión a glTF: @AsoboStudio y @scurest (CC BY 4.0). **Modificado:** solo se añadió un nodo raíz con escala 0,004 (el modelo original mide ~155 unidades de largo y en AR aparecería de 155 m); geometría, texturas y animaciones intactas (con un script puntual, ya eliminado del repositorio). Licencias leídas en `Models/Fox/LICENSE.md` y `README.md` del repositorio. |
| `stone.glb` | Cantuña y el atrio de San Francisco | Simbólico | 7 KB | Creado para este proyecto con un script puntual (ya eliminado del repositorio). Sin material de terceros. |
| `volcano.glb` | Taita Imbabura y Mama Cotacachi | Simbólico | 15 KB | Ídem. Dos volcanes, el mayor con cima nevada. |
| `fish.glb` | Guayas y Quilca | Simbólico | 21 KB | Ídem. Pez genérico, símbolo del río. |
| `tree.glb` | La Tunda | Simbólico | 30 KB | Ídem. Árbol de selva genérico. |
| `bird.glb` | El cóndor y el colibrí | Simbólico | 23 KB | Ídem. Ave estilizada, no es un cóndor ni un colibrí anatómicamente. |
| `mangrove.glb` | Don Goyo, el viejo del manglar | Simbólico | 29 KB | Ídem. Raíces arqueadas sobre el agua. |
| `lantern.glb` | La Dama Tapada | Simbólico | 9 KB | Ídem. Farol de calle genérico. |
| `canoe.glb` | Cumandá | Simbólico | 8 KB | Ídem. Canoa con remo. |

## Atribución requerida (CC BY 4.0) — Fox

> "Fox" — modelo de PixelMannen (CC0), rigging y animación de tomkranis (CC BY 4.0), conversión a glTF de @AsoboStudio y @scurest (CC BY 4.0). Fuente: KhronosGroup/glTF-Sample-Assets. Licencia: https://creativecommons.org/licenses/by/4.0/ . Modificado por LecturaAR: escala reducida.

La atribución también aparece en la pantalla de la lectura (descripción de la escena AR).

## Escala en AR

`<model-viewer>` no pasa su atributo `scale` a Scene Viewer (Android), que solo recibe la URL del modelo (verificado en `packages/model-viewer/src/features/ar.ts`). Por eso la escala del zorro está **dentro del `.glb`** y la escena usa `scale: 1.0`. El resto de modelos simbólicos ya tienen tamaño real (~0,3-0,7 m).

## Por qué casi todos son simbólicos

Se buscaron modelos CC0 adecuados en el repositorio de Khronos. Solo *Fox* encajaba y pesaba poco. *Lantern* (CC0, 9,3 MB) y *Barramundi Fish* (CC0, 12 MB) se **descartaron por superar el límite de 5 MB**, por sus texturas de 4096 px; reducirlas requería una herramienta externa que no se ejecutó. Para esas lecturas (y para las que no tienen un modelo libre equivalente, como un volcán ecuatoriano o un manglar) se usó un **modelo genérico simbólico**, de baja complejidad y declarado como tal. No representan fielmente el objeto de la lectura; son una ayuda visual.

Los scripts que los generaron (`scripts/generar-modelos.js` y `scripts/escalar-glb.js`) se eliminaron del repositorio; siguen en el historial de git (commits anteriores a este) si hiciera falta regenerarlos.

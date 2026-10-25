# Plan del juego de la orca

Juego web en three.js para un niño de 10 años: una orca que protege el océano de barcos furtivos, rescata animales y explora un mapa.

- **Idioma:** el juego está en **inglés**; este plan y la documentación interna, en español.
- **Plataformas:** navegador de escritorio (teclado y ratón) y **navegador de iPad (táctil)**.
- **Regla de tono:** la orca nunca ataca a personas. Sabotea barcos, redes y grúas. No hay muerte: la orca se "desmaya" y reaparece.

Cada etapa termina con algo jugable que tu hijo puede probar. Conviene enseñárselo al final de cada etapa y preguntarle qué cambiaría.

**Estado:** ✅ completada · 🔄 en curso · ⏳ pendiente

| Etapa | Estado |
|---|---|
| 0 · Base | ✅ |
| 1 · Jugar en iPad | ✅ |
| 2 · Vida, energía y comida | ✅ |
| 3 · Misiones y primer rescate | ✅ |
| 4 · Animales del océano | ✅ |
| 5 · Barcos furtivos | ✅ |
| 6 · Más misiones | ✅ |
| 7 · Progresión y colección | ✅ |
| 8 · Sonido y música | ✅ |
| 9 · Jefe final y pulido | ✅ |

---

## Etapa 0 · Base ✅

- Océano estilizado tipo DREDGE con olas, espuma, reflejos y ciclo de día y noche.
- Orca en tercera persona con física realista sobre las olas: flotación, corrientes, buceo y saltos.
- Aletas articuladas y comportamientos: saltos rasantes, *spyhop*, golpe de cola, soplido y aire.
- Mapa de 3 × 3 km con boyas, minimapa, mapa grande y límites.
- Pantalla de carga con progreso real, datos curiosos y botón *Start swimming*.

---

## Etapa 1 · Jugar en iPad ✅

> **Hecho:** joystick flotante, zona de cámara con arrastre y pellizco, 8 botones táctiles con iconos (Action, Jump, Sprint, Dive, Rise, Slap, Look, Call), entrada unificada por acciones (`input.js`), zonas seguras, aviso para girar el iPad, pantalla completa en el menú de pausa, manifest con iconos para "Añadir a pantalla de inicio", bloqueo de zoom y gestos, menú de pausa y de ajustes (gráficos, controles táctiles, lado del joystick, sensibilidad, volumen, cámara tranquila, texto grande) y calidad automática Low/Medium/High. Probado en el navegador simulando un iPad (1024×768) con `?touch=1`; **falta probarlo en un iPad real**.

**Objetivo:** que el juego se controle cómodamente con los dedos en Safari de iPad y vaya fluido.

**Controles táctiles**
- Joystick virtual a la izquierda que aparece donde se apoya el pulgar: adelante para nadar, a los lados para girar.
- Zona de arrastre a la derecha para mover la cámara, y pellizco con dos dedos para acercar o alejar.
- Botones grandes a la derecha (mínimo 64 px) con iconos en lugar de letras: **Sprint** (mantener), **Rise** y **Dive** (mantener), **Jump**, **Tail slap** y **Spyhop**.
- El mismo sistema de entrada para teclado y táctil: `input.js` expone acciones (`swim`, `turn`, `dive`…) en lugar de teclas, así la orca no distingue de dónde vienen.
- Se detecta si hay pantalla táctil y se muestran los controles adecuados. La línea de ayuda del teclado se oculta en iPad.

**Interfaz para iPad**
- Respetar las zonas seguras (`env(safe-area-inset-*)`) para que nada quede bajo los bordes redondeados.
- Pedir orientación horizontal, con un aviso amable si el iPad está en vertical.
- Botón de pantalla completa y opción de "Añadir a pantalla de inicio" (manifest PWA con icono), para que se abra como una app.
- Bloquear los gestos del navegador que molestan: zoom con doble toque, desplazamiento de la página y menú de mantener pulsado (`touch-action: none`, `user-scalable=no`).
- Panel de ajustes (lil-gui) escondido tras un botón de engranaje, no abierto por defecto.
- HUD y minimapa a un tamaño legible con el iPad en la mano.

**Rendimiento en iPad**
- Ajuste de calidad (Low / Medium / High), automático según los FPS de los primeros segundos.
- En calidad baja: menos resolución (`pixelRatio` 1), océano con menos anillos, menos partículas y estela más corta.

**Listo cuando:** en un iPad real se puede nadar, girar, bucear, saltar y usar el mapa solo con los dedos, a unos 60 FPS (mínimo 30), sin que la página haga zoom ni se desplace.

---

## Etapa 2 · Vida, energía y comida ✅

> **Hecho:** barras de vida, energía y aire con aviso cuando están bajas. El sprint, los saltos, el golpe de cola y el *spyhop* gastan energía; al agotarse, la orca va lenta y aparece "Too tired!". Se recupera nadando despacio. Quedarse sin aire quita vida poco a poco. Hay 12 bancos de peces que huyen si te acercas: comerlos devuelve vida y energía, y siempre hay algunos cerca. Las gaviotas vuelan en círculo encima y la superficie "hierve" de espuma. Si la vida llega a cero, la orca se desmaya y reaparece en el último lugar seguro, con un mensaje que explica qué pasó.

**Objetivo:** añadir las tres barras de supervivencia y la estrategia que crean.

- **Health (vida):** baja al chocar de frente con barcos, con las hélices y con mordiscos de tiburón. Sube comiendo y descansando.
- **Energy (cansancio):** se gasta con sprint, saltos, embestidas y golpes de cola, y se recupera nadando despacio o comiendo. Con poca energía la orca va lenta y no puede saltar.
- **Air (ya existe):** sin cambios, solo se integra visualmente con las otras dos barras.
- **Bancos de peces:** bolas de peces que se mueven en grupo. Al atravesarlas la orca come y recupera vida y energía. Las gaviotas que vuelan encima sirven de pista.
- **Desmayo:** si la vida llega a cero, la pantalla se funde a negro y la orca reaparece en el último lugar seguro, sin perder el progreso.
- HUD con tres barras (corazón, rayo, burbuja) que funciona igual en iPad.

**Listo cuando:** hacer sprint sin parar cansa a la orca, comer peces la recupera y un choque fuerte quita vida.

---

## Etapa 3 · Sistema de misiones y primer rescate ✅

> **Hecho:** motor de misiones en `missions.js` con definiciones como datos en `missionDefs.js`. Cada misión disponible tiene una columna de luz turquesa y un marcador en el mapa. Al acercarse aparece *Mission: …* en el botón Action (o la tecla F), con una ventana de introducción y Start / Not now. Durante la misión hay panel de objetivo con flecha y distancia, columna amarilla en el objetivo, pantalla de *Mission complete* con estrellas según el tiempo y puntos, y *Mission failed* con Try again. Se puede abandonar desde la pausa. El progreso (misiones, estrellas, puntos) se guarda en el navegador. Primera misión: ***Tangled Turtle***, morder la red 5 veces antes de que la tortuga se quede sin aire.

**Objetivo:** tener un motor de misiones reutilizable y una primera misión completa.

- **Motor de misiones:** cada misión es un objeto de datos con título, descripción, objetivos y recompensa. Estados: disponible, activa, completada.
- **Indicadores:** texto del objetivo arriba, flecha en el minimapa y marcador en el mundo hacia el siguiente objetivo.
- **Acción contextual:** un botón *Action* que cambia según lo que hay cerca (*Bite net*, *Push*, *Eat*). En teclado, la tecla F.
- **Primera misión, *Tangled Turtle*:** una tortuga enredada en una red flotante. Hay que llegar, morder la red 5 veces y la tortuga se libera con una pequeña animación. Si tardas, la tortuga se queda sin aire y la misión se reinicia, sin castigo.
- Pantalla de *Mission complete* con estrellas según el tiempo.
- **Guardado** del progreso en el navegador (`localStorage`).

**Listo cuando:** se puede aceptar, seguir y completar el rescate de la tortuga, y el progreso sigue ahí al recargar.

---

## Etapa 4 · Animales del océano ✅

> **Hecho:** modelos procedurales de delfín, tiburón, tortuga, foca, ballena jorobada (y cría), gaviota y peces, todos flotando sobre las olas reales y oscureciéndose con la profundidad. Hay 3 grupos de delfines que nadan saltando, y **saltan contigo si haces un salto cerca**. Hay delfines amigos que te siguen (se ganan rescatándolos en la etapa 5), 6 tortugas que suben a respirar, 2 colonias de focas que juegan y huyen (al tocarlas dan un salto), y una ballena madre con su cría que dan la vuelta al mapa y soplan al respirar. Hay 2 zonas de tiburones: patrullan, te persiguen y muerden (−8 de vida); un golpe de cola o una embestida rápida los ahuyenta 20 s. La primera vez que ves cada especie se añade al **álbum** con un aviso. Solo se animan los animales cercanos, para no cargar el iPad.

**Objetivo:** llenar el mar de vida con comportamientos simples pero creíbles.

| Animal | Comportamiento | Interacción |
|---|---|---|
| Delfines | Grupos que nadan y saltan | Si los salvas, te siguen y saltan contigo |
| Tortugas | Lentas, a media profundidad | Rescates |
| Focas | Juegan en la superficie | Juego de persecución, sin comerlas |
| Ballena y cría | Migran despacio | Escoltarlas y proteger a la cría |
| Tiburones | Patrullan su zona | Rivales: se ahuyentan con un golpe de cola y pueden morder |
| Peces | Bancos (ya en la etapa 2) | Comida |
| Gaviotas | Vuelan en círculos | Pista de dónde hay peces |

- Movimiento en grupo con *boids* (separación, alineación y cohesión), y todos flotan sobre las olas reales con `waves.heightAt`.
- Modelos procedurales o *low-poly* con el mismo estilo que la orca.
- Aparecen solo cerca del jugador y desaparecen lejos, para cuidar el rendimiento en iPad.

**Listo cuando:** al nadar por el mapa se encuentran animales que reaccionan a la orca.

---

## Etapa 5 · Barcos furtivos ✅

> **Hecho:** `boats.js` con barcos procedurales que flotan y se balancean sobre las olas, dejan estela y salpican en la proa. Hay **pesquero** que arrastra una red con 3 cabos ("Bite line" para cortarlos), **lancha** rápida que persigue y lanza redes que te atrapan ("Break free" pulsando Action varias veces) y **ballenero** con grúa, preparado para el jefe final. La **barra de miedo** se llena con saltos cerca (+25), golpes de cola (+18), embestidas de lado (+22) y cortar la red (+30); al llenarse, el barco huye hasta salir del mapa. Choques: si el barco te embiste de proa, −15; un golpe flojo, −4; la **hélice**, −7 si nadas detrás. El **guardacostas de Captain Marina** cerca del inicio tiene el tablón con todas las misiones. En juego libre patrullan un pesquero y una lancha: ahuyentarlos da +25 puntos y vuelven a los 90 s.

**Objetivo:** el enemigo principal y la defensa de los animales.

- **Pesquero ilegal:** lento, arrastra una red. Hay que cortar la red en 3 puntos.
- **Lancha rápida:** persigue a los delfines. Hay que bloquearla y embestirla de lado.
- **Barra de *Fear*:** saltos cerca, golpes de cola y embestidas la llenan. Cuando se llena, el barco huye y sale del mapa.
- **Peligros del barco:** la hélice hace daño si nadas detrás, algunos lanzan redes que te atrapan unos segundos (machacas *Action* para soltarte) y un choque de frente quita vida.
- Los barcos flotan y se balancean sobre las olas, con estela y espuma.
- **Barco amigo (guardacostas o científicos):** da misiones y no hace daño.

**Listo cuando:** se puede ahuyentar a un barco furtivo antes de que atrape a un grupo de delfines.

---

## Etapa 6 · Más misiones ✅

> **Hecho: 15 misiones de 7 tipos**, todas probadas de principio a fin. Se desbloquean poco a poco según cuántas hayas completado, y Captain Marina las presenta en el tablón.
> - **Rescate:** Tangled Turtle, Lost Calf (guiar al ballenato hasta su madre), Stranded Whale (empujar a la ballena fuera del banco de arena; gasta energía).
> - **Defensa:** Dolphin Defense (ahuyentar la lancha antes de que atrape a los delfines; al ganar, 2 delfines te siguen para siempre), Net Cutter (cortar los 3 cabos y echar al pesquero), Crane Breaker (saltar junto al barco para romper la grúa y liberar a la foca).
> - **Exploración:** Secret Places (barco hundido, bosque de algas, campo de burbujas), Message in a Bottle (5 botellas y luego bucear a 16 m hasta el cofre del tesoro).
> - **Limpieza:** Ocean Cleanup (8 piezas de basura en 150 s).
> - **Familia:** Find Your Family (Grandma Tika, Mom Luna y Little Pip se unen al llamarlas con *Call* y te siguen siempre), Wave Practice (pulsar Action a tiempo con la familia para hacer una ola gigante).
> - **Retos:** High Jump (más de 3,5 m), Ring Race (10 aros, algunos bajo el agua y uno en el aire), Deep Dive (perla a 35 m y volver a respirar).
> - **Juego:** Seal Tag (tocar 5 focas en 60 s).
>
> También se libera la memoria al terminar cada misión y hay un aviso con botón de recarga si iPad Safari pierde los gráficos.

**Objetivo:** variedad usando el motor de la etapa 3.

- **Rescate:** cría perdida (guiarla hasta su madre) y ballena varada (empujarla mar adentro).
- **Defensa:** bloquear barcos, romper la grúa con un salto y cortar líneas de pesca.
- **Exploración:** lugares secretos (barco hundido, cueva, bosque de algas) y botellas con mensajes que forman un mapa del tesoro.
- **Limpieza:** recoger basura y redes abandonadas en un tiempo límite.
- **Manada:** encontrar a cada miembro de la familia de orcas, que luego te sigue, y una caza en equipo haciendo una ola juntos con el ritmo correcto.
- **Retos:** salto más alto, carrera de anillos y buceo profundo.
- Una pequeña historia que conecta las misiones, contada con textos cortos.

**Listo cuando:** hay al menos 10 misiones de 4 tipos distintos.

---

## Etapa 7 · Progresión y colección ✅

> **Hecho:** `progression.js` con un perfil de 4 pestañas (botón de persona arriba a la derecha o desde la pausa):
> - **My Orca:** nombre de la orca, rango con barra de progreso y estadísticas (puntos, misiones, estrellas, animales).
> - **Upgrades:** Big Lungs (más aire), Strong Tail (más velocidad), Power (asustan más los saltos, golpes y embestidas) y Stamina (más energía), con 3 niveles cada una (150 / 300 / 500 puntos).
> - **Skins:** Classic, Midnight (200), Snowy (400) y Golden Legend (al llegar a Ocean Guardian). Se aplican en el shader de la orca.
> - **Album:** las 8 especies con su dato curioso real; las no encontradas salen como "???".
>
> Rangos: *Calf* → *Juvenile* (300) → *Hunter* (900) → *Ocean Guardian* (2000), con una ventana de "New rank!" al subir. Los puntos llegan de las misiones (menos al repetirlas) y de ahuyentar furtivos en juego libre. Todo se guarda.

**Objetivo:** que siempre haya algo que conseguir.

- **Puntos** por misión y **mejoras**: más aire, más velocidad, golpes más fuertes y más energía.
- **Aspectos de orca:** patrones distintos, como una orca con cicatriz, una albina o una cría.
- **Ponerle nombre a la orca** al empezar.
- **Álbum de animales:** cada animal rescatado o descubierto se añade con un dato curioso real.
- **Rangos:** *Calf* → *Juvenile* → *Hunter* → *Ocean Guardian*.

**Listo cuando:** hay una pantalla de perfil con mejoras, aspectos, álbum y rango, y todo queda guardado.

---

## Etapa 8 · Sonido y música ✅

> **Hecho:** `audio.js`, todo sintetizado con Web Audio (sin archivos que descargar). Hay oleaje y viento de fondo; bajo el agua todo suena apagado. Efectos: salpicaduras según su fuerza y distancia, soplido, mordisco, golpe de cola, daño, comer, motor del barco furtivo más cercano, silbidos de delfín al saltar con ellos y canto de la ballena cerca de ella. **Call (V)** hace sonar la llamada de la orca y cada miembro de la familia responde con su voz. Jingles para misión completada, misión fallida y nuevo rango. La música ambiental cambia sola a una progresión tensa con bajo pulsante cuando hay un barco o un tiburón cerca. El volumen de música y efectos se ajusta en Settings. El audio se activa con el toque de *Start swimming*, como exige iPad Safari. **No se ha podido escuchar en esta sesión**: falta probarlo con altavoces en el iPad.

**Objetivo:** que el océano se oiga.

- Olas de fondo, soplido, salpicaduras, golpes de cola y motores de barco.
- **Llamadas de orca** (silbidos y chasquidos), y quizá un botón para "llamar" a la manada.
- Música tranquila al explorar que cambia a tensa cuando hay un barco cerca.
- Sonido bajo el agua amortiguado al bucear.
- En iPad el audio solo puede arrancar tras un toque del usuario: el botón *Start swimming* ya sirve para eso.
- Volumen de música y efectos en ajustes.

**Listo cuando:** cada acción importante tiene sonido y la música reacciona al peligro.

---

## Etapa 9 · Jefe final y pulido ✅

> **Hecho:**
> - **Jefe *The Whaling Ship*** (se desbloquea con 8 misiones). Fase 1: cortar los cabos de su red. Fase 2: romper la grúa del arpón saltando junto al barco, mientras 2 lanchas escolta lanzan redes. Fase 3: asustarlo (resiste el miedo) antes de que alcance a la ballena. Al ganar, la familia salta contigo.
> - **Menú principal** en la pantalla de carga: *Continue* (con "Welcome back, nombre!"), *New game* (pide confirmación si hay partida y luego el nombre de la orca) y *Settings*. *Main menu* desde la pausa.
> - **Tutorial guiado** de 7 pasos en la primera partida (nadar, girar, bucear, respirar, saltar, comer, hablar con Marina), con textos distintos para teclado o táctil. Se puede saltar desde la pausa.
> - **Ajustes completos:** gráficos, controles táctiles, lado del joystick (zurdos), velocidad de cámara, música, efectos, *Calmer camera* (sin sacudidas y con un destello de daño suave) y texto grande.
> - **Accesibilidad:** iconos y colores distintos en cada barra, botones táctiles de 54–96 px y textos ampliables.
> - **Robustez:** aviso si iPad Safari pierde los gráficos, mensaje claro si el navegador no puede crear 3D, carga que no se atasca en segundo plano y memoria liberada al terminar misiones.
> - Probado en escritorio y en modo iPad simulado. El build de producción compila.

**Objetivo:** un cierre épico y un juego redondo.

- **Barco ballenero (jefe):** tres fases. Primero cortar las redes, luego romper la grúa del arpón con saltos y por último hacerlo huir.
- **Menú principal:** *Play*, *Continue*, *Settings* y *Album*. También pausa (botón en iPad, Esc en teclado).
- **Tutorial guiado** en la primera partida: nadar, respirar, comer y la primera misión.
- **Ajustes:** calidad gráfica, volumen, sensibilidad de cámara y lado del joystick (zurdos).
- **Accesibilidad:** textos grandes, opción de menos movimiento de cámara y colores que se distingan.
- Pruebas finales en iPad y en escritorio.

**Listo cuando:** se puede jugar de principio a fin, desde el menú hasta el jefe final, en iPad y en escritorio.

---

## Orden recomendado y por qué

1. **El iPad primero (etapa 1):** si tu hijo juega en iPad, todo lo que se construya después debe probarse ya con controles táctiles. Adaptarlo al final costaría mucho más.
2. **Supervivencia (etapa 2) antes que misiones:** las misiones y los barcos usan vida y energía.
3. **El motor de misiones (etapa 3)** antes que los animales y barcos que lo usan.
4. **El resto** se puede reordenar según lo que más ilusión le haga: si le encantan los delfines, la etapa 4 puede ir antes que la 5.

---

## Cómo jugar en el iPad

1. En el Mac, dentro de la carpeta del juego, arranca el servidor visible en la red local:
   `npm run dev -- --host`
2. Vite muestra una dirección *Network*, por ejemplo `http://192.168.1.20:5173`. Ábrela en Safari del iPad (con el iPad en la misma Wi-Fi).
3. Para que se abra como una app: botón Compartir → **Añadir a pantalla de inicio**.
4. Juega con el iPad en horizontal.

**Pendiente de verificar en un iPad real:** rendimiento y calidad automática, sonido, pantalla completa y comodidad de los botones táctiles. Todo se probó en un navegador de escritorio simulando un iPad.

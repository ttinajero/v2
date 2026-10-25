# Actualización 1.1 · Eventos, peligros y noches misteriosas

Segunda versión del juego de la orca. Se mantienen las reglas de la 1.0: **el juego en inglés y la documentación en español**, se juega en **iPad y escritorio**, y nada muere (la orca se desmaya y reaparece).

**Estado:** ✅ completado · 🔄 en curso · ⏳ pendiente

| Paso | Contenido | Estado |
|---|---|---|
| 1 | Buscar actualizaciones y contenido nuevo cada 10 minutos | ✅ |
| 2 | Ciclo de día y noche activo, con reloj en pantalla | ✅ |
| 3 | Motor de eventos aleatorios | ✅ |
| 4 | Puntos misteriosos "?" en el mapa | ✅ |
| 5 | Franja roja: paso de un banco de tiburones | ✅ |
| 6 | Gran tiburón blanco: pelear o huir | ✅ |
| 7 | Barcos que piden refuerzos si no los vences a tiempo | ✅ |
| 8 | Noches peligrosas: apariciones y el monstruo de las profundidades | ✅ |
| 9 | Pruebas, limpieza y build | ✅ |

---

## Paso 1 · Buscar actualizaciones cada 10 minutos ✅

> **Hecho:** `vite.config.js` toma la versión de `package.json` (ahora **1.1.0**), la mete en el juego y genera `version.json` al compilar (en desarrollo lo sirve en vivo). `src/updates.js` consulta `version.json` y `public/content.json` al empezar, cada 10 minutos y al volver a la pestaña. Probado: al subir la versión aparece el aviso *A new version is ready!* (Update / Later), y un `message` de `content.json` se muestra una sola vez.

**Objetivo:** cuando publiques una versión nueva (más misiones, cambios en la interfaz), el juego abierto se entera solo y avisa.

- El número de versión sale de `package.json` (`"version": "1.1.0"`). Al publicar, **solo hay que subir ese número**.
- Al compilar se genera `version.json` con la versión. En desarrollo se sirve en vivo.
- El juego consulta `version.json` al arrancar y **cada 10 minutos**, sin caché. Si la versión publicada es distinta, muestra un aviso: *"A new version is ready!"* con un botón **Update** que recarga el juego. El progreso se mantiene.
- Archivo **`public/content.json`**, editable sin tocar código:
  - `events`: probabilidad de cada evento aleatorio (subir tiburones, quitar el monstruo…).
  - `message`: un anuncio que se muestra una sola vez (por ejemplo, "¡Nuevo evento de medusas este fin de semana!").
  - Se vuelve a leer cada 10 minutos y se aplica sin recargar.
- Si no hay internet, no pasa nada: se reintenta en la siguiente consulta.

## Paso 2 · Día y noche de verdad ✅

> **Hecho:** el ciclo está activo (un día = 20 min), hay reloj con sol o luna en el HUD, la hora se guarda cada 30 s y avisa al anochecer y al amanecer.

- El ciclo de día y noche pasa a estar **activado por defecto**: un día dura **20 minutos reales** (unos 6 de noche).
- La partida empieza por la mañana y la hora se guarda al salir.
- **Reloj en el HUD**, con un icono de sol o luna y la hora.
- Aviso al anochecer: *"Night is falling… the sea gets dangerous."*

## Paso 3 · Motor de eventos aleatorios ✅

> **Hecho:** `src/events.js`, con probabilidades leídas de `content.json`, el doble de peligros de noche y límites por tipo. El HUD tiene franjas rojas, marcadores "?", alerta roja parpadeante y barra de vida de enemigos.

- Nuevo `events.js`: cada 40–90 segundos decide si empieza un evento, según su probabilidad (`content.json`) y la hora.
- **De noche** los eventos peligrosos son el doble de probables y aparecen los sobrenaturales.
- Límites para que no se amontonen: como mucho 2 "?" a la vez, un solo peligro grande y ninguno nuevo durante el tutorial. Durante una misión solo aparecen eventos tranquilos.
- Cada evento puede poner marcadores en el mapa, alertas en pantalla, barras de vida de enemigos y acciones.

## Paso 4 · Puntos misteriosos "?" ✅

> **Hecho:** `src/events/mystery.js`. Probado cada resultado: cofre (+75–150), cardumen gigante, medusas brillantes de colores de noche (+30 y álbum), manada de tiburones y remolino (+40 al escapar).

- Aparece un **"?" brillante** flotando sobre el agua y en el mapa. Hasta que no te acercas (unos 35 m) no sabes qué es:
  - 🎁 **Premio:** un cofre a la deriva con 75–150 puntos.
  - 🐟 **Curioso de día:** un **cardumen gigante**, mucha comida y muchas gaviotas.
  - ✨ **Curioso de noche:** un **espectáculo de medusas brillantes** de colores (puntos y nueva entrada en el álbum).
  - 🦈 **Peligroso:** una **manada de tiburones** que ataca durante 40 s (se ahuyentan con golpes de cola).
  - 🌀 **Peligroso:** un **remolino** que te arrastra hacia el centro; hay que salir con sprint, y en el centro hace daño.
- Si un "?" no se visita, desaparece a los 3 minutos.

## Paso 5 · Franja roja: el paso de los tiburones ✅

> **Hecho:** `createSharkStream` en `src/events/sharks.js`. Probado: franja roja en el mapa, cuenta atrás de aviso, 10 tiburones que recorren el corredor y atacan dentro de él, y el golpe de cola los dispersa.

- Aviso: *"A shark swarm is coming! Stay out of the red zone."*
- En el minimapa y el mapa grande aparece una **franja roja** que cruza la zona por donde vas a nadar.
- A los 25 s, **10 tiburones** recorren la franja de punta a punta. Si te pillan dentro, te atacan en grupo.
- Un golpe de cola dispersa a los que tienes cerca un rato. Al terminar el recorrido, la franja desaparece.

## Paso 6 · Gran tiburón blanco ✅

> **Hecho:** `src/events/greatWhite.js`. Probadas las dos opciones. Al pelear: barra de vida, embestidas (−20), golpes de cola (−12) y *Bite* (−8); al ganar, +150 y álbum. Al huir: escapas a 60 m con un sprint completo (ajustado tras probarlo, porque a 90 m era casi imposible) y ganas +25.

- A veces un **gran tiburón blanco** (mucho más grande que los normales) ronda con la aleta fuera del agua.
- Si te acercas, el juego pausa y te deja elegir: **Fight** o **Flee**.
  - **Fight:** sale su barra de vida. Le haces daño embistiéndolo a velocidad, con golpes de cola cerca o con *Bite* (Action) cuando está al lado. Él da vueltas y carga cada pocos segundos. Si ganas: +150 puntos, entrada en el álbum y un dato real (*las orcas son de los pocos animales a los que temen los grandes blancos*).
  - **Flee:** te persigue unos 30 s. Si te alejas 60 m (con sprint) escapas y ganas +25 puntos.

## Paso 7 · Barcos que piden refuerzos ✅

> **Hecho:** en `src/boats.js`. Atacar un barco furtivo inicia una cuenta atrás de 40 s, visible en la alerta. Se cancela si lo espantas o te alejas 220 m. Si llega a cero, suenan la radio y una alarma y aparecen 2 lanchas que te rodean lanzando redes (sin embestirte sin parar). Espantarlas da +15 y se rinden a los 70 s.

- En cuanto atacas a un barco furtivo (embestida, salto cerca, golpe de cola o morder sus cabos) empieza un **temporizador de 40 s**, visible en pantalla: *"Fishing boat is calling for help: 32s"*.
- Antes de que acabe puedes:
  - **completar la misión o espantar el barco**: el temporizador se cancela;
  - **huir** a más de 220 m: el temporizador se cancela y te escapas.
- Si se acaba el tiempo, el barco **llama a 2 lanchas** que vienen a por ti lanzando redes. Se pueden espantar (dan puntos) y se van solas a los 70 s.

## Paso 8 · Noches peligrosas y misteriosas ✅

> **Hecho:** `src/events/night.js`. Fantasmas que huyen riéndose si te acercas, barco pirata fantasma turquesa translúcido, sirenas que cantan y se sumergen al acercarte, y el monstruo: una sombra de 80 m con ojos brillantes que agita el mar, oscurece el ambiente y suena con un rugido grave. El álbum suma 6 entradas, 4 de ellas *Legends* con datos reales detrás de cada leyenda. Sonidos nuevos: alarma, rugido, coro, risa, canto de sirena y radio.

- De noche hay más peligros (los eventos de tiburones y remolinos son el doble de probables).
- **Apariciones muy aleatorias**, solo de noche. Brillan, se mueven un rato y luego se desvanecen; no hacen daño:
  - 👻 **Fantasmas:** luces con forma de fantasma que flotan sobre el agua.
  - 🏴‍☠️ **Barco pirata fantasma:** un barco translúcido y brillante que navega y se esfuma.
  - 🧜 **Sirenas:** figuras brillantes sentadas en el agua que cantan.
- **Muy pocas veces**, el **monstruo de las profundidades**: una sombra gigante pasa por debajo de la orca. Se oye un rugido grave, el mar se agita (olas más grandes, sacudidas de cámara, espuma) y el ambiente se oscurece mientras pasa.
- Nueva sección **Legends** en el álbum (fantasma, barco fantasma, sirena, monstruo), además de **Moon Jellyfish** y **Great White Shark**.

## Paso 9 · Pruebas, limpieza y build ✅

> **Hecho:** cada evento probado en modo iPad simulado, código de depuración quitado y build de producción con `version.json`. **Falta probarlo en un iPad real y escuchar los sonidos nuevos.**

- Probar cada evento en escritorio y en modo iPad simulado, junto con el aviso de versión.
- Quitar el código de depuración y compilar.
- Instrucciones para publicar una versión nueva.

---

## Cómo publicar una versión nueva

1. Haz los cambios (nuevas misiones, interfaz…).
2. Sube el número en `package.json`, por ejemplo `"version": "1.2.0"`.
3. Compila con `npm run build` y sube la carpeta `dist/` a donde esté alojado el juego.
4. En menos de 10 minutos, los juegos abiertos muestran *A new version is ready!*. Al pulsar **Update** se carga la versión nueva sin perder el progreso.

**Cambiar eventos sin publicar versión:** edita `content.json` en el servidor (o `public/content.json` antes de compilar). Por ejemplo, `"greatWhite": 0` quita los tiburones blancos, o pon un anuncio así:

```json
"message": { "id": "medusas-octubre", "text": "Jellyfish festival tonight! Look for the ? marks after dark." }
```

Cada `id` distinto se muestra una sola vez por jugador.

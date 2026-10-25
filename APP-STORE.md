# Llevar el juego de la orca a la App Store (iPad)

**Objetivo:** el juego sigue siendo una web (un único código), pero también se publica como **app de iPad**, con el progreso guardado como en una app y **compras dentro de la app**.

**Cómo:** con **Capacitor**, que mete el juego web dentro de una app nativa de iOS. La app usa el mismo motor que Safari, así que el juego funciona igual. Desde JavaScript se accede a funciones nativas: almacenamiento, compras, vibración, iCloud.

```
            ┌──────────── mismo código (src/) ────────────┐
 Web  ──▶   navegador: localStorage · sin compras · avisos de versión
 iPad ──▶   app Capacitor: almacenamiento nativo + iCloud · compras de Apple
```

---

## 0 · Decisiones antes de empezar

1. **¿Categoría "Kids" (niños) o no?**
   - **Kids:** sale en la sección infantil de la App Store, pero tiene reglas más estrictas. No se permiten analíticas ni publicidad de terceros, ni enviar datos a terceros. Las compras y los enlaces externos deben ir detrás de una **puerta para padres**.
   - **No Kids** (edad 4+ normal): más libertad, por ejemplo para usar servicios como RevenueCat.
   - *Recomendación:* para un juego pensado para niños, **Kids con StoreKit directo**, sin SDKs de terceros.
2. **Qué vender.** Lo más recomendable para niños son **compras únicas** ("no consumibles"):
   - packs de aspectos (Aurora, Coral, Shadow…);
   - expansiones, como un mapa nuevo (Ártico) con misiones;
   - un "Pase de Guardián" que desbloquea todo lo que salga después.

   Las compras de puntos que se gastan ("consumibles") se sienten como pagar para ganar y Apple las mira con más lupa en apps infantiles. Mejor evitarlas.
3. **¿La web sigue gratis y sin compras?** Lo más simple es que en la web la tienda diga *"Available in the iPad app"*. Dentro de la app de iOS, todo lo digital se cobra **solo con compras de Apple**. Las normas sobre enlazar a pagos externos han cambiado en algunos países; hay que revisarlas en el momento de publicar.
4. **¿Se sincroniza el progreso entre iPads?** Con **iCloud** (Key-Value Store), el progreso pasa de un iPad a otro con el mismo Apple ID, sin servidores propios.

---

## 1 · Cuentas y trámites (los haces tú)

- [ ] **Apple Developer Program:** 99 USD al año, en developer.apple.com. Puede ser como persona o como empresa; la empresa necesita un número D-U-N-S y tarda más.
- [ ] En **App Store Connect**, firmar el **Paid Applications Agreement** y rellenar los datos **bancarios y fiscales**. **Sin esto no funcionan las compras dentro de la app.**
- [ ] Apuntarse al **App Store Small Business Program**: Apple se queda el 15 % en lugar del 30 % si facturas menos de 1 millón de dólares al año.
- [ ] Una **política de privacidad** publicada en una URL (obligatoria para todas las apps). Puede ser una página sencilla que diga que el juego no recoge datos.
- [ ] Una **URL de soporte**: un correo o una página.

## 2 · Preparar el código (lo puedo hacer yo)

- [ ] **Capa de plataforma** (`platform.js`): detecta si el juego corre en la web o en la app de iOS.
- [ ] **Guardado de app** (`storage.js`):
  - en iOS, usar el almacenamiento nativo (`@capacitor/preferences`) en vez de `localStorage`, para que iOS no lo borre;
  - en la web, seguir con `localStorage`;
  - copiar automáticamente la partida antigua la primera vez que se abre la app;
  - opcional: sincronizar con **iCloud Key-Value** (un plugin o unas pocas líneas de Swift).
- [ ] **Compras** (`purchases.js`):
  - catálogo de productos con sus identificadores, comprar, **Restaurar compras** (obligatorio) y guardar lo comprado;
  - opción recomendada para Kids: `cordova-plugin-purchase`, que funciona con Capacitor y usa StoreKit en el propio iPad sin enviar datos a terceros;
  - alternativa si no es Kids: RevenueCat (`@revenuecat/purchases-capacitor`), con panel de ventas y validación en la nube.
- [ ] **Puerta para padres** antes de la tienda y de cualquier enlace externo: una pregunta que un niño pequeño no resuelva, como "Escribe en números: cuarenta y siete".
- [ ] **Tienda en el perfil** (pestaña *Shop*) con los productos, el precio que da Apple, Comprar y Restaurar. En la web muestra el mensaje de "disponible en la app".
- [ ] **Contenido comprable:** aspectos y extras que se desbloquean al comprar.
- [ ] **Ajustes solo para la app:**
  - quitar el aviso de "versión nueva": en la app, las actualizaciones llegan por la App Store;
  - seguir leyendo `content.json` desde internet, porque solo son datos de eventos, no código;
  - quitar el botón de pantalla completa y el manifest web;
  - opcional: vibración (`@capacitor/haptics`) al saltar, recibir daño o completar misiones.
- [ ] **Todo el código va dentro de la app.** Apple no permite descargar código que cambie cómo funciona la app. Cambiar los datos de `content.json` sí está bien.

## 3 · Crear la app de iOS con Capacitor (lo hago yo; tú lo abres en Xcode)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/preferences
npx cap init "Orca" com.tunombre.orca --web-dir dist
npm run build && npx cap add ios && npx cap sync ios
npx cap open ios
```

En **Xcode**:
- [ ] **Identificador de la app** (bundle id, por ejemplo `com.tunombre.orca`) y tu **equipo** de Apple Developer.
- [ ] **Solo iPad** y **solo horizontal**.
- [ ] **Iconos**, incluido el de 1024×1024 para la tienda, y **pantalla de arranque**.
- [ ] Ocultar la barra de estado; versión **1.0** y número de build **1**.
- [ ] Activar la capacidad **In-App Purchase**, y **iCloud → Key-Value storage** si se sincroniza.
- [ ] Un archivo **StoreKit Configuration** para probar compras en el iPad sin cobrar.

## 4 · Compras en App Store Connect

- [ ] Crear la ficha de la app con el mismo bundle id.
- [ ] Crear cada **compra dentro de la app**: tipo no consumible, identificador (por ejemplo `orca.skins.aurora`), nombre y descripción en inglés (y en español si quieres), precio y una captura para la revisión de Apple.
- [ ] Crear **cuentas de prueba Sandbox** para comprar sin pagar.
- [ ] Opcional: activar **En familia** para las compras.

## 5 · Probar

- [ ] En tu iPad desde Xcode, con compras de prueba (StoreKit Configuration).
- [ ] **TestFlight**: sube un build y lo instalan tu hijo y la familia desde la app TestFlight, durante 90 días por build.
- [ ] Probar: guardado al cerrar y abrir, compra, restaurar en otro iPad, modo avión, sonido y rendimiento.

## 6 · Ficha de la tienda

- [ ] **Capturas de iPad** en el tamaño que pide App Store Connect (iPad de 13 pulgadas).
- [ ] Nombre, subtítulo, descripción, palabras clave y categoría (Games → Family o Kids).
- [ ] **Cuestionario de edad** y, si es Kids, la franja de edad (6–8 o 9–11).
- [ ] **Privacidad de la app** ("etiqueta nutricional"): si no se recogen datos, *Data Not Collected*.
- [ ] **Cumplimiento de exportación**: el juego solo usa el cifrado estándar del sistema, así que está exento.

## 7 · Enviar a revisión

Puntos que Apple revisa y que ya estarán cubiertos:
- compras digitales solo con compras de Apple;
- botón de **Restaurar compras** visible;
- **puerta para padres** en compras y enlaces (si es Kids);
- sin publicidad ni analíticas de terceros;
- política de privacidad;
- que la app aporte algo más que una web: un juego completo sin conexión suele pasar sin problemas.

La primera revisión suele tardar entre 1 y 3 días. Si la rechazan, explican el motivo y se corrige.

## 8 · Después de publicar

- **Web:** se actualiza como hasta ahora (`package.json` → build → subir `dist/`, y aviso automático).
- **App:** cada cambio de código es un build nuevo que sube a la App Store y pasa revisión. `npm run build && npx cap sync ios`, subir el número de versión en Xcode y enviar.
- **Eventos y anuncios** (`content.json`) cambian en las dos sin publicar nada.

---

## Tiempo y coste aproximados

| Fase | Tiempo |
|---|---|
| Cuentas y trámites | 1–7 días (más si es empresa) |
| Preparar el código (guardado, compras, tienda, puerta para padres) | 2–4 días |
| Capacitor, Xcode, iconos y pruebas en el iPad | 1–2 días |
| Productos, TestFlight y ficha de la tienda | 2–3 días |
| Revisión de Apple | 1–3 días |

**Coste:** 99 USD al año, más el 15 % de las ventas para Apple (Small Business Program).

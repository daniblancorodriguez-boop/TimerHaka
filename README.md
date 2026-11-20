# HAKATIMER

Temporizador para CrossFit y entrenamiento funcional. App web (HTML/CSS/JS sin dependencias de ejecución) empaquetada con Capacitor para Android.

## Modos
For Time · AMRAP (con contador de rondas) · AMRAP con descansos · EMOM · Tabata · Intervalos · Descanso · Trabajo = descanso · Fight Gone Bad · Contador de rondas (sin reloj)

- Display LED: tiempo en rojo, rondas en azul (descanso en verde).
- Pausa, reiniciar y terminar en todos los modos.
- Cuenta atrás previa configurable (10 s por defecto) con pitidos 3-2-1.
- Sonido distinto para inicio, cambio de minuto, trabajo, descanso y fin. Se puede elegir entre sonidos incluidos o subir uno propio (máx. 700 KB).
- Entrenamientos predefinidos del box: se crean eligiendo ejercicios de la biblioteca (reps, calorías o metros a mano), se pueden editar y borrar.
- Ejercicios: biblioteca con la explicación en español de cada uno; botón (i) junto a cada ejercicio de un entreno.
- Logo y nombre del gimnasio personalizables (Ajustes).

## Probar en el navegador
```
npm run serve     # http://localhost:8080
npm test          # lógica de temporizadores + prueba de interfaz
```

## Generar la app para Google Play
Requisitos: Node 18+, Android Studio (incluye el SDK y JDK) y una cuenta de Google Play Console.

1. `npm install`
2. `npm run android:init`  (crea la carpeta `android/` y copia la web)
3. Iconos: en Android Studio, clic derecho en `app/src/main/res` → New → Image Asset. Usa `www/icons/icon-1024.png` como foreground/legacy y `#e7bd13` (amarillo del logo) como fondo.
4. `npm run android:open` y en Android Studio:
   - `Build → Generate Signed App Bundle / APK → Android App Bundle (.aab)`.
   - Crea una keystore nueva y **guárdala con copia de seguridad**: sin ella no podrás actualizar la app.
5. En Play Console: crear app → subir el `.aab` en una pista de prueba o producción → ficha de la tienda (descripción, capturas, icono 512×512 = `www/icons/icon-512.png`, gráfico de funciones 1024×500) → política de privacidad → cuestionario de contenido y seguridad de datos (la app no recoge datos; todo se guarda en el dispositivo).

Cada vez que cambies algo en `www/`: `npm run android:sync`, sube `versionCode` en `android/app/build.gradle` y genera un nuevo `.aab`.

El `appId` (`com.hakacrossbox.timer`) es el identificador definitivo de la app en Google Play: cámbialo en `capacitor.config.json` **antes** de `android:init` si quieres otro.

## Compartir en Instagram (estilo Strava)

Al terminar un entreno el botón **Pausa** pasa a **Compartir**. Se genera una imagen (Story 9:16 o Post 4:5) con el logo del gimnasio, el logo HAKATIMER, el entreno y sus ejercicios, y:
- **AMRAP / AMRAP con descansos**: número de rondas (en azul, LED).
- **For Time**: tiempo realizado (en rojo, LED).
- Resto de modos: duración.

Puedes **hacer una foto** o **elegir una de la galería** como fondo, quitarla, ocultar los ejercicios y **Compartir** (menú del móvil → Instagram) o **Guardar imagen**.

En Android (Capacitor) hacen falta los plugins nuevos: `npm install` y luego `npx cap sync android`
(`@capacitor/share` y `@capacitor/filesystem`). Instagram se abre desde el menú de compartir del sistema;
saltar directo a Stories requeriría código nativo adicional. La ruta nativa no se ha probado en un dispositivo real.

## Sonidos exactos (pantalla apagada)

Los pitidos ya no dependen del temporizador de la página: la app conoce de antemano todos los eventos del entreno
(`Timer.timeline`) y los **programa en el reloj de Web Audio con 12 s de margen**, renovándolos constantemente. Pausa, reiniciar
y terminar cancelan lo pendiente; al reanudar se reprograman con el desfase exacto. Medido en Chromium: error ≤ 10 ms.

Para que Android no duerma la app con la pantalla apagada hace falta un **servicio en primer plano** (código nativo, no incluido y
sin probar en dispositivo). Opción: plugin de Capacitor para foreground service (p. ej. `@capawesome-team/capacitor-android-foreground-service`)
iniciándolo al pulsar Empezar y parándolo al salir del reloj, más el permiso `FOREGROUND_SERVICE` en el manifiesto.

## Esfera del reloj y botón INICIAR

- Al pulsar Empezar se abre la pantalla del reloj **parada**: hay que tocar **INICIAR** (suena un «boop» pulsante) para que arranque la cuenta atrás. «Reiniciar» vuelve a ese estado.
- **Esfera circular** (predeterminada): círculo amarillo corporativo con el tiempo y las rondas dentro y 60 rayas que se van consumiendo al ritmo del reloj (por fase; en cuenta hacia arriba, una vuelta por minuto).
- **Reloj grande**: botón de las flechas en la barra superior del reloj. Deja solo el reloj y las rondas, siempre en marcador rectangular (sea cual sea la esfera), a pantalla completa y en horizontal (si el móvil está en vertical, la imagen se gira). Junto a la × hay un icono pequeño para iniciar / pausar / reanudar (tocar el reloj hace lo mismo); en modos con rondas manuales (AMRAP, For Time…) aparecen abajo los botones − y +1 (tocar las rondas también suma una); la × sale.
- **Esfera clásica**: el marcador rectangular de siempre. Se cambia en Ajustes → «Esfera del reloj».

## Sonidos de cuenta atrás y voces
Archivos en `www/audio/` (se guardan para usar sin conexión):
- `cuenta-atras.mp3`: 3 pitidos y 1 largo (4 s). Se arranca 3,02 s antes del inicio y de cada cambio de minuto (EMOM, Fight Gone Bad) para que el pitido largo caiga justo en el cambio. Con menos de 4 s de cuenta atrás previa suenan los pitidos de siempre.
- `mitad-tiempo.mp3`: voz «half time». EMOM y modos por intervalos: en la mitad de cada tiempo de trabajo (si dura 15 s o más). AMRAP y For Time con límite: en la mitad del tiempo total. For Time sin límite: no suena.
- `well-done.mp3`: voz «Well done», 1,25 s después de la bocina final (no suena tras un descanso).
En Ajustes → Cuenta atrás hay un interruptor para cada uno, y botones para probarlos. Sin Web Audio se usan los pitidos de siempre.

## Sonidos por tipo (accesibilidad)

En Ajustes → «Aplicar sonidos distintos por tipo»: pitido corto y agudo = trabajo, tono largo y grave = descanso, y cada evento
(cuenta atrás, inicio, minuto, fin) suena distinto. La vibración también cambia: corta doble = trabajo, larga = descanso.

## Historial y marcas personales

Al terminar un entreno con el reloj se guarda solo (también «Guardar en el historial» en Compartir entreno). Agrupa por nombre y modo;
For Time: gana el menor tiempo; AMRAP: más rondas (y repeticiones). Muestra la diferencia con la vez anterior, la gráfica de evolución,
«Repetir este entreno» y la insignia «NUEVO PR» en la tarjeta de compartir.

## Plantillas de tarjeta

Story 9:16, Post 4:5 y **Horizontal 16:9**, con logo normal o **logo grande** del gimnasio.

## Guardar en la galería y vídeo (compartir)
- En el móvil, «Guardar imagen» y «Guardar vídeo» van a la galería, álbum **HAKATIMER** (plugin `@capacitor-community/media`; tras actualizar: `npm install` y `npx cap sync android`). En el navegador se descargan.
- Vídeo: se elige o graba un vídeo de fondo y la app lo regraba con el logo, el resultado y los ejercicios encima (hasta 60 s, con su audio) usando `MediaRecorder`. El formato (MP4 o WebM) depende del móvil.

## Logo y compartir
- Logo de serie: el de HAKA Crossbox (`www/icons/gym-logo.png`, cuadrado). Si subes uno propio en Ajustes, se usa el tuyo.
- Compartir entreno: opción «Ejercicios arriba a la izquierda (semitransparentes) y entreno abajo» (formatos Story y Post).
- Entrenos de serie: seis formatos genéricos (p2, p3, p4, p6, p7, p8). Los nuevos ejemplos que se añadan en versiones futuras se incluyen solos una vez.

## Estilos de tarjeta con varias fotos (Story)
En «Compartir entreno» hay un selector de estilo: **Normal**, **Carrete 3 + fondo** (tira de fotomatón), **Carrete 4 + 2 fondos** (película inclinada sobre dos fondos) y **Collage 3 + fondo**. Cada hueco tiene su «Hacer foto / Subir foto». Los huecos vacíos solo se ven en la vista previa; al guardar o compartir no salen. Solo en formato Story y sin lista de ejercicios.

## Vídeo e Instagram
- Instagram limita a 15 s lo que recibe desde otra app con «Compartir». Para historias de hasta 60 s: «Guardar vídeo» y subirlo desde la galería dentro de Instagram.
- Un vídeo de más de 60 s se graba en partes de 60 s (`hakatimer-entreno-parte1`, `-parte2`…), una por historia.

### Quitar carteles en la tarjeta de compartir
En la pantalla de compartir hay dos casillas: **Mostrar el cartel del modo y el nombre** y **Mostrar el marcador (tiempo / resultado)**. Desmárcalas para dejar la foto o el vídeo limpios; los ejercicios y el pie se recolocan solos. Funciona con todos los estilos, formatos y con el vídeo.

### Foto / vídeo frontal y de fondo
La pantalla de compartir tiene **Foto de fondo**, **Vídeo de fondo**, **Foto frontal** y **Vídeo frontal**. El frontal va enmarcado delante (donde antes estaba la «foto de la pizarra») y el de fondo ocupa toda la tarjeta. Se puede combinar foto de fondo + vídeo frontal, o vídeo de fondo + foto frontal. Solo un vídeo a la vez.


### Editor de la tarjeta para compartir
La pantalla de compartir es ahora un editor sobre la propia tarjeta:
- **Stories / Publicación** arriba y, justo debajo, la **ruleta de plantillas** (Clásica, Foto frontal, Ejercicios arriba, Solo resultado, Carrete 3 + fondo, Carrete 4 + 2 fondos, Collage 3 + fondo). Se cambia tocando la miniatura o **deslizando el fondo** de la tarjeta a izquierda/derecha. Al cambiar, las fotos y vídeos ya cargados pasan a los huecos de la nueva plantilla.
- **Toca un recuadro** (marcador, nombre, ejercicios, logo, pie, fotos…) para seleccionarlo: se **arrastra** y se **redimensiona** con el tirador naranja de la esquina inferior derecha. Alrededor del elemento aparecen sus herramientas, en el lado con más sitio libre (vertical a izquierda/derecha o en horizontal arriba/abajo): **Estilo** (3 por elemento, p. ej. marcador: Marcador / Cristal / Solo cifras; foto: Recto / Redondeado / Polaroid), **Capa** (poner delante / detrás), **Girar**, **Tamaño** (− / +), cambiar foto o vídeo, **Más** (vaciar, poner de fondo) y **Eliminar**. Estilo, capa, girar y tamaño abren una burbuja con las opciones.
- Cada hueco con **+** acepta **foto o vídeo**: toca el hueco y luego el icono de cámara de sus herramientas; una burbuja pequeña ofrece **Foto**, **Vídeo** (cámara) o **Galería**. «Poner de fondo» lo extiende a toda la tarjeta; «Liberar fondo» lo permite mover.
- **Añadir** vuelve a poner cualquier elemento eliminado o crea más recuadros de foto/vídeo.
- Con varios vídeos en la tarjeta se graban a la vez; el más largo marca la duración (partes de 60 s) y el audio.
- Sustituye a las casillas anteriores (Mostrar ejercicios, cartel, marcador…): ahora se quita el elemento. El formato horizontal 16:9 se ha retirado.
- **Deshacer** (arriba de la tarjeta): vuelve atrás paso a paso hasta el inicio (mover, tamaño, giro, estilo, capas, plantilla, formato, fotos y vídeos, eliminar/añadir). Muestra cuántos pasos hay.
- Tocar **fuera de la tarjeta** quita la selección.

### Voces de aviso (en inglés)

| Voz | Cuándo suena |
|---|---|
| «Last round!» | Al empezar la última ronda de EMOM, Tabata, Intervalos, Trabajo = descanso, Fight Gone Bad y AMRAP con descansos. No en AMRAP simple, For Time ni Descanso. |
| «Last minute!» | Cuando falta 1 minuto, si el entreno dura 2 min o más. No se repite si coincide con «Last round!» o «Half time!». |
| «Ten seconds!» | Cuando faltan 10 segundos, si el entreno dura 30 s o más. Los 3 pitidos finales siguen después. |

Se activan o desactivan juntas en Ajustes. Si en ese instante suena el archivo de cuenta atrás, la voz entra justo cuando éste termina.

### Voz «Rest»

Al empezar cada descanso (Tabata, Intervalos, Trabajo = descanso, AMRAP con descansos, Fight Gone Bad) suena la voz «Rest» en lugar del tono grave; la vibración se mantiene. Se puede apagar en Ajustes para volver al tono de siempre.

### Voz «Go!»

Suena al empezar el entreno y al empezar cada intervalo de trabajo después de un descanso (Tabata, Intervalos, Trabajo = descanso, AMRAP con descansos, Fight Gone Bad), en lugar del pitido corto. En EMOM solo suena al empezar (cada minuto ya suena el archivo de cuenta atrás). Al empezar el entreno entra a la vez que el pitido largo. Si coincide con «Last round!», este espera a que termine el «Go!». Se puede apagar en Ajustes.

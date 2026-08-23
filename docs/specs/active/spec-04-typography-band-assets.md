# spec-04: Badge — tipografía OTF, textos abajo-izquierda y correa nueva

> Spec nueva (no es una fase extraída de spec-03). Prerequisitos: `spec-03-F4v2` implementada y
> archivada — el frente de la tarjeta ya es una escena RT ortográfica 32:45 con quad de `baseColor`,
> arte del tier con alfa y los tres textos del socio anclados y escalados uniformemente. Esta spec
> toca **cuatro** cosas pedidas por Sergio el 2026-08-05: fuente de texto elegible en formato
> **OTF**, color de texto elegible, textos **abajo-izquierda**, color base **`#111111`** y el
> reemplazo de `band.jpg` por `band.png`.

> ⚠️ **REVISADA 2026-08-05 (leader, antes de implementar), contra el código real y contra los
> assets reales.** El enunciado de partida tenía dos supuestos que no se sostienen y un cambio que
> parecía trivial y no lo es. Corregido en el cuerpo de la spec:
>
> 1. **«Poder elegir el color del texto» ya existe.** `theme.colors.text ?? BADGE_TEXT.color` está
>    cableado desde spec-03-F4v2 (`badge-texture.component.ts:175`). El trabajo real es el control
>    en el playground, no la API. Ver R1.
> 2. **La fuente no es `.ttf` sino `.otf`** (corrección de Sergio en la misma sesión), y el fichero
>    ya está entregado: `projects/products-3d-playground/public/assets/Ballega.otf`. Cambia el
>    nombre de la fn de detección, no el diseño. Ver R2.
> 3. **`band.png` NO es un reemplazo drop-in de `band.jpg`.** Cambia de aspecto 4:1 horizontal a
>    1:16 **vertical** y estrena canal alfa. Con el código actual la correa saldría con el arte
>    comprimido ×64 y con fondo **negro**. Es la parte más delicada de la spec. Ver el Diagnóstico
>    y R5.

## Diagnóstico: la demo tiene HOY dos assets rotos

Estado real del working tree (verificado el 2026-08-05, después de que Sergio moviera assets):

| Asset | Estado en disco | A qué apunta el código |
|---|---|---|
| `band.jpg` | **borrado**, pero sigue **trackeado en git** | `bandTextureUrl` → `/assets/band.jpg` ⇒ **404** |
| `font.json` | **borrado por Sergio**, trackeado en git | `fontUrl` → `/assets/font.json` ⇒ **404** |
| `band.png` | ✅ entregado, **725 × 70** (ya girado) — *revisado por Sergio el 2026-08-06 13:17:48; la primera entrega era 784 × 49* | nadie |
| `Ballega.otf` | ✅ entregado, 70 736 B | nadie |

Es decir: **la demo arranca hoy sin correa y sin textos**, degradando a color plano y a sin-texto con
sendos warns dev (los modos degradados diseñados en `badge-scene.component.ts:436-445`). Los dos
404 los cierran T5 y T6 respectivamente.

## Diagnóstico de la correa

`band.jpg` y `band.png` no son intercambiables:

| | `band.jpg` (borrado) | `band.png` (vigente) |
|---|---|---|
| Dimensiones | 1024 × 256 | **725 × 70** |
| Aspecto | **4:1** | **~10.36:1** |
| Canal alfa | no | **sí — arte blanco sobre transparente** |
| Arte | espiga neutra tileable | marcas blancas espaciadas a lo largo de la tira |

> Sergio ya lo entregó **girado a horizontal** (eje largo = longitud de la correa), que era la
> decisión cerrada. La primera versión que dejó era 49 × 784 (vertical) y no habría servido: ver
> el punto 3 de abajo.
>
> **El asset se ha revisado dos veces.** Las cifras de arriba son las del fichero **vigente**
> (725 × 70, blob `2cd2b6ad`, 2026-08-06 13:17:48). La entrega anterior era **784 × 49** (aspecto 16),
> y es la que citan las notas de `progress/` escritas antes de esa hora. El diagnóstico cualitativo de
> abajo **no cambia** con la revisión: los tres defectos dependen de que el aspecto **no sea 4:1** y
> de que el arte **tenga alfa**, y ambas cosas siguen siendo ciertas.

De ahí **tres** defectos que aparecerían al repuntar la URL sin tocar nada más:

1. **Arte con el teselado equivocado.** `BADGE_BAND.repeat = [-3.383, 1]` (`badge.config.ts:100`)
   está derivado **a mano** del aspecto 4:1. Con un aspecto distinto la derivación deja de valer y el
   arte sale comprimido en proporción (×4 con el 16:1 de la primera entrega, ×2.6 con el 10.36:1
   vigente).
2. **Correa negra.** Los píxeles a alfa 0 del PNG llevan RGB `(0,0,0)`, y el material de la correa
   no declara `transparent` ⇒ el shader multiplica por negro y pinta la correa de negro donde no
   hay arte.
3. **La orientación no se puede corregir por código** — por eso el asset se pidió girado. El
   fragment shader de meshline es
   `if (useMap == 1.) diffuseColor *= texture2D(map, vUV * repeat);`
   (`node_modules/meshline/dist/index.js:323`): **no aplica la transformada UV de la textura**, así
   que `texture.rotation` / `offset` / `center` son inertes y no hay swizzle de coordenadas. Una
   tira vertical no se puede tumbar desde la lib sin redibujarla en un canvas.

## Requisitos (cerrados con Sergio, 2026-08-05)

### R1 — Color del texto: solo falta el control de la demo

**No se toca la API.** `Products3dBadgeTheme.colors.text` ya existe (`types.ts`), ya tiene fallback
(`BADGE_TEXT.color = 'black'`, `badge.config.ts:363`) y ya está cableado al material de los tres
textos (`badge-texture.component.ts:175`). Lo que falta es un `<input type="color">` en el
formulario del playground, **exactamente igual al que ya existe para `baseColor`**
(`badge-demo.component.ts:101-104,202,207-210`): mismo patrón de signal + `computed` que mergea
sobre el tema demo.

El **default de la lib se queda en `'black'`**. Que el negro sea o no legible depende del arte del
tema, no de la lib, y ésa es la decisión de diseño que la review de T7 de spec-03-F4v2 dejó abierta:
se cierra **mirando el playground en la N3**, con el control nuevo como herramienta. Si de ahí sale
que hay que cambiar el default, se anota y se hace; no se decide a ciegas ahora.

### R2 — Fuente OTF

`theme.fontUrl` pasa a aceptar **typeface JSON (como hoy), `.otf` o `.ttf`**, con **autodetección
por extensión**. No se añade campo nuevo al tema, así que `REQUIRED_THEME_URL_FIELDS`
(`badge-theme.ts:4`) **no se toca** y ningún consumidor existente se rompe.

Hoy no funciona porque `fontResource` de soba asume JSON para cualquier string
(`angular-three-soba-loaders.mjs:100-103`):

```js
async function loadFontData(font) {
	return typeof font === 'string' ? await (await fetch(font)).json() : font;
}
```

Pero ese mismo código es la puerta de entrada: **si `font` no es un string, se pasa tal cual** a
`FontLoader.parse()`. Y `NgtsText3D.font` es `input.required` sin transform, así que acepta el
objeto de datos sin ceremonia.

**Diseño:**

- Fn pura nueva **`isOpentypeFontUrl(url)`**. Nombre deliberado: **no** `isTtfFontUrl`, porque cubre
  las dos extensiones y el nombre no debe sugerir que OTF queda fuera. Insensible a mayúsculas y
  tolerante a `?query` y `#hash`.
- Carga vía **`three/addons/loaders/TTFLoader.js`**. Presente en `three` 0.182 y expuesto por su
  mapa `exports` (`"./addons/*": "./examples/jsm/*"`). **Cero dependencias nuevas**: `opentype` va
  embebido en three (`examples/jsm/libs/opentype.module.js`) y ese bundle **incluye el intérprete
  CFF**, que es lo que distingue OTF de TTF. `three` ya es peerDep.

  > ⚠️ **Para el implementer**: el loader se llama `TTFLoader` **y es el que hay que usar para
  > OTF**. No busques un `OTFLoader`: no existe, ni en three ni en three-stdlib.

  **Verificado ejecutándolo sobre el asset real** (no es un supuesto de la spec):

  ```
  familyName: "Ballega"   resolution: 1000   ascender: 1065   descender: -278
  glyph count: 176        A a 0 1 # S e r g i o Ñ ó  → todos presentes
  new FontLoader().parse(json) -> Font (isFont: true)
  font.generateShapes('Sergio #1234') -> 12 shapes
  ```

- **`import()` dinámico, nunca estático.** `opentype.module.js` pesa **467 KB**: un import estático
  se lo comería todo consumidor de la lib aunque solo use typeface JSON. El dinámico además
  mantiene la ruta SSR-safe.
- `TTFLoader.parse()` devuelve **typeface JSON**, justo lo que `NgtsText3D[font]` acepta como objeto
  ⇒ `[font]="resolvedFont()"`, con `resolvedFont` = datos parseados si la URL es binaria, o **la URL
  string tal cual** si es JSON (así soba conserva su propia caché para el camino de siempre).
- **Caché por URL con referencia estable**: la caché de soba es por **identidad del parámetro**, así
  que devolver un objeto nuevo por CD la haría re-parsear en bucle. Misma URL ⇒ misma referencia.
- Fuente que no carga o no parsea → **degrada a sin texto** + `console.warn` dev con prefijo
  `[ngx-products-3d]`, igual que la correa y el arte del frente. Nunca una excepción.

> **Sergio borró `font.json`** del playground en la misma sesión, así que en la demo **`Ballega.otf`
> pasa a ser la fuente única** y los tres `fontUrl` de la demo se repuntan a ella
> (`badge-demo.component.ts:33,48` y `badge-demo.routes.ts:26`, todos a `/assets/font.json` hoy).
> Un **selector** de fuente en el formulario no tiene sentido con un solo asset: se descarta, y lo
> que garantiza que el camino de typeface JSON no se rompe es el **test N1 de passthrough**, que no
> necesita fichero. Si más adelante se quiere comprobar el JSON a ojo, basta con volver a dejar un
> typeface en `public/assets/` — la lib acepta los dos formatos sin tocar nada.

⚠️ **P21 sigue vigente y esta spec no lo toca**: la extrusión (`height`) funciona solo mientras
`angular-three-soba` importe el `TextGeometry` de **three-stdlib** (el de three 0.182 ya solo lee
`depth`). El test espejo `SOBA_TEXT3D_DEFAULT_HEIGHT` (`badge-texture.component.spec.ts:344`) **se
conserva**: es el que detectaría la rotura silenciosa.

### R3 — Textos abajo-izquierda

En `BADGE_TEXT_LAYOUT` (`badge.config.ts:345-357`) las tres anclas pasan de `u = 0.92` a
**`u = 0.08`** y `align` de `'right'` a **`'left'`**. Las V (`0.24` tier / `0.16` name / `0.08`
memberNumber), los `size`, los `height` y los `maxWidth` **no cambian**.

**`BadgeTextSlot` no cambia de forma**, y `uvAnchorToRtPosition` / `alignOffsetX` / `fitTextScale`
tampoco: el sistema de anclaje de spec-03-F4v2 ya contempla `align: 'left'` (`alignOffsetX` devuelve
`0` en ese caso). Es un cambio de **datos**, no de mecanismo.

Encaje comprobado: con `align: 'left'` el texto ocupa `[anchorX, anchorX + maxWidth]`, y
`anchorX = (0.08 − 0.5) × 1.6 = −0.672`; el slot más ancho da `−0.672 + 0.65 = −0.022`, muy dentro
del `+0.8` del borde derecho.

> ⚠️ **La trampa de la V se mantiene intacta**: `anchor[1] = 0` es el borde **INFERIOR** de la cara,
> al revés que los UV del GLB. No se toca `BADGE_TEXTURE.mapRepeat`/`mapOffset`.

**Cuatro invariantes de `badge.config.spec.ts` codifican hoy «abajo-derecha» y hay que reescribirlos**
(no relajarlos: siguen siendo asserts que fallan si el layout se descoloca):

| Línea | Test | Cambio |
|---|---|---|
| `:139` | `expect(slot.align).toBe('right')` | → `'left'` |
| `:157-165` | `places name and memberNumber at the BOTTOM-RIGHT` | → `BOTTOM-LEFT`, con `u < 0.5` |
| `:176-178` | «misma U = bandera por la derecha» | misma U, pero bandera por la **izquierda** (assert igual, comentario nuevo) |
| `:181-189` | `keeps every slot inside the face even at its full maxWidth` | el rango pasa de `anchorX − maxWidth` a `anchorX + maxWidth` |

Se aprovecha para cerrar **P22** del backlog: hoy ningún test distingue el `maxWidth` **por slot**
del global (`fitTextScale(width, BADGE_TEXT_LAYOUT[0].maxWidth)` deja la suite en verde). Son ~2
líneas en `badge-texture.component.spec.ts:455`.

### R4 — Color base `#111111`

`BADGE_BASE_COLOR` (`badge.config.ts:149`) pasa de `'#000000'` a **`'#111111'`** (= `rgb(17,17,17)`).

- `badge-theme.spec.ts` afirma el literal (`expect(BADGE_BASE_COLOR).toBe('#000000')`) → se
  actualiza. El resto de casos (prioridad `colors.clip > baseColor`, default aplicado) **no cambia**.
- `resolveBaseColor` / `resolveClipColor` (`badge-theme.ts:26-37`) **no cambian de forma**.
- **Los dos temas demo retiran su `baseColor`** (`badge-demo.component.ts`: violet `#3b0764`, ember
  `#7c2d12`) para que lo que se vea en pantalla sea el default nuevo.

  > **Detalle que rompe si se pasa por alto**: hoy
  > `baseColor = signal(DEMO_THEMES[INITIAL_THEME_KEY].baseColor)` (`badge-demo.component.ts:202`).
  > Al quitar el campo del tema ese signal arranca `undefined` y el `<input type="color">` se queda
  > sin valor. Debe inicializarse desde `BADGE_BASE_COLOR`.

- El `color` del `meshPhysicalMaterial` de la tarjeta **sigue sin definirse** (three multiplica
  `map × color` y el map es la RenderTexture). No negociable, igual que en spec-03-F4v2 R2.

### R5 — Correa: `band.png`, `repeat` derivado del aspecto y alfa

**(a) El asset lo aporta Sergio girado a horizontal.** Decisión cerrada: eje largo = longitud de la
correa. **No se añade rotación por código** a la lib — redibujar la textura en un canvas metería
maquinaria solo-navegador en una librería que hoy es SSR-safe, y el arreglo está en el asset.

**(b) `repeat` derivado por fn pura**, evaluada sobre el aspecto **real** de la textura ya cargada:

```
bandLength = 3 rope joints × BADGE_PHYSICS.segmentLength (1)     = 3
bandWidth  = BADGE_BAND.lineWidth × tan(BADGE_CAMERA.fov / 2)    = 1 × tan(12.5°) = 0.22169
tileLength = textureAspect × bandWidth
repeatX    = −(bandLength / tileLength)
```

**La fórmula se valida contra el código actual**: con `aspect = 4` (el `band.jpg` de referencia)
devuelve exactamente el **`3.383`** hardcodeado hoy en `badge.config.ts:100`. Ése es el test N1 de
anclaje, y es lo que demuestra que la derivación no inventa nada.

- `BADGE_BAND.repeat` deja de ser una tupla literal y pasa a **`bandRepeatFor(aspect)`**. Esto cierra
  el ítem de backlog «`BADGE_BAND.repeat` derivado del fov» (hoy `-3.383` precalculado a mano, que
  queda obsoleto en silencio si alguien toca el fov).
- Es **cambio de API pública** (`public-api.ts` hace `export *` de `badge.config`). Ver Versionado.
- El aspecto solo se conoce tras cargar la textura ⇒ **`computed` sobre `bandMap()`**, con fallback
  al aspecto de referencia mientras `useMap` es 0. **NO va en `beforeRender`**: es one-shot por
  textura, no por frame (regla de cero allocations de `docs/architecture.md` §4).
- **El signo negativo se conserva** (inversión de la U, orientación del arte del lanyard, spec-03
  feature 4).
- Aspecto no medible / `0` / `NaN` → fallback al valor de referencia, **nunca `NaN`** (un `NaN` en el
  uniform deja la correa sin textura sin decir por qué).

**(c) Alfa.** `<ngt-mesh-line-material>` (`badge-scene.component.ts:200-209`) gana **`transparent`**.
`MeshLineMaterial` extiende `ShaderMaterial`, así que es la propiedad estándar, y el shader ya
multiplica el alfa del map dentro de `diffuseColor`. `depthTest: false` **se mantiene** (la correa se
dibuja siempre encima, para no clipear con la tarjeta).

**(d) Consecuencia de la tesela — hay que mirarla en la N3.** La fórmula es agnóstica al asset. Con el
`band.png` **vigente** (**725 × 70, aspecto 10.3571**, sustituido por Sergio el 2026-08-06 a las
13:17:48) da:

```
repeat = −(3 / (10.3571 × 0.22169)) = −1.3066
```

**1,31 teselas**: el arte se repite y algo más de un cuarto de tesela vuelve a empezar por el extremo.
Lo que hay que mirar en la N3 ya **no** es si falta tesela, sino si **la costura del tileado canta** y
si el corte del extremo se ve. El arreglo, si hace falta, sigue siendo de **asset**, no de código.

> **Histórico, para no releer mal las notas viejas.** El primer `band.png` entregado era **784 × 49**
> (aspecto 16) y daba `repeat = −0.846`, o sea **menos de una tesela**: se veía ~85 % del arte y se
> cortaba. Ese era el «fleco abierto de la correa» que arrastran `progress/` y las notas previas, y
> **ya no aplica**: el asset de 725 × 70 lo cierra por sí solo. La propuesta de tesela más corta
> (196 × 49) queda igualmente **descartada**.

### R6 — Repuntar `band.jpg` → `band.png`

`band.jpg` sigue **trackeado en git** aunque esté borrado del disco: se cierra con `git rm` +
`git add band.png`. Lo mismo con **`font.json`**, borrado por Sergio y también trackeado (su repunte
a `Ballega.otf` va en T6, pero el `git rm` puede ir aquí). **Prohibido `git checkout --` /
`git restore` / `git stash`** (norma de proceso 1 de `progress/current.md`, salida de un incidente
real que borró trabajo cerrado): esos ficheros se van a propósito, no se restauran.

- **Código vivo**: `badge-demo.component.ts:27,40,42` · `badge-demo.routes.ts:18`
- **Fixtures de tests** (inertes, nunca se descargan): `badge-scene.component.spec.ts:150` ·
  `badge-texture.component.spec.ts:137` · `badge-texture.spec.ts:13` · `badge-theme.spec.ts:7` ·
  `badge.component.spec.ts:90`
- **Aspecto de referencia**: `badge-scene.component.spec.ts:441` (`const textureAspect = 1024 / 256`)
  y el JSDoc de `badge.config.ts:71-100`
- **Docs**: `README.md:30` · `projects/ngx-products-3d/README.md:85,197,256-257,459` ·
  `docs/smoke-test-external.md:61,95`

No hay entrada por asset en `angular.json` (los assets se copian en bloque con `**/*`): nada que
tocar ahí.

## Tareas

1. **T1** — `BADGE_BASE_COLOR` `'#000000'` → `'#111111'` y actualización de la aserción literal de
   `badge-theme.spec.ts`. Tests N1: default aplicado, override por `baseColor`, prioridad
   `colors.clip > baseColor` (los tres ya existen; se comprueba que siguen discriminando).
2. **T2** — `BADGE_TEXT_LAYOUT` a `u = 0.08` / `align: 'left'` + reescritura de los **cuatro**
   invariantes de `badge.config.spec.ts` de la tabla de R3 + cierre de **P22**. Tests N1.
3. **T3** — Fuente OTF: fn pura `isOpentypeFontUrl` + recurso propio con `import()` dinámico de
   `TTFLoader` + `[font]="resolvedFont()"` + warn dev al fallar. Tests N1 de la fn pura y del
   passthrough de una URL JSON.
4. **T4** — Correa: fn pura `bandRepeatFor(aspect)` (anclada al `3.383`) + `computed` sobre
   `bandMap()` + `transparent` en el material. Tests N1.
5. **T5** — Repuntar las referencias de `band.jpg` → `band.png` (código vivo, fixtures, aspecto de
   referencia, docs) + `git rm` del jpg y `git add` del png.
6. **T6** — Playground: repuntar los tres `fontUrl` a `Ballega.otf` (cierra el 404 de `font.json`),
   color picker de color de texto, temas demo sin `baseColor`. **Verificación visual N3 completa.**
7. **T7** — Documentación: README publicado (fuente admite OTF/TTF, textos abajo-izquierda, contrato
   del arte de la correa con el `repeat` derivado y el requisito de alfa), README raíz y ampliación
   de la entrada **0.3.0** del CHANGELOG.

T1–T4 son independientes entre sí. T5 depende de T4 (el aspecto de referencia se toca en los mismos
tests), T6 de T1–T5 y T7 de todas.

## Versionado

Todo se pliega en la **0.3.0**, que sigue **sin publicar** (el registry sirve `0.2.1`; el bump vive
en `feature/blender-assets`). No se crea `0.4.0` ni se toca
`projects/ngx-products-3d/package.json`.

Reparto de los cambios de API pública:

- **Cambio de forma**: `BADGE_BAND.repeat` deja de ser una tupla literal y pasa a
  `bandRepeatFor(aspect)`. Es el único.
- **Ampliación compatible**: `theme.fontUrl` acepta ahora `.otf` / `.ttf` además de typeface JSON.
- **Cambios de valores por defecto** (no de tipos): `BADGE_BASE_COLOR` y `BADGE_TEXT_LAYOUT`.
  `BadgeTextSlot` **no cambia**.

**Consecuencia operativa: no se mergea a `main` hasta cerrar esta spec**, porque el merge dispara la
publicación de la 0.3.0 por CI (`.github/workflows/release-publish.yml`).

## Criterios de aceptación

- [ ] `theme.fontUrl` acepta `Ballega.otf` y los tres textos se renderizan extruidos con esa fuente
- [ ] Una URL de typeface JSON sigue funcionando exactamente igual que antes (passthrough a soba)
- [ ] Una fuente rota degrada a **sin texto** con warn dev, nunca a excepción ni a pantalla en blanco
- [ ] `opentype` entra por `import()` **dinámico**: no aparece en el bundle de quien no use OTF
- [ ] `dist/ngx-products-3d/package.json` **no gana ninguna dependencia** nueva
- [ ] `name`, `memberNumber` y `tier` quedan **abajo-izquierda**, a bandera por la izquierda, sin
      deformar; nombre largo → escala **uniforme** (`scale.x === scale.y === scale.z`)
- [ ] Los cuatro invariantes de layout de `badge.config.spec.ts` reescritos y **discriminantes**
      (fallan si el layout vuelve a la derecha)
- [ ] `BADGE_BASE_COLOR === '#111111'`; el frente muestra ese color donde el arte es transparente
- [ ] Los temas demo ya no fijan `baseColor` y el control de color del playground arranca con valor
- [ ] La correa carga `band.png`: arte **sin comprimir**, **sin fondo negro** en las zonas con alfa
- [ ] `bandRepeatFor(4)` devuelve `−3.383` (ancla contra el valor hardcodeado que sustituye)
- [ ] Aspecto no medible / `0` / `NaN` → fallback, nunca `NaN` en el uniform
- [ ] Ninguna URL de asset apunta a un fichero inexistente; `band.jpg` fuera del índice de git
- [ ] Constantes solo en `badge.config.ts`, derivadas donde aplique; cero literales nuevos en
      componentes
- [ ] N1 (`isOpentypeFontUrl`, `bandRepeatFor`, invariantes de layout, `BADGE_BASE_COLOR`, P22) +
      N3 (checklist visual **con log de consola guardado**) en el informe
- [ ] `pnpm build` + `pnpm ng lint ngx-products-3d` + `pnpm ng test ngx-products-3d` +
      `pnpm ng build products-3d-playground` verdes

## No hacer

- No añadir campos nuevos al tema: la fuente entra por el `fontUrl` que ya existe y el color de
  texto por el `colors.text` que ya existe
- No cambiar la forma de `BadgeTextSlot` ni de `BADGE_TEXT` (esta vez sí se quedan quietos)
- No importar `TTFLoader` de forma **estática** (467 KB de `opentype` a todo consumidor)
- No importar desde `three-stdlib`: no está hoisted al `node_modules` raíz y arrastra el gotcha de
  TS2742 ya documentado en `badge-scene.component.ts:59-72`
- No rotar la textura de la correa por código (canvas, `CanvasTexture`, patch del shader): el asset
  llega girado
- No borrar la inversión de la U de la correa (signo negativo del `repeat`) ni la inversión de la V
  del frente (`BADGE_TEXTURE.mapRepeat`/`mapOffset`)
- No tocar el `color` del `meshPhysicalMaterial` de la tarjeta
- No tocar física, GLB, ni la cámara ortográfica de la escena RT
- No cambiar el default `BADGE_TEXT.color` sin haber visto la N3 (ver R1)
- No escalado no uniforme de textos bajo ninguna circunstancia
- No mergear a `main` mientras la spec esté abierta (publicaría la 0.3.0 a medias)

## A observar en la N3 (no son tareas)

- **Tesela de la correa**: anotar el aspecto medido del `band.png` definitivo y el `repeat` que sale.
  Si el arte se corta (`repeat < 1`), la decisión es de asset, no de código — ver R5(d).
- **Métrica de `Ballega`**: los 176 glifos incluyen acentos y `#`, pero el encaje es visual.
  Comprobar que los textos no se reducen en exceso contra sus `maxWidth`; si pasa, el ajuste va en
  `BADGE_TEXT_LAYOUT`, nunca en el código.
- **Legibilidad y colisión con el arte**: `badge_vitality.png` se diseñó dejando hueco
  **abajo-derecha** (así lo dice el README publicado). Con los textos abajo-izquierda hay que mirar
  si pisan el arte y si el `'black'` por defecto sigue valiendo. Es la decisión de diseño que la
  review de T7 de spec-03-F4v2 dejó abierta.
- **Cambio de fuente en caliente**: sin selector en el formulario (ya no hay segundo asset), se
  comprueba cambiando el `fontUrl` del tema demo a mano y recargando: que no recree el canvas y que
  no haya destello al re-parsear.
- **Canto y dorso de la tarjeta**: siguen fuera de alcance. Anotar qué se ve.

## Assets

En `projects/products-3d-playground/public/assets/`. **Ninguno bloquea: están los dos entregados.**

| Fichero | Estado |
|---|---|
| `Ballega.otf` | ✅ **Entregado** (70 736 B, 176 glifos, parseo verificado de punta a punta) |
| `band.png` | ✅ **Entregado y ya girado** — **revisión vigente: 725 × 70, aspecto ~10.36:1, RGBA** (3 661 B, blob `2cd2b6ad`, 2026-08-06 13:17:48). Da `repeat = −1.3066` (1,31 teselas): el fleco de «menos de una tesela» era de la entrega anterior de 784 × 49 y **ya no aplica** — ver R5(d) |
| `font.json` | ❌ **Borrado por Sergio.** `Ballega.otf` pasa a ser la fuente única de la demo. El camino de typeface JSON queda cubierto por el test N1 de passthrough, no por un asset |

Ficheros que se quedan como estaban: `badge_vitality.png` (arte del frente, 800 × 1125 = 32:45),
`base-wrong-ratio.png` (fixture del warn de ratio) y `membresia.glb`.

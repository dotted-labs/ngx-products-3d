# Changelog

Todas las novedades relevantes de `@dotted-labs/ngx-products-3d`.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Mientras la versión mayor sea `0`, los
**breaking changes viajan en la versión menor** (`0.2.x` → `0.3.0`), nunca en un patch: un rango
`^0.2.1` instalaría un patch automáticamente y rompería builds ajenos sin aviso.

## [0.3.1] — 2026-09-29

> Primera publicación de la línea 0.3: la 0.3.0 no llegó a publicarse en npm. Todo lo que sigue
> aplica al actualizar desde la 0.2.1.

Assets reales del badge (modelo Blender + correa texturizada) en sustitución de los assets demo, y
**rediseño del frente de la tarjeta**: el arte del socio pasa a cubrir la cara frontal exacta
(ratio 32:45, con canal alfa sobre un color base configurable) y los textos se anclan
abajo-izquierda sin deformarse, en lugar de depender del tamaño de la ventana del navegador.
Además: fuentes `.otf`/`.ttf` en el tema, correa con alfa y teselado derivado del aspecto real de su
textura, correa sin parpadeo en la unión con la tarjeta, y un arranque en el que el badge no se
muestra hasta tenerlo todo cargado y entonces cae desde arriba.

### ⚠️ Breaking changes

**1. Cambia el contrato del modelo GLB — el origen pasa a ser el centro de la tarjeta.**

Hasta 0.2.1 la lib esperaba un GLB cuyo **origen fuese el punto de anclaje del clip**, con el nodo
`card` desplazado `y = -1.45` para compensar. Desde 0.3.1 el contrato es el natural: **origen del
GLB = centro de la tarjeta**, nodo `card` en identidad.

Este es el cambio peligroso, porque **no produce ningún error de compilación**: un modelo hecho
contra el contrato de 0.2.x seguirá cargando y renderizará **desplazado 1.45 unidades**. Si tu
tarjeta aparece flotando por encima o por debajo de donde la agarra la correa, es esto.

Contrato vigente (ver § "Contrato del modelo GLB" del README para el detalle completo):

| Nodo    | Transformación | Extensión                                            |
| ------- | -------------- | ---------------------------------------------------- |
| `card`  | identidad      | X[-0.8, 0.8] · Y[-1.125, 1.125] · Z[-0.01, 0.01]     |
| `clip`  | identidad      | Y[0.917, 1.286], cruzando la ranura                  |
| `clamp` | propia         | `rotation` + `scale` + `translation`, hay que aplicarlas todas |

Conjunto real: `Y[-1.125, 1.5642]`, `Z[±0.09]`. Materiales `base` y `metal`. Sin Draco.

**Migración**: reexporta el modelo con el origen en el centro de la tarjeta, o aplica un offset de
`+1.45` en Y a la geometría del GLB antiguo.

**2. `BADGE_CARD_PLACEHOLDER` deja de exportarse.**

Era la constante del plano blanco provisional (tamaño, color y opacidad) que la lib usaba antes de
cargar geometría real. Quedó huérfana en 0.2.0 y nunca estuvo documentada, pero **sí viajaba en el
tarball publicado**, así que su retirada es formalmente breaking.

**Migración**: si la importabas, cópiate los valores (`planeSize: [1.6, 2.25]`, `color: 'white'`,
`opacity: 0.9`). No tiene reemplazo en la lib.

**3. Cambia el contrato del arte del frente: ratio 32:45 y canal alfa.**

Hasta 0.2.1 no había un ratio "correcto" para `baseTextures` / `defaultBaseTextureUrl`: el arte se
pintaba sobre un plano de 5 × 5 unidades encuadrado por una cámara en **perspectiva** cuyo aspecto
seguía al de la **ventana**, sobre un FBO cuadrado de 2000 × 2000. Desde 0.3.1 el arte cubre la cara
frontal exacta de la tarjeta, así que su contrato es:

| Propiedad | Requisito |
| --- | --- |
| Ratio | **32:45 exacto** (1.6 : 2.25 ≈ 0.7111). Único requisito geométrico |
| Tamaño en px | **Libre** (1600 × 2250 es solo la densidad de referencia de 1000 px/unidad; 800 × 1125 vale igual) |
| Canal alfa | Necesario para que se vea el `baseColor` por debajo |
| Formato | **No es requisito**: cualquiera que cargue `TextureLoader` y soporte alfa (WebP, PNG…) |
| Espacio de color | sRGB |
| Orientación | El borde superior de la imagen es el borde superior de la tarjeta |

Este cambio **tampoco da error de compilación**: es un cambio de datos, no de tipos. Un asset de
0.2.x se sigue cargando y el frente se sigue renderizando; simplemente sale **estirado**.

**Migración**: reexporta el arte a 32:45 con alfa. Si el ratio se desvía más de un **1%**, la lib lo
avisa por consola en dev (`ngDevMode`), con la URL, el ratio esperado y el medido — **avisa, no
lanza y no deja de renderizar**, y en un build de producción es muda.

**4. `BadgeTextSlot` cambia de forma y `BADGE_TEXT.maxWidth` desaparece.**

El layout de los textos del socio pasa de posiciones absolutas a **anclajes normalizados**:

| 0.2.1 | 0.3.1 |
| --- | --- |
| `position: [number, number, number]` | `anchor: [number, number]` normalizado (0-1) sobre la cara |
| `rotation: [number, number, number]` | — (eliminado; los textos van planos sobre el frente) |
| — | `align: BadgeTextAlign` (`'left' \| 'right' \| 'center'`) |
| `BADGE_TEXT.maxWidth` global (`3.6`) | `maxWidth` **por slot** |
| — | la z común de la capa vive en `BADGE_TEXTURE.textLayerZ` |

Los valores de `BADGE_TEXT_LAYOUT` también cambian: los tres slots van **abajo-izquierda**,
alineados a la izquierda y con la misma U (`0.08`), con tamaños de fuente acordes al encuadre nuevo
(ver § "Valores por defecto" más abajo). Los valores viejos caen **fuera** del encuadre actual.

**Migración**: si tenías un layout propio, reescríbelo con la forma nueva. **Ojo con la V**:
`anchor[1] = 0` es el borde **INFERIOR** de la tarjeta, al revés que los UV del GLB (donde `v = 0`
es el borde superior). Reutilizar un UV del modelo como `anchor` coloca el texto reflejado en
vertical. Detalle en § "Textos del socio" del README.

**5. `BADGE_TEXTURE.size` → `width` / `height`, y `BADGE_TEXTURE.planeSize` desaparece.**

El FBO de la render texture deja de ser cuadrado: `size: 2000` se sustituye por `width: 1600` y
`height: 2250` (ratio 32:45, el de la cara). `planeSize: [5, 5]` —el tamaño del plano del arte en la
escena de textura— se elimina a favor de `frontPlaneSize`, derivado del rect de la cara.

**Migración**: mecánica y con error de compilación si leías esas claves. `BADGE_TEXTURE.size` →
`BADGE_TEXTURE.width` / `.height`; `BADGE_TEXTURE.planeSize` → `BADGE_TEXTURE.frontPlaneSize`.

**6. `BADGE_BAND.repeat` desaparece: el teselado de la correa lo deriva `bandRepeatFor(aspect)`.**

En 0.2.1 `BADGE_BAND.repeat` era una tupla literal (`[-4, 1]`) calculada para un arte 4:1. Desde
0.3.1 no hay tupla: la lib mide el aspecto (ancho/alto) de la textura de la correa **ya cargada** y
llama a la función pública `bandRepeatFor(aspect)`, que devuelve el `[x, 1]` que mantiene el arte
sin estirar:

```
teselas = longitud de la correa / (aspecto × ancho de la correa)
        = (BADGE_BAND.ropeJoints × BADGE_PHYSICS.segmentLength)
          / (aspecto × BADGE_BAND.lineWidth × tan(BADGE_CAMERA.fov / 2))
```

Con la config por defecto (3 uds de largo, 0.2217 uds de ancho) un arte 4:1 da `-3.383`. El signo
negativo (inversión de la U) se conserva. Un aspecto no medible, `0` o `NaN` cae al del arte de
referencia (`BADGE_BAND.referenceTextureAspect`, 4), nunca a `NaN`. Consecuencias:

- El arte de la correa pasa a tener **aspecto libre**: solo tiene que ser horizontal (eje largo = a
  lo largo de la correa) y tileable en X.
- Un arte muy alargado (aspecto mayor que ≈ 13.5:1 con la config por defecto) da **menos de una
  tesela** y se corta por el extremo. El arreglo es una tesela más corta en el asset.

**Migración**: con error de compilación si leías `BADGE_BAND.repeat`. Sustitúyelo por
`bandRepeatFor(textura.image.width / textura.image.height)` con tu textura, o por
`bandRepeatFor(BADGE_BAND.referenceTextureAspect)` si solo querías el valor de referencia.

### Valores por defecto

Cambios de **valor**, no de tipos: no dan error de compilación. Cambian lo que se ve con la config
por defecto y lo que lees si importas estas constantes para componer tu propia escena.

- **`BADGE_TEXT_LAYOUT`**: `name`, `memberNumber` y `tier` van **abajo-izquierda**
  (`anchor[0] = 0.08`, `align: 'left'`), a bandera por la izquierda, con el `tier` encima. Las V
  (`0.24` tier, `0.16` nombre, `0.08` número), `size`, `height` y `maxWidth` son los del bloque
  de defaults del README (§ "Textos del socio"). Con `align: 'left'` cada texto ocupa `[anchorX, anchorX + maxWidth]`.
- **`BADGE_BASE_COLOR`** (constante nueva, ver "Añadido") vale **`'#111111'`**: es el color que
  asoma por las zonas transparentes del frente y el que tiñe clip y clamp si el tema no define
  `baseColor` ni `colors.clip`.
- **`BADGE_LAYOUT` pasa a ser la pose de REPOSO** del badge, no la de salida: la cadena cuelga
  vertical y tensa del anclaje fijo y la tarjeta cuelga de `j3`. `cardPosition` pasa de
  `[2, 0, 0]` a `[0.5, -0.286, 0]` (= `[0.5, 1 − cardJointAnchor[1], 0]`); el resto de posiciones no
  cambia. La pose de salida es ahora `badgeDropLayout()` (ver "Añadido"), salvo con
  `prefers-reduced-motion: reduce`, que arranca directamente en `BADGE_LAYOUT`. El tipo sigue
  siendo de 5 tuplas (ahora con nombre, `BadgeLayout`).

### Añadido

- `BADGE_CARD_MODEL`, con `groupPosition` — posición del grupo **visual** del GLB dentro del rigid
  body, deliberadamente separada del anclaje **físico** (`BADGE_PHYSICS.cardJointAnchor`). Antes
  ambos conceptos compartían una única constante, que es lo que hacía que el contrato del GLB y el
  de la física quedasen acoplados.
- `BADGE_TEXTURE.mapRepeat` / `mapOffset` — transformada UV del `map` de la tarjeta.
- **`Products3dBadgeTheme.baseColor`** (opcional) — color base del modelo, con default en la
  constante pública `BADGE_BASE_COLOR` (`'#111111'`). No llega igual a todas las piezas: pinta el
  quad de fondo **opaco** del frente (visible por las zonas transparentes del arte) y tiñe el metal
  de **clip y clamp**, donde `colors.clip` sigue siendo el override específico
  (`colors.clip ?? baseColor ?? BADGE_BASE_COLOR`). **Canto y dorso quedan fuera de alcance**:
  comparten material y `map` con el frente. Reparto completo en la tabla del README.
- **`BADGE_FRONT_FACE`** — rect de la cara frontal de la tarjeta (1.6 × 2.25) derivado de
  `BADGE_PHYSICS.cardColliderHalfExtents`. Es la única fuente del ratio 32:45 al que se alinean el
  FBO, el frustum de la cámara de la escena de textura, los quads del fondo y el asset del tema.
- **`BADGE_TEXTURE.cameraFrustum`** — frustum explícito de la cámara ortográfica de la escena de
  textura, derivado de `BADGE_FRONT_FACE`.
- **`BADGE_TEXTURE.frontPlaneSize`**, **`backdropPosition`** y **`artPosition`** — tamaño y
  apilado en z de las dos capas del fondo del frente (quad de `baseColor` → arte del tier).
- **`BADGE_TEXTURE.textLayerZ`** — z común de la capa de textos, por delante del arte.
- **`BADGE_TEXTURE.assetAspect`** y **`assetAspectTolerance`** — ratio exigido al arte del frente
  (derivado de `BADGE_FRONT_FACE`) y desviación relativa máxima antes de avisar (`0.01` = 1%).
- **`BadgeTextAlign`** — tipo del alineado horizontal de un slot de texto
  (`'left' | 'right' | 'center'`).
- **Aviso de dev cuando el arte del frente no respeta el ratio 32:45** (ver breaking 3): un
  `console.warn` con prefijo `[ngx-products-3d]`, la URL, el ratio esperado y el medido. Avisa una
  sola vez por textura resuelta, no lanza, no interrumpe el render y no se emite en producción.
- **`theme.fontUrl` acepta `.otf` y `.ttf` además de typeface JSON** (ampliación compatible: el
  campo no cambia de tipo y un tema de 0.2.1 sigue funcionando igual). El formato se autodetecta por
  la extensión de la ruta, sin distinguir mayúsculas e ignorando `?query` y `#hash`; cualquier otra
  extensión se trata como typeface JSON y se le pasa a soba tal cual, como hasta ahora.
  - La conversión la hace el `TTFLoader` de three, que entra por **`import()` dinámico**: solo lo
    descarga quien use una fuente binaria. No añade dependencias (viene con `three`).
  - El sentido de giro de los contornos se decide por la **cabecera** del fichero (`OTTO` = CFF,
    TrueType en otro caso), no por la extensión: sin ello, los glifos con hueco (`o`, `A`, `D`, `e`…)
    de una fuente CFF salían rotos.
  - WOFF/WOFF2, colecciones `ttcf` o una cabecera desconocida se rechazan. Una fuente binaria que no
    carga o no se puede leer deja el frente **sin textos**, con un aviso dev `[ngx-products-3d]`;
    nunca lanza.
- **`bandRepeatFor(aspect)`** — teselado de la correa a partir del aspecto de su textura (ver
  breaking 6), y en `BADGE_BAND`: **`ropeJoints`** (3, longitud de la correa en segmentos),
  **`referenceTextureAspect`** (4, fallback de `bandRepeatFor`) y **`transparent`** (`true`).
- **Alfa en la correa**: su material declara `transparent`, así que las zonas transparentes del arte
  dejan ver lo que haya detrás. Sin ello los píxeles a alfa 0 de un PNG (RGB 0,0,0) pintaban la
  correa de negro.
- **Arranque con carga y caída.** Mientras carga, del badge no se ve nada y su física está
  congelada: se esperan el WASM de Rapier, el GLB, la textura de la correa, la textura base del
  tier y la fuente (con los textos construidos), y después se precompilan los shaders
  (`WebGLRenderer.compileAsync`). Entonces la cadena y la tarjeta caen desde fuera del viewport por
  arriba, con física real. Un recurso en error cuenta como terminado; si algo sigue sin terminar a
  los `BADGE_LOADING.timeoutMs` (10 s), se suelta con lo que haya y se avisa en dev. Solo pasa al
  arrancar: los cambios posteriores de `theme` o `member` se aplican en sitio. Con
  `prefers-reduced-motion: reduce` no hay caída: el badge aparece ya colgando en `BADGE_LAYOUT`. Vive
  en la escena, así que también funciona en un canvas propio.
- **Output `ready`** (`void`) en `Products3dBadge`, `Products3dBadgeScene` y
  `Products3dBadgeTexture`. En el wrapper y en la escena se emite **una sola vez**, al soltar el badge
  (o al vencer el tope); el wrapper re-emite el de la escena. El de `Products3dBadgeTexture` se emite
  una sola vez, cuando el frente ha terminado de cargar (textura base y textos).
- **`badgeDropLayout(lateralOffset?)`** y **`BadgeLayout`** — pose de salida de la caída, derivada del
  frustum de `BADGE_CAMERA` para que el modelo entero quede por encima del borde superior, y el tipo
  con nombre de las poses. **`BADGE_DROP`** (`lateralOffset`, `frustumMargin`,
  `chainFoldClearance`) y **`BADGE_LOADING`** (`timeoutMs`, `reducedMotionQuery`) son su config.
- **`BADGE_CARD_MODEL.bounds`** — caja envolvente del modelo entero (`card` ∪ `clip` ∪ `clamp`) en el
  sistema local de la tarjeta; la consume `badgeDropLayout()`.
- **`BADGE_CARD_MODEL.bandAttachPoint`** — extremo **visual** de la correa sobre la tarjeta: el centro
  de la ranura superior del `clamp` (`[0, 1.479, 0]`). Distinto del anclaje **físico**
  (`BADGE_PHYSICS.cardJointAnchor`, top del `clip`).
- **`BADGE_LOOP_PRIORITY`** (`input`, `physicsStep`, `band`) — orden fijo dentro de cada frame:
  entrada del puntero → paso de Rapier → correa. El wrapper ya lo aplica; **en un canvas propio**
  hay que pasar `updatePriority: BADGE_LOOP_PRIORITY.physicsStep` en las `[options]` de
  `<ngtr-physics>` (sin ello el orden queda al azar y el extremo de la correa puede temblar).
- **`BADGE_PHYSICS.curveArcLengthDivisions`** — precisión con la que se mide la longitud de arco de la
  curva de la correa antes de remuestrearla.
- **`BADGE_BAND.endCapTolerance`** — tolerancia con la que la correa detecta sus extremos (ver
  "Corregido").

### Corregido

- **El frente del socio salía espejado en vertical.** Las UVs del modelo y la textura que produce
  `NgtsRenderTexture` usan convenciones de V opuestas. Se corrige invirtiendo la V
  (`mapRepeat: [1, -1]`, `mapOffset: [0, 1]`).
- **El teselado de la correa comprimía el arte.** El `[-4, 1]` de 0.2.1 suponía que la correa medía
  `lineWidth` = 1 unidad de ancho, pero mide `lineWidth · tan(fov/2)` = 0.2217 unidades, porque
  meshline aplica `sizeAttenuation`: con el arte 4:1 de referencia el valor correcto es `-3.383`
  (un 18 % menos). Ahora lo calcula `bandRepeatFor` con ese ancho y el aspecto real (breaking 6).
- **La correa parpadeaba en la unión con la tarjeta y no seguía el enganche.** Se construía con la
  pose física cruda de Rapier, que va hasta un paso por delante de la pose interpolada que se pinta,
  y su extremo era el centro del último segmento de la cadena, que se separa del anclaje del joint.
  Ahora se construye con la pose **renderizada**, después del paso físico (`BADGE_LOOP_PRIORITY`), y
  termina en `BADGE_CARD_MODEL.bandAttachPoint` transformado con la pose de la tarjeta, así que va
  pegada a la ranura del `clamp`. La curva se remuestrea por **longitud de arco** (puntos
  equiespaciados), para que la textura no "nade" a lo largo de la correa al moverse la cadena.
- **El extremo de la correa formaba una cuña y parpadeaba.** El vertex shader de `meshline` detecta
  los extremos con `==` exacto entre dos proyecciones que en float32 no salen iguales bit a bit, y
  el extremo cogía una dirección al azar en cada frame. La lib usa ahora un material interno que
  compara con tolerancia (`BADGE_BAND.endCapTolerance`). Si una versión de `meshline` cambia ese
  shader, la lib lo avisa en dev y dibuja la correa sin el parche, sin romperse.
- **En la primera carga la tarjeta aparecía tarde, a mitad de oscilación.** La física arrancaba en
  cuanto resolvía Rapier y el GLB llegaba después, con la tarjeta arrancando de lado
  (`cardPosition: [2, 0, 0]`). Lo resuelve el arranque con carga y caída (ver "Añadido").
- **La estabilización de la cadena se pasaba de largo con frames lentos.** El factor de
  interpolación de los segmentos intermedios podía superar 1 con un `delta` grande; ahora está
  acotado a 1.
- `BADGE_PHYSICS.cardJointAnchor` pasa de `[0, 1.45, 0]` a `[0, 1.286, 0]` (top real del `clip`),
  acorde al contrato nuevo del GLB.
- Documentación del contrato GLB en el README: los valores publicados en 0.2.1 (`Y[-1.12, 1.29]`,
  `Z[-0.12, 0.14]`, "agarre = top del conjunto ≈ 1.29") eran **falsos en los dos ejes**. Se
  midieron aplicando solo la `translation` del nodo `clamp`, ignorando su `rotation` y su `scale`.
- **El frente de la tarjeta se deformaba con la relación de aspecto de la VENTANA** —listado como
  "conocido, no corregido" en el borrador de esta misma versión, y presente desde 0.2.1—. Había
  tres relaciones de aspecto encadenadas y ninguna coincidía: el FBO era cuadrado (2000 × 2000), el
  plano del arte medía 5 × 5, y la cámara de la escena de textura era en **perspectiva**, con su
  `aspect` atado al `size` del canvas (el portal de la render texture no tiene `size` propio y lo
  hereda). Se corrige alineando las tres al 32:45 de la cara: FBO 1600 × 2250, cámara **ortográfica**
  con `manual: true` y frustum explícito derivado de `BADGE_FRONT_FACE`, y quads del tamaño exacto
  del rect frontal. Con ello desaparecen también las **franjas oscuras a los lados** con ventana
  ancha y el estirado de los textos, que eran síntomas del mismo defecto.
- **El alfa del arte del frente se ignoraba.** El plano del arte se pintaba con un material opaco:
  una imagen con transparencias tapaba el frente entero. Ahora va con `transparent: true` sobre un
  quad opaco de `baseColor`, así que las zonas transparentes revelan ese color y no hace falta
  recortar la silueta de la tarjeta en el asset.
- **Los textos del socio salían estirados y arriba-izquierda.** El estirado era el defecto anterior;
  la colocación, un layout de posiciones absolutas calibrado para el encuadre viejo. Ahora se anclan
  abajo-izquierda con `anchor` normalizado y `align`, y un texto que no cabe en su `maxWidth` se
  reduce con escala **uniforme** (nunca comprimido en un solo eje).

### Cambios de aspecto (sin cambio de API)

- **Un tema sin `colors.clip` cambia de aspecto en clip y clamp.** En 0.2.1, sin `colors.clip` el
  metal del GLB se usaba **tal cual**; desde 0.3.1 el clip y el clamp se tiñen siempre con el color
  resuelto `colors.clip ?? baseColor ?? BADGE_BASE_COLOR`, así que un tema que no defina ninguno de
  los dos pasa a mostrarlos **casi negros** (`'#111111'`, el default de `baseColor`) en vez del metal
  crudo. La API no cambia y nada deja de compilar: es solo aspecto. **Si quieres el metal del GLB visible, define
  `baseColor` (o `colors.clip`) con el color que quieras**; no hay valor que signifique "sin tinte".
- El material `metal` del GLB se sigue **clonando** antes de teñir (el original nunca se muta) y el
  clon se libera al cambiar de tema o destruir la escena.
- **El badge ya no aparece al instante**: queda oculto hasta que todo carga y entonces cae desde
  arriba (ver "Añadido"). Con `prefers-reduced-motion: reduce` aparece directamente en reposo.

### Sin cambios

Gravedad, joints, damping, colliders y drag quedan intactos (el único ajuste físico es
`cardJointAnchor`, ver "Corregido"). Los providers no se tocan y los inputs de los componentes
(`Products3dBadge`, `Products3dBadgeScene`, `Products3dBadgeTexture`) tampoco; lo único que ganan es
el output `ready`. En el tema, todos los campos de 0.2.1 conservan su nombre y su tipo: entra
`baseColor` (opcional) y `fontUrl` admite además `.otf`/`.ttf`.

### Conocido, no corregido

**Canto y dorso de la tarjeta.** Comparten material y `map` con el frente, así que muestran lo que
caiga en sus UV: el contrato del asset frontal describe únicamente la cara +Z. Es una decisión de
alcance de esta versión, no un defecto de configuración; corregirlo exigiría tocar el GLB.

**Typeface JSON que no carga.** Un `fontUrl` de typeface JSON lo descarga `NgtsText3D` de soba por
dentro, así que la lib no ve su error: soba lo lanza durante la detección de cambios (sale en
consola como error de Angular, no como aviso `[ngx-products-3d]`), los textos no se construyen y el
arranque solo se suelta al vencer `BADGE_LOADING.timeoutMs`. Con `.otf`/`.ttf` el fallo sí se
detecta: frente sin textos, aviso dev y arranque sin esperar al tope.

## [0.2.1] — 2026-07-21

- Corregido el pipeline de publicación: el workflow sobrescribía el README público completo con el
  README corto de la raíz del repositorio. La 0.2.0 se publicó con la documentación equivocada.

## [0.2.0] — 2026-07-21

- Badge completo: carga de GLB, material físico con clearcoat, correa texturizada, iluminación con
  environment y lightformers, frente dinámico del socio vía render texture, theming y validación de
  tema en dev.
- README público con instalación, peers, quickstart con `@defer`, tabla del tema y contrato del GLB.

## [0.1.1] — 2026-07

- Ajustes de empaquetado.

## [0.1.0] — 2026-07

- Primera publicación: arquitectura de la librería, providers y tokens de configuración.

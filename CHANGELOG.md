# Changelog

Todas las novedades relevantes de `@dotted-labs/ngx-products-3d`.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Mientras la versión mayor sea `0`, los
**breaking changes viajan en la versión menor** (`0.2.x` → `0.3.0`), nunca en un patch: un rango
`^0.2.1` instalaría un patch automáticamente y rompería builds ajenos sin aviso.

## [0.3.0] — 2026-08-01

Assets reales del badge (modelo Blender + correa texturizada) en sustitución de los assets demo, y
**rediseño del frente de la tarjeta**: el arte del socio pasa a cubrir la cara frontal exacta
(ratio 32:45, con canal alfa sobre un color base configurable) y los textos se anclan abajo-derecha
sin deformarse, en lugar de depender del tamaño de la ventana del navegador.

### ⚠️ Breaking changes

**1. Cambia el contrato del modelo GLB — el origen pasa a ser el centro de la tarjeta.**

Hasta 0.2.1 la lib esperaba un GLB cuyo **origen fuese el punto de anclaje del clip**, con el nodo
`card` desplazado `y = -1.45` para compensar. Desde 0.3.0 el contrato es el natural: **origen del
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
seguía al de la **ventana**, sobre un FBO cuadrado de 2000 × 2000. Desde 0.3.0 el arte cubre la cara
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

| 0.2.1 | 0.3.0 |
| --- | --- |
| `position: [number, number, number]` | `anchor: [number, number]` normalizado (0-1) sobre la cara |
| `rotation: [number, number, number]` | — (eliminado; los textos van planos sobre el frente) |
| — | `align: BadgeTextAlign` (`'left' \| 'right' \| 'center'`) |
| `BADGE_TEXT.maxWidth` global (`3.6`) | `maxWidth` **por slot** |
| — | la z común de la capa vive en `BADGE_TEXTURE.textLayerZ` |

Los valores de `BADGE_TEXT_LAYOUT` también cambian (los tres slots van abajo-derecha, alineados a la
derecha, con tamaños de fuente acordes al encuadre nuevo). Los valores viejos caen **fuera** del
encuadre actual.

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

### Añadido

- `BADGE_CARD_MODEL`, con `groupPosition` — posición del grupo **visual** del GLB dentro del rigid
  body, deliberadamente separada del anclaje **físico** (`BADGE_PHYSICS.cardJointAnchor`). Antes
  ambos conceptos compartían una única constante, que es lo que hacía que el contrato del GLB y el
  de la física quedasen acoplados.
- `BADGE_TEXTURE.mapRepeat` / `mapOffset` — transformada UV del `map` de la tarjeta.
- **`Products3dBadgeTheme.baseColor`** (opcional) — color base del modelo, con default en la
  constante pública `BADGE_BASE_COLOR` (`'#000000'`). No llega igual a todas las piezas: pinta el
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

### Corregido

- **El frente del socio salía espejado en vertical.** Las UVs del modelo y la textura que produce
  `NgtsRenderTexture` usan convenciones de V opuestas. Se corrige invirtiendo la V
  (`mapRepeat: [1, -1]`, `mapOffset: [0, 1]`).
- **El teselado de la correa estaba mal por un 18 %.** `BADGE_BAND.repeat` pasa de `[-4, 1]` a
  `[-3.383, 1]`: el ancho real de la correa no es `lineWidth` = 1 sino `lineWidth · tan(fov/2)` =
  0.2217 unidades, porque meshline aplica `sizeAttenuation`. El valor anterior comprimía la espiga.
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
  abajo-derecha con `anchor` normalizado y `align`, y un texto que no cabe en su `maxWidth` se
  reduce con escala **uniforme** (nunca comprimido en un solo eje).

### Cambios de aspecto (sin cambio de API)

- **Un tema sin `colors.clip` cambia de aspecto en clip y clamp.** En 0.2.1, sin `colors.clip` el
  metal del GLB se usaba **tal cual**; desde 0.3.0 el clip y el clamp se tiñen siempre con el color
  resuelto `colors.clip ?? baseColor ?? BADGE_BASE_COLOR`, así que un tema que no defina ninguno de
  los dos pasa a mostrarlos **negros** (el default de `baseColor`) en vez del metal crudo. La API no
  cambia y nada deja de compilar: es solo aspecto. **Si quieres el metal del GLB visible, define
  `baseColor` (o `colors.clip`) con el color que quieras**; no hay valor que signifique "sin tinte".
- El material `metal` del GLB se sigue **clonando** antes de teñir (el original nunca se muta) y el
  clon se libera al cambiar de tema o destruir la escena.

### Sin cambios

Física, joints, drag y estabilización quedan intactos. La API de componentes (`Products3dBadge`,
`Products3dBadgeScene`, `Products3dBadgeTexture`) y los providers no se tocan; en el tema, todos los
campos de 0.2.1 conservan su nombre y significado y lo único que entra es `baseColor` (opcional).

### Conocido, no corregido

**Canto y dorso de la tarjeta.** Comparten material y `map` con el frente, así que muestran lo que
caiga en sus UV: el contrato del asset frontal describe únicamente la cara +Z. Es una decisión de
alcance de esta versión, no un defecto de configuración; corregirlo exigiría tocar el GLB.

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

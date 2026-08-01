# Changelog

Todas las novedades relevantes de `@dotted-labs/ngx-products-3d`.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/). Mientras la versión mayor sea `0`, los
**breaking changes viajan en la versión menor** (`0.2.x` → `0.3.0`), nunca en un patch: un rango
`^0.2.1` instalaría un patch automáticamente y rompería builds ajenos sin aviso.

## [0.3.0] — 2026-08-01

Assets reales del badge (modelo Blender + correa texturizada) en sustitución de los assets demo.

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

### Añadido

- `BADGE_CARD_MODEL`, con `groupPosition` — posición del grupo **visual** del GLB dentro del rigid
  body, deliberadamente separada del anclaje **físico** (`BADGE_PHYSICS.cardJointAnchor`). Antes
  ambos conceptos compartían una única constante, que es lo que hacía que el contrato del GLB y el
  de la física quedasen acoplados.
- `BADGE_TEXTURE.mapRepeat` / `mapOffset` — transformada UV del `map` de la tarjeta.

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

### Sin cambios

Física, joints, drag y estabilización quedan intactos: de esta versión solo cambian valores de
anclaje, materiales y teselado. La API de componentes (`Products3dBadge`, `Products3dBadgeScene`,
`Products3dBadgeTexture`), los providers y el tipo `Products3dBadgeTheme` no se tocan.

### Conocido, no corregido

El frente de la tarjeta se deforma con la relación de aspecto de la **ventana** (el portal de la
render texture hereda el `size` del canvas mientras el FBO es cuadrado), y con ventana ancha el
plano base deja franjas oscuras a los lados. Es preexistente desde 0.2.1 y se aborda por separado.

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

# Informe impl — feature 6 `badge-texture-scene` (spec-03, Fase 4)

- **Fecha**: 2026-07-13
- **Estado**: implementado, verificación automática verde. Pendiente review (no marcado `done`).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge-texture.component.ts` | Implementación completa del stub (cámara propia, plano con textura base, 3 × Text3D data-driven, encaje de nombre largo). |
| `projects/ngx-products-3d/src/lib/badge/badge-texture.ts` | **Nuevo.** Fns puras: `resolveBaseTextureUrl`, `badgeTextFor`, `fitTextScale`. |
| `projects/ngx-products-3d/src/lib/badge/badge-texture.spec.ts` | **Nuevo.** 9 tests N1 de las tres fns puras. |
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts` | `BADGE_TEXTURE` += `cameraPosition` `[0,0,5]` y `planeSize` `[5,5]`; nuevos `BadgeTextField`, `BadgeTextSlot`, `BADGE_TEXT_LAYOUT` (3 slots `{field, position, rotation, size, height}`) y `BADGE_TEXT` (`memberNumberPrefix: '#'`, `maxWidth: 3.6`, `color: 'black'`). Todo con JSDoc. |
| `progress/current.md` | Plan + criterios + log del implementer. |

Sin dependencias nuevas, sin cambios de peers, sin tocar playground ni otras features.

## Decisiones (y desviaciones de la spec, API real gana)

1. **Cámara: `<ngts-perspective-camera>` (soba/cameras) en vez de `<ngt-perspective-camera>` crudo.**
   El brief pedía `ngt-perspective-camera` manual con `makeDefault`, pero el renderer de
   angular-three v4 **no tiene concepto de `makeDefault` en el elemento crudo** (grep en
   `node_modules/angular-three/fesm2022/angular-three.mjs`: cero ocurrencias). `makeDefault` es una
   opción de `NgtsPerspectiveCamera` (`node_modules/angular-three-soba/types/angular-three-soba-cameras.d.ts:261`),
   que registra la cámara como default del store inyectado (el del portal del RenderTexture cuando
   la feature 7 monte este componente dentro). → `[options]="{ makeDefault: true, position: BADGE_TEXTURE.cameraPosition }"`.
   **Actualizar la spec/brief con esta discrepancia.**
2. **Encaje de nombre largo: bbox manual, NO `ngts-center`.** `NgtsResize` no existe en soba v4
   (spike S3). Se descartó `ngts-center`+evento `centered` porque su effect solo trackea los
   hijos directos del grupo interno: el attach de la `TextGeometry` (async, cuando resuelve la
   fuente) **no** re-dispararía el cálculo (emitiría width de geometría vacía y no volvería a
   medir). En su lugar: effect que trackea `getInstanceState(mesh)?.nonObjects()` (API pública de
   `angular-three`; mismo mecanismo interno que usa `NgtsCenter`) → se re-ejecuta cuando la
   TextGeometry se attachea/recrea (font resuelta, cambio de member/theme) → `computeBoundingBox()`
   local + `mesh.scale.setScalar(fitTextScale(width, BADGE_TEXT.maxWidth))`. El cálculo del factor
   es fn pura testeada (clamp ≤1: nunca agranda; ancho no medible → 1). Se aplica a los 3 slots
   (los cortos quedan a escala 1 por el clamp); cero trabajo por frame (no va en `beforeRender`).
3. **Material de los textos: `ngt-mesh-basic-material` (unlit).** La escena del RenderTexture es
   una escena aparte sin luces; un material lit (standard) pintaría negro siempre. El texto es
   gráfico plano sobre la tarjeta → unlit con `theme.colors?.text ?? BADGE_TEXT.color`.
4. **`BADGE_TEXT_LAYOUT` como `BadgeTextSlot[]`** (interface exportada con tuplas mutables), mismo
   criterio que `BadgeLightformerOptions`: los `options` de `NgtsText3D` no admiten tuplas
   `readonly`, y la interface exportada evita TS4029 en los `.d.ts`. Reordenar/añadir slots no toca
   el componente (template = `@for` sobre `textSlots()`). Slots con z=0.01 para no z-fightear con
   el plano (documentado en JSDoc, no hay números en el componente).
5. **Patrón endurecido de recursos** replicado de badge-scene: `baseMap()` =
   `resourceValueOrUndefined(baseTexture)` (gate `hasValue()`, no lanza con URL rota), plano dentro
   de `@if (baseMap())` (sin flash sin cargar), `colorSpace = SRGBColorSpace` mutado en `effect`
   post-resolución, warn dev (`ngDevMode`) al entrar el recurso en `error`. Sin cast del
   `ResourceRef`: el tipo resuelto es `Texture` de three (el gotcha three-stdlib no aplica aquí,
   confirmado compilando).
6. Formateo por slot extraído a fn pura `badgeTextFor` (nombre verbatim, `#`+número, tier
   UPPERCASE) — testeada; el computed `textSlots()` solo compone config + member.

## Criterios de aceptación

- [x] Cámara propia + plano con textura base por tier (fallback default) + 3 textos con `theme().fontUrl` — implementado; montaje visual real llega con la feature 7 (ver abajo).
- [x] Layout data-driven desde `BADGE_TEXT_LAYOUT` (cambiar el array reordena sin tocar el componente).
- [x] Fallback de tier testeado (fn pura: tier conocido, desconocido y vacío → default).
- [x] Nombre largo se escala a ancho máximo (fn pura `fitTextScale` testeada: reduce >maxWidth, nunca agranda, ancho no medible → 1).
- [x] `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ (all files pass) · `pnpm ng test ngx-products-3d` ✅ **68/68** (59 previos + 9 nuevos).
- [x] Extra N2: `pnpm ng build products-3d-playground` ✅ (integración API pública, sin tocar su código).

## Verificación manual pendiente (N3)

El componente aún no se monta en ningún sitio (lo monta la feature 7 dentro del
`NgtsRenderTexture`). La comprobación visual (plano sRGB, posiciones/tamaños de los slots,
escalado del nombre largo en pantalla, fallback de tier visible) queda para el checklist N3 de las
features 7/9; los valores de `BADGE_TEXT_LAYOUT`/`planeSize` son de arranque y se ajustarán ahí.

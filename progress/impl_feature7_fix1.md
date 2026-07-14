# Informe fix 1 — feature 7 `badge-rendertexture-map` (corrección post-review, N3 1-3)

- **Fecha**: 2026-07-14
- **Contexto**: la checklist N3 de `progress/review_feature7.md` falló en sus puntos 1-3
  (captura del usuario: frente de la tarjeta completamente negro, correa blanca lisa).
  Clip/clamp y física OK.
- **Estado**: corregido, verificación automática verde. Checklist N3 lista para repetir.

## Diagnóstico verificado (no asumido)

Causa raíz ÚNICA: **URLs de assets con extensión equivocada en el playground**.

1. **Assets reales** (`projects/products-3d-playground/public/assets/`): `band.png`,
   `base-gold.png`, `base-silver.png`, `base-default.png` — verificado con `file`: PNGs
   válidos (256×256 RGB las bases, 512×64 la correa). No existe ningún `.jpg`.
2. **El demo pisaba al provider**: `badge-demo.routes.ts:14-22` provee el tema correcto
   (`.png`), pero `badge-demo.component.ts` pasaba `[theme]` con URLs `.jpg`, y
   `resolvedTheme = this.theme() ?? this.themeFromToken` (`badge.component.ts:105-112`)
   es un **override total, sin merge** → ganaban las `.jpg` → 404 en las 4 texturas.
3. **Cadena del frente negro** (comportamiento correcto de la lib, no defecto):
   `textureResource(baseTextureUrl)` → error → `baseMap()` = undefined
   (`resourceValueOrUndefined`, no lanza) → el `@if` de `badge-texture.component.ts:47`
   no monta el plano de fondo → el FBO del RenderTexture solo tiene el clear color
   (negro) → frente negro. Los 3 Text3D sí se montaban, pero con el color fallback
   `BADGE_TEXT.color: 'black'` son invisibles sobre FBO negro. El warn dev del effect de
   error se emitía (diseño de feature 6, aprobado).
4. **Correa blanca**: mismo 404 con `band.jpg` → gate de la textura de la correa → material
   en color plano de fallback.

## Descartes (punto 3 del mandato: ¿algo más impide N3 1-3?)

Comprobado con Node/scripts, sin navegador — **no hay más defectos**:

- `font.json`: typeface Helvetiker válida (keys `glyphs`/`resolution`/`boundingBox`…),
  208 glifos, cobertura completa de los textos demo "Sergio", "#0042", "GOLD" (0 missing).
- PNGs decodificados (zlib + unfilter): `base-gold.png` RGB medio (190,152,44) = dorado →
  el texto negro fallback es visible encima (N3.1 OK con contraste); `base-silver`
  (188,190,198), `base-default` (148,148,156), `band` (80,79,236). Ningún asset corrupto.
- sRGB: el effect de `badge-texture.component.ts` ya muta `colorSpace` al resolver (N3.3).
- Encuadre: cámara de la escena de textura a z=5 con fov default de three (50) → altura
  visible ≈4.66 < planeSize 5 → el plano cubre el frame (sin bordes negros).
- Fallback tier desconocido (N3.2): `base-default.png` existe y es válido.
- **Nada que corregir en la lib**: los gates no-lanzantes hicieron exactamente lo diseñado
  ante el 404. Sin cambios en decisiones aprobadas (frames: Infinity, anisotropy en
  options, gates intactos).

## Cambios

| Archivo | Cambio |
|---|---|
| `projects/products-3d-playground/src/app/badge-demo/badge-demo.component.ts` | URLs del signal `theme` corregidas de `.jpg` → `.png` (band, base-gold, base-silver, base-default). + Comentario avisando de que este input pisa por completo al provider de la ruta (sin merge), para que no vuelva a divergir. Playground: fuera de la lib, perímetro permitido. |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` | Minors de review_feature7.md §Menores 1: título del test de la línea 296 acortado (<=100 cols, la coletilla "config, no magic numbers" pasa al comentario) y comentario de la 300 reflowed a <=100 cols. Sin cambios de lógica ni de aserciones. |

Sin dependencias nuevas, sin tocar config/decisiones de la lib, sin tocar otras features.

## Verificación

| Comando | Resultado |
|---|---|
| `pnpm build` | OK (3.6s) |
| `pnpm ng lint ngx-products-3d` | OK — All files pass linting |
| `pnpm ng test ngx-products-3d` | OK — 8 files, **69/69 passed** |
| `pnpm ng build products-3d-playground` | OK (10.0s) |

## Checklist N3 para repetir (usuario, `pnpm ng serve products-3d-playground`)

- [ ] 1. El frente de la tarjeta muestra la textura base `gold` (dorada) + "Sergio" /
  "#0042" / "GOLD" en negro (CA1 visual). La correa muestra `band.png` (azul), no blanco.
- [ ] 2. Cambiar el signal `member` (devtools o editando `badge-demo.component.ts`)
  actualiza el frente en vivo sin recrear el canvas; tier desconocido → `base-default`
  (gris) visible (CA2 + fallback).
- [ ] 3. Nombre largo se encaja al ancho máximo; colorSpace sRGB correcto (sin lavado).
- [ ] 4. 60 fps estables con drag (coste del FBO 2000² por frame asumido; si no, bajar
  `BADGE_TEXTURE.size` o revisar `samples`).

Si pasa → el leader cierra la feature 7 anotando el resultado (la review no exige nueva
pasada). Ajuste fino visual de layout → feature 9.

# Review — spec-03 feature 6 `badge-texture-scene`

**Veredicto:** APPROVED

- **Fecha**: 2026-07-13
- **Revisor**: reviewer (subagente)
- **Informe revisado**: `progress/impl_feature6.md`
- **Perímetro**: coincide con lo declarado. `git status`/`git diff` muestran exactamente:
  `badge-texture.component.ts` (impl del stub), `badge-texture.ts` (nuevo),
  `badge-texture.spec.ts` (nuevo), `badge.config.ts` (BADGE_TEXTURE+, BADGE_TEXT,
  BADGE_TEXT_LAYOUT, BadgeTextField/BadgeTextSlot), más `feature_list.json`
  (solo `pending`→`in_progress`, correcto: no marcado done) y `progress/*`.
  Sin archivos tocados no declarados. Sin ampliación de alcance.

## Criterios de aceptación (feature_list.json id 6)

- CA1 (cámara propia + plano con textura base por tier con fallback + 3 textos con
  fuente del tema): [x]
  - Cámara: `<ngts-perspective-camera [options]="cameraOptions">` con
    `makeDefault: true` y `position` desde `BADGE_TEXTURE.cameraPosition` ([0,0,5]).
  - Plano: `textureResource(baseTextureUrl)` gateado con `baseMap()`
    (`resourceValueOrUndefined`, no lanza); `baseTextureUrl` = fn pura
    `resolveBaseTextureUrl` (tier → fallback `defaultBaseTextureUrl`).
  - Textos: 3 × `ngts-text-3d` con `[font]="theme().fontUrl"`; textos formateados por
    `badgeTextFor` (name verbatim, `#`+memberNumber con prefijo config, tier UPPERCASE);
    color `theme().colors?.text ?? BADGE_TEXT.color` (contrato `colors?.text` verificado
    en `types.ts:30`).
- CA2 (layout data-driven desde BADGE_TEXT_LAYOUT): [x]
  Template = `@for` sobre `textSlots()` (computed que mapea `BADGE_TEXT_LAYOUT`);
  reordenar/añadir slots no toca el componente. Posiciones/rotaciones/size/height
  solo en config.
- CA3 (fallback de tier testeado como fn pura): [x]
  `badge-texture.spec.ts`: tier conocido (gold/silver), desconocido (platinum) y vacío
  → `defaultBaseTextureUrl`. Camino feliz + fallback (N1 conforme a verification.md).
- CA4 (nombre largo escala a ancho máximo): [x]
  `fitTextScale` (fn pura) testeada: reduce >maxWidth (7.2→0.5, producto ≤ maxWidth),
  clamp a ≤1 (no agranda cortos), ancho no medible (±Inf/NaN/0/negativo) → 1.
  Aplicación: effect reactivo a `getInstanceState(mesh)?.nonObjects()` (attach async de
  la TextGeometry) + `computeBoundingBox()` + `scale.setScalar` — fuera del game loop,
  cero trabajo por frame.
- CA5 (`pnpm build` sin errores): [x] — ejecutado por el reviewer, verde (3.0s).
- CA6 (`pnpm ng lint ngx-products-3d` sin errores): [x] — "All files pass linting."
- CA7 (`pnpm ng test ngx-products-3d` > 0 tests y todos verdes): [x] —
  **68/68 passed (8 files)**, incluye los 9 nuevos de `badge-texture.spec.ts`.

Extra N2 (no exigido por la feature, ejecutado igualmente):
- `pnpm ng build products-3d-playground` ✅ (integración API pública).
- Dist: `dist/ngx-products-3d/fesm2022/dotted-labs-ngx-products-3d.mjs` presente;
  `package.json` del dist: deps = solo `tslib`; peers correctos
  (@angular/*, angular-three*, rapier, three, meshline, ngxtension). Sin deps fantasma.

## Docs

- architecture.md: [x]
  - §2 config data-driven: cero números/URLs mágicos en el componente (cameraPosition,
    planeSize, prefijo, maxWidth, color fallback, layout → todo en `badge.config.ts`
    con JSDoc; `as const` donde los inputs de soba lo permiten, desviación de tupla
    mutable documentada con el mismo criterio ya aceptado de `BadgeLightformerOptions`).
  - §3 signals/OnPush/zoneless: `input.required`, `computed`, `effect`,
    `viewChildren` signal query, OnPush. Sin Zone/`@Input()`/`ngOnChanges`/RxJS.
  - §4 cero allocations por frame: no hay `beforeRender`; el encaje de texto es un
    effect one-shot por attach de geometría.
  - §6 SSR: no toca window/document; se monta dentro del canvas anfitrión (guard vive
    en `badge.component`).
  - §7 API real gana: desviación cámara (soba `NgtsPerspectiveCamera.makeDefault` en vez
    de `ngt-perspective-camera` crudo) **verificada por el reviewer en node_modules**:
    `angular-three-soba/types/angular-three-soba-cameras.d.ts:261` (`makeDefault?: boolean`)
    y 0 ocurrencias de `makeDefault` en `angular-three/fesm2022`. Desviación documentada
    en informe y en comentario del template. También verificados: `getInstanceState`
    (angular-three.d.ts:933, API pública) y `nonObjects` como Signal (:549);
    `NgtsText3D.meshRef` (abstractions.d.ts:825).
  - Boundaries: playground no tocado; sin deps nuevas.
- conventions.md: [x] (con 1 minor de formato, ver abajo)
  - Nombres, orden de componente (inputs→queries→estado→computed→constructor), JSDoc en
    exports públicos nuevos (`BadgeTextField`, `BadgeTextSlot`, `BADGE_TEXT_LAYOUT`,
    `BADGE_TEXT`, fns puras), `ngDevMode` guard como único console, prefijo
    `[ngx-products-3d]` en el warn, comentarios solo de "por qué" (workarounds de API
    documentados: makeDefault, NgtsResize inexistente, unlit sin luces, z-fighting).
- verification.md N1: [x] — 9 tests de fns puras, camino feliz + fallback/error en las
  tres; nombres descriptivos; aportan cobertura real (URLs resueltas, formatos exactos,
  clamps con valores concretos). Ningún `toBeTruthy` vacío.
- verification.md N2: [x] — ejecutado íntegro por el reviewer (ver CA5–CA7 + dist).
- verification.md N3: [x] con condición — el componente aún no se monta en ningún sitio
  (lo monta la feature 7 dentro del RenderTexture): no existe superficie visual que
  verificar hoy, y el informe lo declara explícitamente en vez de fingir checklist.
  Coherente con verification.md (el checklist de ejemplo "spec-03 F4" describe conducta
  que requiere la feature 7). **Condición de cierre de fase**: la checklist N3 de Fase 4
  (member reactivo, tier desconocido → textura default visible, encaje del nombre largo
  en pantalla, sRGB) es OBLIGATORIA en la review de la feature 7/9; la Fase 4 no puede
  cerrarse sin ella.

## Hallazgos

### Bloqueantes

Ninguno.

### Menores (no bloquean; arreglar de paso en feature 7)

1. `badge-texture.component.ts:13` — línea de import de 103 caracteres (> 100 de
   conventions.md "Formato"; Prettier del monorepo la partiría). Lint pasa (el workspace
   no tiene Prettier instalado ni check automatizado), por eso no bloquea.
2. `badge-texture.component.ts:41` (comentario del template) — referencia a
   "baseTextureErrorEffect", nombre que no existe (los effects son anónimos en el
   constructor). Drift trivial de documentación.
3. Preexistente (no de esta feature): `badge.config.ts` tiene finales de línea CRLF;
   prettier --check lo marca entero solo por eso.

## Salida de verificación (ejecutada por el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm build` | ✅ Built @dotted-labs/ngx-products-3d (partial compilation, 3013ms) |
| `pnpm ng lint ngx-products-3d` | ✅ All files pass linting |
| `pnpm ng test ngx-products-3d` | ✅ Test Files 8 passed (8) · Tests **68 passed (68)** |
| `pnpm ng build products-3d-playground` | ✅ bundle completo (8.8s) |
| dist fesm2022 + package.json | ✅ entry point presente; deps solo tslib; peers correctos |

## Conclusión

APPROVED. La feature 6 puede marcarse `done` (lo hace el leader, no este reviewer).
Los 3 menores pueden corregirse junto a la feature 7, que además DEBE aportar la
checklist N3 de Fase 4 antes de cerrar la fase.

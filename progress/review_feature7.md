# Review — spec-03 feature 7 `badge-rendertexture-map` (Fase 4)

**Veredicto:** APROBADA CON CONDICIONES

- **Fecha**: 2026-07-14
- **Revisor**: reviewer (subagente)
- **Informe revisado**: `progress/impl_feature7.md`
- **Perímetro**: delta de la feature 7 sobre el working tree con la feature 6 sin
  commitear (ya aprobada en `progress/review_feature6.md`). `git status`/`git diff`
  coinciden con la tabla "Archivos tocados" del informe: `badge-scene.component.ts`,
  `badge.config.ts` (delta: `BADGE_TEXTURE.frames` + JSDoc de `BADGE_MAP_ANISOTROPY`),
  `badge-scene.component.spec.ts`, `badge-texture.component.ts` (solo minors/doc-drift,
  sin cambios de lógica), `feature_list.json` (7 pasa a `in_progress`, NO `done`:
  correcto) y `progress/*`. Sin archivos tocados no declarados. Sin ampliación de
  alcance (playground no tocado; sin deps nuevas — dist: deps = solo tslib, peers
  correctos).

## Criterios de aceptación (feature_list.json id 7)

- CA1 (tarjeta muestra textura dinámica como map del material físico): [x] estructural /
  [~] visual pendiente de N3.
  `<ngts-render-texture attach="map">` hijo del `<ngt-mesh-physical-material>` de la
  tarjeta, con `<ng-template renderTextureContent>` envolviendo
  `<products-3d-badge-texture [member] [theme]>` (badge-scene.component.ts:159-163).
  Firma verificada por el reviewer en node_modules: tupla `NgtsRenderTexture`
  (`angular-three-soba/types/angular-three-soba-staging.d.ts:2169`), directiva
  `ng-template[renderTextureContent]` (fesm `staging.mjs:3206-3210`), input `attach`
  con default `map` (`:3238`). No existe `cameraContent`: la cámara la registra
  `Products3dBadgeTexture` con `makeDefault` en el store del portal (feature 6, ya
  aprobado). Confirmación visual → checklist N3 (abajo).
- CA2 (member/theme reactivos sin recrear canvas): [x] estructural / [~] visual
  pendiente de N3.
  Cadena de signals verificada: playground (`badge-demo.component.ts`, signals) →
  `Products3dBadge` (`badge.component.ts:58`) → `Products3dBadgeScene` → template del
  RenderTexture lee `member()`/`theme()`. El único `@if` que envuelve `<ngt-canvas>` es
  `isBrowser` (estático): nada re-monta el canvas al cambiar inputs. Con `frames`
  continuo, cada cambio se vuelca al FBO en el frame siguiente.
- CA3 (size desde BADGE_TEXTURE; frames:1 o coste por-frame documentado): [x]
  `renderTextureOptions` 100% config-driven (`width/height = BADGE_TEXTURE.size`,
  `frames = BADGE_TEXTURE.frames`, `anisotropy = BADGE_MAP_ANISOTROPY`); cero números
  mágicos en componentes (grep del delta limpio). Ruta "coste por-frame documentado" de
  la acceptance: JSDoc de `BADGE_TEXTURE.frames` (badge.config.ts:80-92) + comentario de
  template + informe. Evidencia verificada (ver "Discrepancias verificadas").
- CA4 (`pnpm build`): [x] — ejecutado por el reviewer, verde (3.0s).
- CA5 (`pnpm ng lint ngx-products-3d`): [x] — "All files pass linting."
- CA6 (`pnpm ng test ngx-products-3d` > 0 tests, todos verdes): [x] —
  **69/69 passed (8 files)**, incluye el nuevo test de derivación de options.

Extra N2: `pnpm ng build products-3d-playground` OK (12.3s);
`dist/ngx-products-3d/fesm2022/dotted-labs-ngx-products-3d.mjs` presente; package.json
del dist: deps = solo `tslib`, `sideEffects: false`, peers sin deps fantasma.

## Discrepancias spec-API verificadas en node_modules (architecture.md §7)

1. **`frames: Infinity` en vez del `frames: 1` preferente de la spec/feature — CORRECTO
   y obligado por la API real.** Verificado en
   `angular-three-soba/fesm2022/angular-three-soba-staging.mjs:3132-3159`
   (`NgtsRenderTextureContainer`): `count` es variable de cierre del `effect` y solo se
   resetea cuando el effect se re-ejecuta; el effect trackea únicamente
   `this.renderPriority()` y `this.store()` (línea 3133). `fbo()`/`frames()` se leen
   dentro del callback de `internal.subscribe` (no tracked). El montaje async del
   contenido (textura base, fuente del Text3D) y los cambios de `member`/`theme` no
   tocan ese effect → con `frames: 1` el único render (count < 1*1) se pintaría antes de
   que exista el contenido: frente en blanco congelado y sin reactividad. No hay API
   pública de invalidación del contador. `frames: Infinity` es además el default de soba
   (`defaultOptions`, `staging.mjs:3176`; d.ts:2051-2055). La acceptance permite esta
   ruta con coste documentado: cumplido (JSDoc en config con referencia al fesm).
2. **Eliminación del binding `[mapAnisotropy]` del material y traslado a options —
   CORRECTO.** Verificado en `angular-three/fesm2022/angular-three.mjs:928-946`
   (`resolveInstanceKey`): solo hace "pierce" de claves con punto; `mapAnisotropy` se
   asignaría como propiedad inexistente de `MeshPhysicalMaterial` (no-op; la notación
   `map-anisotropy` de R3F no existe en angular-three v4). Cableado real verificado:
   `NgtsRenderTextureImpl.parameters = omit(options, [claves de FBO/loop])`
   (`staging.mjs:3241-3252` — `anisotropy` NO está en la lista de omit al ser propiedad
   de `ngt-texture` vía la extensión de `NgtsRenderTextureOptions`, d.ts:2009) y se
   aplica en `<ngt-primitive *args="[fbo.texture]" [attach]="attach()"
   [parameters]="parameters()">` (`staging.mjs:3331`) → `fbo.texture.anisotropy = 16`.
   JSDoc de `BADGE_MAP_ANISOTROPY` actualizado en consecuencia. Ambas discrepancias
   documentadas en informe y código: conforme a architecture.md §7.

## Docs

- architecture.md: [x]
  - §2 config data-driven: `renderTextureOptions` íntegro desde `BADGE_TEXTURE` y
    `BADGE_MAP_ANISOTROPY`; sin URLs ni números mágicos en el delta.
  - §3 signals/OnPush: sin cambios de patrón; el delta solo añade template + campo
    constante. Sin Zone/RxJS/decorador Input.
  - §4 cero allocations por frame: el delta no añade `beforeRender` ni código por frame
    propio (el coste por frame es el render del FBO de soba, documentado y permitido por
    la acceptance).
  - §6 SSR: sin accesos a window/document (el stub de canvas del spec es solo test env,
    no código de lib).
  - §7 API real gana: las 2 desviaciones verificadas y documentadas (ver arriba).
  - Boundaries: playground intacto, import de lib solo por path público.
- conventions.md: [x] con 1 minor de formato (abajo).
- verification.md N1: [x] — nuevo test
  `derives the render texture options from BADGE_TEXTURE and BADGE_MAP_ANISOTROPY`
  compara con `toEqual` contra las constantes de config (width/height/frames/anisotropy):
  cubre exactamente la derivación config→options, nombre descriptivo, sin `toBeTruthy`
  vacío. (No hay lógica pura nueva con ramas de error en esta feature; el fallback de
  tier ya quedó testeado en la 6.)
- verification.md N2: [x] — ejecutado íntegro por el reviewer (tabla abajo).
- verification.md N3: [~] CONDICIÓN — ver sección siguiente.

## Condición: checklist N3 pendiente de smoke visual del usuario

Todo lo automatizable está verificado (builds, wiring por inspección de código,
evidencia en node_modules). Lo que exige navegador NO se da por aprobado en silencio:
la Fase 4 no puede cerrarse hasta que el usuario ejecute
`pnpm ng serve products-3d-playground` y marque:

- [x] 1. El frente de la tarjeta muestra la textura base `gold` + "Sergio" / "#0042" /
  "GOLD" (CA1 visual).
- [x] 2. Cambiar el signal `member` (devtools o editando `badge-demo.component.ts`)
  actualiza el frente en vivo sin recrear el canvas; tier desconocido → textura default
  visible (CA2 visual + fallback).
- [x] 3. Nombre largo se encaja al ancho máximo; colorSpace sRGB correcto (sin lavado).
- [x] 4. 60 fps estables con drag (coste del FBO 2000x2000 por frame asumido; si no,
  bajar `BADGE_TEXTURE.size` o revisar `samples`).

**Resultado N3 (usuario, 2026-07-14): LOS 4 PUNTOS PASAN.** Requirió una corrección
previa fuera de la lib: la primera ejecución falló en los puntos 1-3 por URLs `.jpg`
inexistentes en el `[theme]` del demo del playground (pisaban al provider `.png` de la
ruta; ver `progress/impl_feature7_fix1.md`). Corregidas → checklist repetida y superada.
Condición satisfecha → la feature 7 se cierra `done` (esta review no exige nueva pasada).
Nota del usuario para el futuro: diseñar el tema con assets mucho más potentes que los
PNGs demo actuales (seguimiento para features 9/10 y assets de producción).

Resultado → anotar en `progress/impl_feature7.md` (o en este archivo) antes de marcar
la feature `done`. Ajuste fino visual de layout → feature 9 (ya previsto).

## Minors de review_feature6.md (mandato "arreglar en la 7")

- Minor 1 (import >100 chars, badge-texture.component.ts:13): [x] partido en multilínea.
- Minor 2 (referencia "baseTextureErrorEffect"): [x] el texto actual ya dice "el effect
  de error del constructor"; nada pendiente.
- Minor 3 (CRLF en badge.config.ts): no tocado, decisión razonable (normalizar EOLs
  excede el perímetro y ensuciaría el diff). Sigue como housekeeping.

## Hallazgos

### Bloqueantes

Ninguno (la condición N3 no es un defecto del código: es verificación pendiente que
requiere navegador humano).

### Menores (no bloquean)

1. `badge-scene.component.spec.ts:296` (título del test nuevo, 120 chars) y `:300`
   (comentario, 102 chars) superan las 100 columnas de conventions.md "Formato". Misma
   categoría que el minor 1 de la review de la 6 (lint pasa; el workspace no tiene
   Prettier automatizado). Arreglar de paso en la siguiente feature.
2. Duplicación del stub `vi.hoisted` de canvas 2D entre `badge.component.spec.ts` y
   `badge-scene.component.spec.ts`. El propio implementer lo señala y propone
   `setupFiles` compartido de vitest: housekeeping para el leader, fuera del perímetro
   de esta feature. Correcto no haberlo hecho aquí.
3. Preexistentes fuera del perímetro (no de esta feature): líneas >100 chars en
   `badge-texture.component.ts:138` (warn de feature 6) y en zonas committeadas de
   `badge-scene.component.ts` y `badge.config.ts`.

## Salida de verificación (ejecutada por el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm build` | OK — Built @dotted-labs/ngx-products-3d (3040ms) |
| `pnpm ng lint ngx-products-3d` | OK — All files pass linting |
| `pnpm ng test ngx-products-3d` | OK — Test Files 8 passed (8) · Tests **69 passed (69)** |
| `pnpm ng build products-3d-playground` | OK — bundle completo (12.3s) |
| dist fesm2022 + package.json | OK — entry point presente; deps solo tslib; peers correctos; sideEffects false |

## Conclusión

APROBADA CON CONDICIONES: todo lo automatizable está verde y las dos desviaciones de
API están verificadas en node_modules y correctamente documentadas. La feature 7 NO
debe marcarse `done` hasta que la checklist N3 de arriba se ejecute en navegador y se
anote (los 4 puntos, especialmente reactividad de `member` y fallback de tier). Si la
checklist pasa, no hace falta nueva review: el leader puede cerrar la feature anotando
el resultado.

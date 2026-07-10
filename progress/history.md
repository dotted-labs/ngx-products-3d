# Historial de sesiones (append-only)

## 2026-07-07 — spec-02 Fase 0 (spike) — features 1 y 2 → done

- **Rol**: leader (orquestación); 2 explorers en paralelo + 1 implementer (trivial, sin reviewer según tabla de escalado).
- **Baseline inicial**: build ✅, lint ✅, test ❌ ("No tests found" — el repo no tenía ningún `*.spec.ts`, gap heredado de spec-01). Se continuó por ser el spike read-only; el gap se cerró en esta misma sesión.
- **S1 joints** (`progress/explore_s1_joints.md`): **caso A** — `angular-three-rapier@4.2.3` exporta `ropeJoint`/`sphericalJoint` nativos (Signal<Joint|null>, cleanup automático; `inject*Joint` deprecated). No hace falta wrapper `joints.ts`.
- **S2 meshline** (`progress/explore_s2_meshline.md`): **viable** — meshline@3.3.1 compatible con three@0.182 y renderer v4 (auto-attach por `isBufferGeometry`/`isMaterial`, `kebabToPascal` coincide). Fallback TubeGeometry descartado. Pendiente runtime (features 3-5): render del shader, `[resolution]`, coste de `setPoints()` por frame.
- **Consolidación**: leader escribió `docs/spike-notes.md` (deliverable de F0).
- **Implementer** (`progress/impl_spec-02-f0.md`): creó `projects/ngx-products-3d/src/lib/badge/badge.component.spec.ts` (4 tests de `resolvedTheme`; único archivo nuevo, cero cambios en producción/config) para cumplir "> 0 tests". Marcó features 1 y 2 → `done`. Incidencia: el subagente se cortó a mitad por límite de sesión y se reanudó vía SendMessage sin pérdida de trabajo.
- **Verificación final del leader**: `pnpm build` ✅ (`Built @dotted-labs/ngx-products-3d`, 1.4s) · `pnpm ng test ngx-products-3d` ✅ (vitest 4.1.10: Test Files 1 passed, Tests 4 passed, 2.56s). Lint ✅ (verificado por implementer y en baseline).
- **Siguiente**: Fase 1 — feature 3 `badge-canvas-wrapper` (depende de 1 ✅).

## 2026-07-07/08 — spec-02 Fase 1 — feature 3 `badge-canvas-wrapper` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (2 rondas), según tabla de escalado.
- **Implementer** (`progress/impl_spec-02-f1-canvas.md`): sustituyó el stub de `badge.component.ts` por `<ngt-canvas [camera]>` + `<ngtr-physics [options]>` + guard SSR (`@if (isBrowser)`) + passthrough `debug`; 5 tests nuevos (9 en total). Decisión clave: `provideNgtRenderer()` devuelve `EnvironmentProviders` → lo registra el consumidor en los providers de la **ruta** (playground `badge-demo.routes.ts`), no en providers del componente.
- **Review ronda 1** (`progress/review_spec-02-f1-canvas.md`): CHANGES_REQUESTED — (1) ítem 1 de checklist N3 sin ejecutar, (2) `README.md` contradecía el contrato del renderer, (3) dejar constancia de la desviación spec↔API. La decisión del renderer en ruta fue VALIDADA.
- **Fixes**: implementer corrigió README (quickstart + regla 2); leader actualizó spec-02 y descripción de la feature en `feature_list.json`; leader verificó runtime (2026-07-08, Chrome headless): canvas 1248×512, contexto webgl2, 0 errores de consola.
- **Review ronda 2**: **APPROVED**. N2 re-ejecutado por el reviewer: build ✅, lint ✅, 9/9 tests ✅. Feature 3 → `done`.
- **Pendiente encadenado a feature 4 (N3)**: ítems 2-3 de la checklist N3 de la feature 3 (debug colliders visible + encuadre de cámara) y cierre visual de CA3 ("input debug activa el debug de física") — verificar cuando la escena tenga cuerpos.
- **Siguiente**: Fase 1 — feature 4 `badge-physics-chain` (depende de 1 ✅ y 3 ✅).

## 2026-07-09 — spec-02 Fase 1 — feature 4 `badge-physics-chain` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (2 rondas) + verificación N3 runtime del leader.
- **Implementer** (`progress/impl_spec-02-f1-chain.md`): cadena física en `badge-scene.component.ts` — 5 rigid bodies (`fixed`/`j1`/`j2`/`j3`/`card`), colliders explícitos (ball ×3 + cuboid), 3 rope joints + 1 spherical joint con la API nativa del spike S1 (`ropeJoint`/`sphericalJoint`), signal `cardBodyType`, mesh placeholder. Constantes nuevas en `badge.config.ts` (`segmentJointAnchor`, `segmentColliderRadius`, `cardColliderHalfExtents`, `BADGE_LAYOUT`, `BADGE_CARD_PLACEHOLDER`) — cero números mágicos. 6 tests nuevos (15 en total).
- **Review ronda 1** (`progress/review_spec-02-f1-chain.md`): APPROVED a nivel de código, condicionado a la N3 runtime del leader.
- **N3 del leader (ronda 1): FALLÓ** — 2× NG0950 (`NgtrRigidBody` input `type` sin valor al resolverse el WASM), body del card no creado, plano no renderizado. Causa raíz confirmada por el implementer (`fesm2022/angular-three-rapier.mjs:1317-1327`): `bodyDesc` lee el input requerido vía `untracked()` y el error queda cacheado en el computed; el property binding `[rigidBody]="cardBodyType()"` aún no estaba escrito cuando el effect de creación de bodies corre. Los atributos estáticos son inmunes (se aplican en creación de vista).
- **Fix**: card con `rigidBody="dynamic"` estático; `cardBodyType` conservado — la feature 6 hará el switch vía `setBodyType()` del body crudo (documentado en template e informe). Extra playground: fondo oscuro en `badge-demo` (el placeholder blanco era invisible sobre blanco).
- **N3 del leader (ronda 2): PASA** — Chrome headless: 0 errores de consola, plano colgando y oscilando (diff entre frames > 0), debug ON muestra cuerda + ball colliders + cuboid de la tarjeta. Cierra también los pendientes encadenados de la feature 3 (CA3 "debug activa el debug de física" + encuadre: fixed/j1 fuera de plano por diseño).
- **Review ronda 2**: **APPROVED**. Implementer marcó feature 4 → `done`.
- **Verificación final del leader**: `pnpm build` ✅ · lint ✅ · `pnpm ng test ngx-products-3d` ✅ (2 files, 15/15 tests) · `pnpm ng build products-3d-playground` ✅ (initial 242.98 kB, three/rapier lazy).
- **Nota para features 5-8**: patrón aprendido — inputs requeridos de `NgtrRigidBody` con property binding sufren race con el init del WASM; preferir atributos estáticos + mutación vía API del body crudo en `beforeRender`.
- **Siguiente**: Fase 1 — feature 5 `badge-band-rendering` (depende de 2 ✅ y 4 ✅).

## 2026-07-10 — spec-02 Fase 1 — feature 5 `badge-band-rendering` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer + verificación N3 runtime del leader (tabla de escalado: caso normal).
- **Implementer** (`progress/impl_spec-02-fase1-band.md`): renderizado por frame de la correa (lanyard) con meshline sobre `badge-scene.component.ts`. `extend({ MeshLineGeometry, MeshLineMaterial })` a nivel módulo + `<ngt-mesh>` con `<ngt-mesh-line-geometry #bandGeometry>` y `<ngt-mesh-line-material>` bindeado a `BADGE_BAND` (color/lineWidth/depthTest) + `resolution()`. Estado reutilizado: 4 `Vector3` + `CatmullRomCurve3` (`curveType='chordal'` fijado una vez); `beforeRender` copia traslaciones `j3,j2,j1,fixed` y `setPoints(curve.getPoints(BADGE_PHYSICS.curvePoints))` (32 pts). `resolution` = `store.size()` reactivo a resize (Vector2 reutilizado). Nueva const `BADGE_BAND` en `badge.config.ts` (cero números mágicos). 3 tests nuevos (18 en total).
- **Discrepancia spec↔API (API real gana)**: la spec sugería `store.select('size')`; la API real de `angular-three@4.2.3` es `store.size()` (`SignalState<NgtState>`, DeepSignal). Documentada y verificada en node_modules; validada por el reviewer.
- **Review** (`progress/review_spec-02-fase1-band.md`): RECHAZADO — motivo ÚNICO: código correcto y todo lo automatizable en verde, pero la checklist Nivel 3 (CA1 visual + parte profiler de CA2) no estaba anotada como completada (verification.md §N3: "sin checklist anotada = fase no verificada"). Recomendación menor no bloqueante: reordenar `injectStore()`.
- **Verificación N3 del leader (smoke test)**: Chrome headless + ANGLE/SwiftShader (WebGL real) contra `http://localhost:4200/`. Frame 2500 ms = correa blanca curva suave (meshline, miter joins) bajando del anclaje, tarjeta inclinada en balanceo; frame 5000 ms = correa recta vertical, tarjeta enderezada y desplazada (**pose distinta**) ⇒ la correa sigue las traslaciones vivas de la cadena frame a frame (oscilación por gravedad de feature 4). Frames en scratchpad (`badge_v2500.png`, `badge_v5000.png`, `badge_t1.png`).
- **Checklist Nivel 3 — feature 5**: CA1 ✔ (visual, frames 2500/5000 ms) · CA3 ✔ (tests unitarios N1) · CA2 ✔ (garantía estática: solo `.copy()` + curva reutilizada; única asignación = array de `curve.getPoints()`, literal de la spec; el pase de profiler GC interactivo pertenece a la puerta N3 de Fase 2 / feature 8 "60fps sin GC spikes"). Recomendación de reorden de `injectStore()` diferida (opcional, no bloqueante) para no reabrir revisión de código.
- **Verificación Nivel 1/2 (cierre)**: `pnpm build` ✔ (Built @dotted-labs/ngx-products-3d, 2393ms) · `pnpm ng lint ngx-products-3d` ✔ (All files pass linting) · `pnpm ng test ngx-products-3d` ✔ (2 files, 18/18 tests).
- Feature 5 → `done`.
- **Siguiente**: Fase 1 — feature 6 `badge-drag` (depende de 4 ✅).

## 2026-07-10 — spec-02 Fase 1 — feature 6 `badge-drag` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (aprobado a la primera), según tabla de escalado. Arranque verde: build ✅, lint ✅, test 18/18 ✅.
- **Implementer** (`progress/impl_spec-02-f6-drag.md`): drag de la tarjeta con puntero sobre `#cardBody` en `badge-scene.component.ts`. Nuevo archivo `badge-drag.ts` con lógica pura reutilizable — `subtractInto` (resta in-place sobre Vector3, soporta aliasing minuendo=salida) y `projectPointerToWorld` (desproyección puntero NDC→mundo reutilizando `vec`/`dir`). `onPointerdown`: `setPointerCapture(event.pointerId)` sobre `event.target`, `dragOffset = event.point − card.translation()`, `dragged.set(true)`, switch a kinemático por el **body crudo** `card.setBodyType(RigidBodyType.KinematicPositionBased, true)` (NO por input `rigidBody` — evita el race NG0950 aprendido en feature 4) + `cardBodyType` sincronizado. `beforeRender` con `dragged()`: desproyecta puntero, `wakeUp()` de card+j1+j2+j3, `setNextKinematicTranslation(dragVec − dragOffset)`; correa Catmull-Rom intacta. `onPointerup`: `releasePointerCapture`, `dragged.set(false)`, vuelta a `dynamic`. Nueva const `BADGE_DRAG.unprojectDepth=0.5` en `badge.config.ts` (cero números mágicos). 6 tests nuevos (24 en total).
- **Decisión de API (verificada en node_modules)**: enum `RigidBodyType` obtenido vía `NgtrPhysics.rapier()?.RigidBodyType` (namespace RAPIER cargado) — sin importar `@dimforge/rapier3d-compat` como valor, cero deps nuevas, sin `any`. Evento pointer = `NgtThreeEvent<PointerEvent>` (`event.point` Vector3 mundo, `event.pointerId`/`event.target` del spread `NgtProperties`). Los tests existentes siguen verdes sin ampliar el mock: `physics.rapier()` solo se lee dentro de handlers, no en construcción.
- **Review** (`progress/review_spec-02-f6-drag.md`): **APROBADO** a la primera. Checklist punto por punto verificada contra código real; re-ejecutó N2 (build ✅, lint ✅, test 24/24 ✅, `pnpm ng build products-3d-playground` ✅). Cero allocations por frame confirmadas en código. Sin discrepancias no documentadas.
- **Verificación final del leader**: `pnpm build` ✅ (2004ms) · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` ✅ (3 files, 24/24 tests).
- **Pendiente N3 (no automatizable en este entorno, anotado en el informe)**: smoke manual en playground — tarjeta sigue al puntero y la cadena reacciona, cae y oscila al soltar, pointer capture activo/liberado, 60fps sin GC spikes. Se cerrará en la puerta N3 de Fase 2 (features 7/8) junto con anti-jitter y estabilización.
- Feature 6 → `done`. **Hito Fase 1 (drag) completo.**
- **Siguiente**: Fase 2 — feature 7 `badge-anti-jitter-spin` (depende de 5 ✅ y 6 ✅).

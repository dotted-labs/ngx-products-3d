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

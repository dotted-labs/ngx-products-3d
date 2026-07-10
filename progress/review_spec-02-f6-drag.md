# Review — spec-02 F1, feature 6 `badge-drag`

**Veredicto:** APROBADO

## Verificación ejecutable (Nivel 2)
- `pnpm build` → verde. `Built @dotted-labs/ngx-products-3d` (2.0s).
- `pnpm ng lint ngx-products-3d` → verde. `All files pass linting`.
- `pnpm ng test ngx-products-3d` → verde. **3 files, 24 tests passed** (18 previos + 6 nuevos).
- `pnpm ng build products-3d-playground` → verde (integración de API pública, sin deep imports rotos).

## Archivos declarados vs `git status`
Coinciden. Producción tocada = exactamente la declarada:
`badge-drag.ts` (nuevo), `badge-drag.spec.ts` (nuevo), `badge.config.ts`,
`badge-scene.component.ts`, `badge-scene.component.spec.ts`.
Extras en `git status` (`feature_list.json`, `progress/current.md`,
`progress/impl_spec-02-f6-drag.md`) son backlog/informe, fuera de `src/`. Sin archivos fantasma.

## Checklist de revisión (código real)
1. **Drag funcional:** [x] `onPointerDown` hace `setPointerCapture(event.pointerId)` sobre
   `event.target`, offset = `subtractInto(event.point, card.translation(), dragOffset)`,
   `dragged.set(true)`, y conmuta a kinemático por el body crudo `card.setBodyType(RigidBodyType.KinematicPositionBased, true)`
   (NO por el input `rigidBody`), evitando el race NG0950. `cardBodyType` sincronizado (badge-scene.component.ts:253-269).
2. **beforeRender:** [x] rama `if (dragged() && card)` desproyecta con `projectPointerToWorld` (Vector3 reutilizados),
   `wakeUp()` de card+j1+j2+j3 y `setNextKinematicTranslation(subtractInto(dragVec, dragOffset, dragVec))`.
   El cálculo Catmull-Rom de la correa (bandPoints.copy + setPoints) queda intacto (badge-scene.component.ts:220-245).
3. **onPointerUp:** [x] `releasePointerCapture`, `dragged.set(false)`, `setBodyType(Dynamic, true)`,
   `cardBodyType.set('dynamic')` (badge-scene.component.ts:272-283).
4. **Cero allocations en path de drag:** [x] `dragOffset`/`dragVec`/`dragDir` campos de clase instanciados una vez;
   `subtractInto` y `projectPointerToWorld` escriben in-place, sin `new`/`.clone()` (badge-drag.ts:14-37).
5. **Cero números mágicos:** [x] el `0.5` externalizado a `BADGE_DRAG.unprojectDepth` (badge.config.ts:32-35);
   resto de valores desde config.
6. **Sin `any`, imports, formato:** [x] `event.target as Element` (cast a tipo concreto, no `any`);
   imports ordenados Angular→three→angular-three*→propios; lint verde confirma Prettier/orden de miembros.
7. **Zoneless-safe, sin console.log/TODO:** [x] solo signals/`beforeRender`; sin logs de debug ni TODOs.
8. **Tests Nivel 1:** [x] `badge-drag.spec.ts` comprueba resultado concreto (valores exactos de la resta;
   x≈0/y≈0 y x>0 en la desproyección; invariante de reutilización de instancia), camino feliz + borde (aliasing),
   sin mockear la escena rapier (matemática pura con `PerspectiveCamera` real). Los 18 previos siguen verdes.

## Criterios de aceptación (spec / feature 6)
- CA1 (tarjeta sigue al puntero y cadena reacciona): [x] código correcto; validación visual → Nivel 3 manual (checklist anotada, pendiente de smoke).
- CA2 (al soltar cae y oscila, vuelve a dynamic): [x] código correcto; validación visual → Nivel 3 manual.
- CA3 (pointer capture activo durante drag y liberado al soltar): [x] código correcto; validación visual → Nivel 3 manual.
- CA4 (sin allocations por frame en el path de drag): [x] verificado en código.
- CA5 (`pnpm build` verde): [x]
- CA6 (`pnpm ng lint` verde): [x]
- CA7 (`pnpm ng test` >0 y verdes): [x] 24/24.

## Docs
- architecture.md: [x] entry point único, config data-driven, cero allocations en loop, SSR/handlers, sin deps nuevas.
- conventions.md: [x] nombres, orden de clase, signals/OnPush, sin `any`, JSDoc en exports públicos de badge-drag.ts.
- verification.md N1: [x] specs con resultado concreto + borde.
- verification.md N2: [x] build/lint/test/playground verdes.
- verification.md N3: [x] checklist manual anotada en el informe (impl_spec-02-f6-drag.md:81-88) como pendiente de smoke — correcto para este entorno (no automatizable, no motivo de rechazo).

## Discrepancias spec↔API (protocol §6)
Verificado en `node_modules/@dimforge/rapier3d-compat/dynamics/rigid_body.d.ts`:
`RigidBodyType.Dynamic=0`, `KinematicPositionBased=2`, `setBodyType(type, wakeUp)` (:361),
`setNextKinematicTranslation(t)` (:240), `wakeUp()` (:328). Uso del enum vía `physics.rapier()?.RigidBodyType`
(sin importar el compat como valor, sin `any`) es correcto y está documentado en el informe. Sin desviaciones no documentadas.

## Nota sobre Nivel 3 (no bloqueante)
Criterios visuales/físicos (sigue puntero, cae al soltar, 60fps, sin GC spikes) no automatizables en este entorno.
Quedan anotados como pendientes de smoke manual en el informe. No motivo de rechazo (instrucción explícita de la tarea).

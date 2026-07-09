# Informe implementer — spec-02 Fase 0 (cierre: features 1 y 2)

- **Fecha**: 2026-07-07
- **Tarea**: cierre mínimo de F0. El spike concluyó **caso A** (joints nativos en
  `angular-three-rapier@4.2.3`, ver `docs/spike-notes.md`) ⇒ no se escribió `joints.ts`.
  El único gap para la acceptance era "> 0 tests": el repo no tenía ningún `*.spec.ts`.

## Qué se creó

- `projects/ngx-products-3d/src/lib/badge/badge.component.spec.ts` — único archivo nuevo.
  Vitest + `TestBed` mínimo (zoneless por defecto en Angular 21, sin providers extra)
  sobre `Products3dBadge` existente. 4 tests de `resolvedTheme`:
  1. Devuelve el theme pasado por input `[theme]`.
  2. Cae al token `PRODUCTS_3D_BADGE_THEME` si no hay input.
  3. Prioriza input sobre token cuando hay ambos.
  4. Lanza `Error('[ngx-products-3d] badge: no theme. Pasa [theme] o provideProducts3dBadgeTheme()')`
     sin input ni token.
  Usa los tipos reales de `src/lib/types.ts` (`Products3dBadgeTheme`, `BadgeMemberData`)
  y el token de `src/lib/tokens.ts`. `resolvedTheme` es `protected`: acceso vía narrow
  tipado (`unknown` → interfaz local), sin `any`.

## Qué NO se tocó

- **Cero cambios en código de producción** (`badge.component.ts` y resto de `src/lib` intactos).
- **Cero cambios de configuración**: el runner vitest del builder `@angular/build:unit-test`
  arrancó sin ajustes (`tsconfig.spec.json` ya incluía `vitest/globals`).
- Sin dependencias nuevas.

## Verificación (los 3 comandos, en orden)

1. `pnpm build` → ✅ `Built @dotted-labs/ngx-products-3d` (ng-packagr, sin errores, ~1.6s).
2. `pnpm ng lint ngx-products-3d` → ✅ `All files pass linting.`
3. `pnpm ng test ngx-products-3d` → ✅ vitest 4.1.10: `Test Files 1 passed (1)`,
   `Tests 4 passed (4)`. Se cumple "> 0 tests y todos verdes" (baseline anterior fallaba
   con "No tests found").

## Estados actualizados en feature_list.json

Verificado previamente que `docs/spike-notes.md` existe y documenta S1 (joints, caso A,
firmas exactas de `ropeJoint`/`sphericalJoint`) y S2 (meshline viable, decisión vs
fallback TubeGeometry). Con la acceptance completa:

- Feature id 1 `spike-rapier-joints`: `in_progress` → **`done`**
- Feature id 2 `spike-meshline`: `in_progress` → **`done`**

(Cambio de estado autorizado por el leader en esta tarea: cierre trivial sin API pública,
sin reviewer según tabla de escalado, ver `progress/current.md`.)

## Verificación manual pendiente

Ninguna: F0 no tiene criterios visuales/físicos. Los criterios runtime de meshline
(render del shader, `[resolution]`, coste de `setPoints()`) quedan explícitamente
diferidos a features 3-5 según `docs/spike-notes.md`.

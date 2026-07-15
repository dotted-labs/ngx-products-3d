# Review — spec-02 F8 `badge-cursor-polish`

**Veredicto:** APROBADO

## Verificación ejecutable (Nivel 2)
- `pnpm build` → OK (Built @dotted-labs/ngx-products-3d, 2574ms).
- `pnpm ng lint ngx-products-3d` → OK (All files pass linting).
- `pnpm ng test ngx-products-3d` → OK (5 files, **36 tests passing**; 33 previos + 3 nuevos).
- `pnpm ng build products-3d-playground` → OK (integración pública compila; import por `@dotted-labs/ngx-products-3d`, sin deep imports).
- Dist: entry point en `dist/ngx-products-3d/fesm2022`; `package.json` con peers correctos y solo `tslib` como dependency (sin deps fantasma; **sin tweakpane**).

## Archivos modificados vs informe
- `badge-cursor.ts` (nuevo) — declarado. OK.
- `badge-cursor.spec.ts` (nuevo) — declarado. OK.
- `badge-scene.component.ts` (mod) — declarado. OK.
- Nota: `badge.config.ts` y `badge-stabilize.*` aparecen en `git status` pero pertenecen a **F7** (lerpClampMin/Max, no committeado aún), NO a F8. Fuera de alcance de esta review; no atribuibles al implementer de F8.

## Checklist de revisión
1. Cursor — estado y handlers: [x] `hovered = signal(false)`; `onPointerOver`/`onPointerOut` con `event.stopPropagation()` + `hovered.set(true|false)`; bindeados `(pointerover)`/`(pointerout)` en `#cardBody` (badge-scene.component.ts:88-89, 376-385).
2. Effect: [x] reactivo a `dragged()`/`hovered()`, aplica `document.body.style.cursor = cursorFor(...)` (líneas 222-227). `cursorFor` pura, prioridad drag>hover>reposo → grabbing/grab/auto (badge-cursor.ts:5-7). Está en el constructor, NO en `beforeRender` (no corre por frame).
3. Guard SSR: [x] `isBrowser = isPlatformBrowser(inject(PLATFORM_ID))`; captura de original, effect y onDestroy todo dentro de `if (this.isBrowser)` (líneas 150-231). En server no toca `document`.
4. Restauración del cursor (CRÍTICO): [x] `originalCursor` capturado UNA vez al construir (línea 151), restaura ese valor (no `'auto'`). `onCleanup` restaura antes de cada re-run y en destroy; `destroyRef.onDestroy` como red de seguridad. Lógica correcta: el body vuelve al cursor original tras destruir, incluso a mitad de hover/drag.
5. Números mágicos en componentes: [x] Auditados `badge.component.ts` y `badge-scene.component.ts`. Todos los valores tunables desde config (`BADGE_LAYOUT`/`BADGE_PHYSICS`/`BADGE_DRAG`/`BADGE_BAND`/`BADGE_CARD_PLACEHOLDER`/`BADGE_CAMERA`). Únicos literales: identidades de init (`Euler(0,0,0,'YXZ')`, `reuseAngvel {0,0,0}`) e índices `bandPoints[0..3]` — no cuentan. Sin hallazgos.
6. Estilo: [x] Sin `any`, imports ordenados (Angular→three→angular-three*→meshline→propios), Prettier/lint verde, sin `console.log`/TODO, zoneless-safe (effects/signals, sin Zone).
7. Tests N1: [x] `badge-cursor.spec.ts` cubre 3 estados + prioridad drag>hover con `.toBe(...)` (sin `toBeTruthy`). 33 previos siguen verdes (total 36).

## Docs
- architecture.md: [x] (§4 cero allocations respetado — effect fuera del loop; §6 SSR-safe; §5 sin peers nuevos; boundaries del playground intactos).
- conventions.md: [x] (nombres, orden, OnPush/signals, JSDoc de una línea en exports de `badge-cursor.ts`).
- verification.md N1: [x]
- verification.md N2: [x] (build+lint+test+playground verdes).
- verification.md N3: [x] (checklist manual anotada como pendiente en el informe, sección "Checklist Nivel 3 pendiente").

## Playground (nota del leader)
- Toggle de debug física YA existente en `badge-demo.component.ts:19` (`<input type="checkbox" [checked]="debug()" (change)="debug.set(!debug())">`). Confirmado por el implementer, sin cambios. **No se añadió Tweakpane** (verificado: sin coincidencias en package.json ni proyectos). Correcto.

## Criterios de aceptación (spec / feature 8)
- Cursor correcto en 3 estados y restaurado al destruir: [x] (lógica pura testeada + restauración verificada por código; verificación visual final en checklist N3 del informe, no automatizable).
- Cero números mágicos en componentes: [x]
- Toggle de debug física accesible en playground: [x] (preexistente, confirmado).
- 60fps / zoneless-safe: [x] (effect fuera del loop, sin Zone; medición fps en checklist N3 del informe).
- build / lint / test verdes: [x]

## Conclusión
Última feature del backlog spec-02. Todo verde, sin ampliación de alcance, sin dependencias nuevas, restauración de cursor correcta y checklist N3 anotada. **APROBADO.**

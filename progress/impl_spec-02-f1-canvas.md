# Informe impl — spec-02 F1, feature 3 `badge-canvas-wrapper`

- **Fecha**: 2026-07-07 (fixes post-review: 2026-07-08)
- **Estado**: implementado + fixes post-review aplicados, pendiente veredicto final (no marcado `done`)

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge.component.ts` | Sustituido stub por `<ngt-canvas>` + `NgtrPhysics` + escena, guard SSR, `physicsOptions` computed. Inputs `member`/`theme`/`debug` y `resolvedTheme` conservados intactos. |
| `projects/ngx-products-3d/src/lib/badge/badge.component.spec.ts` | +5 tests (physics options, SSR guard, montaje browser). Los 4 tests originales de tema sin tocar (solo se extrajo el helper `internalsOf`). |
| `projects/products-3d-playground/src/app/badge-demo/badge-demo.routes.ts` | **Nuevo**: rutas lazy del demo con `provideNgtRenderer()` + providers de producto/tema (movidos desde `app.routes.ts`). |
| `projects/products-3d-playground/src/app/app.routes.ts` | Pasa a `loadChildren` → `badge-demo.routes` (ver decisión 3). |
| `projects/products-3d-playground/src/app/badge-demo/badge-demo.component.ts` | Altura (32rem) para `products-3d-badge` y placeholder, para que el canvas tenga tamaño visible. |

Sin dependencias nuevas ni cambios en `peerDependencies`.

## API real verificada (node_modules, v4.2.3)

- `angular-three/dom` exporta `NgtCanvas` (array `[NgtCanvasImpl, NgtCanvasContent]`), selector `ngt-canvas`, input `camera: NgtCamera | NgtCameraParameters | undefined`; contenido vía `<ng-template canvasContent>` (`types/angular-three-dom.d.ts:44-126`).
- `angular-three-rapier` exporta `NgtrPhysics`, selector `ngtr-physics`, único input `options: InputSignalWithTransform<NgtrPhysicsOptions, '' | Partial<NgtrPhysicsOptions>>`; contenido = `<ng-template>` hijo (contentChild `TemplateRef`) (`types/angular-three-rapier.d.ts:1701-1770`). `gravity: Vector3Tuple`, `timeStep: number | 'vary'`, `interpolate: boolean`, `debug: boolean` confirmados en `NgtrPhysicsOptions`.
- Selectores del template copiados de los `.d.ts`; coinciden con el boceto de la spec.

## Decisiones

1. **Discrepancia spec ↔ API (documentar en spec):** la spec pide "`provideNgtRenderer()` en providers del componente", pero `provideNgtRenderer()` devuelve `EnvironmentProviders` (`makeEnvironmentProviders`, `fesm2022/angular-three-dom.mjs:372-381`) y `@Component.providers` está tipado `Provider[]` → error de compilación (y NG0207 en runtime). Además, en Ivy `RendererFactory2` se resuelve del environment injector al crear el árbol de componentes, así que un provider a nivel de node injector no tendría efecto. Resolución conforme a `docs/architecture.md` §6 ("nivel de componente/ruta, jamás root"): se registra en los providers de la **ruta** del playground y se documenta en el JSDoc del componente como requisito del consumidor.
2. **`interpolate: true` inline** en `physicsOptions`: literal booleano dictado por la spec (no constante física); gravity/timeStep salen de `BADGE_PHYSICS`, camera de `BADGE_CAMERA`. Cero números mágicos en el componente.
3. **Ruta lazy en playground**: importar `angular-three/dom` (y la lib, que ya importa three/rapier) desde `app.routes.ts` metía three.js en el bundle inicial → budget error (3.25 MB > 1 MB). Providers movidos a `badge-demo.routes.ts` cargado con `loadChildren`; inicial queda en 236 kB y three/rapier van en chunks lazy.
4. **Sin `CUSTOM_ELEMENTS_SCHEMA`**: todos los elementos del template (`ngt-canvas`, `ngtr-physics`, `products-3d-badge-scene`, `ng-template`) son componentes/directivas Angular reales importados; no hay elementos custom de `extend()`. Añadir el schema solo enmascararía errores de template.
5. **`:host { display: block }`** en la lib: el host custom element es inline por defecto y colapsaría el canvas (que es 100%×100%); la altura la decide el consumidor (demo: 32rem).
6. **Zoneless-safe**: solo signals/computed + `OnPush`; sin Zone.js, sin `ngOnChanges`, sin suscripciones.
7. **Tests browser en jsdom**: montar `ngt-canvas` es seguro sin WebGL — `initRoot` solo registra el root; el `WebGLRenderer` se crea en `configure()`, con guard `resize.width > 0` que en jsdom nunca se cumple. Único hueco: jsdom no implementa `ResizeObserver` (lo usa `NgxResize` interno) → stub con `vi.stubGlobal` acotado al `describe` del path browser.
8. `badge-scene.component.ts` NO tocado (stub, feature 4). Nada de bodies/joints/correa/drag.

## Tests (9 en verde; 4 previos + 5 nuevos)

- `defaults the debug input to false` — acceptance "debug default false".
- `passes the debug input through to the physics options` — passthrough a `NgtrPhysics` (el binding `[options]="physicsOptions()"` es la única vía de entrada al componente de física; su efecto visual se verifica manual).
- `builds gravity, timeStep and interpolate from BADGE_PHYSICS` — sin números mágicos.
- `renders nothing on the server platform...` — PLATFORM_ID `server`: `isBrowser` false, host sin hijos, sin `ngt-canvas` ni `<canvas>` en `document`.
- `mounts ngt-canvas with its host <canvas> element on the browser platform` — rama browser del `@if` renderiza `ngt-canvas` con su `<canvas>` interno.

No testeado automatizadamente (no viable sin WebGL, ver `docs/verification.md` nivel 3): instanciación del contenido del canvas (requiere tamaño real + contexto GL) y render del debug de física.

## Verificación ejecutada

```
pnpm build                          → OK (lib empaquetada; dist con fesm2022 + solo tslib como dependency)
pnpm ng lint ngx-products-3d        → All files pass linting
pnpm ng lint products-3d-playground → All files pass linting
pnpm ng test ngx-products-3d        → 1 file, 9 tests passed
pnpm ng build products-3d-playground→ OK (initial 236.25 kB; three/rapier en lazy chunks)
```

## Pendiente de verificación manual en playground (Nivel 3)

- [ ] `pnpm start:playground` → el `@defer (on viewport)` monta `products-3d-badge` y aparece el `<canvas>` con contexto WebGL sin errores en consola. **Verificación runtime a cargo del leader** (evidencia de CA1; no depende de la feature 4).
- [ ] Toggle "debug física" activa el render de debug de Rapier. **Encadenado a la verificación N3 de la feature 4**: el debug dibuja wireframes de colliders y la escena actual es un stub vacío — no dar CA3 ("activa el debug") por cerrado hasta esa verificación.
- [ ] Cámara en `[0, 0, 13]` fov 25. **Encadenado a la verificación N3 de la feature 4** (comprobable cuando la escena tenga contenido).

## Fixes post-review (`progress/review_spec-02-f1-canvas.md`, fix 2)

1. `README.md` — regla 2 de consumo: sustituida la afirmación obsoleta "provideNgtRenderer() lo aporta la lib a nivel de componente; no lo declares en root" por el contrato real: la app consumidora registra `provideNgtRenderer()` (import de `angular-three/dom`) en los providers de la **ruta** que consume el badge (idealmente lazy), nunca en root — devuelve `EnvironmentProviders` y Angular no lo admite en providers de componente.
2. `README.md` — quickstart (`badgeRoute`): añadidos el import y `provideNgtRenderer()` al bloque de providers, para que el ejemplo no produzca un canvas roto.
3. JSDoc de `badge.component.ts` revisado (ítem 3 del encargo): ya enunciaba exactamente el contrato real (renderer en providers de ruta del consumidor por ser `EnvironmentProviders`), así que su "Ver README" ahora apunta a un README consistente. **Sin cambio de código.**
4. Fix 3 del review (spec-02 "Canvas wrapper" + descripción de feature 3 en `feature_list.json`) aplicado por el **leader**; no tocado por el implementer.

Re-verificación tras fixes (2026-07-08):

```
pnpm build                   → OK
pnpm ng lint ngx-products-3d → All files pass linting
pnpm ng test ngx-products-3d → 1 file, 9 tests passed
```

Review aprobada (ronda 2) → feature 3 done

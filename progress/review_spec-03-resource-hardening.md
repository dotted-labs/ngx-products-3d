# Review — spec-03 resource hardening (bugfix robustez)

**Veredicto:** APROBADO

Bugfix de robustez (no feature de backlog). Objetivo declarado: acceso no-lanzante
a los recursos async del badge (`bandTexture`/`gltf`) para que una URL rota/loading
degrade en vez de blanquear la escena por `ResourceValueError` en la detección de cambios.

## Alcance verificado
Archivos del bugfix declarados en el informe = archivos realmente tocados por el fix:
- `resource-value.ts` (nuevo)
- `resource-value.spec.ts` (nuevo)
- `badge/badge-scene.component.ts`
- `badge/badge-scene.component.spec.ts`

El resto de ficheros modificados en el working tree (`badge.component.*`, `badge.config.ts`,
`badge-material.*`, assets PNG/GLB/font, `badge-demo.routes.ts`, `app.config.ts`) pertenecen
a las fases f2–f5 y al tooling de assets, ya revisados aparte (`review_spec-03-f2..f5.md`) y
fuera del objeto de esta review. No hay scope creep atribuible a este bugfix: física,
material, lighting, drag, estabilización y cursor intactos; nada de RenderTexture; playground
no tocado por el fix.

## Checklist punto por punto
1. API no-lanzante (verificado en node_modules): [x]
   `@angular/core` `types/_api-chunk.d.ts` L128 `value: Signal<T>` = "throws an error if the
   resource is in an error state"; L149-154 `hasValue()` = "Whether this resource has a valid
   current value. This function is reactive." (no lanza); `status: Signal<ResourceStatus>` (L135,
   no lanza; error/loading → `value()` undefined, L102/108). El fix gatea con `hasValue()`, nunca
   llama `value()` sin gate.
2. Helper puro `resourceValueOrUndefined`: [x]
   `resource.hasValue() ? resource.value() : undefined` — NO invoca `value()` cuando `hasValue()`
   es false (no dispara el throw). Interfaz `ReadableResource<T>` sin deps Angular → testeable puro.
3. Band template usa `bandMap()` en `[map]` y `[useMap]="bandMap() ? 1 : 0"`: [x]
   (badge-scene.component.ts:164-165). Textura error/loading → undefined → useMap=0 → color plano.
4. GLB `@if (gltfData(); as data)` (computed seguro) en lugar de `@if (gltf.value())`: [x]
   (badge-scene.component.ts:128). GLB error → escena viva sin tarjeta.
5. Effects endurecidos leen accessors seguros: [x]
   tinte del metal → `this.gltfData()` (L346); RepeatWrapping de la band → `this.bandMap()` (L366).
   Ningún `value()` directo sobre los recursos en código (las 2 apariciones L340/L362 son comentarios).
6. Warn dev (no silencia): [x]
   Dos effects observan `.status() === 'error'` con guard `if (ngDevMode)` y prefijo
   `[ngx-products-3d]` incluyendo la URL (L380-399). Único `console` en toda la lib
   (grep confirmado: solo L385 y L395). NO en beforeRender (one-shot por transición a error).
   Conforme a conventions.md §Manejo de errores (avisa, no captura-y-silencia).
7. Sin scope creep: [x] (ver "Alcance verificado").
8. Sin `any` (grep limpio en resource-value.ts y badge-scene.component.ts), imports ordenados
   (Angular → three → angular-three* → meshline → propios), sin TODO/FIXME, zoneless-safe
   (signals/computed/effect, OnPush): [x]
9. Tests N1: [x]
   `resource-value.spec.ts`: hasValue true→value; hasValue false→undefined SIN invocar value();
   `value()` que lanza → no se propaga (camino error/fallback cubierto con valores concretos).
   Mock de soba ampliado con `hasValue()`/`status()`; `SceneInternals` amplía `gltfData`/`bandMap`;
   2 tests nuevos de accessors seguros. 54→59 verdes.

## Docs
- architecture.md: [x] (entry point único, peers correctos, cero deps fantasma, SSR-safe, sin
  console.log, avisos dev con ngDevMode, sin allocations por frame en el fix — warns fuera del loop)
- conventions.md: [x] (§Manejo de errores respetado; orden de miembros; nombres; sin any)
- verification.md N1: [x] (camino feliz + error/fallback)
- verification.md N2: [x] (los 4 comandos verdes; dist con entry point y peers correctos)
- verification.md N3: [x] (corrección visual/runtime; informe deja nota de re-smoke a cargo del
  usuario — sección "Re-smoke pendiente (N3)". No automatizable aquí; no motivo de rechazo.)

## Verificación ejecutable (salida literal)

### pnpm build
```
Building entry point '@dotted-labs/ngx-products-3d'
✔ Compiling with Angular sources in partial compilation mode.
✔ Writing FESM and DTS bundles
✔ Built @dotted-labs/ngx-products-3d
Build at: 2026-07-12T22:16:11.085Z - Time: 3454ms
```

### pnpm ng lint ngx-products-3d
```
Linting "ngx-products-3d"...

All files pass linting.
```

### pnpm ng test ngx-products-3d
```
 Test Files  7 passed (7)
      Tests  59 passed (59)
   Duration  6.25s
```

### pnpm ng build products-3d-playground
```
Application bundle generation complete. [12.207 seconds]
Output location: C:\Projects\dixper\ngx-products-3d\dist\products-3d-playground
```

### Checks de dist
```
dist/ngx-products-3d/fesm2022:
  dotted-labs-ngx-products-3d.mjs
  dotted-labs-ngx-products-3d.mjs.map
peerDependencies: @angular/common, @angular/core, angular-three, angular-three-soba,
  angular-three-rapier, @dimforge/rapier3d-compat, three, meshline, ngxtension
dependencies: tslib   (sin deps fantasma)
playground: cero deep imports a src/lib (grep sin coincidencias).
```

## Observación menor (no bloqueante)
Los comentarios de los dos effects endurecidos siguen diciendo "reactivo a gltf.value()"
(L340) y "reactivo a bandTexture.value()" (L362), mientras el código ya lee `gltfData()` /
`bandMap()`. Inexactitud cosmética; no viola ninguna regla dura. Sugerencia para un pase futuro,
no motivo de rechazo.

## Conclusión
Los cuatro comandos en verde (59 tests). Fix correcto contra la API real de `@angular/core`
verificada en node_modules, conforme a architecture.md, conventions.md (§Manejo de errores) y
verification.md (N1 + N2; N3 con nota de re-smoke). Sin scope creep. **APROBADO.**

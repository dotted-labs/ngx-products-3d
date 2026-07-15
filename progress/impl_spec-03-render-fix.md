# Informe — BUGFIX render inicial (spec-03 Fase 3)

**Estado**: done (pendiente review + re-smoke N3 del usuario)
**Síntoma**: el badge no se ve al cargar; solo aparece y se vuelve interactivo tras clicar el
checkbox "debug física" del playground.

---

## Causa raíz (CON EVIDENCIA)

**No es un problema de frameloop ni de la lib. Es un scheduler de detección de cambios ausente en
la app consumidora (playground) al ser zoneless.**

### Descarte de la hipótesis "frameloop demand"

- `NgtCanvasImpl.frameloop` tiene **default `'always'`** — `angular-three/fesm2022/angular-three-dom.mjs:186`
  (`this.frameloop = input('always', ...)`). El badge usa `<ngt-canvas [camera]="camera">` sin bindear
  `frameloop`, luego es `'always'`. La Fase 3 NO lo cambió (badge.component.ts nunca setea frameloop).
- En modo `'always'`, `update()` devuelve `1` incondicionalmente — `angular-three.mjs:317`
  (`return state.frameloop === 'always' ? 1 : state.internal.frames`), así que en el loop
  `repeat >= 1` siempre y **el bucle nunca se detiene una vez arrancado** — `angular-three.mjs:335-351`.
- El bucle arranca vía `invalidate()` cuando se añaden objetos a la escena
  (`invalidateInstance` en `addThreeChild` — `angular-three.mjs:1925-1926`; `invalidate` arranca el rAF
  si `!running` — `angular-three.mjs:375-378`). El `<ngt-ambient-light>` del wrapper se añade de forma
  síncrona al montar (`noZoneRender` pone `internal.active=true` en `angular-three-dom.mjs:266` ANTES de
  crear la vista embebida en :290), así que **el loop arranca al montar y corre en continuo**.

Conclusión: poner `frameloop="always"` explícito habría sido un **no-op** (ya lo es). El render loop
está bien; el problema es que la escena visible **nunca se construye** hasta que un evento fuerza CD.

### La causa real: sin scheduler de CD para signals async

- **Todo el contenido visible del badge está detrás de `@if` de recursos async**, todos ampliados/nuevos
  en Fase 3:
  - Cuerpos físicos + correa: `@if (rapierConstruct())` dentro de `NgtrPhysics`, que resuelve el WASM
    de Rapier de forma async — `angular-three-rapier.mjs:590-596` (`import('@dimforge/rapier3d-compat')
    .then(() => rapier.init())...`) y el gate en `:852`.
  - Tarjeta GLB: `@if (gltf.value())` (gltfResource async) — badge-scene.component.ts:124.
  - Textura de correa (`textureResource`) y `NgtsEnvironment` (portal + FBO): también async.
- La app playground es **zoneless**: no hay `zone.js` instalado (no existe `node_modules/zone.js`),
  `angular.json` no declara `polyfills`, y `app.config.ts` **no** tenía `provideZonelessChangeDetection()`
  ni `provideZoneChangeDetection()`.
- En Angular, escribir un signal que consume una plantilla marca la vista sucia (`markForRefresh`) pero
  **necesita un `ChangeDetectionScheduler` para agendar el `tick()`**. Sin `provideZonelessChangeDetection()`
  (y sin zone.js) ese scheduler no reacciona a las notificaciones de signals: las resoluciones async
  (Rapier/gltf/texture/environment) marcan la vista embebida del canvas como sucia **pero nunca agendan
  un ciclo de CD**. Un evento del DOM (el checkbox `debug`) sí dispara un `tick()`, que entonces refresca
  la vista y **vacía de golpe todos los cambios pendientes acumulados** → por eso el badge aparece
  (y ya interactivo/animando, porque el loop `'always'` llevaba corriendo desde el montaje).

Esto explica exactamente el síntoma: **eventos sí refrescan, signals async no**.

### ¿Por qué "regresión de Fase 3" si el bug es de config?

En spec-02 la escena tenía menos contenido async y la resolución caía dentro de la ventana de CD del
`@defer (on viewport)`/evento inicial por suerte de timing. Fase 3 movió el 100% del contenido visible
detrás de recursos async más pesados (WASM + GLB + textura + environment), cuya resolución cae fuera de
cualquier tick, **exponiendo** el scheduler ausente que ya faltaba.

---

## Fix (mínimo)

1. **`projects/products-3d-playground/src/app/app.config.ts`** (causa raíz): añadir
   `provideZonelessChangeDetection()` a los providers de la aplicación. Instala
   `ChangeDetectionSchedulerImpl`, que agenda un `tick()` en cada notificación de signal → las
   resoluciones async construyen la escena sin necesidad de un evento. Comentario explicando la
   invariante. `provideZonelessChangeDetection` es API **estable** en Angular 21
   (`@angular/core` types/core.d.ts:3967, sin `@experimental`).
2. **`projects/ngx-products-3d/src/lib/badge/badge.component.ts`** (contrato de consumo, solo doc):
   ampliado el JSDoc del wrapper para documentar que la app consumidora DEBE tener un scheduler de CD
   reactivo a signals (`provideZonelessChangeDetection()` en apps zoneless, o `provideZoneChangeDetection()`
   + zone.js), porque el badge carga geometría/física async detrás de `@if`. Sin cambio de lógica.

**Por qué es mínimo/correcto**: no toca el render loop (está bien), no cambia features 2-5 (física, GLB,
material, correa, luces intactos), no añade dependencias ni peerDeps, cero números mágicos. Ataca la
única pieza que faltaba: el scheduler de CD que el propio Angular exige en apps zoneless.

**Discrepancia con la sugerencia del brief**: el brief apuntaba a `frameloop="always"` en la lib; se
descartó con evidencia (ya es el default, sería no-op). La causa raíz está en la config de la app
consumidora, no en la lib — el brief permite tocar el playground si la causa está ahí.

---

## Verificación N1/N2 (salida literal)

- `pnpm build` → `✔ Built @dotted-labs/ngx-products-3d` (Time: 8175ms). OK.
- `pnpm ng lint ngx-products-3d` → `All files pass linting.` OK.
- `pnpm ng test ngx-products-3d` → `Test Files 6 passed (6)` / `Tests 54 passed (54)`. OK (54 mantenidos verdes).
- `pnpm ng build products-3d-playground` → `Application bundle generation complete. [12.226 seconds]`. OK.

No se añadió test unitario: el fix es un provider a nivel de bootstrap de la app (no unit-testeable de
forma pura en la lib); su efecto es puramente de detección de cambios en runtime del navegador.

---

## Re-smoke N3 pendiente (a cargo del usuario — requiere navegador)

Ejecutar el playground y verificar SIN tocar el checkbox debug:
- El badge **se ve y oscila al cargar** (tarjeta GLB colgando de la cadena), sin clicar "debug física".
- El **drag** con puntero funciona.
- El **toggle de debug** sigue funcionando (colliders visibles on/off) y no rompe el render.
- Reflejos de environment sobre el clearcoat presentes; sin flash de correa con map roto.

Si tras el fix el badge sigue sin verse al cargar, la hipótesis alternativa a revisar sería un detach
de la vista embebida del canvas respecto al árbol de CD (poco probable: el toggle la refresca vía
binding `[options]`, luego está adjunta).

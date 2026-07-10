# Informe implementación — spec-02 Fase 1, feature 6 `badge-drag`

**Fecha**: 2026-07-10
**Rol**: implementer
**Alcance**: SOLO feature 6 (drag de la tarjeta con puntero). No se tocó ninguna otra feature.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge-drag.ts` | **NUEVO**. Lógica pura del drag: `subtractInto` (resta componente a componente sobre Vector3 reutilizado) y `projectPointerToWorld` (desproyección puntero NDC → mundo, reutilizando `vec`/`dir`). |
| `projects/ngx-products-3d/src/lib/badge/badge-drag.spec.ts` | **NUEVO**. 5 tests Nivel 1 (ver abajo). |
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts` | Añadido `BADGE_DRAG.unprojectDepth = 0.5` (`as const` + JSDoc). Evita el número mágico 0.5 en el componente. |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` | Estado de drag, bindings `(pointerdown)`/`(pointerup)` en `#cardBody`, rama de drag en `beforeRender`, handlers `onPointerDown`/`onPointerUp`. |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` | 1 test nuevo: `dragged()` arranca en `false`. Añadido `dragged` a `SceneInternals`. |

## Decisiones de API (verificadas en `node_modules`)

### Firma del evento de pointer
`node_modules/angular-three/types/angular-three.d.ts:484` →
`NgtThreeEvent<PointerEvent> = NgtIntersectionEvent<PointerEvent> & NgtProperties<PointerEvent>`.
- `event.point`: `THREE.Vector3` en coordenadas de **mundo** (heredado de `THREE.Intersection`).
- `event.pointerId` / `event.target`: vienen del spread `NgtProperties<PointerEvent>` (= `Pick` de las
  claves no-función del `PointerEvent` nativo). `target` es `EventTarget | null`.
- `event.stopPropagation()` y `event.nativeEvent` disponibles.
- Los outputs `pointerdown`/`pointerup` existen en `ngt-object3D` (`angular-three.d.ts:2045-2046`), por eso
  el binding `(pointerdown)`/`(pointerup)` sobre `#cardBody` funciona.

### Pointer capture
Vía canónica R3F/angular-three: `(event.target as Element).setPointerCapture(event.pointerId)` en down y
`releasePointerCapture(event.pointerId)` en up sobre el mismo `event.target` (el canvas DOM que recibió el
evento nativo). No hizo falta ir al store (`gl().domElement`): `event.target` ya es el elemento capturable.
Se documenta como decisión: es más directo y no depende del store dentro del handler.

### Enum RigidBodyType (sin `any`, sin dep nueva)
`NgtrPhysics.rapier()` (`angular-three-rapier.d.ts:1728`) devuelve
`typeof _dimforge_rapier3d_compat__default | null` = el **namespace RAPIER** cargado (null hasta que resuelve
el WASM). Se inyecta `NgtrPhysics` y se lee `this.physics.rapier()?.RigidBodyType` →
`.KinematicPositionBased` (=2) y `.Dynamic` (=0), enum verificado en
`node_modules/@dimforge/rapier3d-compat/dynamics/rigid_body.d.ts:12-29`. Así **no** se importa como valor el
paquete compat (cero deps nuevas, cero `import` de valor) y no hay `any`.
- El switch va por el body crudo `card.setBodyType(type, true)` (`rigid_body.d.ts:361`), tal como pide el
  comentario del template (NO por el input `rigidBody`, para no reactivar el race NG0950). El signal
  `cardBodyType` se mantiene sincronizado (`'kinematicPosition'` ↔ `'dynamic'`) para no romper el spec actual.

### beforeRender / cámara y puntero
`beforeRender(cb)` (`angular-three.d.ts:1857`) invoca `cb(state: NgtRenderState)`, que extiende `NgtState`
(`camera: NgtCamera`, `pointer: THREE.Vector2`). Se destructura `({ camera, pointer })`. `NgtCamera` es
`PerspectiveCamera | OrthographicCamera & extras`, asignable a `THREE.Camera` que exige `Vector3.unproject`.

### setNextKinematicTranslation / wakeUp
`card.setNextKinematicTranslation(t: Vector)` (`rigid_body.d.ts:240`) acepta `{x,y,z}`; se le pasa el
`Vector3` reutilizado. `wakeUp()` (`rigid_body.d.ts:328`) se llama sobre card + j1 + j2 + j3.
`translation()` devuelve el `Vector` crudo (`{x,y,z}`), consumido por `subtractInto` (que acepta `Vec3Like`).

## Cero allocations por frame
`dragOffset`, `dragVec`, `dragDir` son campos `Vector3` instanciados una vez. En `beforeRender`:
`projectPointerToWorld` reescribe `dragVec`/`dragDir` in-place; el target kinemático se calcula con
`subtractInto(dragVec, dragOffset, dragVec)` (aliasing del minuendo como salida). No hay `new` en el loop.

## Tests añadidos (Nivel 1)
`badge-drag.spec.ts`:
- `subtractInto`: diferencia componente a componente en el vector reutilizado (camino feliz) + aliasing
  minuendo=salida (borde: el patrón real del frame de drag).
- `projectPointerToWorld` (con `PerspectiveCamera` real de three, solo matemática, sin WebGL): puntero
  centrado → world x≈0,y≈0 (eje de cámara); puntero al borde derecho → world x>0 (sigue al cursor, borde);
  misma instancia `vec` reutilizada entre llamadas (invariante de cero allocations).

`badge-scene.component.spec.ts`: `dragged()` arranca en `false`.

Los tests existentes (mock `NgtrPhysics` con `rapier: () => null`) siguen verdes: el componente solo lee
`physics.rapier()` **dentro de los handlers**, no en construcción, así que no hizo falta ampliar el mock.

## Verificación (Nivel 1 + 2)
```
pnpm build                       → ✔ Built @dotted-labs/ngx-products-3d (10.3s)
pnpm ng lint ngx-products-3d     → ✔ All files pass linting
pnpm ng test ngx-products-3d     → ✔ 3 files, 24 passed (18 previos + 6 nuevos)
```

## Nivel 3 — smoke manual pendiente (requiere GPU/navegador, NO ejecutable por el implementer)
Ejecutar `pnpm start:playground` y verificar la checklist de la feature 6:
- [ ] La tarjeta sigue al puntero durante el drag y la cadena (correa/segmentos) reacciona.
- [ ] Al soltar, la tarjeta vuelve a `dynamic`, cae y oscila (hito Fase 1 completo).
- [ ] Pointer capture activo durante el drag (arrastre continúa aunque el cursor salga de la tarjeta) y
      liberado al soltar.
- [ ] Sin GC spikes por frame en el path de drag (profiler: cero allocations en `beforeRender`).
- [ ] 60fps estables durante el arrastre (devtools performance).

## Notas / discrepancias spec↔API
- Ninguna discrepancia con la API real. La spec mencionaba `event.point.clone`/vías alternativas de pointer
  capture; la implementación final usa el offset in-place (`subtractInto`) y `event.target` directo, ambos
  confirmados contra `node_modules`.
- El `0.5` de la desproyección se externalizó a `BADGE_DRAG.unprojectDepth` (regla cero-números-mágicos).

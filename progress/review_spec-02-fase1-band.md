# Review — spec-02 F1 · feature 5 `badge-band-rendering`

**Veredicto:** RECHAZADO (CHANGES_REQUESTED)

Motivo único de rechazo: los criterios de aceptación **visuales/físicos** (CA1
render de la correa, parte de profiler de CA2) no están verificados ni anotados
como checklist Nivel 3 en el informe — el informe los deja bajo "Verificación
manual **pendiente**". Por `docs/verification.md` §Nivel 3 ("Sin checklist
anotada en informe = fase no verificada") y regla dura del revisor, no se puede
aprobar. El código está limpio y todo lo automatizable (build/lint/test/dist)
está en verde; el único bloqueo es la evidencia Nivel 3.

## Checklist de aceptación (feature 5, feature_list.json)

1. Correa blanca curva suave (32 pts) **visible** siguiendo la cadena en
   movimiento — [ ]
   - Código: ✔ correcto. Template (badge-scene.component.ts:84-92) tiene
     `<ngt-mesh>` con `<ngt-mesh-line-geometry #bandGeometry>` +
     `<ngt-mesh-line-material>`. `beforeRender` copia en orden tarjeta→anclaje
     `j3,j2,j1,fixed` (líneas 201-204) y llama
     `setPoints(curve.getPoints(BADGE_PHYSICS.curvePoints))` (línea 206);
     `curvePoints = 32` en badge.config.ts:28. `curveType = 'chordal'` fijado una
     vez en constructor (línea 164).
   - Verificación VISUAL: ✗ no realizada. La correa renderiza con shader meshline
     (miter joins) — requiere WebGL/playground y no puede confirmarse por
     inspección ni por los specs. El informe la lista como "pendiente", no como
     checklist Nivel 3 completada. La cadena ya oscila por gravedad (feature 4
     `done`), así que este criterio ES verificable ahora sin necesidad del drag
     (feature 6). No hay excusa para diferirlo.

2. Sin allocations por frame (Vector3 y curva reutilizados; profiler sin GC
   spikes) — [ ] (parcial)
   - Código: ✔ `bandPoints` (4 `Vector3`) y `CatmullRomCurve3` son campos de
     clase (líneas 137-138); en `beforeRender` solo `.copy()`, cero `new`. Cumple
     `architecture.md` §4.
   - `curve.getPoints()` asigna un array/frame: es literal de la spec §"Correa por
     frame" paso 3; el implementer lo documenta como tradeoff. Aceptable, no es
     motivo de rechazo por sí solo (viene de la spec).
   - Profiler (GC spikes): ✗ no verificado en playground. Parte Nivel 3 pendiente.

3. `resolution` se actualiza al redimensionar el viewport — [x]
   - `resolution = computed(() => this.resolutionVec.set(size.width, size.height))`
     desde `this.store.size()` (líneas 129-133): reactivo por signal, `Vector2`
     reutilizado. Cubierto por 2 tests unitarios (spec líneas 138-161): es
     `Vector2`, refleja viewport y reacciona al resize reusando la instancia.

4. `pnpm build` sin errores — [x]  (ejecutado: Built @dotted-labs/ngx-products-3d, 2421ms)
5. `pnpm ng lint ngx-products-3d` sin errores — [x]  (ejecutado: "All files pass linting")
6. `pnpm ng test ngx-products-3d` > 0 tests, todos verdes — [x]  (ejecutado: 18 passed / 2 files)

## Docs

- architecture.md — [x]
  - §2 config data-driven: `color`, `lineWidth`, `depthTest` en `BADGE_BAND`
    (badge.config.ts:41-47), `curvePoints` en `BADGE_PHYSICS` (:28). Cero literales
    en el componente. ✔
  - §4 cero allocations por frame: ✔ (ver CA2).
  - §7 API real gana a spec: desviación `store.select('size')` → `store.size()`
    documentada en informe y **verificada** en node_modules/angular-three/types:
    `injectStore(): SignalState<NgtState>` (línea 1716) y `NgtState.size: NgtSize`
    (línea 657). `.select` no existe. Desviación correcta y documentada. ✔
  - §5 peers: `meshline` ya es peer declarado; dist/ngx-products-3d/package.json
    lista peers correctos y solo `tslib` como dependency. Sin deps fantasma. ✔
  - No API pública nueva (spec "No hacer"): `BADGE_BAND` es interno a badge, no se
    exporta. ✔  Sin GLB/texturas/RenderTexture. ✔
- conventions.md — [x]
  - `extend({ MeshLineGeometry, MeshLineMaterial })` a nivel módulo (línea 30) +
    `CUSTOM_ELEMENTS_SCHEMA` en el componente (línea 95). ✔
  - OnPush, signals, sin `console.log`, campos de frame instanciados fuera del
    callback. ✔  Comentarios justifican "por qué" (chordal, nativeElement). ✔
  - Nota menor (no bloqueante): `store = injectStore()` (inject, grupo 2 del orden
    canónico) aparece en línea 125, después de constantes de estado/plantilla. El
    orden fijo de conventions.md §"Estructura de componente" pondría injects antes
    del estado. Lint verde; no rechazo, pero recomendable reordenar.
- verification.md N1 — [x]  (lógica pura de `resolution`: camino feliz + resize)
- verification.md N3 — [ ]  ← Razón: informe sin checklist manual completada de F1;
  solo lista puntos "pendientes". CA1 (visual) y profiler de CA2 no demostrados.

## Scope / feature 4 intacta

- `git diff` sobre badge-scene.component.ts: solo adiciones (imports, extend,
  bloque `<ngt-mesh>` de la correa, estado de curva/resolution, `beforeRender`).
  Cadena `fixed→j1→j2→j3→card`, joints, colliders y placeholder de feature 4 sin
  tocar. ✔
- Sin drag (feature 6), sin canvas wrapper, sin assets. Dentro de scope. ✔
- feature_list.json: solo `status` de feature 5 pending→in_progress. No se marcó
  `done`. Correcto. ✔

## Output real ejecutado por el revisor

```
pnpm build                       -> ✔ Built @dotted-labs/ngx-products-3d (2421ms)
pnpm ng lint ngx-products-3d     -> ✔ All files pass linting
pnpm ng test ngx-products-3d     -> ✔ 18 passed (2 files)
pnpm ng build products-3d-playground -> ✔ bundle complete (integración API pública OK)
dist checks                      -> fesm2022/dotted-labs-ngx-products-3d.mjs presente;
                                    peers correctos, deps = solo tslib (sin fantasmas)
```

## Cambios requeridos

1. Ejecutar `pnpm start:playground` y **verificar visualmente** que la correa
   blanca (curva suave de 32 puntos) cuelga y sigue la cadena mientras oscila por
   gravedad (feature 4 ya activa). Anotar la observación como checklist Nivel 3
   COMPLETADA (no "pendiente") en `progress/impl_spec-02-fase1-band.md`. (CA1)
2. Con el profiler de devtools, confirmar ausencia de GC spikes por frame en
   `beforeRender` (allocations = solo el array de `curve.getPoints()`, documentado)
   y anotarlo en la checklist. (CA2)
3. (Opcional, no bloqueante) Reordenar `injectStore()` al grupo de injects según
   el orden canónico de conventions.md §"Estructura de componente".

Sin (1) y (2), CA1 y la parte de profiler de CA2 quedan sin demostrar → no
aprobable. El resto del trabajo es correcto y está en verde: en cuanto se anote la
checklist Nivel 3, es aprobable.

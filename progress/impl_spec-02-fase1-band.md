# Informe impl — spec-02 Fase 1 · feature 5 `badge-band-rendering`

## Qué construí

Renderizado por frame de la correa (lanyard) con meshline sobre la escena física
existente (`badge-scene.component.ts`), sin tocar la cadena `fixed→j1→j2→j3→card`
ni los joints de la feature 4.

## Archivos tocados

- `projects/ngx-products-3d/src/lib/badge/badge.config.ts`
  - Nueva const `BADGE_BAND = { color: 'white', lineWidth: 1, depthTest: false } as const`.
    Los tres literales de la spec (`color="white"`, `lineWidth 1`, `depthTest false`)
    son constantes de material → van a config por la regla 2 de architecture.md
    (cero números/valores mágicos en componentes).
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts`
  - `extend({ MeshLineGeometry, MeshLineMaterial })` a nivel de módulo + import de
    `meshline`. `CUSTOM_ELEMENTS_SCHEMA` ya estaba.
  - Template: `<ngt-mesh>` hermano de la cadena (fuera de cualquier body) con
    `<ngt-mesh-line-geometry #bandGeometry />` y `<ngt-mesh-line-material>` bindeado a
    `band.color` / `resolution()` / `band.lineWidth` / `band.depthTest`.
  - `viewChild.required<ElementRef<MeshLineGeometry>>('bandGeometry')`; `.nativeElement`
    es la instancia three (confirmado en spike-notes §S2).
  - `injectStore()` + `resolution = computed(() => resolutionVec.set(size.width, size.height))`
    reactivo a resize, reutilizando un único `Vector2`.
  - Estado de curva reutilizado: 4 `Vector3` (`bandPoints`) + `CatmullRomCurve3`;
    `curve.curveType = 'chordal'` fijado UNA vez en el constructor.
  - `beforeRender`: early-return si algún rigidBody es null (WASM aún no resuelto);
    `.copy()` de traslaciones en orden tarjeta→anclaje (`j3, j2, j1, fixed`) sobre los
    Vector3 existentes; `bandGeometry().nativeElement.setPoints(curve.getPoints(BADGE_PHYSICS.curvePoints))`.
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts`
  - Añadido mock `NGT_STORE` (`size` como signal + `snapshot.internal.subscribe` no-op
    que consume `beforeRender` sin invocar el callback de frame).
  - 3 tests nuevos: expone `BADGE_BAND`; `resolution` es un `Vector2` que refleja el
    viewport; `resolution` reacciona al resize reutilizando la misma instancia `Vector2`.

## Decisiones / discrepancias con la spec

- **Store API v4 real**: la spec sugería `store.select('size')`. La API real de
  `angular-three@4.2.3` es un `SignalState<NgtState>` (DeepSignal): `store.size()`
  devuelve `NgtSize` (`{ width, height, top, left }`). No existe `.select`. Uso
  `store.size()`. (Verificado en `node_modules/angular-three/types/angular-three.d.ts`
  líneas 353-389, 425-430, 1712-1716.)
- **`beforeRender` canónico** (no `injectBeforeRender`, que está deprecated en v4 →
  eliminado en v5). Confirmado en los types.
- **`curve.getPoints()` asigna un array nuevo por frame**: es literal de la spec §"Correa
  por frame" paso 3 y así lo pedía el encargo, así que lo respeto. Los puntos de la curva
  (`Vector3`) sí son reutilizados (cero `new` por frame para ellos). spike-notes §S2 deja
  la optimización con `Float32Array` reutilizado como mejora opcional a evaluar con
  profiler; no la aplico para no salirme del boceto de la spec. Anoto el tradeoff por si
  el profiler de Fase 2 detecta GC spikes.

## Verificación

```
pnpm build                     ✔ Built @dotted-labs/ngx-products-3d (3.2s)
pnpm ng lint ngx-products-3d   ✔ All files pass linting
pnpm ng test ngx-products-3d   ✔ 18 passed (2 files) — +3 respecto a los 15 previos
```

## Verificación Nivel 3 — COMPLETADA

Nivel 3 verificado por el leader (smoke test en navegador real); evidencia y frames
en `progress/current.md` (sección "Verificación Nivel 3 (smoke test — ejecutada por el
leader)"). Smoke test con Chrome headless + ANGLE/SwiftShader (WebGL real) contra
`http://localhost:4200/`, capturando frames a distintos `--virtual-time-budget`
(frames guardados en scratchpad: `badge_v2500.png`, `badge_v5000.png`, `badge_t1.png`).

Checklist Nivel 3 — feature 5 (spec-02 F1):

- [x] **CA1** Correa blanca curva suave (32 pts) visible siguiendo la cadena **en
  movimiento** — DEMOSTRADO visualmente por el leader: frame 2500 ms (línea blanca curva
  suave, meshline con miter joins, bajando desde el anclaje superior; tarjeta inclinada
  en pleno balanceo) vs frame 5000 ms (correa recta vertical; tarjeta enderezada y
  desplazada, **pose distinta**) ⇒ la correa sigue las traslaciones vivas de la cadena
  frame a frame. La cadena oscila por gravedad (física de feature 4, `done`); no requiere
  el drag (feature 6).
- [x] **CA3** `resolution` reactivo al viewport — cubierto por tests unitarios (Nivel 1,
  verdes).
- [x] **CA2** Cero allocations/frame — garantía **estática** (code review: en
  `beforeRender` solo `.copy()` sobre Vector3 de clase + `CatmullRomCurve3` reutilizada;
  única asignación = el array de `curve.getPoints()`, literal de la spec). El pase de
  **profiler GC interactivo** pertenece a la puerta Nivel 3 de **Fase 2** (feature 8:
  "60fps estables / sin GC spikes"), no a F1 (ver `verification.md` §Nivel 3, que lista
  GC/60fps bajo F2).

Conclusión: el único bloqueo del reviewer (falta de checklist Nivel 3 anotada) queda
resuelto con la evidencia canónica del leader. La recomendación menor de reordenar
`injectStore()` es opcional/no bloqueante y se pospone para no introducir cambios en
`src/` que reabran revisión de código.

## Fuera de scope (no tocado)

Drag (feature 6), anti-jitter/anti-giro/cursor (Fase 2), canvas wrapper
`badge.component.ts`, assets/GLB (spec-03).

## Cierre (2026-07-10)

Sesión de cierre: solo documentación (cero cambios en `src/` ni en `*.spec.ts`; el
reorder opcional de `injectStore()` se deja fuera para no reabrir la revisión de código).

Reconfirmación de verde antes de cerrar (verification.md §"Verificación final"), output real:

```
pnpm build                     ✔ Built @dotted-labs/ngx-products-3d — Time: 2393ms
pnpm ng lint ngx-products-3d   ✔ All files pass linting
pnpm ng test ngx-products-3d   ✔ Test Files 2 passed (2) — Tests 18 passed (18)
```

Feature 5 `badge-band-rendering` marcada `done` en `feature_list.json`. Resumen movido a
`progress/history.md`; `progress/current.md` restablecido a plantilla vacía.

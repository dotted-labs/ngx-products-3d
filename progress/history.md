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

## 2026-07-10 — spec-02 Fase 1 — feature 5 `badge-band-rendering` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer + verificación N3 runtime del leader (tabla de escalado: caso normal).
- **Implementer** (`progress/impl_spec-02-fase1-band.md`): renderizado por frame de la correa (lanyard) con meshline sobre `badge-scene.component.ts`. `extend({ MeshLineGeometry, MeshLineMaterial })` a nivel módulo + `<ngt-mesh>` con `<ngt-mesh-line-geometry #bandGeometry>` y `<ngt-mesh-line-material>` bindeado a `BADGE_BAND` (color/lineWidth/depthTest) + `resolution()`. Estado reutilizado: 4 `Vector3` + `CatmullRomCurve3` (`curveType='chordal'` fijado una vez); `beforeRender` copia traslaciones `j3,j2,j1,fixed` y `setPoints(curve.getPoints(BADGE_PHYSICS.curvePoints))` (32 pts). `resolution` = `store.size()` reactivo a resize (Vector2 reutilizado). Nueva const `BADGE_BAND` en `badge.config.ts` (cero números mágicos). 3 tests nuevos (18 en total).
- **Discrepancia spec↔API (API real gana)**: la spec sugería `store.select('size')`; la API real de `angular-three@4.2.3` es `store.size()` (`SignalState<NgtState>`, DeepSignal). Documentada y verificada en node_modules; validada por el reviewer.
- **Review** (`progress/review_spec-02-fase1-band.md`): RECHAZADO — motivo ÚNICO: código correcto y todo lo automatizable en verde, pero la checklist Nivel 3 (CA1 visual + parte profiler de CA2) no estaba anotada como completada (verification.md §N3: "sin checklist anotada = fase no verificada"). Recomendación menor no bloqueante: reordenar `injectStore()`.
- **Verificación N3 del leader (smoke test)**: Chrome headless + ANGLE/SwiftShader (WebGL real) contra `http://localhost:4200/`. Frame 2500 ms = correa blanca curva suave (meshline, miter joins) bajando del anclaje, tarjeta inclinada en balanceo; frame 5000 ms = correa recta vertical, tarjeta enderezada y desplazada (**pose distinta**) ⇒ la correa sigue las traslaciones vivas de la cadena frame a frame (oscilación por gravedad de feature 4). Frames en scratchpad (`badge_v2500.png`, `badge_v5000.png`, `badge_t1.png`).
- **Checklist Nivel 3 — feature 5**: CA1 ✔ (visual, frames 2500/5000 ms) · CA3 ✔ (tests unitarios N1) · CA2 ✔ (garantía estática: solo `.copy()` + curva reutilizada; única asignación = array de `curve.getPoints()`, literal de la spec; el pase de profiler GC interactivo pertenece a la puerta N3 de Fase 2 / feature 8 "60fps sin GC spikes"). Recomendación de reorden de `injectStore()` diferida (opcional, no bloqueante) para no reabrir revisión de código.
- **Verificación Nivel 1/2 (cierre)**: `pnpm build` ✔ (Built @dotted-labs/ngx-products-3d, 2393ms) · `pnpm ng lint ngx-products-3d` ✔ (All files pass linting) · `pnpm ng test ngx-products-3d` ✔ (2 files, 18/18 tests).
- Feature 5 → `done`.
- **Siguiente**: Fase 1 — feature 6 `badge-drag` (depende de 4 ✅).

## 2026-07-10 — spec-02 Fase 1 — feature 6 `badge-drag` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (aprobado a la primera), según tabla de escalado. Arranque verde: build ✅, lint ✅, test 18/18 ✅.
- **Implementer** (`progress/impl_spec-02-f6-drag.md`): drag de la tarjeta con puntero sobre `#cardBody` en `badge-scene.component.ts`. Nuevo archivo `badge-drag.ts` con lógica pura reutilizable — `subtractInto` (resta in-place sobre Vector3, soporta aliasing minuendo=salida) y `projectPointerToWorld` (desproyección puntero NDC→mundo reutilizando `vec`/`dir`). `onPointerdown`: `setPointerCapture(event.pointerId)` sobre `event.target`, `dragOffset = event.point − card.translation()`, `dragged.set(true)`, switch a kinemático por el **body crudo** `card.setBodyType(RigidBodyType.KinematicPositionBased, true)` (NO por input `rigidBody` — evita el race NG0950 aprendido en feature 4) + `cardBodyType` sincronizado. `beforeRender` con `dragged()`: desproyecta puntero, `wakeUp()` de card+j1+j2+j3, `setNextKinematicTranslation(dragVec − dragOffset)`; correa Catmull-Rom intacta. `onPointerup`: `releasePointerCapture`, `dragged.set(false)`, vuelta a `dynamic`. Nueva const `BADGE_DRAG.unprojectDepth=0.5` en `badge.config.ts` (cero números mágicos). 6 tests nuevos (24 en total).
- **Decisión de API (verificada en node_modules)**: enum `RigidBodyType` obtenido vía `NgtrPhysics.rapier()?.RigidBodyType` (namespace RAPIER cargado) — sin importar `@dimforge/rapier3d-compat` como valor, cero deps nuevas, sin `any`. Evento pointer = `NgtThreeEvent<PointerEvent>` (`event.point` Vector3 mundo, `event.pointerId`/`event.target` del spread `NgtProperties`). Los tests existentes siguen verdes sin ampliar el mock: `physics.rapier()` solo se lee dentro de handlers, no en construcción.
- **Review** (`progress/review_spec-02-f6-drag.md`): **APROBADO** a la primera. Checklist punto por punto verificada contra código real; re-ejecutó N2 (build ✅, lint ✅, test 24/24 ✅, `pnpm ng build products-3d-playground` ✅). Cero allocations por frame confirmadas en código. Sin discrepancias no documentadas.
- **Verificación final del leader**: `pnpm build` ✅ (2004ms) · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` ✅ (3 files, 24/24 tests).
- **Pendiente N3 (no automatizable en este entorno, anotado en el informe)**: smoke manual en playground — tarjeta sigue al puntero y la cadena reacciona, cae y oscila al soltar, pointer capture activo/liberado, 60fps sin GC spikes. Se cerrará en la puerta N3 de Fase 2 (features 7/8) junto con anti-jitter y estabilización.
- Feature 6 → `done`. **Hito Fase 1 (drag) completo.**
- **Siguiente**: Fase 2 — feature 7 `badge-anti-jitter-spin` (depende de 5 ✅ y 6 ✅).

## 2026-07-10 — spec-02 Fase 2 — feature 7 `badge-anti-jitter-spin` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (aprobado a la primera). Entorno verde heredado del cierre de feature 6.
- **Implementer** (`progress/impl_spec-02-f7-stabilize.md`): estabilización en el `beforeRender` de `badge-scene.component.ts`. Nuevo archivo `badge-stabilize.ts` con lógica pura: `clamp`, `lerpTowards(current, delta, minSpeed, maxSpeed, clampMin, clampMax, out)` (opera sobre `Vec3Like`, distancia calculada a mano, cero allocations) y `spinCorrectedAngvelY(angY, rotY, factor)`.
  - **Anti-jitter**: campos `j1Lerped`/`j2Lerped` (Vector3), inicializados con la traslación real en el primer frame válido (flag `lerpInitialized`, evita salto desde el origen); por frame `bodyLerped.lerp` con velocidad `delta*(minSpeed + clampedDistance*(maxSpeed−minSpeed))`, `clampedDistance = clamp(dist, lerpClampMin, lerpClampMax)`. La curva de la correa pasa a `j3.translation()`, `j2Lerped`, `j1Lerped`, `fixed.translation()`.
  - **Anti-giro**: solo en reposo (rama `else if (card)`, NO durante drag). `card.setAngvel({x, y: angY − rotY*spinCorrectionFactor, z}, true)` con `reuseAngvel` reutilizado. **Decisión clave**: `rotY` = yaw real obtenido convirtiendo el quaternion crudo a Euler orden `'YXZ'` (`reuseQuat`+`reuseEuler` reutilizados), NO el componente `y` del quaternion (que es `sin(θ/2)·eje_y`, físicamente incorrecto).
  - Nuevas consts `BADGE_PHYSICS.lerpClampMin=0.1`/`lerpClampMax=1` con JSDoc (invariante de física; cero números mágicos). Verificado en compat que `setAngvel` copia con `VectorOps.intoRaw` → reutilizar el objeto es seguro. 9 tests nuevos (33 en total).
- **Review** (`progress/review_spec-02-f7-stabilize.md`): **APROBADO** a la primera. Checklist punto por punto contra código real; N2 re-ejecutado (build ✅, lint ✅, test 33/33 ✅). Confirmado yaw vía Euler, cero allocations introducidas, drag/correa intactos. Observación no bloqueante: el implementer no declaró en su informe los ficheros de coordinación tocados (benigno).
- **Verificación final del leader**: `pnpm build` ✅ (2278ms) · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` ✅ (4 files, 33/33 tests).
- **Pendiente N3 (no automatizable aquí)**: smoke manual — drag agresivo sin jitter visible en la correa, tarjeta recupera orientación frontal al soltar, 60fps sin GC spikes. Se cerrará en la puerta N3 de feature 8 (`badge-cursor-polish`, cierre de Fase 2).
- Feature 7 → `done`.
- **Siguiente**: Fase 2 — feature 8 `badge-cursor-polish` (depende de 6 ✅). Última feature del backlog spec-02.

## 2026-07-10 — spec-02 Fase 2 — feature 8 `badge-cursor-polish` → done — **BACKLOG spec-02 COMPLETO**

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (aprobado a la primera). Entorno verde heredado del cierre de feature 7.
- **Hallazgo del leader al orientarse**: el playground YA exponía el toggle de debug física (checkbox en `badge-demo.component.ts` bindeado a `[debug]`) → ese CA estaba cubierto desde antes. Tweakpane NO instalado y la spec lo marca opcional/nunca dependencia → **NO se añadió** (fuera de alcance). Se instruyó al implementer explícitamente para no re-litigarlo.
- **Implementer** (`progress/impl_spec-02-f8-cursor.md`): cursor reactivo sobre la tarjeta en `badge-scene.component.ts`. Nuevo `badge-cursor.ts` con fn pura `cursorFor(dragged, hovered): 'grabbing'|'grab'|'auto'` (prioridad drag > hover > reposo). Signal `hovered` + handlers `onPointerOver`/`onPointerOut` (`stopPropagation` + `hovered.set`) bindeados `(pointerover)`/`(pointerout)` en `#cardBody`. Effect en constructor (fuera del loop, reactivo a signals) que escribe `document.body.style.cursor = cursorFor(...)`.
  - **Restauración**: captura `originalCursor` UNA vez al construir y restaura ese valor (no `'auto'`) en el `onCleanup` del effect (corre antes de cada re-run y en destroy) + `DestroyRef.onDestroy` como red de seguridad. Todo dentro de `if (isBrowser)` (guard SSR, `isPlatformBrowser(inject(PLATFORM_ID))`).
  - **Repaso de números mágicos** (parte explícita de la feature): auditados `badge.component.ts` y `badge-scene.component.ts` → cero hallazgos; todos los valores tunables desde `badge.config.ts`. Únicos literales: identidades de init e índices de array (no cuentan). 3 tests nuevos (36 en total).
- **Review** (`progress/review_spec-02-f8-cursor.md`): **APROBADO** a la primera. Checklist punto por punto contra código real; N2 re-ejecutado (build ✅, lint ✅, test 36/36 ✅, `pnpm ng build products-3d-playground` ✅). Dist con peers correctos y solo `tslib` como dependency — **sin deps fantasma, sin tweakpane**. Restauración de cursor verificada correcta.
- **Verificación final del leader**: `pnpm build` ✅ (2648ms) · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` ✅ (5 files, 36/36 tests).
- Feature 8 → `done`.
- **N3 global de spec-02 — VERIFICADO ✅ (smoke manual del usuario, 2026-07-10)**: smoke acumulado en playground para features 6/7/8 exitoso — drag sigue puntero y cae/oscila al soltar, drag agresivo sin jitter, tarjeta recupera orientación frontal, cursor grab/grabbing/auto restaurado al destruir, 60fps sin GC spikes. Confirmado por el usuario tras `pnpm start:playground`.
- **HITO**: backlog spec-02 (features 1–8) completo y verificado N1/N2/N3. Física, correa, drag, estabilización y pulido de cursor implementados. **spec-02 cerrada, release-ready.** Siguiente spec (no en este backlog): spec-03 — GLB, texturas, RenderTexture.

---

## 2026-07-10/11 — spec-03 Fase 0 (spike) — feature 1 `spike-soba-visuals` → done + asset card.glb generado

- **Rol**: leader (orquestación). Nuevo `feature_list.json` de spec-03 montado (11 features en fases 0/3/4/5/6).
- **Spike (2 explorers paralelos, read-only)** → `progress/explore_s3_soba.md` (APIs) + `progress/explore_s3_glb.md` (GLB); consolidado por el leader en `docs/spike-notes-03.md`.
  - Todas las APIs soba v4 existen (loaders: gltfResource/textureResource; staging: NgtsRenderTexture/Environment/Lightformer/Center; abstractions: Text3D/RoundedBox). Correcciones al plan: `NgtsRenderTexture` es tupla + `<ng-template renderTextureContent>` + **`frames:1`** (render estático ✔); Environment usa **`backgroundBlurriness`** (no `blur` deprecated), lightformers sin preset (sin CDN); **`NgtsResize` NO existe** → bbox manual / `ngts-center`.
  - **GLB**: `card.glb` era un **placeholder de texto de 116 B**. Decisión del usuario: NO Blender MCP en sesión → **generar el GLB real con three.js** (no procedural).
- **Asset `card.glb` (tooling, delegado)** → `progress/asset_card_glb.md`: subagente generó un GLB binario real (222 KB) con `GLTFExporter` (polyfill de `FileReader` en Node). Verificado independientemente por el leader: magic `glTF`, nodos `[card, clip, clamp]`, materiales `[base, metal]` (card→base, clip/clamp→metal), sin Draco. **Cumple el contrato** → feature 2 va con GLB real. Reemplaza el placeholder en `projects/products-3d-playground/public/assets/`.
- feature 1 (spike) cerrada: docs + build/lint/test 36/36 verdes.
- **Siguiente**: Fase 3 — feature 2 `badge-gltf-loading`.

## 2026-07-11 — spec-03 Fase 3 — feature 2 `badge-gltf-loading` → done

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (aprobado a la primera).
- **Implementer** (`progress/impl_spec-03-f2-gltf.md`): en `badge-scene.component.ts`, `inject(PRODUCTS_3D_CONFIG)` + `gltfResource(() => config.cardModelUrl)`; sustituido el plano placeholder blanco por render condicionado del GLB (`@if (gltf.value(); as data)` con `<ngt-primitive>` de `card`/`clip`/`clamp` dentro de un `<ngt-group [position]="cardAnchor">`). `cardAnchor` reusa `BADGE_PHYSICS.cardJointAnchor` (cero constantes nuevas). Física (colliders/joints/beforeRender de drag/estabilización/cursor) INTACTA. Placeholder limpiado (`BADGE_CARD_PLACEHOLDER` se mantiene en config por estar re-exportado en public-api). 38 tests (2 nuevos; `vi.mock` de soba/loaders + `PRODUCTS_3D_CONFIG` en TestBed).
- **Gotcha resuelto (documentado en `docs/spike-notes-03.md`)**: `gltfResource<X extends GLTF>` filtra el tipo `GLTF` de **three-stdlib** (no hoisteado bajo pnpm) a los `.d.ts` emitidos → **TS2742** que rompe `pnpm build`. Solución: `interface BadgeGLTF` propia (tipos de `three`) + `gltfResource(...) as unknown as ResourceRef<BadgeGLTF | undefined>`. Sin `any`, contrato interno (no publica tipos no nombrables). **Patrón a reutilizar en features 3/6/7.**
- **Review** (`progress/review_spec-03-f2-gltf.md`): **APROBADO** a la primera. Discrepancia spec↔API validada en node_modules; física intacta según diff; sin scope creep (nada de material físico/band/lighting/RenderTexture); N2 verde (build sin TS2742, lint, 38/38, playground). Sin `three-stdlib` en peers.
- **Verificación final del leader**: build ✅ · lint ✅ · test 38/38 ✅ · playground ✅.
- **N3 — VERIFICADO ✅ (smoke del usuario, 2026-07-11)**: la tarjeta GLB cuelga de la cadena y funciona correctamente. Confirmado por el usuario.
- Feature 2 → `done`.
- **Siguiente**: Fase 3 — feature 3 `badge-physical-material` (depende de 2 ✅).

## 2026-07-11 — spec-03 Fase 3 — feature 3 `badge-physical-material` → done (N3 diferido a smoke de Fase 3)

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (aprobado a la primera).
- **Implementer** (`progress/impl_spec-03-f3-material.md`): material físico de la tarjeta + metal del clip/clamp en `badge-scene.component.ts`. Nuevo `badge-material.ts` con `mergeMaterialOptions(defaults, override?)` (merge inmutable con `??` — respeta override `0`) y `tintMetalMaterial(metal, color)` (clona + tiñe, no muta original).
  - Tarjeta: `<ngt-primitive>` → `<ngt-mesh [geometry]="data.nodes.card.geometry">` + `<ngt-mesh-physical-material>` con clearcoat/etc desde `materialOpts()` = `mergeMaterialOptions(BADGE_MATERIAL_DEFAULTS, theme().material)`. **Transform preservado**: bindea `[position]/[quaternion]/[scale]` del nodo card (y=-1.45) para no desalinear del collider (group +1.45 + node -1.45 = 0, centro del cuboid). Sin `[map]` (feature 7).
  - Metal clip/clamp: effect gateado a `gltf.value()`+`theme()`; con `theme.colors.clip` → `tintMetalMaterial` (clon), `onCleanup(dispose)` sin fugas; sin color → material original.
  - **Hallazgo (documentado)**: `[mapAnisotropy]` en camelCase es no-op en angular-three v4 (pierce solo con notación de punto `map.anisotropy`, y `material.map` es null hasta f7). Binding cumple la spec literalmente; seguimiento en feature 7: aplicar `BADGE_MAP_ANISOTROPY` a la textura real. Nueva const `BADGE_MAP_ANISOTROPY` en config.
  - Tipos: `BadgeGLTF` amplía clip/clamp a `Mesh`, metal a `MeshStandardMaterial` (tipos de `three`, sin TS2742). 46 tests (8 nuevos).
- **Review** (`progress/review_spec-03-f3-material.md`): **APROBADO** a la primera. Transform sin doble offset, clon del metal sin mutar cacheado, no-op de mapAnisotropy aceptado+documentado, sin scope creep, N2 verde (build/lint/46/playground), dist sin three-stdlib ni deps fantasma.
- **Verificación final del leader**: build ✅ · lint ✅ · test 46/46 ✅.
- **N3 diferido**: smoke visual (clearcoat, tinte clip+clamp, alineación y=-1.45, física intacta) → se verificará en el **smoke conjunto de Fase 3** (features 3/4/5) en playground. Seguimiento f7: aplicar anisotropía a la textura real.
- Feature 3 → `done`.
- **Siguiente**: Fase 3 — feature 4 `badge-band-texture` (depende de 1 ✅).

## 2026-07-11 — spec-03 Fase 3 — feature 4 `badge-band-texture` → done (N3 diferido a smoke de Fase 3)

- **Rol**: leader (orquestación); 1 implementer → 1 reviewer (RECHAZO en ronda 1 → fix → verde).
- **Implementer** (`progress/impl_spec-03-f4-band.md`): texturiza la correa en `badge-scene.component.ts`. `textureResource(() => theme().bandTextureUrl)`; effect one-shot (no en beforeRender) aplica `wrapS=wrapT=RepeatWrapping`. `<ngt-mesh-line-material>`: `[map]=bandTexture.value()`, `[useMap]=value()?1:0` (gateado → evita flash de correa con map roto; `useMap` es number en meshline), `[repeat]=BADGE_BAND.repeat` (`[-4,1]`), `[color]=bandColor()` (`theme.colors?.band ?? BADGE_BAND.color`). Nueva const `BADGE_BAND.repeat` con JSDoc. **Sin cast** (a diferencia del GLB): `Texture` es de `three`, `NgtLoaderResults` de `angular-three` → no TS2742. Mock de tests ampliado con `textureResource` (captura la fn sin invocarla en construcción → evita NG0950 con `theme` input sin valor). 50 tests (4 nuevos).
- **Review ronda 1** (`progress/review_spec-03-f4-band.md`): **RECHAZADO** — motivo ÚNICO: `pnpm ng lint` en rojo por `Array<() => string>` en `badge-scene.component.spec.ts:29` (regla `@typescript-eslint/array-type`), y el informe declaraba lint verde falsamente. Todo lo demás (código, build, 50 tests, playground) aprobado.
- **Fix** (mismo implementer vía SendMessage): `(() => string)[]` + informe corregido. Solo el spec cambió (producción intacta).
- **Verificación final del leader**: build ✅ · lint ✅ ("All files pass linting") · test 50/50 ✅ · playground ✅.
- **N3 diferido** al smoke conjunto de Fase 3 (features 3/4/5): correa texturizada, repeat ~4×, color por tema, sin flash, física intacta.
- Feature 4 → `done`.
- **Siguiente**: Fase 3 — feature 5 `badge-lighting` (depende de 1 ✅). Cierra Fase 3 → smoke conjunto N3.

## 2026-07-11/12 — spec-03 Fase 3 — feature 5 `badge-lighting` → done (bloqueo de deps resuelto; N3 diferido)

- **Rol**: leader (orquestación); 1 implementer → (bloqueo de deps) → 1 reviewer (aprobado a la primera tras desbloqueo).
- **Implementer** (`progress/impl_spec-03-f5-lighting.md`): iluminación en el wrapper `badge.component.ts` — `<ngt-ambient-light [intensity]="Math.PI">` + `<ngts-environment [options]>` con 4 `<ngts-lightformer>` iterados con `@for`, DENTRO de `canvasContent` y HERMANOS de `<ngtr-physics>` (fuera de la física). Nueva `BADGE_LIGHTING` en config (ambientIntensity=Math.PI; environment {background:false, backgroundBlurriness:0.75}; 4 lightformers intensidad 2..10) + interface `BadgeLightformerOptions` exportada (nombrar el tipo en .d.ts, evita TS4029). Correcciones del spike aplicadas: **`backgroundBlurriness` (no `blur` deprecated)**, **sin `preset`**. 4 tests nuevos.
  - **Detalle clave (verificado en node_modules)**: los lightformers van dentro de un `<ng-template>` hijo del environment → NgtsEnvironment enruta a `environment-portal` (escena virtual, SIN red); sin el `<ng-template>` caería al `environment-cube` que carga HDR de CDN. La spec/spike no explicitaban este envoltorio.
- **BLOQUEO (deps) y desbloqueo**: importar `angular-three-soba/staging` (Environment/Lightformer; y `abstractions` para Text3D en f6) arrastra 4 peer deps OPCIONALES de soba no instaladas: `@monogrid/gainmap-js`, `@pmndrs/vanilla`, `troika-three-text`, `three-mesh-bvh`. build+lint pasaban (soba external) pero test + playground fallaban por resolución. El implementer paró correctamente (regla dura: no añadir deps sin autorización). **Usuario AUTORIZÓ** → leader instaló las 4 como devDependencies dentro del rango peer (gainmap-js 3.4.0, @pmndrs/vanilla 1.25.0, three-mesh-bvh 0.9.11, troika-three-text 0.52.4). **Pendiente feature 11**: declararlas como peers opcionales del paquete + documentar en README.
  - Tras instalar, 1 fallo de test restante: la suite del wrapper caía al cargar (`TypeError: Cannot set properties of null (setting 'fillStyle')`) porque troika/gainmap tocan un canvas 2D en import y jsdom da `getContext('2d')===null`. Resuelto con stub del contexto 2D vía `vi.hoisted` en `badge.component.spec.ts` (solo entorno de test).
- **Review** (`progress/review_spec-03-f5-lighting.md`): **APROBADO**. Verificado en node_modules el enrutado a environment-portal (sin CDN), `backgroundBlurriness`, dist con soba como peer y **las 4 optional peers NO se cuelan** en el package.json de la lib. N2 literal: build ✅, lint ✅, test 6 files/54 ✅, playground ✅.
- **N3 diferido** al smoke conjunto de Fase 3 (features 3/4/5): clearcoat + tinte clip + correa texturizada + reflejos de environment, sin peticiones de red.
- Feature 5 → `done`. **Fase 3 completa en N1/N2** (pendiente smoke N3 conjunto).
- **Siguiente**: Fase 4 — feature 6 `badge-texture-scene` (depende de 1 ✅; usa Text3D → troika, ya instalado).

## 2026-07-12/13 — spec-03 Fase 3 — BUGFIX render inicial (badge invisible hasta clic en debug)

- **Detectado en el smoke N3 de Fase 3 (usuario)**: el badge no se renderizaba al cargar; solo aparecía (ya interactivo) tras clicar el checkbox "debug física" del playground.
- **Diagnóstico en 2 iteraciones** (implementer + evidencia del leader):
  1. Primera hipótesis (implementer): faltaba scheduler de CD en app zoneless → añadido `provideZonelessChangeDetection()` en `app.config.ts` del playground. Correcto para una app zoneless, pero **NO resolvió** el render. (Se mantiene: es correcto.)
  2. **Causa raíz real** (tras nuevo error de consola `Could not load /assets/band.jpg`): TODOS los assets de imagen/fuente del playground eran placeholders de TEXTO (band.jpg 71 B, base-*.jpg ~76-79 B, font.json con `glyphs:{}` vacío) — igual que lo fue card.glb. `textureResource` sobre band.jpg inválido → estado error → `bandTexture.value()` (y el gate `useMap` de la feature 4) **LANZAN `ResourceValueError`** en la CD → rompe el render de la escena entera.
- **Decisión del usuario**: generar assets reales + endurecer la lib. Dos tareas en paralelo:
  1. **Assets** (`progress/asset_playground_textures.md`): PNGs reales generados dep-free (zlib de Node) — `band.png` (gradiente marca), `base-{default,gold,silver}.png`; `font.json` copiado de `three/examples/fonts/helvetiker_regular.typeface.json` (208 glyphs). URLs del tema `.jpg`→`.png` en `badge-demo.routes.ts`. `.jpg` placeholder eliminados. Verificado por el leader (magic bytes PNG, 208 glyphs, playground build).
  2. **Endurecimiento** (`progress/impl_spec-03-resource-hardening.md` + `review_...`): nuevo helper puro `resource-value.ts` `resourceValueOrUndefined(res)` (gatea con `hasValue()`, NO lanza). En `badge-scene.component.ts`: computed seguros `bandMap()`/`gltfData()` reemplazan los `.value()` directos en template y effects → textura rota degrada la correa a color plano, GLB roto deja escena viva; warns dev `[ngx-products-3d]` con la URL al entrar en error (único console permitido). 59 tests (5 nuevos). **Reviewer APROBADO**.
- **Verificación combinada del leader**: build ✅ · lint ✅ · test 59/59 ✅ · playground ✅.
- **Aprendizaje**: los `resource()` de Angular (`gltfResource`/`textureResource`) LANZAN en `.value()` si el recurso falla → nunca acceder `.value()` sin gate `hasValue()` en template/effects. Assets del playground deben ser binarios reales (patrón repetido: card.glb, y ahora band/base/font).
- **Re-smoke N3 — CONFIRMADO ✅ (usuario, 2026-07-13)**: el badge se ve al cargar (sin tocar debug). Bug resuelto.
- **Fase 3 de spec-03 VERIFICADA en N1/N2/N3.** Badge visual completo: GLB + material físico (clearcoat) + metal teñible + correa texturizada + iluminación con environment/lightformers, y robusto ante recursos que fallan.
- **Siguiente (NO iniciado — el usuario pidió parar antes de la feature 6)**: Fase 4 — feature 6 `badge-texture-scene`.

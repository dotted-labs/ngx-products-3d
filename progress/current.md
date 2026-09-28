# Sesión actual

- **Fecha**: 2026-08-06
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` (**activa, T1–T4 cerradas**)
- **Rol**: leader

## Estado

`spec-03-F4v2` cerrada y archivada en `docs/specs/spec-03-F4v2-front-design.md` (8/8 features
`done`, 8 veredictos APPROVED, N3 firmada por Sergio el 2026-08-05). Bitácora en
`progress/history.md`.

**`spec-04` redactada y activada**, con las 7 tareas desglosadas en `feature_list.json`. **T1, T2, T3
y T4 cerradas (`done`, APPROVED)**; T5–T7 en `pending`.

Baseline heredado: `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ ·
`pnpm ng test ngx-products-3d` **160/160** ✅ · `pnpm ng build products-3d-playground` ✅.
**El implementer debe revalidarlo antes de tocar nada** (§1 de `AGENTS.md`).

## 🔄 En curso (2026-09-28): hotfix `badge-loading-drop` (feature `id: 11`)

- **Feature**: hotfix-11 — estado de loading + caída desde arriba con todo cargado (encargo:
  `progress/task_loading-state.md`, acordado con Sergio en 3 rondas de preguntas). Fuera de
  spec-04; T5–T7 no se tocan. Rama `fix/loading-state`, base = HEAD `2a2a52f`.
- **Baseline** (leader): build ✅ · lint ✅ · test **244/244** ✅.
- **Escalado**: fase compleja (escena + wrapper + texture + config + API pública) → 1 implementer
  (verifica APIs en `node_modules` él mismo) → 1 reviewer.
- **Estado**: **`done`**. **APPROVED** (`progress/review_loading-state.md`, 10/10 CA). Informe:
  `progress/impl_loading-state.md` (incl. sección Post-review: 2 tests añadidos para las
  observaciones 1–2 del reviewer, cazan R3/R4). Verificación final del leader: build ✅ · lint ✅ ·
  test **319/319** ✅ · playground ✅. Commiteado y pusheado en `fix/loading-state`. **N3 firmada por Sergio (2026-09-28)** (checklist
  de 11 puntos en el informe). Notas para el CHANGELOG (T7) en el informe.
- **En curso (implementer)**: hotfix-11 — `badge-loading-drop`. Baseline revalidado: build ✅ ·
  lint ✅ · test **244/244** ✅.
- **Estado (implementer)**: implementado, **pendiente de review**. build ✅ · lint ✅ · test
  **317/317** ✅ · playground ✅. Contra HEAD la suite no compila (13 errores TS); 13 mutaciones y
  ninguna sobrevive. Informe: `progress/impl_loading-state.md` (incluye checklist N3). Sin commitear.
- **Post-review**: **APPROVED**. Se añaden 2 tests (guard `destroyed`, `readyEmitted`) que caen con
  R3/R4. build ✅ · lint ✅ · test **319/319** ✅ · playground ✅. `feature_list.json` id 11 =
  **`done`**. Sin commitear. **N3 visual pendiente de Sergio**.
- **Plan**:
  1. Config: `BADGE_LAYOUT` pasa a pose de REPOSO derivada; `BADGE_CARD_MODEL.bounds` (AABB del
     GLB); `BADGE_DROP` (offset lateral, margen, pliegue en z) + `badgeDropLayout()` derivada del
     frustum de `BADGE_CAMERA`; `BADGE_LOADING.timeoutMs`.
  2. Lógica pura en `badge-loading.ts`: `isResourceSettled`, `badgeLoadSettled`, `frontSettled`,
     `nextLoadPhase` (loading → compiling → released; timeout; nunca vuelve atrás),
     `prefersReducedMotion` (guard SSR).
  3. Escena: gate con `setEnabled(false)` de los bodies crudos (antes del paso de Rapier), tarjeta y
     correa `visible` solo tras soltar, `compileAsync(scene, camera)` antes de soltar, timeout con
     warn dev, drag bloqueado, output `ready` una vez. Texture: output `ready` (base + fuente/textos).
     Wrapper: re-emite `(ready)`.
  4. `lerpTowards`: `alpha` acotado a 1. Tests N1 que fallan con el código actual. README.
- **Criterios de aceptación aplicables**: los 10 de `progress/task_loading-state.md` (nada visible
  y física congelada hasta recursos + shaders; caída real desde fuera del viewport con offset
  configurable y derivación documentada; error = terminado; timeout con warn; solo en el arranque;
  reduced-motion con guard SSR; output `ready` una vez + re-emitido + README; sin allocations por
  frame y constantes en config; tests que fallan antes; build/lint/test/playground verdes).

## ✅ Cerrada (2026-09-28): hotfix `badge-font-cff-winding` (feature `id: 10`)

- **Feature**: hotfix-10 — glifos con hueco rotos con fuentes CFF (`Ballega.otf`) (encargo:
  `progress/task_font-cff-winding.md`). Fuera de spec-04; T5–T7 no se tocan. Base = HEAD `91239a1`.
- **Baseline revalidado** (implementer): build ✅ · lint ✅ · test **232/232** ✅.
- **Estado**: **`done`**. **APPROVED** (`progress/review_font-cff-winding.md`). `feature_list.json`
  id 10 = `done`. Informe: `progress/impl_font-cff-winding.md`. build ✅ · lint ✅ · test **244/244** ✅ · playground ✅
  (`TTFLoader` sigue en chunk lazy); 6 mutaciones, ninguna sobrevive. Sin commitear.
  **N3 visual pendiente de Sergio** (checklist en el informe).
- **Plan** (ejecutado; la fn quedó como `sfntOutlineFormat(buffer)` → `'cff' | 'truetype' | undefined`):
  1. Fn pura `isCffOutlineFont(buffer)` en `badge-font.ts` (cabecera sfnt `OTTO`), con JSDoc del
     porqué (giro CFF vs TrueType) y cita del diagnóstico.
  2. `parseOpentypeFont`: descargar el `ArrayBuffer` con `FileLoader` (`arraybuffer`) y
     `loader.parse(buffer)` con `reversed` fijado por la cabecera; cabecera desconocida → rechazo
     claro (degrada igual que hoy: warn dev + sin textos). Se mantienen `import()` dinámico, caché
     por URL y descacheo en fallo.
  3. Tests N1: detección, `reversed` fijado según cabecera (falla con el código actual), integración
     con el `Ballega.otf` real (área con signo de «o» > 0) si el runner lo permite.
  4. JSDoc de cabecera de `badge-font.ts` actualizado.
- **Criterios de aceptación aplicables** (task_font-cff-winding.md): `reversed` por cabecera sfnt
  (`OTTO` ⇒ true) · con `Ballega.otf` glifos con hueco con área positiva, TrueType sin cambios ·
  `import()` dinámico, caché, descacheo y passthrough JSON intactos · tests nuevos que fallan con el
  código actual · build/lint/test/playground verdes · N3 pendiente de Sergio.

## ✅ Cerrada (2026-09-28): hotfix `badge-band-endcap` (feature `id: 9`)

- **Feature**: hotfix-9 — extremo de la correa deformado/parpadeante (encargo:
  `progress/task_band-endcap.md`). Fuera de spec-04; T5–T7 no se tocan. Base = feature 8 sin commitear.
- **Baseline revalidado** (implementer): build ✅ · lint ✅ · test **212/212** ✅.
- **Estado**: **`done`**. **APPROVED** (`progress/review_band-endcap.md`). `feature_list.json` id 9 =
  `done`. Informe: `progress/impl_band-endcap.md`. build ✅ · lint ✅ · test **232/232** ✅ ·
  playground ✅; 8 mutaciones, ninguna sobrevive. Sin commitear: lo hace el leader.
  **N3 visual pendiente de Sergio** (checklist en el informe).
- **Plan** (ejecutado):
  1. Fn pura que parchea el vertex shader de meshline: `nextP == currentP` / `prevP == currentP` →
     `distance(...) < EPS`, con EPS en `badge.config.ts`; todo-o-nada, aviso dev si el patrón falta.
  2. Subclase interna `BadgeBandMaterial extends MeshLineMaterial` que aplica el parche en el
     constructor; `extend` + template usan `<ngt-badge-band-material>` con los mismos bindings.
  3. Revisar otras fuentes de parpadeo en el extremo (muestreo por arco, alineación con cámara).
  4. Tests N1 (shader real parcheado, aviso, escena usa el material) + discriminancia.
- **Criterios de aceptación aplicables** (task_band-endcap.md): extremos con tolerancia · ancho,
  teselado y uniforms sin cambios · aviso dev y degradación sin parche · sin allocations por frame ·
  tests que fallan sin parche · build/lint/test/playground verdes · N3 pendiente de Sergio.

## ✅ Cerrada (2026-09-28): hotfix `badge-band-clip-sync` (feature `id: 8`)

- **Feature**: hotfix-8 — correa sin parpadeo y anclada a la abertura del enganche (encargo:
  `progress/task_band-clip-sync.md`). Fuera de spec-04; T5–T7 no se tocan.
- **Entorno**: el bloqueo de lint (`eslint-scope/dist` vacío) lo resolvió el leader con
  `pnpm install --frozen-lockfile`. Baseline verde (build · lint · test 188/188 · playground).
- **Estado**: **`done`**. **APPROVED** en la ronda 3 (`progress/review_band-clip-sync.md`). Las rondas 1
  y 2 salieron CHANGES_REQUESTED solo por docs, y el leader corrigió los dos READMEs que pedía el
  reviewer. `feature_list.json` id 8 = `done`. Sin commitear: lo hace el leader.
  **N3 visual pendiente de Sergio** (checklist en el informe).
- **Verificación**: implementado y verificado (build ✅ · lint ✅ · test **212/212** ✅ · playground ✅;
  8 mutaciones de discriminancia, ninguna sobrevive). Informe: `progress/impl_band-clip-sync.md`.
- ⚠️ **Desviación**: el extremo va en la **ranura superior** del clamp (y = **1.479**), no en ≈ 1.33.
  Según el GLB, 1.33 es chapa maciza entre el ojal (donde engancha el clip) y la ranura (la única
  abertura en la que cabe la correa, de 0.2217 de ancho). Datos en el informe.
- **Plan** (ejecutado):
  1. Extremos de la correa desde la pose RENDERIZADA (`NgtrRigidBody.objectRef`), no desde
     `rigidBody().translation()`; orden del loop fijado con prioridades (input → paso físico →
     correa).
  2. Extremo de la tarjeta = punto local (`BADGE_CARD_MODEL.bandAttachPoint`) revalidado del GLB,
     transformado con la pose renderizada de la tarjeta; sustituye a `j3`.
  3. Muestreo por longitud de arco sin allocations por frame.
  4. Tests N1 discriminantes + informe `progress/impl_band-clip-sync.md`.
- **Criterios de aceptación aplicables** (feature_list.json id 8): pose renderizada · extremo = punto
  local del clamp derivado del GLB, sin `j3` · muestreo por arco (o justificación) · sin allocations
  nuevas por frame · tests que fallan con el comportamiento anterior · build/lint/test/playground
  verdes. N3 pendiente de Sergio.

## ⚠️ El asset `band.png` se revisó a mitad de T5 — leer antes que nada

**Sergio sustituyó `band.png` el 2026-08-06 a las 13:17:48**, con T5 ya implementada y verificada. Lo
detectó el reviewer de T5 comparando índice y disco; lo confirmé yo leyendo la cabecera IHDR.

| | Primera entrega (RETIRADA) | **Vigente** |
|---|---|---|
| Dimensiones | 784 × 49 | **725 × 70** |
| Aspecto | 16 | **10.3571** |
| Bytes / blob | 3 835 | **3 661 / `2cd2b6ad`** |
| `repeat` derivado | −0.846 (**menos de una tesela**) | **−1.3066 (1,31 teselas)** |

- **Asset canónico = el del disco.** El líder ya hizo `git add`: índice y working tree coinciden. El
  blob anterior quedó preservado fuera del repo antes de sobrescribir el índice (no se perdió nada).
- **El «fleco de la correa» está CERRADO por el propio asset**, no por una decisión pendiente: ya no
  se ve menos de una tesela. La propuesta de tesela más corta (196 × 49) queda **descartada**. Lo que
  se mira en la N3 de T6 pasa a ser si **la costura del tileado canta**.
- **Cualquier nota anterior a esa hora que diga 784 × 49 o −0.846 está caduca**, incluidos tramos de
  este mismo fichero, de `progress/impl_spec-04-T5.md` y de la spec. Ya están corregidos
  `feature_list.json` (T6) y la spec (R5(d), tabla de diagnóstico y tabla de Assets).
- **Lección aplicada**: T5 quita de `badge.config.ts` la cita de dimensiones del asset de demo. Una
  constante de la lib **no debe documentar el tamaño de un fichero del playground** — ese dato se
  pudrió en horas, y viajaba en los `.d.ts` publicados de la 0.3.0.

## 🔄 En curso: spec-04-T5 — `badge-band-asset-swap` (feature `id: 5`)

- **Estado**: **CHANGES_REQUESTED** → ronda de correcciones en marcha.
  Veredicto: `progress/review_spec-04-T5.md` · Informe: `progress/impl_spec-04-T5.md`.
  El trabajo del implementer era **correcto y estaba verificado al entregarlo**; lo bloqueó el cambio
  de asset externo y posterior de arriba, más una cita de dimensiones derivada de él.
- **Verificado por el líder** sobre la entrega inicial (norma 7): `lint` ✅ ·
  `test` **188/188** ✅ · `ng build products-3d-playground` ✅ · índice de git con el reparto correcto
  (`band.jpg` y `font.json` fuera; `band.png` y `Ballega.otf` dentro) · barrido sin `band.jpg` vivo.
  El reviewer revalidó los cuatro por su cuenta + checks de `dist` (sin deps fantasma, README
  publicado con `band.png`).
- **Correcciones pedidas**: (1) asset canónico — **hecho por el líder**; (2) quitar `784×49` del JSDoc
  público de `BADGE_BAND.referenceTextureAspect`; (3) misma limpieza en el comentario de
  `badge-scene.component.spec.ts:452`; (4) revalidar los cuatro comandos y actualizar el informe.
- **Dictámenes del reviewer que zanjan dudas abiertas**:
  - `textureAspect = 512 / 128` es **honesto** (input arbitrario, `tiles` derivado a mano de
    constantes independientes) y **no debe** derivarse de `BADGE_BAND.referenceTextureAspect`: eso
    haría **estructuralmente invisible** el mutante «ignoro la imagen y devuelvo siempre el fallback».
    La asimetría con el test hermano está justificada: allí el 4 significa «el valor del fallback»,
    aquí «un 4:1 cualquiera».
  - `docs/smoke-test-external.md:61,101` (`font.json`) **es de T6, no de T5**: la propia T5 dice
    literal «su repunte a `Ballega.otf` va en T6», sin restringir el sitio. El CA1 de T5 («en todo el
    repo») era **insatisfacible por T5 sola**. **T6 ya ampliada** por el líder (ver abajo).
  - Las tres referencias rotas de `base-*.png` son **preexistentes** (`e523a97a`, muertas en
    `cea05d6`, ancestro de HEAD) → **backlog**, no bloquean.
- ❌ **Corrección de una afirmación que estuvo escrita aquí**: «el barrido global solo saldrá limpio
  tras T6» **era falso** tal como estaba T6 enunciada — su descripción solo cubría los tres `fontUrl`
  de la demo. Ya no lo es: T6 absorbe también las dos líneas de `docs/smoke-test-external.md`.
- **Ampliación de T6 hecha por el líder** (`feature_list.json` id 6): las referencias a `font.json`
  pasan de **tres a cinco** (las dos de `docs/smoke-test-external.md`), con su criterio de aceptación
  reescrito; y los números de la correa actualizados al asset vigente. **No** se tocan los `font.json`
  de `README.md:36` ni de `projects/ngx-products-3d/README.md:92,467`: son rutas ficticias
  `/assets/3d/...` de la app consumidora y su repunte de fuente es **de T7**.
- **Plan** (la parte de repunte, ya ejecutada y validada):
  1. Repuntar el **código vivo** del playground (`badge-demo.component.ts:27,40,42` incluido el
     comentario, `badge-demo.routes.ts:18`) de `/assets/band.jpg` a `/assets/band.png`.
  2. Repuntar los **5 fixtures inertes** de tests (`badge-scene.component.spec.ts`,
     `badge-texture.component.spec.ts`, `badge-texture.spec.ts`, `badge-theme.spec.ts`,
     `badge.component.spec.ts`).
  3. **Aspecto de referencia**: JSDoc de `BADGE_BAND.referenceTextureAspect` (`badge.config.ts`) y
     `badge.config.spec.ts` dejan de citar `band.jpg` 1024×256 como si existiera; el test de
     `badge-scene.component.spec.ts` deja de atribuir su 4:1 a un fichero borrado **sin** cambiar
     el valor ni debilitar la aserción (`referenceTextureAspect` sigue = 4, no se toca).
  4. **Docs**: `README.md`, `projects/ngx-products-3d/README.md` (incluido el contrato del arte de
     la correa: tileable en X, con alfa, aspecto libre porque el `repeat` se deriva) y
     `docs/smoke-test-external.md`.
  5. **Git**: `git rm --cached`-equivalente real (`git rm`) de `band.jpg` y `font.json` (borrados
     del disco, aún trackeados) + `git add` de `band.png` y `Ballega.otf`. **Prohibido**
     `git checkout --` / `git restore` / `git stash` (norma 1).
- **Criterios de aceptación aplicables** (copiados de `feature_list.json` id 5):
  - Ninguna URL de asset apunta a un fichero inexistente en todo el repo
  - `band.jpg` y `font.json` fuera del índice de git; `band.png` y `Ballega.otf` dentro
  - El aspecto de referencia de los tests y del JSDoc ya no cita `band.jpg` 1024×256 como si existiera
  - Los cinco fixtures de tests y las cuatro referencias de docs están repuntados
  - `pnpm build` / `pnpm ng lint ngx-products-3d` / `pnpm ng test ngx-products-3d` verdes
- **Fuera de alcance explícito**: los `fontUrl` → `Ballega.otf` (**T6**), controles y N3 del
  playground (T6), resto de README/CHANGELOG (T7), `BADGE_BAND.referenceTextureAspect` (T4, cerrado).

## ✅ Cerrada: spec-04-T4 — `badge-band-repeat-derived` (feature `id: 4`)

- **Estado**: **`done`** — **APPROVED** por el reviewer, sin cambios requeridos.
  Veredicto: `progress/review_spec-04-T4.md` · Informe: `progress/impl_spec-04-T4.md`.
  `feature_list.json` id 4 = `done`; T5–T7 siguen en `pending`. **Sin commitear**: lo hace el leader.
- **Backlog**: el ítem «`BADGE_BAND.repeat` derivado del fov» **sale del backlog** — ya no es un
  `-3.383` precalculado a mano, sino `bandRepeatFor(aspect)` derivado. `BADGE_BAND.repeat`
  **desaparece de la API pública** a favor de `bandRepeatFor(aspect)`: breaking que documenta **T7**
  en el CHANGELOG.
- **Plan** (ejecutado):
  1. Fn pura `bandRepeatFor(aspect)` en `badge.config.ts` derivada de `segmentLength`, `lineWidth` y
     `fov`; `BADGE_BAND.repeat` (tupla literal `[-3.383, 1]`) desaparece. Constantes nuevas
     `ropeJoints: 3` y `referenceTextureAspect: 4` (fallback), cero literales sueltos.
  2. `computed` `bandRepeat()` en `badge-scene.component.ts` sobre `bandMap()` (lee
     `image.width/height`), **no** en `beforeRender`; template `[repeat]="bandRepeat()"`.
  3. `transparent` en `<ngt-mesh-line-material>` (vía `BADGE_BAND.transparent`), conservando
     `depthTest: false`.
  4. N1: 6 tests de `bandRepeatFor` (ancla `−3.383`, derivación, aspecto 16, signo, fallback sin
     `NaN`) + 5 en la escena (aspecto real 8:1, reteselado, dos fallbacks, material).
  5. Discriminancia con 4 mutaciones temporales revertidas por copia previa + `md5sum -c` (norma 1);
     una de ellas obligó a cambiar el asset de un test que sobrevivía por coincidencia.
- **Criterios de aceptación aplicables** (copiados de `feature_list.json` id 4): `bandRepeatFor(4)` =
  −3.383 · testeada también con 16 y con `0`/`NaN`/no medible → fallback sin `NaN` · signo siempre
  negativo · `repeat` recalculado al resolver la textura (`computed`, nunca `beforeRender`) ·
  material con `transparent` y `depthTest: false` · ningún literal `3.383` en el código ·
  `build` / `lint` / `test` verdes.
- **Verificación**: `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ ·
  `pnpm ng test ngx-products-3d` **188/188** ✅ (baseline de entrada 178/178) ·
  `pnpm ng build products-3d-playground` ✅.
- **Fuera de alcance explícito**: repunte de `band.jpg` → `band.png` y `git rm` (**T5**, la demo
  sigue en 404 a propósito), playground y N3 visual (T6), README/CHANGELOG (T7), física/GLB/escena RT.

## ✅ Cerrada: spec-04-T2 — `badge-text-bottom-left` (feature `id: 2`)

- **Estado**: **`done`** — **APPROVED** por el reviewer, sin cambios requeridos.
  Veredicto: `progress/review_spec-04-T2.md` · Informe: `progress/impl_spec-04-T2.md`.
  `feature_list.json` id 2 = `done`; T4–T7 siguen en `pending`. **Sin commitear**: lo hace el leader.
- **P22 cerrado**: ya existe el test que distingue el `maxWidth` **por slot** del global, así que
  **P22 sale de la lista de backlog**.
- **Siguiente**: T4–T7 pendientes. T4 puede arrancar sin esperar a nada.
- **Plan** (ejecutado):
  1. `BADGE_TEXT_LAYOUT` (`badge.config.ts`): las 3 anclas `u = 0.92 → 0.08` y `align 'right' →
     'left'`. V, `size`, `height` y `maxWidth` intactos. JSDoc de la constante reescrito.
  2. Los **4** invariantes de `badge.config.spec.ts` de la tabla de R3, reescritos sin relajarlos.
  3. Los 2 tests de anclaje de `badge-texture.component.spec.ts` que codificaban `align 'right'`
     sobre el layout publicado (fallaban de verdad), reapuntados a la izquierda.
  4. **P22 cerrado**: test nuevo que exige el `maxWidth` **por slot** (mata el mutante
     `BADGE_TEXT_LAYOUT[0].maxWidth`).
  5. Discriminancia con 2 mutaciones temporales revertidas por copia previa + `sha256` (norma 1).
- **Criterios de aceptación aplicables** (copiados de `feature_list.json` id 2): tres slots con
  `u = 0.08` y `align 'left'` con V/size/height/maxWidth intactos · `BadgeTextSlot` y las tres fns
  puras sin tocar · los cuatro invariantes reescritos y discriminantes · P22 cerrado · JSDoc sin
  «abajo-derecha» · `build` / `lint` / `test` verdes.
- **Verificación**: `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ ·
  `pnpm ng test ngx-products-3d` **178/178** ✅ (baseline de entrada 177/177).
- **Fuera de alcance explícito**: `badge-texture.component.ts` (no se toca), README publicado
  (documenta el layout abajo-derecha → **T7**), correa (T4/T5), demo y N3 visual (T6).

## ✅ Cerrada: spec-04-T3 — `badge-font-opentype` (feature `id: 3`)

- **Estado**: **`done`** — **APPROVED** por el reviewer, sin cambios requeridos.
  Veredicto: `progress/review_spec-04-T3.md` · Informe: `progress/impl_spec-04-T3.md`.
  `feature_list.json` id 3 = `done`; T2 y T4–T7 siguen en `pending`. **Sin commitear**: lo hace el
  leader.
- **Nota de proceso**: el informe de implementación lo redactó **el leader**, porque el implementer
  original se colgó **tres veces** por errores de infraestructura; y la ronda de **mutaciones de
  discriminancia** se sustituyó por **análisis por construcción**, validado después por el reviewer.
- **Baseline revalidado antes de tocar nada** (2026-08-05): `pnpm build` ✅ ·
  `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **160/160** ✅.
- **Siguiente**: T2 y T4–T7 pendientes. T2 y T4 pueden arrancar sin esperar a nada.
- **Plan** (ejecutado):
  1. Fn pura `isOpentypeFontUrl(url)` en `badge-font.ts` (nuevo, interno: no entra en
     `public-api.ts`) + caché por URL de typefaces parseados con `import()` **dinámico** de
     `three/addons/loaders/TTFLoader.js`.
  2. `badge-texture.component.ts`: `resource()` de Angular sobre la URL binaria (params
     `undefined` ⇒ recurso IDLE para el camino JSON) + `resolvedFont()` que hace **passthrough
     del string** si la URL es typeface JSON.
  3. Template: gate `@if (resolvedFont(); as font)` sobre el `@for` de los textos ⇒ fuente rota o
     aún sin parsear = **sin texto**, nunca excepción. Warn dev con prefijo `[ngx-products-3d]`.
  4. N1: `badge-font.spec.ts` (extensiones, caché, fallo) + tests nuevos en
     `badge-texture.component.spec.ts` (passthrough, degradado, warn).
  5. Verificación: los 3 comandos + `pnpm ng build products-3d-playground` + comprobación de que
     `dist/ngx-products-3d/package.json` no gana deps y de que el `import()` sigue siendo dinámico
     (chunk aparte con `opentype` en el bundle del playground).
- **Criterios de aceptación aplicables** (copiados de `feature_list.json` id 3):
  - `isOpentypeFontUrl` testeada N1: `.otf`, `.OTF`, `.ttf`, `.otf?v=2`, `.otf#hash`, `.json`,
    string vacío
  - Una URL de typeface JSON sigue haciendo passthrough del string a soba (test que lo demuestre)
  - El import de `TTFLoader` es dinámico: no aparece en el bundle de quien no usa OTF
  - `dist/ngx-products-3d/package.json` no gana ninguna dependencia nueva
  - Misma URL ⇒ misma referencia de objeto (test de estabilidad de la caché)
  - Una fuente rota degrada a sin texto con warn dev, sin excepción
  - `SOBA_TEXT3D_DEFAULT_HEIGHT` sigue en su sitio y sigue discriminando
  - `pnpm build` / `pnpm ng lint ngx-products-3d` / `pnpm ng test ngx-products-3d` verdes
- **Fuera de alcance explícito**: `REQUIRED_THEME_URL_FIELDS`, los `fontUrl` de la demo (T6, hoy en
  404 a propósito), layout de textos (T2), correa (T4/T5), docs (T7).

## ✅ Cerrada: spec-04-T1 — `badge-base-color-111` (feature `id: 1`)

- **Estado**: **`done`** — **APPROVED** por el reviewer, sin cambios requeridos.
  Veredicto: `progress/review_spec-04-T1.md` · Informe: `progress/impl_spec-04-T1.md`.
  `feature_list.json` id 1 = `done`; T2–T7 siguen en `pending`. **Sin commitear**: lo hace el leader.
  El reviewer verificó por su cuenta que **ninguna de las 4 mutaciones sobrevivió** (`badge-theme.ts`
  byte a byte igual a HEAD) y que los **cuatro** comandos quedan verdes, incluido
  `pnpm ng build products-3d-playground` y los checks de `dist` sin deps fantasma.
- **Siguiente**: T2–T7 pendientes. T1–T4 son independientes entre sí, así que T2, T3 y T4 pueden
  arrancar sin esperar a nada. Sigue pendiente la N3 visual de T6 para ver el `#111111` en pantalla
  (los temas demo aún sobreescriben `baseColor`; se limpian en T6).
- **Detalle de la implementación**: Baseline revalidado antes de tocar (160/160) y tras el cambio:
  `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **160/160** ✅.
  Diff = 4 líneas (`badge.config.ts:149` + 3 en `badge-theme.spec.ts`). Discriminancia demostrada con
  4 mutaciones (constante revertida, prioridad de clip invertida, `resolveBaseColor` contaminado por
  `colors.clip`, default hardcodeado), todas revertidas por copia previa + `md5sum -c` `OK`.
  Detalle relevante: la mutación «default hardcodeado a `'#000000'`» era **indetectable antes** de
  T1 (aserciones simbólicas contra una constante que valía justo eso) y ahora tumba 8 tests.
- **Plan** (ejecutado):
  1. Revalidar baseline (`build` + `lint` + `test`) antes de tocar nada.
  2. `BADGE_BASE_COLOR` (`badge.config.ts:149`) `'#000000'` → `'#111111'`.
  3. Actualizar la aserción literal de `badge-theme.spec.ts:68` y los nombres de test que dicen
     «black».
  4. Demostrar que los tests de prioridad (`colors.clip` > `baseColor` > default) **siguen
     discriminando**, con rotura temporal revertida por copia previa + hash (norma 1).
  5. Revalidar los tres comandos e informar en `progress/impl_spec-04-T1.md`.
- **Criterios de aceptación aplicables** (copiados de `feature_list.json` id 1):
  - `BADGE_BASE_COLOR === '#111111'` y es la única fuente del default (ningún literal nuevo en
    componentes)
  - La aserción de `badge-theme.spec.ts` está actualizada y sigue siendo discriminante (falla si
    alguien revierte la constante)
  - Los tests de prioridad `colors.clip` > `baseColor` > default siguen verdes y siguen discriminando
  - `pnpm build` sin errores
  - `pnpm ng lint ngx-products-3d` sin errores
  - `pnpm ng test ngx-products-3d` con > 0 tests y todos verdes
- **Fuera de alcance explícito**: temas demo del playground (T6), forma de
  `resolveBaseColor`/`resolveClipColor`, `color` del `meshPhysicalMaterial`, assets y layout de
  textos (T2–T7).

## spec-04 — de dónde sale y qué se cerró antes de redactarla

Sergio pidió cuatro cosas el 2026-08-05: fuente `.ttf` elegible **(corregido por él a `.otf`
en la misma sesión)**, color de texto elegible, textos **abajo-izquierda**, color base
**`rgb(17,17,17)`**, y reemplazar `band.jpg` por `band.png`.

La exploración previa cambió tres supuestos del enunciado. Está todo en la spec, pero conviene
tenerlo a mano:

1. **El color de texto YA existe** (`theme.colors.text ?? BADGE_TEXT.color`, cableado desde F4v2).
   El trabajo real es el control del playground, no la API.
2. **OTF verificado contra el fichero real, no supuesto.** Pese al nombre, el `TTFLoader` de three
   parsea OTF (su `opentype` embebido incluye el intérprete **CFF**). Ejecutado sobre
   `Ballega.otf`: 176 glifos (con `Ñ`, `ó`, `#`), `FontLoader.parse` → `Font`,
   `generateShapes('Sergio #1234')` → 12 shapes. **Cero dependencias nuevas.**
3. **`band.png` NO es un reemplazo drop-in.** `band.jpg` era 1024×256 (4:1, sin alfa); `band.png`
   es **725×70** (~10.36:1, con alfa; *cifra del asset vigente — al escribirse esta nota era 784×49*).
   El shader de meshline (`meshline/dist/index.js:323`) **ignora la
   transformada UV de la textura**, así que la orientación no se puede corregir por código — por eso
   el asset se pidió girado, y Sergio ya lo entregó así.

### Decisiones cerradas con Sergio (2026-08-05)

1. **Sergio aporta `band.png` girado a horizontal.** Sin código de rotación en la lib.
2. **El arte es un patrón tileable**: el `repeat` se **deriva del aspecto real** de la textura.
   Cierra el ítem de backlog del `-3.383` precalculado a mano.
3. **`baseColor` `#111111`** en el default de la lib **y** los temas demo dejan de sobreescribirlo.
4. **Soporte de fuente binaria en la lib + controles en la demo** (selector de fuente y color picker
   de texto).

## Assets — nada bloquea, pero la demo está rota hoy

| Fichero | Estado |
|---|---|
| `Ballega.otf` | ✅ Entregado (70 736 B, 176 glifos), **en el índice de git** desde T5 |
| `band.png` | ✅ Entregado y **ya girado**. Revisión vigente **725×70** (~10.36:1, con alfa), en el índice desde T5 |
| `band.jpg` | ✅ **Fuera del índice** (`git rm` en T5); llevaba borrado del disco pero trackeado |
| `font.json` | ✅ **Fuera del índice** (`git rm` en T5). Su **repunte** a `Ballega.otf` es de T6 |

⚠️ **La demo sigue arrancando sin textos**: los `fontUrl` apuntan a `font.json`, que es 404. La correa
ya no lo es (T5 la repuntó a `band.png`). Degrada a sin-texto con warns dev — el modo degradado
diseñado —, pero es un 404 vivo hasta que se cierre **T6**.

**Fleco de la correa: CERRADO por el propio asset.** El «`repeat` −0.846, menos de una tesela»
correspondía a la entrega de 784×49, hoy **retirada**. Con el asset vigente el `repeat` es **−1.3066**
(**1,31 teselas**) y la propuesta de tesela más corta (196×49) queda **descartada**. Lo que se mira en
la N3 de T6 pasa a ser si **la costura del tileado canta**.

**Sin selector de fuente en la demo**: al desaparecer `font.json`, `Ballega.otf` es la fuente única y
un selector no tendría nada que elegir. El camino de typeface JSON queda cubierto por el test N1 de
passthrough de T3.

## ⚠️ Decisión pendiente: publicación de la 0.3.0

`0.3.0` sigue **preparada y NO publicada** (el registry sirve `0.2.1`). La publicación la dispara
**CI** (`.github/workflows/release-publish.yml`) al detectar el bump **en un push a `main`**.

Todo el trabajo vive en `feature/blender-assets`. **Mergear a `main` = publicar.** Requiere **GO
explícito de Sergio**; el leader no mergea por su cuenta. **No se mergea mientras spec-04 esté
abierta**: la 0.3.0 acumula ya los breaking de tres specs (F3, F4v2 y ésta).

## Normas de proceso vigentes (salidas de incidentes reales, NO son teoría)

1. **Prohibido `git checkout --`, `git restore`, `git stash`** sobre trabajo sin commitear. Para
   revertir una mutación: **copia previa del fichero + `md5sum -c`**. (En F4v2 un `git checkout --`
   borró el trabajo cerrado de dos features.) **Relevante ya en T5**: `band.jpg` está borrado del
   disco pero trackeado — se cierra con `git rm`, nunca restaurándolo.
2. **Ninguna mutación temporal de discriminancia sobrevive al informe.** Nada de `false as boolean`,
   `true ||`, `.only`, `.skip`, constantes alteradas ni aserciones relajadas. Barrer el propio diff
   antes de reportar y dejar el árbol verde.
3. **Commitear cada feature cerrada.** No acumular la spec entera en el working tree.
4. **Sin aserciones vacuas**: nada que no pueda fallar. Demostrar discriminancia con roturas
   temporales (revertidas según la norma 1).
5. **No atribuir instrucciones a intercambios no verificables.** Citar literal lo que llegue.
6. **En las N3, guardar el log de consola**, no solo capturas: si no, la parte «cero warnings» no es
   reauditable.
7. **El leader verifica el árbol por su cuenta** antes de pasar a review: los informes se contrastan,
   no se aceptan de palabra.

## Backlog (no pertenece a ninguna spec activa)

- **P21** — `height` del texto depende de que soba importe el `TextGeometry` de three-stdlib
  (`height`→`depth`); el de three 0.182 solo lee `depth`, default **50**. Si soba migra, la extrusión
  se rompe **en silencio**. Vigilar en cada bump de `angular-three-soba`. El centinela es
  `SOBA_TEXT3D_DEFAULT_HEIGHT` (`badge-texture.component.spec.ts:344`), que spec-04 **conserva**.
- **P23** — `badgeTextFor` (`badge-texture.ts:20-33`) no tiene guarda para `memberNumber: ''` ⇒ el
  frente pinta el prefijo `#` suelto. Defecto de la **lib**.
- **P24** — `badge-texture.component.ts:243` dice «El frente se renderiza sin fondo», redacción
  anterior a T4 de F4v2: ahora sí hay un quad opaco de `baseColor`.
- **H3** — `alignOffsetX` tiene `switch` exhaustivo sin `default` ⇒ `undefined`/`NaN` para un
  consumidor **JS** con `align` inválido.
- **P25** — `docs/smoke-test-external.md` cita **tres assets que ya no existen**: `base-gold.png`,
  `base-silver.png` y `base-default.png` (`:61` dentro de las llaves del `cp`, y `:97,98,100`). Es un
  **runbook**, no un ejemplo de consumidor: cada nombre de ese `cp` debe existir en el repo o el smoke
  test peta en el paso 4. **Preexistente y ajeno a la correa**, confirmado por el reviewer de T5 con
  `git blame` (líneas de `e523a97a`, 2026-07-21; los assets murieron en `cea05d6`, ancestro de HEAD).
  No lo arregla T5 ni T6: **decidir si va a anexo de T7 o a spec propia**.
- **Higiene fuera de spec** — (a) Prettier reporta ficheros no formateados por **CRLF** en todo el
  repo (`endOfLine: lf` por defecto): arreglo = fijar `endOfLine`/`.gitattributes` + un `--write` en
  **commit dedicado**. (b) `setupFiles` en el target `test` de `angular.json` para ejecutar el stub
  de `getContext('2d')` una vez y borrar sus **tres** copias.
- Propuestas P3/P4/P5 del implementer en `progress/impl_feature14.md`, sin aplicar.
- Canto y dorso de la tarjeta: fuera de alcance en F4v2, solo se anotó lo que se ve.

### Absorbidos por spec-04 (ya no son backlog)

- **P22** (mutante superviviente: ningún test distingue el `maxWidth` **por slot** del global) → T2,
  **cerrado y APPROVED** (`progress/review_spec-04-T2.md`). Fuera del backlog.
- **`BADGE_BAND.repeat` derivado** (era `-3.383` precalculado a mano, obsoleto en silencio si alguien
  tocaba el fov) → T4, **cerrado y APPROVED** (`progress/review_spec-04-T4.md`). Fuera del backlog:
  ahora se deriva con `bandRepeatFor(aspect)`, y `BADGE_BAND.repeat` desaparece de la API pública
  (breaking a documentar en el CHANGELOG en **T7**).

### Verificación del leader tras APPROVED — feature 8 `badge-band-clip-sync` (2026-09-28)

`pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **212/212** (13 ficheros) ✅ ·
`pnpm ng build products-3d-playground` ✅. Sin commitear. **N3 visual pendiente de Sergio.**
Nota de entorno: `node_modules` estaba corrupto (faltaban ficheros de `eslint-scope`, `aria-query`...) y el
lint fallaba; se regeneró con `pnpm install --frozen-lockfile`.

### Verificación del leader tras APPROVED — feature 9 `badge-band-endcap` (2026-09-28)

`pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **232/232** (14 ficheros) ✅ ·
`pnpm ng build products-3d-playground` ✅. Sin commitear. **N3 visual pendiente de Sergio.**
**Backlog para T7 (CHANGELOG)**: «Fixed: la correa sigue la pose renderizada y termina en la ranura
del clamp (feature 8)», «Fixed: extremos de la correa sin cuña ni parpadeo, parche del shader de meshline
(feature 9)», «Added: `BADGE_CARD_MODEL.bandAttachPoint`, `BADGE_BAND.endCapTolerance`,
`BADGE_LOOP_PRIORITY`», y el aviso de `updatePriority` para consumidores con canvas propio.

### T6(a) adelantado por el leader (2026-09-28)

Sergio reportó que el nombre y el número de socio ya no se veían. Causa: `font.json` se borró en el
commit `advances` (T5), pero la demo seguía con `fontUrl: '/assets/font.json'` → 404 → la lib oculta
los textos (gate + warn dev). No tiene relación con las features 8/9. Repuntadas las 5 referencias
(`badge-demo.component.ts:33,48`, `badge-demo.routes.ts:26`, `docs/smoke-test-external.md:61,101`) a
`Ballega.otf`. `pnpm ng build products-3d-playground` ✅. El resto de T6 sigue `pending`.

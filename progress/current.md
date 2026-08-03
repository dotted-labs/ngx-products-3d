# Sesión actual

- **Fecha**: 2026-08-01
- **Spec**: `docs/specs/active/spec-03-F4v2-front-design.md` (diseño frontal de la card)
- **Fase**: 4 (v2) — desglosada en 8 features en `feature_list.json`
- **Rol**: leader

## Estado

Spec **revisada y corregida antes de implementar**. El borrador traía cuatro afirmaciones falsas
sobre el código actual y tres huecos; el análisis con referencias `fichero:línea` está en
`progress/review_spec-03-F4v2.md` y las correcciones ya están aplicadas en la propia spec.

Ninguna feature arrancada todavía. Baseline Nivel 2 verde antes de repartir trabajo:
`pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **80/80** ✅.

### Correcciones que llevaba la spec (resumen)

1. La RenderTexture **ya** es el `map` de la tarjeta, y la tarjeta **no usa el material `base`** del
   GLB (usa `meshPhysicalMaterial` con clearcoat). Aplicar el borrador habría perdido el clearcoat.
2. `baseColor` **no puede** ser el `color` del material de la tarjeta (three multiplica
   `map × color`): entra como quad de fondo de la escena RT.
3. La cámara ortográfica necesita **`manual: true`** y **frustum explícito**: cada uno cierra una
   ruta distinta. Matizado el 2026-08-02 tras la verificación en `node_modules` de la feature 3 —
   ver el log y el Dictamen 1 de `progress/review_spec-03-F4-feature3.md`.
4. El estirado tenía **tres** aspectos encadenados, no dos; el dominante es el `aspect` de la cámara
   de la escena RT, que es también el defecto «el frente se deforma con la ventana» que la 0.3.0
   dejó anotado como conocido. Esta spec lo cierra.

### Decisiones de Sergio (2026-08-01)

- **Assets**: los aporta él (seis `.webp` 1600×2250 con alpha, lista en la spec). Feature 7
  **`blocked`** hasta entonces.
- **Versionado**: los breaking se **pliegan en la 0.3.0**, que sigue sin publicar. → **no mergear a
  `main` hasta cerrar la spec**, o CI publicaría una 0.3.0 a medias.
- **Canto y dorso de la tarjeta**: fuera de alcance; se anota lo que se vea en la N3.

## Orden de trabajo

`1 → 2` y `3 → {4 → 5, 6}` son independientes entre sí; 7 espera assets; 8 cierra.

## Pendientes anotados por las reviews (que NO se pueden perder)

Salidos de `progress/review_spec-03-F4-feature2.md`:

1. **A la N3 de T7** — migrar los cinco puntos de la checklist visual que dejó el implementer de T2:
   `ember` sigue en cobre; `violet` pasa a **negro**; alternar temas no remonta el canvas; el frente
   no se oscurece; sin GC spikes al alternar repetidamente.
2. **Decisión de T7** — `DEMO_THEMES.violet` no define `colors.clip` ni `baseColor`, así que su
   clip/clamp pasan de «metal del GLB» a negro. O se le da un `baseColor`/`colors.clip` explícito, o
   se acepta el negro **por escrito**.
3. **A T8 (CHANGELOG 0.3.0)** — un tema sin `colors.clip` pasa a mostrar clip/clamp con el
   `baseColor` (negro por defecto) en vez del metal crudo del GLB. No es breaking de API (la 0.3.0
   no está publicada) pero sí de aspecto.
4. **Higiene, fuera de esta spec** — Prettier reporta ficheros no formateados por **CRLF** en todo el
   repo (`endOfLine: lf` por defecto) más una desviación real preexistente en el template inline de
   `badge-scene.component.ts:88-100`. `pnpm ng lint` pasa. Arreglo = fijar `endOfLine`/`.gitattributes`
   y un `--write` en **commit dedicado**, no dentro de una feature.

Salidos de `progress/review_spec-03-F4-feature3.md`:

5. **Al implementer de T4** (vuelve a abrir `badge-texture.component.ts`) — alinear el JSDoc de
   `cameraOptions` con la spec ya corregida: añadir que la ruta de `updateCamera()` es hoy
   **latente**. No se pidió como cambio de T3 para no dejar un diff de solo-comentario.
6. **Higiene, fuera de esta spec** — `setupFiles` en el target `test` de `angular.json` (hoy no
   define ninguno) para ejecutar el stub de `getContext('2d')` una vez y borrar sus **tres** copias.
   No se hace ahora: tocar el runner en mitad de la spec cambiaría el entorno de verificación de las
   features 4-8.
7. **A T8 (CHANGELOG 0.3.0)** — `BADGE_TEXTURE.size` desaparece a favor de `width`/`height`; entran
   `BADGE_FRONT_FACE` y `BADGE_TEXTURE.cameraFrustum` como API pública. Verificado que hoy ni el
   README ni el CHANGELOG mencionan `BADGE_TEXTURE.size`, así que no hay documentación mintiendo.

Salidos de `progress/review_spec-03-F4-feature4.md`:

8. **A la N3 de T7 — tres modos de fallo SIN cobertura automática.** `[transparent]="true"` y el
   quad de fondo sin gate viven en el **template**, y los specs lo sobrescriben → ningún test los
   ancla. El reviewer evaluó tres alternativas (regex sobre el fuente, render real en jsdom, mover
   `transparent` a config) y ninguna cubre el modo de fallo real sin violar `architecture.md` /
   `verification.md`: se acepta el hueco **a cambio de que los tres pasen a la N3 como obligatorios**.
9. **A la N3 de T7 — z-fighting entre el quad de `baseColor` y el arte** (hallazgo NUEVO del
   reviewer, no estaba en el informe). Con `near 0.1` / `far 2000` (defaults de soba) y depth de 24
   bits, el cuanto es ~1.2e-4 uds ⇒ `BADGE_RT_LAYER_GAP = 0.001` deja solo **~8 cuantos** de margen.
   Si parpadea, la corrección es **bajar el `far` desde config**, NO subir el gap a ciegas. Verificar
   también que el arte se ve unlit correcto (si sale negro, el material dejó de ser `basic`).
10. **A T8 (CHANGELOG 0.3.0)** — nuevos públicos `BADGE_TEXTURE.frontPlaneSize` / `backdropPosition`
    / `artPosition`; **breaking**: `BADGE_TEXTURE.planeSize` eliminado. `BADGE_RT_LAYER_GAP` **no**
    entra (privada, confirmado en el `dist`).

**F4 no es cerrable hasta que se ejecute la N3 de T7**, aunque las features individuales se aprueben.

## Backlog aplazado (no entra en esta spec)

- **`BADGE_BAND.repeat` derivado del fov**: hoy es `-3.383` precalculado a mano desde
  `BADGE_CAMERA.fov`; si alguien cambia el fov queda obsoleto en silencio. Hacerlo **función pura
  evaluada al cargar el módulo (NO `computed()`**: no hay estado reactivo y rompería la config
  data-driven), con el aspecto de la textura como **parámetro**. No urge: el test de invariante
  rompe si cambia el fov.
- Propuestas P3/P4/P5 del implementer en `progress/impl_feature14.md`, sin aplicar.
- Doble tone mapping de la escena RT y canto/dorso de la tarjeta: se observan en la N3 de esta spec,
  se corrigen (si procede) en otra.

## Estado de publicación

`0.3.0` **preparada y NO publicada**: bump en `projects/ngx-products-3d/package.json`, `CHANGELOG.md`
en la raíz y aviso de migración en el README publicado, todo commiteado en `feature/blender-assets`
(`343ef45`). La publicación la dispara **CI** (`.github/workflows/release-publish.yml`) al detectar
el bump **en un push a `main`**. El registry sirve todavía `0.2.1`.

## En curso

**Nada en curso.** T4 aprobada (7/7). Siguientes candidatas: **T5** y **T6**, independientes entre
sí y ambas desbloqueadas (T5 depende de 4 ✅; T6 depende de 3 ✅). T7 sigue `blocked` por assets.

<details>
<summary>Plan de la feature 4 (cerrada, se conserva como referencia)</summary>

- **Plan**:
  1. `badge.config.ts`: retirar `planeSize: [5, 5]`; añadir tamaño de los quads de la escena RT
     derivado de `BADGE_FRONT_FACE` + posiciones de capa (separación en z explícita).
  2. `badge-texture.component.ts`: quad opaco `meshBasicMaterial` con `resolveBaseColor(theme())`
     + plano del arte del tier con `transparent: true` encima; conservar gate `hasValue()` y
     `colorSpace` sRGB.
  3. Alinear el JSDoc de `cameraOptions` con la spec corregida (ruta de `updateCamera()` hoy
     latente), sin tocar el código de la cámara — encargo del reviewer de T3.
  4. Tests N1 nuevos en `badge.config.spec.ts` y `badge-texture.component.spec.ts`, demostrados
     discriminantes con roturas temporales.
  5. N2: `pnpm build` + `lint` + `test` + `ng build products-3d-playground`. Baseline **110/110**.
- **Criterios de aceptación aplicables** (feature 4 de `feature_list.json`):
  1. Las zonas transparentes del webp muestran `baseColor`; cambiar `baseColor` en el tema se ve en
     el frente sin recrear el canvas.
  2. El quad y el plano cubren exactamente el rect frontal derivado (sin bandas ni márgenes).
  3. Una URL de textura rota sigue degradando a frente sin arte (con warn dev), nunca a escena en
     blanco.
  4. `planeSize [5,5]` ya no existe y ninguna constante de la escena RT es literal en el componente.
  5. `pnpm build` sin errores.
  6. `pnpm ng lint ngx-products-3d` sin errores.
  7. `pnpm ng test ngx-products-3d` > 0 tests y todos verdes.
- **N3 pendiente** (se ejecuta en T7, no en esta feature). Los textos siguen fuera de cuadro hasta
  T6: consecuencia declarada del estado intermedio, no defecto de T4.

</details>

## Log

- **2026-08-01** — Revisión de `spec-03-F4v2` (leader, sin subagentes: lectura pura). Baseline N2
  verde. Spec corregida, `feature_list.json` desglosado en 8 features, `progress/current.md`
  actualizado. Pendiente: arrancar feature 1 con un `implementer`.
- **2026-08-01** — Baseline N2 revalidado antes de repartir: `pnpm build` ✅ · `pnpm ng lint
  ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **80/80** ✅. Feature 1
  (`badge-theme-base-color`, T1) marcada `in_progress` y lanzada a un `implementer`. Informe
  esperado en `progress/impl_spec-03-F4-feature1.md`; después, `reviewer` con los 6 criterios de
  aceptación de la feature como checklist.
- **2026-08-01** — Feature 1 (T1) **implementada, pendiente de review** (implementer). Tocados
  `types.ts` (`baseColor` + JSDoc del reparto), `badge.config.ts` (`BADGE_BASE_COLOR`),
  `badge-theme.ts` (`resolveBaseColor` / `resolveClipColor`) y `badge-theme.spec.ts` (+8 tests).
  Ningún componente tocado. N2: `pnpm build` ✅ · `lint` ✅ · `test` **88/88** ✅ (baseline 80).
  Informe en `progress/impl_spec-03-F4-feature1.md`. Duda abierta para el reviewer: las fns nuevas
  quedan internas (no van a `public-api.ts`); `BADGE_BASE_COLOR` sí es pública vía `badge.config`.
- **2026-08-01** — Feature 1 (T1) **APPROVED** por el `reviewer`, 6/6 criterios con evidencia
  `fichero:línea`, sin cambios requeridos. Veredicto en `progress/review_spec-03-F4-feature1.md`.
  Verificación de cierre ejecutada por el leader: `pnpm build` ✅ · `pnpm ng test ngx-products-3d`
  **88/88** ✅ (el reviewer añadió además `pnpm ng build products-3d-playground` ✅ y comprobó el
  `.d.ts` publicado).
  **Decisión de superficie pública (cerrada):** `BADGE_BASE_COLOR` público vía el `export *` de
  `badge.config`; `resolveBaseColor` / `resolveClipColor` **internas**. Razón principal: publicar
  después es aditivo, despublicar es breaking → la opción reversible es no publicar; además
  `badge-theme.ts` está al mismo nivel que `badge-texture.ts` / `badge-material.ts` / `badge-drag.ts`,
  ninguno en el barrel. A reevaluar solo si `resolveClipColor` deja de ser un `??`.
  **Deuda diferida a la feature 2:** con default negro `resolveClipColor` nunca devuelve `undefined`
  ⇒ la rama «sin color → material original del GLB» de `badge-scene.component.ts` queda muerta; hay
  que eliminarla o documentarla **en T2** (ya está en la descripción de esa feature).
- **2026-08-01** — Feature 1 **cerrada** (`status: "done"` en `feature_list.json`). Feature 2
  (`badge-metal-tint-base-color`, T2) marcada `in_progress` y lanzada a un `implementer`: consumir
  `resolveClipColor` en el effect de tinte de `badge-scene.component.ts`, conservar el clon +
  `onCleanup`, resolver la rama muerta y no tocar el `color` del `meshPhysicalMaterial` de la
  tarjeta. Informe esperado en `progress/impl_spec-03-F4-feature2.md`; después, `reviewer`.
  Baseline para esta feature: **88/88**.
- **2026-08-01** — Feature 2 (T2) **implementada, pendiente de review** (implementer). Tocados solo
  `badge-scene.component.ts` (effect de tinte → `resolveClipColor()`, comentario nuevo del
  `meshPhysicalMaterial` sin `[color]`) y `badge-scene.component.spec.ts` (+8 tests: resolución,
  no-mutación del `metal` del GLB, reactividad a `colors.clip` y a `baseColor` sin recrear el
  componente, disposal del clon anterior en `onCleanup` y en destroy).
  **Decisión: la rama «sin color → material original del GLB» se ELIMINA** (inalcanzable por
  contrato de `resolveClipColor`); el porqué queda en el comentario del effect y **anclado por un
  test** que falla si el default vuelve a ser `undefined`.
  N2: `pnpm build` ✅ · `lint` ✅ · `test` **96/96** ✅ (baseline 88) · `ng build
  products-3d-playground` ✅. Los 3 tests clave se verificaron **discriminantes** revirtiendo
  temporalmente el effect (fallaban). **N3 pendiente** (checklist en el informe).
  **Aviso para T7**: el tema demo `violet` no define `colors.clip` ni `baseColor` → su clip/clamp
  pasan a negro (efecto esperado de R2, no bug).
  Informe en `progress/impl_spec-03-F4-feature2.md`.
- **2026-08-01** — Feature 2 (T2) **APPROVED**, 6/6 criterios con evidencia. Veredicto en
  `progress/review_spec-03-F4-feature2.md`. Verificación de cierre del leader: `pnpm build` ✅ ·
  `pnpm ng test ngx-products-3d` **96/96** ✅ (el reviewer añadió `ng build products-3d-playground` ✅
  y comprobó que `dist/` no gana deps).
  Dictámenes: **D1** (eliminar la rama muerta) aprobado — el porqué queda en el comentario del effect
  y anclado por un test que cae si el default vuelve a ser `undefined`. **R1** (violet → negro) es la
  consecuencia buscada de R2, se resuelve en T7. **R4** (Prettier) preexistente por CRLF, no bloquea.
  Dos correcciones del reviewer sobre el informe: los tests previos del fichero eran **25, no 22**
  (25+8=33, +63 del resto = 96); y la aserción `expect(fixture.componentInstance).toBe(instance)` es
  **vacua** (no puede fallar) — el test sigue siendo válido por lo demás, pero «no se recrea el
  canvas» solo lo prueba la N3. Criterio para lo que viene: no dejar aserciones que no puedan fallar.
  Los cuatro pendientes derivados están arriba, en su propia sección.
- **2026-08-01** — Feature 2 **cerrada** (`done`). Feature 3 (`badge-rt-orthographic-frustum`, T3)
  marcada `in_progress`: es el **núcleo de la corrección** (FBO 1600×2250 + ortográfica `manual`).
  Baseline para esta feature: **96/96**.
- **2026-08-02** — Feature 3 (T3) **APPROVED**, 8/8 criterios. Veredicto en
  `progress/review_spec-03-F4-feature3.md`. N2 de cierre del leader: `pnpm build` ✅ ·
  `pnpm ng test ngx-products-3d` **110/110** ✅ (96 → +14). Tocados `badge.config.ts`
  (`BADGE_FRONT_FACE` derivado, FBO `width`/`height`, `cameraFrustum`), `badge-texture.component.ts`
  (ortográfica `manual`), `badge-scene.component.ts` y **dos specs nuevos**
  (`badge.config.spec.ts`, `badge-texture.component.spec.ts`).
  **Hallazgo de fondo (Dictamen 1):** el implementer verificó las citas de la spec en `node_modules`
  y descubrió que `updateCamera()` **no llega a ejecutarse** sobre la cámara del portal — las tres
  rutas que lo invocan están muertas para este caso (`mergeState` es condicional a que el portal
  traiga `size`, y el effect vive en `storeFactory`, que el store del portal no usa). Lo que
  deformaba el frente era el effect `camera.aspect = store.size…` de la cámara **de soba**
  (`angular-three-soba-cameras.mjs:427-437`) y, en ortográfica, su fallback de `left/right/top/bottom`
  al `store.size` (`:257-264`). El reviewer confirmó el análisis línea a línea y dictaminó que
  `manual: true` **no es cargo-cult**: tiene default `false`, llega de verdad a la instancia de three
  y blinda una ruta latente que se activaría con un cambio de una línea aguas arriba. Comprobó además
  que no tiene contrapartida (la matriz de proyección se actualiza por otras dos vías).
  → **Spec corregida por el leader** con los dos reemplazos exactos del Dictamen 1(c) (diagnóstico
  punto 1, corrección técnica punto 2) más el punto 3 del encabezado.
  **Dictamen 2:** el FBO se queda como literales `1600`/`2250` a propósito — derivarlo del rect
  volvería tautológico el eslabón principal del invariante (y daría `1600.0000000000002`). Los
  1000 px/unidad son decisión de producto, no consecuencia geométrica.
  **Dictamen 3:** el reviewer **reprodujo él mismo** las tres mutaciones (FBO cuadrado → 4 fallos;
  `manual` fuera → 1 fallo; `mapRepeat [1,1]` → 2 fallos) y restauró el árbol verificando con
  `md5sum -c`. Sin aserciones vacuas esta vez.
  **Estado intermedio esperado y declarado**: con el frustum ya en 1.6×2.25 pero `planeSize [5,5]` y
  el `BADGE_TEXT_LAYOUT` viejo, el arte se ve recortado y los textos fuera de cuadro hasta T4 y T6.
  Es aritmética esperada, no regresión.
- **2026-08-02** — Feature 3 **cerrada** (`done`). Feature 4 (`badge-rt-backdrop-webp`, T4) marcada
  `in_progress`: quad de `baseColor` + plano del webp del tier con alpha sobre `BADGE_FRONT_FACE`.
  Baseline para esta feature: **110/110**.
- **2026-08-01** — Feature 3 (T3) **implementada, pendiente de review** (implementer). Las tres
  afirmaciones de la spec sobre `node_modules` se **verificaron** antes de escribir código
  (`angular-three.mjs:601-615`, `angular-three-soba-staging.mjs:3315`,
  `angular-three-soba-cameras.mjs:236-245`/`261-264`); detalle y un matiz sobre la reachability real
  de `updateCamera()` en el informe. Tocados: `badge.config.ts` (`BADGE_FRONT_FACE` derivado de
  `cardColliderHalfExtents`, `BADGE_TEXTURE.size` → `width: 1600`/`height: 2250`, `cameraFrustum`),
  `badge-texture.component.ts` (`NgtsPerspectiveCamera` → `NgtsOrthographicCamera` con
  `makeDefault` + **`manual: true`** + frustum explícito), `badge-scene.component.ts` (FBO
  width/height) y tres specs (2 nuevos: `badge.config.spec.ts`, `badge-texture.component.spec.ts`).
  `mapRepeat`/`mapOffset` **intactos** (+ test nuevo que lo ancla). N2: `pnpm build` ✅ · `lint` ✅ ·
  `test` **110/110** ✅ (baseline 96) · `ng build products-3d-playground` ✅. Discriminación de los
  tests nuevos demostrada con tres roturas temporales (informe §4).
  **Estado intermedio esperado, no regresión**: el plano `planeSize [5,5]` y `BADGE_TEXT_LAYOUT`
  siguen dimensionados para el encuadre viejo → arte recortado y textos fuera de cuadro hasta T4/T6.
  **N3 pendiente** (checklist en el informe, va a la N3 de T7). **Para T8**: `BADGE_TEXTURE.size` →
  `width`/`height` + `BADGE_FRONT_FACE` al CHANGELOG 0.3.0.
  Informe en `progress/impl_spec-03-F4-feature3.md`.
- **2026-08-03 — Sesión reanudada tras corte. Incidencia de proceso, leer entera.** La sesión previa
  murió a mitad de T4: el código estaba escrito pero **sin informe** y con el árbol **rojo (119/120)**.
  Causa: una **mutación temporal de la prueba de discriminancia sin revertir** —
  `badge-texture.component.ts:203` con `if (false as boolean)` en lugar de `if (ngDevMode)`—, que
  dejaba el warn dev muerto y tumbaba justo el test `degraded front`. `git log -S` confirmó el
  origen. Revertida por un `implementer`, que además barrió el árbol en busca de otros restos
  (`.only`/`.skip`/`xit`/constantes alteradas): ninguno.
  **Sergio, explícito: `false as boolean` NO es una construcción aceptable en este repo.** Toda
  mutación de verificación se revierte ANTES de reportar, y el árbol se deja verde.
  **Segunda incidencia, la grave:** el implementer usó `git checkout -- badge.config.ts` para
  revertir una mutación y, como la rama **no tenía NADA commiteado**, se llevó por delante también
  el trabajo cerrado de T1 y T3. Lo reconstruyó a mano y lo validó con `md5sum -c`; el leader lo
  contrastó contra un diff capturado antes del incidente y el reviewer lo verificó contra
  `git diff` (prueba más fuerte: demuestra que **nada de HEAD se perdió**). Sin daño final.
  → **Regla nueva: prohibido `git checkout --` sobre ficheros con trabajo sin commitear.** Para
  revertir una mutación, copia previa del fichero y restauración desde ella.
  → **Causa raíz atacada: se commitea T1-T4 en la rama** (decisión de Sergio, 2026-08-03). El
  working tree deja de ser el único soporte de la spec. Sigue en pie NO mergear a `main` hasta
  cerrar la spec (CI publicaría una 0.3.0 a medias).
- **2026-08-03** — Feature 4 (T4) **APPROVED**, 7/7 criterios con evidencia. Veredicto en
  `progress/review_spec-03-F4-feature4.md`; informe (reconstruido a partir del diff real) en
  `progress/impl_spec-03-F4-feature4.md`. N2 verificada de forma independiente por el leader:
  `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test ngx-products-3d` **120/120** ✅
  (baseline 110) · `ng build products-3d-playground` ✅.
  Tocados: `badge.config.ts` (`frontPlaneSize`, `backdropPosition`, `artPosition`,
  `BADGE_RT_LAYER_GAP` privada; `planeSize` eliminado — cero hits en `projects/` y ausente del
  `.d.ts`) y `badge-texture.component.ts` (quad opaco de `baseColor` SIN gate + plano del arte con
  `transparent: true` encima, gate `hasValue()` y `colorSpace` sRGB conservados).
  **Discriminancia reproducida por el REVISOR**, no aceptada de palabra: M1 (`frontPlaneSize→[5,5]`
  + `artPosition.z` invertido) = 6 rojos exactos; y **dos mutaciones que el informe no demostraba**,
  M2 (computed de `baseColor` fijado) = 2 rojos y M3 (guarda del warn) = 1 rojo. Cero aserciones
  vacuas. Restauración desde copia previa verificada con `md5sum -c` de 22 ficheros + `git status
  --porcelain` idéntico + 120/120 y lint re-ejecutados.
  Pendientes derivados (8, 9 y 10) en la sección de arriba.

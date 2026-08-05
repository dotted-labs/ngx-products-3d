# Review — spec-04 T4 (`badge-band-repeat-derived`)

**Veredicto:** APPROVED

## Criterios de aceptación (spec, feature id: 4)

- `bandRepeatFor(4)` devuelve `−3.383` (ancla): [x] — `badge.config.spec.ts:228-231`,
  `toBeCloseTo(-3.383, 3)`; valor real `-3.3830313777465433`, diff `~3.1e-5` bien dentro de tolerancia.
- Testeada N1 con aspecto 16 y con `0`/`NaN`/no medible → fallback sin `NaN`: [x] —
  `badge.config.spec.ts:246-277` (tests 3, 4, 5, 6).
- Signo del repeat siempre negativo: [x] — `badge.config.spec.ts:252-260` (9 aspectos incl.
  degenerados) + `badge-scene.component.spec.ts:126-130`.
- Repeat recalculado al resolver la textura vía `computed` sobre `bandMap()`, nunca en
  `beforeRender`: [x] — `badge-scene.component.ts:312-316`; confirmado por grep que `bandRepeat` no
  aparece dentro del `beforeRender` de la clase (línea 498, curva de la correa, no relacionado).
- Material de la correa declara `transparent` y conserva `depthTest: false`: [x] —
  `badge-scene.component.ts:179` (template) + `badge.config.ts:310` (`transparent: true`) + test
  `declares transparent on the band material without dropping depthTest: false`
  (`badge-scene.component.spec.ts:133-140`).
- Ningún literal `3.383` en el código: [x] — grep confirma que solo aparece en JSDoc (documentación,
  no valor funcional) y en el test de anclaje (`HAND_DERIVED_REFERENCE_REPEAT_X`, declarado a
  propósito como independiente de la config, tal como pide R5(b)). Cero usos como literal operativo.
- `pnpm build` sin errores: [x] (confirmado por el leader).
- `pnpm ng lint ngx-products-3d` sin errores: [x] (confirmado por el leader).
- `pnpm ng test ngx-products-3d` > 0 y todos verdes: [x] — re-ejecutado de forma independiente:
  **12 files | 188 passed (188)**.

## (1) Discriminancia de los 10 tests nuevos

- **Ancla (`bandRepeatFor(4) === −3.383`)**: `toBeCloseTo(-3.383, 3)` exige diferencia `< 5e-4`. El
  valor real difiere en `~3.1e-5`, deja margen de sobra para detectar una fórmula distinta pero no es
  una tolerancia laxa (una conversión de grados/radianes mal hecha, p.ej. usar `fov/180` en vez de
  `fov/360`, produce una discrepancia de varios décimos, muy por encima del umbral). Aislado, este
  test no discrimina la mutación M1 (tupla fija `[-3.383, 1]`) porque para `aspect=4` la tupla fija
  **coincide** con el valor correcto — pero esa mutación la cazan los otros 3 tests de la suite
  (`derives the tiling…`, `tiles a 16:1 strip…`, `retiles when the artwork aspect changes…`), tal
  como documenta la tabla de mutaciones del informe (M1: 4 failed). La combinación es discriminante,
  no el ancla en solitario — que es justo el propósito: el ancla certifica el valor histórico, los
  demás certifican que viene de una derivación.
- **Fallback (`0`, `NaN`, negativo, `±Infinity`, no medible)**: no se limita a «no es NaN».
  `badge.config.spec.ts:262-273` usa `toEqual(reference)` donde `reference = bandRepeatFor(BADGE_BAND.referenceTextureAspect)`, y cierra comprobando `reference[0]` contra el literal
  `-3.383` — o sea, verifica que el fallback golpea **el valor histórico exacto**, no solo un número
  finito cualquiera. En la escena, `falls back to the reference tiling…` y
  `falls back when the resolved texture exposes no measurable dimensions` (`badge-scene.component.spec.ts:87-107`) hacen lo mismo vía `toEqual(bandRepeatFor(BADGE_BAND.referenceTextureAspect))`.
  El signo negativo en el fallback lo cubre además `always keeps the U inverted…`, que recorre los
  mismos aspectos degenerados.
- Verificación cruzada con la tabla de mutaciones del informe (M1-M4): cada mutación relevante
  (tupla fija, signo positivo, fallback eliminado, `computed` que ignora `bandMap()`) tiene al menos
  un test que la mata, y el informe documenta una segunda pasada de M4 tras detectar una aserción
  vacua por coincidencia (asset de test cambiado de 1024×256 a 2048×256) — evidencia de que el
  proceso de discriminancia se tomó en serio, no de boquilla.

## (2) Cero allocations / recalculo one-shot

- `protected readonly bandRepeat = computed<[number, number]>(...)` es un campo de clase, evaluado
  una vez por cambio de `bandMap()` (Angular signals), no dentro de `beforeRender`
  (`badge-scene.component.ts:498` es un `beforeRender` distinto, para la curva Catmull-Rom de la
  correa; `bandRepeat` no se referencia ahí). Cumple `docs/architecture.md` §4.
- Fallback real: `(image?.width ?? 0) / (image?.height ?? 0)`. Sin `image` (`undefined?.width` →
  `undefined ?? 0` → `0`) da `0/0 = NaN`; con `image` pero sin dimensiones, igual. `bandRepeatFor`
  descarta cualquier valor que no sea `Number.isFinite && > 0` y degrada a
  `BADGE_BAND.referenceTextureAspect`. Camino verificado también con datos reales del mock
  (`textureMock.data = { image: undefined }` y textura sin resolver, `badge-scene.component.spec.ts`).

## (3) Alcance

- `depthTest: false` conservado; `transparent: true` añadido como constante de config (no literal en
  template), coherente con el patrón de `depthTest`.
- Signo negativo conservado en todos los caminos, incluido el de fallback.
- Sin literal `3.383` suelto en código funcional (solo JSDoc y test de anclaje, ambos intencionados).
- URLs siguen apuntando a `band.jpg` (borrado del disco) — correcto, T5 no está en alcance de T4.
- `git status` confirma exactamente 4 ficheros tocados, coincide con lo declarado en el informe;
  ningún fichero de T5-T7 (README, CHANGELOG, playground, `band.jpg`/`font.json`) tocado.
- Ningún literal mágico nuevo suelto en el componente: los dos números nuevos (`ropeJoints: 3`,
  `referenceTextureAspect: 4`) están en `BADGE_BAND`, documentados y `ropeJoints` coincide con la
  cadena `fixed→j1→j2→j3` de `BADGE_LAYOUT` (`badge.config.ts:60-63`).

## (4) API pública / breaking change

- `bandRepeatFor` se exporta desde `badge.config.ts`, que `public-api.ts:4` reexporta con
  `export *` ⇒ API pública nueva, confirmado.
- `BADGE_BAND.repeat` desaparece del objeto (sustituida por la fn). El informe lo declara
  explícitamente como el "único cambio de forma de API de T4" en su sección de Decisiones, y en el
  resumen inicial. Documentar el CHANGELOG es T7, fuera de alcance de esta revisión.

## Docs

- architecture.md: [x] — cero allocations por frame respetado, computed one-shot.
- conventions.md: [x] — JSDoc en export público (`bandRepeatFor`), constantes en `badge.config.ts`,
  sin literales en componente.
- verification.md N1: [x] — 11 tests nuevos (6 + 5), camino feliz + fallback/error cubiertos con
  discriminancia verificada por mutación.
- No hacer (spec-04): [x] — sin rotación por código, sin tocar color del material físico, sin tocar
  física/GLB/cámara ortográfica, signo de la U conservado.

## Verificación independiente

```
pnpm ng test ngx-products-3d   → 12 files | 188 passed (188)
git status (solo lib/badge)    → 4 ficheros modificados, coincide con el informe
grep "3.383" en src/lib/badge  → solo en JSDoc y en test de anclaje (HAND_DERIVED_REFERENCE_REPEAT_X)
```

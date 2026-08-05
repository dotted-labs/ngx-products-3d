# Informe de implementación — spec-04 T4 (`badge-band-repeat-derived`, feature `id: 4`)

- **Fecha**: 2026-08-05
- **Rol**: implementer
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` § **R5 — Correa**
- **Estado**: implementado y verificado, **`in_progress`** en `feature_list.json` (no lo marco `done`
  yo). **Sin commitear**: lo hace el leader.

## Resumen

`BADGE_BAND.repeat = [-3.383, 1]` (tupla literal precalculada a mano) desaparece y pasa a ser la
**fn pura `bandRepeatFor(aspect)`**, derivada de `BADGE_PHYSICS.segmentLength`,
`BADGE_BAND.lineWidth` y `BADGE_CAMERA.fov`. El componente la evalúa sobre el aspecto **real** de la
textura ya cargada con un `computed` sobre `bandMap()` (one-shot por textura, **nada en
`beforeRender`**), y el material de la correa gana `transparent`.

Cierra el ítem de backlog «`BADGE_BAND.repeat` derivado del fov».

Baseline de entrada revalidado: **178/178**. Salida: **188/188** (+10 netos: 11 tests nuevos, 1
eliminado por quedarse sin objeto).

## Ficheros tocados (4)

| Fichero | Qué |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts` | `repeat` fuera; `transparent`, `ropeJoints` y `referenceTextureAspect` dentro de `BADGE_BAND`; **`bandRepeatFor` nueva** (export público) |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` | `computed` `bandRepeat()`; template `[repeat]="bandRepeat()"` + `[transparent]="band.transparent"` |
| `projects/ngx-products-3d/src/lib/badge/badge.config.spec.ts` | `describe('bandRepeatFor')`: **6 tests N1** (ancla, derivación, aspecto 16, signo, fallback, referencia) |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` | mock de `textureResource` con `data` resoluble + **5 tests** del cableado reactivo y del material |

Diff: 4 ficheros, +204 / −35 (incluye los dos borrados de assets que ya venían en el working tree
del leader y que **no** he tocado: `band.jpg` y `font.json`).

## (a) La fn pura

```ts
export function bandRepeatFor(textureAspect: number): [number, number] {
	const aspect =
		Number.isFinite(textureAspect) && textureAspect > 0
			? textureAspect
			: BADGE_BAND.referenceTextureAspect;
	const bandWidth = BADGE_BAND.lineWidth * Math.tan((BADGE_CAMERA.fov * Math.PI) / 360);
	const bandLength = BADGE_BAND.ropeJoints * BADGE_PHYSICS.segmentLength;

	return [-(bandLength / (aspect * bandWidth)), 1];
}
```

- **`fov` en grados → radianes**: `fov * Math.PI / 360` es `fov/2` en radianes (misma expresión que
  ya usaba el test de invariante de la escena, así que no introduce una segunda convención).
- **Ancla**: `bandRepeatFor(4)[0]` = **−3.3830313777465433** ⇒ `toBeCloseTo(-3.383, 3)`. Es
  exactamente el literal que sustituye (el `3.383` estaba redondeado a 3 decimales).
- `bandRepeatFor(16)[0]` = **−0.8457578444366358** (el `−0.846` que anticipa R5(d) para el
  `band.png` entregado; sigue siendo decisión de **asset**, no de código, y se mira en la N3 de T6).
- **Signo negativo siempre**, también en el camino de fallback (test que recorre 9 aspectos).
- **Cero literales nuevos**: los dos números que la fórmula necesitaba y no existían como constante
  se han añadido a `BADGE_BAND`, documentados:
  - `ropeJoints: 3` — los rope joints `fixed→j1→j2→j3` de `BADGE_LAYOUT` (antes era un `3` suelto en
    el test y en el JSDoc);
  - `referenceTextureAspect: 4` — el 4:1 del arte de referencia (`band.jpg`, 1024×256), **usado solo
    como fallback**.

## (b) Cableado reactivo

```ts
protected readonly bandRepeat = computed<[number, number]>(() => {
	const image = this.bandMap()?.image as { width?: number; height?: number } | undefined;

	return bandRepeatFor((image?.width ?? 0) / (image?.height ?? 0));
});
```

- `computed` sobre `bandMap()` ⇒ **una evaluación por textura**, no por frame. `beforeRender` no se
  ha tocado (regla de cero allocations, `docs/architecture.md` §4).
- Textura sin resolver (`useMap` = 0), sin `image` o con dimensiones a `0` ⇒ la división da `NaN`/`0`
  y `bandRepeatFor` degrada al aspecto de referencia. **Nunca `NaN` en el uniform.**
- La sanitización vive **entera** en la fn pura (el componente no repite guardas), que es lo que la
  hace testeable N1.

## (c) `transparent`

`<ngt-mesh-line-material>` gana `[transparent]="band.transparent"`, con
`BADGE_BAND.transparent = true` (el valor va en config, como `depthTest`, no como literal en el
template). **`depthTest: false` se conserva** y hay un test que exige las dos cosas a la vez.
`MeshLineMaterial` extiende `ShaderMaterial` ⇒ propiedad estándar; el shader ya multiplica el alfa
del map dentro de `diffuseColor` (`node_modules/meshline/dist/index.js:323`).

## Tests (N1)

`badge.config.spec.ts` → `describe('bandRepeatFor')`, 6:

1. `reproduces the hand-derived -3.383 for the 4:1 reference artwork` — **el ancla**, con el literal
   `-3.383` declarado como constante del test (independiente de la config a propósito).
2. `derives the tiling from the camera fov and the band geometry, not from a literal` — recompone la
   fórmula desde las constantes, con 12 decimales, para 4 y 16.
3. `tiles a 16:1 strip four times less than a 4:1 one` — el aspecto entra de verdad en la cuenta.
4. `always keeps the U inverted (negative X) and the V untiled (exactly 1)` — 9 aspectos, incluidos
   los degenerados.
5. `falls back to the reference aspect for unmeasurable aspects, never NaN` — `0`, negativo, `NaN`,
   `±Infinity`.
6. `keeps BADGE_BAND.referenceTextureAspect at the 4:1 of the reference artwork`.

`badge-scene.component.spec.ts` → 5 nuevos, 1 reescrito, 1 eliminado:

- **nuevo** `derives the band texture repeat from the REAL aspect of the resolved texture` — usa un
  asset **8:1** (2048×256), deliberadamente **distinto** del de referencia, para que el test caiga si
  el componente ignora la textura y se queda en el fallback.
- **nuevo** `retiles when the artwork aspect changes (a 16:1 strip is not tiled like a 4:1 one)`.
- **nuevo** `falls back to the reference tiling while the band texture is unresolved (never NaN)`.
- **nuevo** `falls back when the resolved texture exposes no measurable dimensions`.
- **nuevo** `declares transparent on the band material without dropping depthTest: false`.
- **reescrito** `tiles the band texture preserving the aspect ratio of a 4:1 lanyard artwork`: la
  invariante geométrica de siempre, pero ahora medida sobre `bandRepeat()` con la textura de
  referencia resuelta en vez de sobre la tupla borrada.
- **eliminado** `drives the band texture repeat from BADGE_BAND.repeat (no magic numbers)`: se quedó
  sin objeto al desaparecer la tupla (su intención —«el teselado no es un número mágico del
  componente»— la cubren ahora los cuatro tests de `bandRepeat()`).

Infraestructura de test tocada: el mock de `textureResource` pasa a exponer `textureMock.data`
(mismo patrón que `gltfMock.data`, ya aceptado en review) para simular la textura resuelta; se
resetea en el `beforeEach`. Los tests del teselado solo necesitan `image: { width, height }`.

## Discriminancia (mutaciones temporales, todas revertidas)

Norma de proceso 1: **copia previa + `md5sum -c`**. Cero `git checkout --` / `git restore` /
`git stash`.

| # | Mutación | Resultado |
|---|---|---|
| M1 | `bandRepeatFor` devuelve la tupla fija `[-3.383, 1]` (ignora el aspecto) **+** `transparent: false` | **4 failed / 184 passed**: `derives the tiling…`, `tiles a 16:1 strip…`, `retiles when the artwork aspect changes…`, `declares transparent…` |
| M2 | signo positivo (`bandLength / (aspect * bandWidth)`) | **6 failed / 182 passed**: los 5 tests de `bandRepeatFor` que tocan valor o signo + `tiles the band texture preserving…` de la escena |
| M3 | fallback eliminado (`const aspect = textureAspect;`) | **4 failed / 184 passed**: `always keeps the U inverted…`, `falls back to the reference aspect…`, y los **dos** de fallback de la escena (uno de ellos por `NaN` en el uniform) |
| M4 | el `computed` del componente ignora `bandMap()` y usa siempre `referenceTextureAspect` | **2 failed / 186 passed**: `derives the band texture repeat from the REAL aspect…` y `retiles when the artwork aspect changes…` |

M4 se corrió **dos veces**: en la primera pasada el test «derives … REAL aspect» usaba 1024×256, que
es justo el aspecto de referencia, y **sobrevivía** (solo caía 1 test). Se cambió el asset del test a
2048×256 (8:1) y la mutación pasó a matar 2. Queda anotado porque es exactamente el tipo de
aserción-vacua-por-coincidencia que la norma 4 persigue.

Reversión verificada por hash (idénticos a los de antes de mutar):

```
633c877c60e24fa084d482702d2f90b1 *badge.config.ts
9a12409ff8186531b6e207c5fed3716f *badge-scene.component.ts
```

## Barrido del diff (norma 2)

Sin `.only`, `.skip`, `true ||`, `as boolean`, constantes alteradas ni aserciones relajadas.
`git diff` de los 4 ficheros revisado; los dos ficheros mutados vuelven a su hash previo.

## Verificación

```
pnpm build                       ✅  Built @dotted-labs/ngx-products-3d (3517 ms)
pnpm ng lint ngx-products-3d     ✅  All files pass linting
pnpm ng test ngx-products-3d     ✅  12 files | 188 passed (188)
pnpm ng build products-3d-playground  ✅  bundle generation complete (9.3 s)
```

`dist/ngx-products-3d/types/dotted-labs-ngx-products-3d.d.ts:190` exporta
`declare function bandRepeatFor(textureAspect: number): [number, number];` ⇒ el cambio de API
pública sale en los tipos publicados, como pide Versionado. Sin dependencias nuevas.

## Decisiones y notas para el reviewer

- **`bandRepeatFor` vive en `badge.config.ts`**, como pide la descripción de la feature (y por tanto
  entra en `public-api.ts` por el `export *`). Es el único cambio de forma de API de T4.
- **Dos constantes nuevas en `BADGE_BAND`** (`ropeJoints`, `referenceTextureAspect`) en lugar de
  literales dentro de la fn. Es una ampliación compatible del objeto; el test
  `exposes the lanyard band material config from BADGE_BAND` sigue verde.
- **`transparent` como constante de config** y no como literal en el template, por coherencia con
  `depthTest` y con la regla de «constantes solo en `badge.config.ts`».
- **El template no está cubierto por tests**: los specs de la escena sustituyen el template por uno
  vacío (patrón ya establecido, jsdom sin WebGL). Los bindings `[repeat]="bandRepeat()"` y
  `[transparent]="band.transparent"` se verifican leyendo el fuente y en la N3.
- Ninguna discrepancia entre la spec y la API real de angular-three v4 / meshline en esta tarea.

## Fuera de alcance (respetado)

- **No he repuntado `band.jpg` → `band.png`**: es **T5**. `theme.bandTextureUrl` de la demo y los
  fixtures siguen apuntando a `band.jpg` (hoy 404 a propósito), y el `referenceTextureAspect` sigue
  siendo el 4:1 de ese asset. Cuando T5 lo repunte, **la única decisión** es si el aspecto de
  *referencia* (el del fallback) sigue siendo 4 o pasa a 16; el ancla `bandRepeatFor(4) = −3.383`
  **no debe moverse** en ningún caso: es histórica, no depende del asset vivo.
- No he tocado física, GLB, escena RT, `README.md`/`CHANGELOG.md` (T7) ni el playground (T6).
- `git rm` de `band.jpg` / `font.json`: es T5. El working tree ya los traía borrados del disco por el
  leader; no los he tocado ni restaurado.

## Verificación manual pendiente (N3 de T6)

Nada automatizable queda fuera. A mirar en la N3, y que depende de esta tarea:

- **Correa sin fondo negro** con el `band.png` (el `transparent` solo se ve con un asset con alfa; a
  día de hoy la demo no carga textura porque la URL es un 404 hasta T5).
- **Teselado real**: anotar el aspecto medido del `band.png` definitivo y el `repeat` que sale
  (−0.846 con 784×49 = **menos de una tesela**, el arte se cortaría). Si molesta, el arreglo es de
  **asset** (196×49 reproduce el teselado de `band.jpg`; 98×49 lo duplica), nunca de código.
- Que no haya **destello** al resolver la textura: el `repeat` arranca en el valor de referencia y
  salta al derivado en el frame en que `useMap` pasa a 1.

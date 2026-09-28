# impl spec-04 · T1 — `badge-base-color-111` (feature `id: 1`)

- **Fecha**: 2026-08-05
- **Rol**: implementer
- **Feature**: `id: 1`, `badge-base-color-111` — «Color base por defecto a `#111111` (rgb(17,17,17))»
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` § R4, tarea T1
- **Estado**: implementado y verificado, **pendiente de review** (no marco `done`)

## 1. Qué he tocado (2 ficheros, 4 líneas)

| Fichero:línea | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts:149` | `export const BADGE_BASE_COLOR = '#000000';` → `'#111111';` |
| `projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts:68` | `expect(BADGE_BASE_COLOR).toBe('#000000')` → `toBe('#111111')` |
| `projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts:66` | Nombre del test: `(black)` → `(near-black #111111)` |
| `projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts:84` | Nombre del test: `(black)` → `(near-black #111111)` |

Diff completo de la lib (`git diff projects/ngx-products-3d/src/`), literal:

```
diff --git a/projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts b/projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts
@@ -63,9 +63,9 @@ describe('assertValidBadgeTheme', () => {
 describe('resolveBaseColor', () => {
-	it('falls back to BADGE_BASE_COLOR (black) when the theme defines no baseColor', () => {
+	it('falls back to BADGE_BASE_COLOR (near-black #111111) when the theme defines no baseColor', () => {
 		expect(resolveBaseColor(makeTheme())).toBe(BADGE_BASE_COLOR);
-		expect(BADGE_BASE_COLOR).toBe('#000000');
+		expect(BADGE_BASE_COLOR).toBe('#111111');
 	});
@@ -81,7 +81,7 @@ describe('resolveBaseColor', () => {
 describe('resolveClipColor', () => {
-	it('falls back to BADGE_BASE_COLOR (black) when neither colors.clip nor baseColor are defined', () => {
+	it('falls back to BADGE_BASE_COLOR (near-black #111111) when neither colors.clip nor baseColor are defined', () => {
 		expect(resolveClipColor(makeTheme())).toBe(BADGE_BASE_COLOR);
 	});
diff --git a/projects/ngx-products-3d/src/lib/badge/badge.config.ts b/projects/ngx-products-3d/src/lib/badge/badge.config.ts
@@ -146,7 +146,7 @@ export const BADGE_FRONT_FACE = {
-export const BADGE_BASE_COLOR = '#000000';
+export const BADGE_BASE_COLOR = '#111111';
```

Fuera de `projects/ngx-products-3d/src/` solo he tocado `feature_list.json` (feature 1 a
`in_progress`, **no** a `done`) y `progress/current.md` / este informe.

### Decisiones

1. **El JSDoc de `BADGE_BASE_COLOR` (`badge.config.ts:144-148`) no se toca**: comprobado, **no cita
   el negro** — dice «Color base del modelo cuando el tema no define `baseColor`» + «Único sitio
   donde vive este literal». Sigue siendo cierto palabra por palabra con `#111111`. No añado el
   valor al comentario para no duplicar el literal (el criterio de aceptación pide que la constante
   sea la **única** fuente).
2. **Nombres de test actualizados de `(black)` a `(near-black #111111)`**: el nombre del test es
   parte de la aserción documental; dejar «black» describiendo `#111111` habría sido una mentira que
   el reviewer no puede distinguir de un olvido. Sin cambio de comportamiento.
3. **Nada más se ha tocado**, por scope explícito: `resolveBaseColor`/`resolveClipColor`
   (`badge-theme.ts:26-37`) intactas, temas demo del playground intactos (T6), `color` del
   `meshPhysicalMaterial` de la tarjeta sigue **sin definirse**, cero cambios en assets, layout de
   textos o fuentes (T2–T7).
4. **No he añadido tests nuevos.** La spec (T1) dice literalmente «los tres ya existen; se comprueba
   que siguen discriminando». Añadir un cuarto test del mismo literal habría sido redundante con
   `expect(BADGE_BASE_COLOR).toBe('#111111')`. La suite sigue en **160** tests, como pedía el
   encargo.

## 2. Demostración de discriminancia (norma de proceso 4)

Método (norma de proceso 1: **prohibido `git checkout --` / `git restore` / `git stash`**): copia
previa de los tres ficheros implicados en el scratchpad + `md5sum` registrado, mutación, ejecución,
restauración **por copia** y `md5sum -c` para probar que el árbol vuelve byte a byte al estado
previo.

Hashes de referencia (tomados **después** de aplicar el cambio real, antes de mutar):

```
8d220ffad857f548200a99a2a5b5cd07 *projects/ngx-products-3d/src/lib/badge/badge.config.ts
e892aa399b13e0351f56cb690470952d *projects/ngx-products-3d/src/lib/badge/badge-theme.ts
048f3920744cd4797e98423ec2661094 *projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts
```

### Mutación A — revertir la constante a `'#000000'`

Cubre el criterio «la aserción está actualizada y **falla si alguien revierte la constante**».

```
×  falls back to BADGE_BASE_COLOR (near-black #111111) when the theme defines no baseColor
FAIL  badge-theme.spec.ts > resolveBaseColor > falls back to BADGE_BASE_COLOR (near-black #111111) ...
AssertionError: expected '#000000' to be '#111111' // Object.is equality
Tests  1 failed | 159 passed (160)
```

Restauración: `md5sum -c` → los tres ficheros `OK`.

### Mutación B — invertir la prioridad en `resolveClipColor`

`return theme.colors?.clip ?? resolveBaseColor(theme);` →
`return theme.baseColor ?? theme.colors?.clip ?? BADGE_BASE_COLOR;`

Cubre el criterio «los tests de prioridad `colors.clip > baseColor` siguen discriminando».

```
×  gives colors.clip priority over baseColor
×  lets theme.colors.clip win over theme.baseColor
FAIL  badge-scene.component.spec.ts > Products3dBadgeScene > metal tint (clip/clamp) > lets theme.colors.clip win over theme.baseColor
AssertionError: expected '123456' to be 'ff0055' // Object.is equality
FAIL  badge-theme.spec.ts > resolveClipColor > gives colors.clip priority over baseColor
AssertionError: expected '#123456' to be '#ff0000' // Object.is equality
Tests  2 failed | 158 passed (160)
```

Restauración: `md5sum -c` → los tres ficheros `OK`.

### Mutación C — que `resolveBaseColor` deje de ignorar `colors.clip`

`return theme.baseColor ?? BADGE_BASE_COLOR;` →
`return theme.colors?.clip ?? theme.baseColor ?? BADGE_BASE_COLOR;`

Cubre el criterio «`baseColor` > default sin contaminación del override de clip» (el frente no se
tiñe nunca con `colors.clip`).

```
×  ignores colors.clip: the front backdrop is never tinted by the clip override
FAIL  badge-theme.spec.ts > resolveBaseColor > ignores colors.clip: the front backdrop is never tinted by the clip override
AssertionError: expected '#ff0000' to be '#123456' // Object.is equality
Tests  1 failed | 159 passed (160)
```

Restauración: `md5sum -c` → los tres ficheros `OK`.

### Mutación D — hardcodear el default a `'#000000'` en vez de leer la constante

`return theme.baseColor ?? BADGE_BASE_COLOR;` → `return theme.baseColor ?? '#000000';`

Es la mutación **más interesante del cambio**: cubre el criterio «`BADGE_BASE_COLOR` es la **única**
fuente del default». Antes de T1 esta mutación era **indetectable** (todas las aserciones del default
son simbólicas, `.toBe(BADGE_BASE_COLOR)`, y la constante valía exactamente `'#000000'`). Al mover la
constante a `#111111`, esas ocho aserciones dejan de ser vacuas frente a un default escrito a mano:

```
×  falls back to BADGE_BASE_COLOR (near-black #111111) when the theme defines no baseColor
×  ignores colors.clip: the front backdrop is never tinted by the clip override
×  falls back to BADGE_BASE_COLOR (near-black #111111) when neither colors.clip nor baseColor are defined
×  ignores unrelated color overrides (band/text) when resolving the metal tint
×  paints the backdrop quad with the theme default when baseColor is absent
×  repaints on a theme change through the same component instance (no re-creation)
×  degrades to a front without art (warning in dev) instead of a blank scene
×  falls back to BADGE_BASE_COLOR when neither colors.clip nor baseColor are set
FAIL badge-scene.component.spec.ts    AssertionError: expected '000000' to be '111111'
FAIL badge-texture.component.spec.ts  AssertionError: expected '#000000' to be '#111111'  (×3)
FAIL badge-theme.spec.ts              AssertionError: expected '#000000' to be '#111111'  (×4)
Tests  8 failed | 152 passed (160)
```

Restauración: `md5sum -c` → los tres ficheros `OK`.

### Barrido final del propio diff (norma de proceso 2)

- `git diff projects/ngx-products-3d/src/` = exactamente las 4 líneas de la tabla de §1. **Ninguna
  mutación sobrevive.**
- `grep -rn "\.only(\|\.skip(\|true ||\|false as boolean" projects/ngx-products-3d/src/` →
  `NO leftover mutations` (sin coincidencias).
- `grep '#000000'` en `projects/ngx-products-3d/src/` → sin coincidencias.

## 3. Hallazgo colateral verificado (no es un cambio, es evidencia)

`badge-scene.component.spec.ts:540` compara el tinte del metal con
`clipMaterialOf(data).color.getHexString()` contra `BADGE_BASE_COLOR.slice(1)`. Con `#000000` el
roundtrip sRGB↔linear de `three.Color` era trivial (0 → 0). Con `#111111` (17/255 = 0.0667 sRGB →
≈0.00560 lineal → vuelta a 17) **el roundtrip sigue siendo exacto**: el test pasa sin tocarlo, y ya
no es un caso degenerado. Lo dejo anotado porque era el único riesgo real de rotura numérica del
cambio y estaba sin comprobar.

## 4. Verificación

Baseline revalidado **antes** de tocar nada (§1 de `AGENTS.md`): `build` ✅, `lint` ✅, `test`
**160/160** ✅ — coincide con lo que dejó el leader.

Salidas literales de los tres comandos **después** del cambio (colas):

### `pnpm build`

```
------------------------------------------------------------------------------
Built Angular Package
- from: C:/Projects/dixper/ngx-products-3d/projects/ngx-products-3d
- to:   C:/Projects/dixper/ngx-products-3d/dist/ngx-products-3d
------------------------------------------------------------------------------

Build at: 2026-08-05T09:50:13.984Z - Time: 16783ms
```

### `pnpm ng lint ngx-products-3d`

```
Linting "ngx-products-3d"...

All files pass linting.
```

### `pnpm ng test ngx-products-3d`

```
 RUN  v4.1.10 C:/Projects/dixper/ngx-products-3d

 Test Files  11 passed (11)
      Tests  160 passed (160)
   Start at  11:51:37
   Duration  51.92s
```

### Comprobación extra sobre `dist` (Nivel 2 de `docs/verification.md`)

El valor nuevo llega al bundle publicable y sigue exportándose como API pública:

```
dist/ngx-products-3d/fesm2022/*.mjs:167:  const BADGE_BASE_COLOR = '#111111';
dist/ngx-products-3d/fesm2022/*.mjs:514:      return theme.baseColor ?? BADGE_BASE_COLOR;
dist/ngx-products-3d/fesm2022/*.mjs:1616: export { ..., BADGE_BASE_COLOR, ... }
```

## 5. Criterios de aceptación (feature `id: 1`)

| Criterio | Estado | Evidencia |
|---|---|---|
| `BADGE_BASE_COLOR === '#111111'` y es la única fuente del default (ningún literal nuevo en componentes) | ✅ | `badge.config.ts:149`; `grep '#000000'` en la lib sin coincidencias; **mutación D** (8 tests caen si alguien escribe el default a mano) |
| La aserción de `badge-theme.spec.ts` está actualizada y sigue siendo discriminante | ✅ | `badge-theme.spec.ts:68`; **mutación A** |
| Los tests de prioridad `colors.clip > baseColor > default` siguen verdes y siguen discriminando | ✅ | **mutaciones B, C y D** |
| `pnpm build` sin errores | ✅ | §4 |
| `pnpm ng lint ngx-products-3d` sin errores | ✅ | §4 |
| `pnpm ng test ngx-products-3d` > 0 tests y todos verdes | ✅ | 160/160, §4 |

## 6. Verificación manual pendiente (N3) — no bloquea T1

El criterio global de la spec «**el frente muestra ese color donde el arte es transparente**» es
visual y **no se puede cerrar en T1**: hoy los dos temas demo siguen sobreescribiendo `baseColor`
(violet `#3b0764`, ember `#7c2d12`), y retirarlos es **T6** por decisión de scope del encargo. Hasta
entonces el `#111111` no es visible en el playground. Queda para la N3 de T6, junto con el detalle ya
anotado en la spec (R4): al quitar el campo del tema, `baseColor = signal(...)`
(`badge-demo.component.ts:202`) arrancaría `undefined` y hay que inicializarlo desde
`BADGE_BASE_COLOR`.

## 7. Para el leader (fuera del scope de T1, no lo he tocado)

Tres sitios siguen documentando el default como **negro `#000000`**. Ninguno es código ejecutable y
los tres caen en el territorio de **T7 (documentación)**, así que los dejo intactos a propósito:

- `projects/ngx-products-3d/src/lib/types.ts:29` — JSDoc de `Products3dBadgeTheme.baseColor`:
  «Default `BADGE_BASE_COLOR` (`badge.config.ts`, **negro**)». Es el único de los tres que vive
  **dentro de la lib** y viaja en los `.d.ts` publicados; si T7 solo repasa READMEs y CHANGELOG,
  éste se queda sin actualizar.
- `projects/ngx-products-3d/README.md:201` y `:215` — tabla del tema con `'#000000'`.
- `CHANGELOG.md:112` — entrada 0.3.0 sin publicar, cita `BADGE_BASE_COLOR` (`'#000000'`).

No hay discrepancia alguna entre la spec y la API real de `angular-three@4` en esta tarea.

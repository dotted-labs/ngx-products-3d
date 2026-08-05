# Sesión actual

- **Fecha**: 2026-08-05
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` (**activa, sin empezar**)
- **Rol**: leader

## Estado

`spec-03-F4v2` cerrada y archivada en `docs/specs/spec-03-F4v2-front-design.md` (8/8 features
`done`, 8 veredictos APPROVED, N3 firmada por Sergio el 2026-08-05). Bitácora en
`progress/history.md`.

**`spec-04` redactada y activada**, con las 7 tareas desglosadas en `feature_list.json`. **T1
cerrada (`done`, APPROVED)**; T2–T7 en `pending`.

Baseline heredado: `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ ·
`pnpm ng test ngx-products-3d` **160/160** ✅ · `pnpm ng build products-3d-playground` ✅.
**El implementer debe revalidarlo antes de tocar nada** (§1 de `AGENTS.md`).

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
   es **784×49** (16:1, con alfa). El shader de meshline (`meshline/dist/index.js:323`) **ignora la
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
| `Ballega.otf` | ✅ Entregado (70 736 B, 176 glifos) |
| `band.png` | ✅ Entregado y **ya girado** (784×49, 16:1, con alfa) |
| `band.jpg` | ❌ Borrado del disco, **aún trackeado** en git → `git rm` en T5 |
| `font.json` | ❌ **Borrado por Sergio** durante esta sesión, aún trackeado → `git rm` en T5 |

⚠️ **La demo arranca hoy sin correa y sin textos**: `bandTextureUrl` apunta a `band.jpg` y los tres
`fontUrl` a `font.json`, y los dos son 404. Degrada a color plano y a sin-texto con warns dev (los
modos degradados diseñados), pero es un 404 vivo hasta que se cierren T5 y T6.

**Fleco abierto de la correa**: el `repeat` derivado del asset entregado sale **−0.846**, o sea
**menos de una tesela** — se vería ~85 % del arte y se cortaría. No es un fallo. Si debe repetirse,
la tesela tiene que ser más corta (196×49 reproduce el teselado que había con `band.jpg`). **Se
decide viendo el playground en la N3 de T6**, y el arreglo sería de asset, no de código.

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
- **Higiene fuera de spec** — (a) Prettier reporta ficheros no formateados por **CRLF** en todo el
  repo (`endOfLine: lf` por defecto): arreglo = fijar `endOfLine`/`.gitattributes` + un `--write` en
  **commit dedicado**. (b) `setupFiles` en el target `test` de `angular.json` para ejecutar el stub
  de `getContext('2d')` una vez y borrar sus **tres** copias.
- Propuestas P3/P4/P5 del implementer en `progress/impl_feature14.md`, sin aplicar.
- Canto y dorso de la tarjeta: fuera de alcance en F4v2, solo se anotó lo que se ve.

### Absorbidos por spec-04 (ya no son backlog)

- **P22** (mutante superviviente: ningún test distingue el `maxWidth` **por slot** del global) → T2.
- **`BADGE_BAND.repeat` derivado** (hoy `-3.383` precalculado a mano, obsoleto en silencio si alguien
  toca el fov) → T4.

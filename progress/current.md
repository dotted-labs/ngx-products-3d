# Sesión actual

- **Fecha**: 2026-08-05
- **Spec**: ninguna activa. `docs/specs/active/` vacío.
- **Rol**: leader

## Estado

**`spec-03-F4v2` (diseño frontal de la card) COMPLETADA y archivada** en
`docs/specs/spec-03-F4v2-front-design.md`. Las 8 features en `done`, los 8 veredictos APPROVED, la
N3 firmada por Sergio el 2026-08-05 («verificación correcta»). Bitácora completa en
`progress/history.md`.

Baseline actual: `pnpm build` ✅ · `pnpm ng lint ngx-products-3d` ✅ · `pnpm ng test
ngx-products-3d` **160/160** ✅ · `pnpm ng build products-3d-playground` ✅.

## ⚠️ Decisión pendiente: publicación de la 0.3.0

`0.3.0` está **preparada y NO publicada**. El registry sirve todavía `0.2.1`. La publicación la
dispara **CI** (`.github/workflows/release-publish.yml`) al detectar el bump **en un push a `main`**.

Todo el trabajo vive en `feature/blender-assets` (6 commits, hasta `1157122`). **Mergear a `main` =
publicar.** Requiere **GO explícito de Sergio**; el leader no mergea por su cuenta.

La 0.3.0 acumula breaking de dos specs (F3 y F4v2), todos documentados en `CHANGELOG.md`.

## Próxima spec (anunciada por Sergio el 2026-08-05, SIN redactar todavía)

> «En la siguiente spec vamos a cambiar fuente, posición y color»

Se refiere a los **textos del socio** del frente de la tarjeta. Contexto que hereda:

- **La posición ya es data-driven** desde `BADGE_TEXT_LAYOUT` (`badge.config.ts`), con la forma de
  `BadgeTextSlot` que estrenó T6: `field`, `anchor`, `align`, `size`, `height`, `maxWidth`.
  ⚠️ **La trampa de la V**: `anchor[1] = 0` es el borde **INFERIOR** de la cara, al revés que los UV
  del GLB (donde `v = 0` es arriba). Documentado en el README publicado.
- **El color** sale de `theme.colors?.text ?? BADGE_TEXT.color`. La review de T7 dejó abierta una
  **decisión de diseño**: el texto negro sobre el arte violeta queda **al límite de legibilidad**, y
  ningún tema demo define `colors.text`. Esta spec es el sitio para resolverlo.
- **La fuente** sale de `theme.fontUrl` (typeface JSON de `NgtsText3D`). Al tocarla, ojo con **P21**:
  la extrusión (`height`) funciona solo mientras `angular-three-soba` importe el `TextGeometry` de
  **three-stdlib**; el de three 0.182 ya solo lee `depth` (default 50) y la extrusión se rompería en
  silencio.
- Cambiar la forma de `BadgeTextSlot` o `BADGE_TEXT` es **API pública** (`public-api.ts` hace
  `export *` de `badge.config`) → decidir si se pliega en la 0.3.0 (si sigue sin publicar) o exige
  un nuevo minor.

**Antes de implementar**: redactar la spec en `docs/specs/active/`, revisarla contra el código real
(en F4v2 el borrador traía cuatro afirmaciones falsas) y desglosarla en `feature_list.json`.

## Normas de proceso vigentes (salidas de incidentes reales, NO son teoría)

1. **Prohibido `git checkout --`, `git restore`, `git stash`** sobre trabajo sin commitear. Para
   revertir una mutación: **copia previa del fichero + `md5sum -c`**. (En F4v2 un `git checkout --`
   borró el trabajo cerrado de dos features.)
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
  se rompe **en silencio**. Vigilar en cada bump de `angular-three-soba`.
- **P22** — mutante superviviente: `fitTextScale(width, slot.maxWidth)` → `BADGE_TEXT_LAYOUT[0].maxWidth`
  deja 160/160 en verde. Ningún test distingue el `maxWidth` **por slot** del global. Cierre: ~2
  líneas en `badge-texture.component.spec.ts:455`.
- **P23** — `badgeTextFor` (`badge-texture.ts:20-33`) no tiene guarda para `memberNumber: ''` ⇒ el
  frente pinta el prefijo `#` suelto. Defecto de la **lib**.
- **P24** — `badge-texture.component.ts:243` dice «El frente se renderiza sin fondo», redacción
  anterior a T4: ahora sí hay un quad opaco de `baseColor` detrás.
- **H3** — `alignOffsetX` tiene `switch` exhaustivo sin `default` ⇒ `undefined`/`NaN` para un
  consumidor **JS** con `align` inválido.
- **`BADGE_BAND.repeat` derivado del fov** — hoy es `-3.383` precalculado a mano; si alguien cambia
  el fov queda obsoleto en silencio. Hacerlo **función pura evaluada al cargar el módulo** (NO
  `computed()`: no hay estado reactivo), con el aspecto de la textura como parámetro.
- **Higiene fuera de spec** — (a) Prettier reporta ficheros no formateados por **CRLF** en todo el
  repo (`endOfLine: lf` por defecto): arreglo = fijar `endOfLine`/`.gitattributes` + un `--write` en
  **commit dedicado**. (b) `setupFiles` en el target `test` de `angular.json` para ejecutar el stub
  de `getContext('2d')` una vez y borrar sus **tres** copias.
- Propuestas P3/P4/P5 del implementer en `progress/impl_feature14.md`, sin aplicar.
- Canto y dorso de la tarjeta: fuera de alcance en F4v2, solo se anotó lo que se ve.

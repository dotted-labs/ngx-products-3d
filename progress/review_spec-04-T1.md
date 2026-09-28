# Review — spec-04 T1 (`badge-base-color-111`, feature `id: 1`)

- **Fecha**: 2026-08-05
- **Rol**: reviewer
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` § R4, tarea T1
- **Informe revisado**: `progress/impl_spec-04-T1.md`

**Veredicto:** APPROVED

## Criterios de aceptación (feature `id: 1` de `feature_list.json`)

- CA1 — `BADGE_BASE_COLOR === '#111111'` y es la única fuente del default (ningún literal nuevo
  en componentes): **[x]**
  - `badge.config.ts:149` → `export const BADGE_BASE_COLOR = '#111111';`. Verificado leyendo el
    fichero, no el informe.
  - Barrido propio de literales de color en `projects/` (`#000000`, `#111111`, `'black'`, `0x000000`,
    `rgb(0,0,0)`): las **únicas** coincidencias en `src/` son `badge.config.ts:149`,
    `badge.config.ts:363` (`BADGE_TEXT.color: 'black'`, preexistente y que R1 manda **no** tocar) y
    las dos del propio `badge-theme.spec.ts`. **Cero literales nuevos en componentes.**
  - `dist/ngx-products-3d/fesm2022/dotted-labs-ngx-products-3d.mjs:167` →
    `const BADGE_BASE_COLOR = '#111111';` y `types/dotted-labs-ngx-products-3d.d.ts:213` →
    `declare const BADGE_BASE_COLOR = "#111111";`, presente en la línea `export { ... }` del d.ts.
    El valor nuevo llega al bundle publicable y sigue siendo API pública.

- CA2 — La aserción de `badge-theme.spec.ts` está actualizada y sigue siendo discriminante (falla
  si alguien revierte la constante): **[x]**
  - `badge-theme.spec.ts:68` → `expect(BADGE_BASE_COLOR).toBe('#111111')`. La aserción compara la
    constante contra un **literal**, no contra sí misma: revertir `badge.config.ts:149` a
    `'#000000'` la tumba por construcción. No es una aserción vacua (norma de proceso 4).
  - La línea hermana `:67` (`expect(resolveBaseColor(makeTheme())).toBe(BADGE_BASE_COLOR)`) es
    simbólica y **sigue siendo necesaria**: cubre el cableado fn↔constante, que el literal no cubre.
    Las dos juntas son lo que hace detectable un default escrito a mano (mutación D del informe).

- CA3 — Los tests de prioridad `colors.clip > baseColor > default` siguen verdes y siguen
  discriminando: **[x]**
  - Leídos uno a uno (`badge-theme.spec.ts:71-106`): los cinco casos de prioridad afirman contra
    hex **distintos y hardcodeados** (`'#123456'` vs `'#ff0000'` vs `BADGE_BASE_COLOR`), no contra
    valores derivados de la propia fn. Ninguna aserción se ha relajado: el diff no las toca.
  - `badge-scene.component.spec.ts:533-542` compara `clipMaterialOf(data).color.getHexString()` con
    `BADGE_BASE_COLOR.slice(1)`. Con `#000000` el roundtrip sRGB↔linear de `three.Color` era
    degenerado (0→0); con `#111111` deja de serlo y el test **pasa igual**. El §3 del informe
    («hallazgo colateral») queda confirmado: era el único riesgo numérico real del cambio y no se
    materializa.

- CA4 — `pnpm build` sin errores: **[x]** exit 0, `Built Angular Package ... Time: 2894ms`.
- CA5 — `pnpm ng lint ngx-products-3d` sin errores: **[x]** exit 0, `All files pass linting.`
- CA6 — `pnpm ng test ngx-products-3d` > 0 tests y todos verdes: **[x]** exit 0,
  `Test Files 11 passed (11)` y `Tests 160 passed (160)`.

Extra ejecutado por mi cuenta (Nivel 2 completo de `docs/verification.md`):

- `pnpm ng build products-3d-playground`: exit 0, `Application bundle generation complete`. El
  consumidor real sigue compilando contra la API pública.
- Checks de dist: `dist/ngx-products-3d/fesm2022/` con el único entry point esperado; peers correctos
  y `"dependencies": { "tslib": "^2.3.0" }` — **sin deps fantasma**.

## Docs

- `architecture.md`: **[x]** — §2 (config data-driven) respetada: el literal sigue viviendo solo en
  `badge.config.ts`. §4 (cero allocations) no aplica: no se toca `beforeRender`. Boundaries intactos:
  ni imports nuevos ni deep imports.
- `conventions.md`: **[x]** — `UPPER_SNAKE` con prefijo de producto conservado; sin comentarios
  nuevos superfluos; nombres de test descriptivos (`... (near-black #111111) ...`). El JSDoc del
  export (`badge.config.ts:144-148`) sigue siendo cierto palabra por palabra sin duplicar el literal:
  comprobado, **no citaba el negro**. Decisión 1 del informe validada.
- `verification.md` N1: **[x]** — lógica pura cubierta con camino feliz (default aplicado) y caminos
  de override/prioridad. No se añaden tests nuevos, y es lo correcto: T1 dice literalmente «los tres
  ya existen; se comprueba que siguen discriminando». Un cuarto test del mismo literal habría sido
  redundante con `:68`.
- `verification.md` N2: **[x]** — los cuatro comandos verdes por mi cuenta + checks de dist.
- `verification.md` N3: **[x] no aplica a T1** — el efecto visual no es observable hoy: los dos temas
  demo siguen fijando `baseColor` (violet `#3b0764`, ember `#7c2d12`) y retirarlos es **T6** por
  scope explícito de la spec (R4). El criterio global «el frente muestra ese color donde el arte es
  transparente» está asignado a la checklist N3 de la feature 6 (`feature_list.json:117`, apartado
  (e), que lo cita literalmente). El §6 del informe lo declara así y es correcto: T1 no se salta una
  N3 que le tocara.

## Barrido de mutaciones supervivientes (norma de proceso 2)

Contrastado contra el árbol, no contra el informe:

- `git diff -- projects/ngx-products-3d/` = **2 ficheros, 4 líneas** (`+4 −4`), idénticas a la tabla
  del §1 del informe. Nada más.
- `badge-theme.ts` **no aparece en el diff**: byte a byte igual a `HEAD`. Ésa es la prueba dura de
  que las mutaciones B, C y D (las tres sobre `resolveBaseColor`/`resolveClipColor`) fueron
  revertidas por completo, sin depender del `md5sum -c` que reporta el implementer.
- `badge.config.ts` solo difiere en la línea 149: la mutación A no sobrevive.
- Barrido de `projects/` por `.only(`, `.skip(`, `xit(`, `xdescribe(`, `fit(`, `fdescribe(`,
  `todo(`, `true ||`, `false &&`, `as boolean`: **cero coincidencias**.
- Barrido de `#000000` en `projects/ngx-products-3d/src/`: **cero coincidencias**.
- Suite en 160 tests, el mismo número del baseline: ni tests desactivados ni perdidos.

**Ninguna mutación ha sobrevivido al árbol.**

## Alcance (sección «No hacer» de la spec)

- `resolveBaseColor` / `resolveClipColor` (`badge-theme.ts:26-37`): **sin cambios de forma** ni de
  ninguna otra clase. **[x]**
- `color` del `meshPhysicalMaterial` de la tarjeta: **sigue sin definirse**. Verificado en
  `badge-scene.component.ts:152-158` — el binding no existe y el comentario `:143-151` que explica el
  porqué sigue en su sitio. **[x]**
- Temas demo del playground (T6): **intactos**. `badge-demo.component.ts` no está en el diff. **[x]**
- Assets, layout de textos, fuentes, física, GLB y cámara ortográfica (T2-T7): **intactos**. **[x]**
- `feature_list.json`: la feature 1 queda en `in_progress`, **no** en `done`. Correcto: cerrarla es
  del leader. **[x]**

Sin ampliación de alcance. Sin discrepancias spec↔API real de `angular-three@4` que verificar en esta
tarea (el informe tampoco declara ninguna, coherente con un cambio que no toca API de terceros).

## Cambios requeridos

Ninguno.

## Notas de seguimiento para T7 (documentación) — NO son motivo de rechazo de T1

Las cuatro que el leader ya tenía localizadas y está trasladando a T7:

- `projects/ngx-products-3d/README.md:201` — fila del tema con `'#000000'`.
- `projects/ngx-products-3d/README.md:215` — fórmula `colors.clip ?? baseColor ?? '#000000'`.
- `CHANGELOG.md:112` — entrada 0.3.0, cita `BADGE_BASE_COLOR ('#000000')`.
- `projects/ngx-products-3d/src/lib/types.ts:29` — JSDoc público («... `badge.config.ts`, **negro**»),
  el único que viaja en los `.d.ts` publicados. Confirmado que sigue así en el dist recién
  construido: `dist/ngx-products-3d/types/dotted-labs-ngx-products-3d.d.ts:37`.

**Cinco más que ha encontrado mi barrido y que no estaban en esa lista.** Todas describen el default
como «negro», ninguna es código ejecutable, ninguna la introduce T1, y la acceptance de la feature 7
ya obliga a «barrer además el repo por si queda alguno más»:

1. `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts:146-147` — comentario del
   template: «el baseColor del tema (**negro por defecto**)». Está **dentro de la lib**.
2. `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts:400` — «Con el default **negro**
   SIEMPRE hay color...». El razonamiento sigue siendo válido (`#111111` también es truthy), pero la
   palabra ya no describe el valor.
3. `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts:538` — el mismo comentario,
   espejado en el test.
4. `CHANGELOG.md:169` — «pasa a mostrarlos **negros** (el default de `baseColor`)». Es una segunda
   ocurrencia en el CHANGELOG, distinta de la `:112` ya fichada.
5. `projects/products-3d-playground/src/app/badge-demo/badge-demo.component.ts:34` — «Sin baseColor
   explícito el clip/clamp de este tema saldría **negro**». Cae en **T6**, no en T7: ese comentario
   deja de ser cierto justo cuando T6 retire el `baseColor` de los temas demo.

Descartadas a propósito por ser correctas o por no referirse al default de `baseColor` (para que T7
no las toque por error): `projects/ngx-products-3d/README.md:204` y `:350` y `badge.config.ts:363`
hablan del default de `colors.text`, que R1 mantiene en `'black'`; `badge-texture.component.ts:58`,
`:72`, `:87`, `README.md:220` y `types.ts:35` describen el efecto de un color oscuro o de componer
sin alfa, no el valor por defecto.

> No es la última fase de spec-04 (quedan T2-T7 en `pending`), así que **no** se emite bloque
> `Cierre de spec`.

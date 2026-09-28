# Implementación — spec-04 T3 (`badge-font-opentype`, feature `id: 3`)

- **Fecha**: 2026-08-05
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` § R2, tarea T3
- **Estado**: implementada y verificada. **Pendiente de review.**

> ⚠️ **Este informe lo redacta el LEADER, no el implementer.** El código lo escribió un subagente
> `implementer` que se **colgó tres veces** por errores de infraestructura (dos veces el mismo agente,
> una tercera un agente nuevo con contexto limpio), siempre en el mismo punto: al ir a redactar este
> fichero. El código quedó completo y en verde en el primer intento; lo que se perdió en cada caída
> fue la redacción, no el trabajo.
>
> **Consecuencia que el reviewer debe tener en cuenta**: la ronda de mutaciones de discriminancia
> **no llegó a ejecutarse de forma reproducible**. El § 4 la sustituye por un análisis de
> discriminancia por construcción, hecho por el leader leyendo los tests. Es más débil que ejecutar
> las mutaciones y así queda declarado, no disimulado. Ver el § 4 y lo que se pide al reviewer.
>
> **Tras cada caída el leader barrió el árbol** (norma de proceso 2): en las tres, cero mutaciones
> supervivientes, cero ficheros de backup huérfanos, y `badge-font.ts` byte a byte idéntico a lo ya
> revisado. Ninguna mutación temporal ha sobrevivido.

## 1. Qué se ha tocado

| Fichero | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge-font.ts` | **Nuevo.** `isOpentypeFontUrl` (fn pura) + `loadOpentypeFontData` (caché por URL) + `parseOpentypeFont` (el `import()` dinámico) |
| `projects/ngx-products-3d/src/lib/badge/badge-font.spec.ts` | **Nuevo.** 11 tests N1 |
| `projects/ngx-products-3d/src/lib/badge/badge-texture.component.ts` | `opentypeFontUrl` / `opentypeFont` / `resolvedFont` + gate del `@for` + effect de warn dev |
| `projects/ngx-products-3d/src/lib/badge/badge-texture.component.spec.ts` | 6 tests nuevos (`describe('Products3dBadgeTexture font')`) |
| `projects/ngx-products-3d/src/lib/types.ts:26` | JSDoc de `fontUrl`: «Typeface JSON (three) para Text3D» → «typeface JSON de three, `.otf` o `.ttf` (detección por extensión)» |

Sin cambios en `REQUIRED_THEME_URL_FIELDS`, sin campos nuevos en el tema, sin dependencias nuevas y
sin tocar los `fontUrl` de la demo (eso es T6).

## 2. Diseño

- **Detección por extensión de la RUTA**, no de la URL entera: `url.split(/[?#]/)` antes de comparar,
  para que `font.json?family=x.otf` siga siendo JSON.
- **Passthrough del camino JSON**: si la URL no es binaria, a `NgtsText3D` se le pasa **la URL string
  tal cual** y soba la fetchea y cachea como siempre. La lib no se mete en medio.
- **`params: undefined` deja el `resource` en `idle`** cuando la fuente es JSON, así que ese camino
  **no paga ni el `import()` del TTFLoader ni una petición extra**. Está demostrado en test:
  `expect(ttfLoaderMock.loaded).toEqual([])`.
- **Caché de la PROMESA, no del resultado** (`badge-font.ts:36`), a nivel de módulo como la de soba.
  Dos motivos, y los dos exigen referencia estable: la caché de `fontResource` está keyed por
  **identidad del parámetro**, así que un objeto nuevo por CD la haría re-parsear en bucle; y dos
  badges con el mismo tema comparten un único parseo. Un fallo **se descachea** para no envenenar
  reintentos.
- **Tipado sin `any`**: usa `NgtsFontInput`, que soba exporta.

## 3. Desviaciones respecto a la spec (decisiones no anticipadas)

### 3.1 Gate `@if (resolvedFont(); as font)` sobre el `@for`

La spec decía «degrada a sin texto», pero no cómo. Hizo falta **gatear el `@for`** porque
`NgtsText3D.font` es `input.required`: no hay valor neutro que pasarle mientras la fuente se descarga
o si falla. Y pasarle una fuente ausente no es inocuo — el `value()` de un recurso en error **lanza**
`ResourceValueError` **en plena detección de cambios**, que es exactamente el fallo que ya tumbó la
escena entera en una spec anterior (ver `progress/history.md:151`) y por el que existe
`resource-value.ts::resourceValueOrUndefined`.

Sin el gate, una fuente rota no degradaría: reventaría el render. Con él, el modo degradado es
«frente con su color base y su arte, sin textos» — coherente con cómo ya degradan la correa y el arte
del frente.

### 3.2 `as unknown as NgtsFontInput` (`badge-font.ts:73`)

El `FontData` de `@types/three` y el `NgtsFontInput` de soba **describen el mismo typeface JSON**,
pero el de soba declara `_cachedOutline` **obligatorio** en cada glifo. Ese campo lo rellena el
`FontLoader` de three **en caliente**: ningún typeface lo trae de origen, tampoco el que produce
`TTFLoader`. O sea que el tipo de soba describe el objeto *después* de pasar por `FontLoader`, no
antes.

Es **conversión de tipos, no de datos**: el objeto que sale de `TTFLoader` es literalmente el que
`FontLoader.parse()` espera recibir. No cabía evitarlo con un tipo más estrecho sin `any`, que
`docs/conventions.md` prohíbe, y el cast queda comentado en el propio fichero.

**Es el punto que más conviene que apriete el reviewer.**

## 4. Discriminancia — análisis por construcción (NO ejecutada como mutaciones)

Lo honesto: **no se ejecutó la ronda de mutaciones**. Lo que sigue es el análisis del leader sobre
por qué cada mutación caería, leyendo las aserciones. Se declara como lo que es.

| Mutación | Qué la detecta |
|---|---|
| `isOpentypeFontUrl` → siempre `true` | `badge-font.spec.ts:41-42,47-50,55-56` (los 8 casos que esperan `false`) y `badge-texture.component.spec.ts` «passes a typeface JSON url straight through» |
| `isOpentypeFontUrl` → siempre `false` | `badge-font.spec.ts:27-30,35-37` (los 7 casos que esperan `true`) y los tests de `.otf`/`.ttf` del componente |
| Caché devolviendo objeto nuevo por llamada | `badge-font.spec.ts:80` `expect(second).toBe(first)` **y** `:81` `expect(ttfLoaderMock.loaded).toEqual(['/assets/stable.otf'])` — la cuenta de cargas pasaría a 2. Doble red |
| Cachear el resultado en vez de la promesa | `badge-font.spec.ts:92` (dos llamadas concurrentes) |
| Cachear también los fallos | `badge-font.spec.ts:117-120` (el reintento debe volver a cargar) |
| Gate del template dejando pasar `undefined` | `badge-texture.component.spec.ts` «degrades to a front WITHOUT TEXT ... never throwing» |

Las aserciones **no son vacuas**: comparan contra **literales** (`'assets/font.json'`,
`{ familyName: 'Ballega' }`) y contra **cuentas de invocación** del doble del loader
(`ttfLoaderMock.loaded`), no contra valores derivados de la propia función bajo prueba. El doble
intercepta el `import()` dinámico con `vi.mock`, así que no hay red ni los 467 KB reales en la suite.

> **Lo que se le pide al reviewer**: validar este análisis por su cuenta y, si alguna de las seis
> filas no se sostiene, emitir `CHANGES_REQUESTED`. En particular la tercera: si un objeto nuevo por
> llamada **no** tumbara ningún test, ese test sería vacuo, y con él se cae la garantía de que soba
> no re-parsea la fuente en cada detección de cambios — que es el motivo de existir de la caché.

## 5. Verificación (N1 + N2), ejecutada por el LEADER

| Comando | Resultado |
|---|---|
| `pnpm ng test ngx-products-3d` | **177/177** verdes, 12 ficheros (baseline: 160/160, 11 ficheros) ⇒ **+17 tests** |
| `pnpm build` | ✅ |
| `pnpm ng lint ngx-products-3d` | ✅ `All files pass linting.` |
| `pnpm ng build products-3d-playground` | ✅ |

Checks sobre el paquete publicable:

- `dist/ngx-products-3d/package.json` → `dependencies: {"tslib":"^2.3.0"}`. **Sin deps nuevas.**
- El bundle conserva `import('three/addons/loaders/TTFLoader.js')` **como import dinámico**
  (verificado con `grep -o "import([^)]*)"` sobre `fesm2022/dotted-labs-ngx-products-3d.mjs`).
- **`opentype` NO entra en el bundle**: las 8 coincidencias de esa cadena son identificadores propios
  (`isOpentypeFontUrl`, `loadOpentypeFontData`, `parsedOpentypeFonts`, `opentypeFont`…). Bundle en
  **103 155 B**.

## 6. N3

**No aplica a T3.** El efecto no es observable todavía en el playground: los tres `fontUrl` de la demo
apuntan a `/assets/font.json`, que Sergio borró, y repuntarlos a `Ballega.otf` es **T6** por alcance
explícito. La comprobación visual de la fuente real (acentos, `#`, métrica contra los `maxWidth`)
está en la checklist N3 de la feature 6.

## 7. Para el reviewer

1. El § 4: discriminancia **analizada, no ejecutada**. Es la debilidad conocida de esta entrega.
2. El § 3.2: el `as unknown as`.
3. El § 3.1: que el gate degrade de verdad y no oculte un error.

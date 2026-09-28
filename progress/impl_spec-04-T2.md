# Informe de implementación — spec-04 T2 (`badge-text-bottom-left`, feature `id: 2`)

- **Fecha**: 2026-08-05
- **Rol**: implementer
- **Spec**: `docs/specs/active/spec-04-typography-band-assets.md` § **R3 — Textos abajo-izquierda**
- **Estado**: implementado y verificado, **`in_progress`** en `feature_list.json` (no lo marco `done`
  yo). **Sin commitear**: lo hace el leader.

## Resumen

Cambio de **datos**, no de mecanismo: las tres anclas de `BADGE_TEXT_LAYOUT` pasan de `u = 0.92` a
`u = 0.08` y `align` de `'right'` a `'left'`. Ni `BadgeTextSlot` ni `uvAnchorToRtPosition` /
`alignOffsetX` / `fitTextScale` se han tocado (`alignOffsetX` ya devolvía `0` para `'left'`).

Baseline revalidado al arrancar y al terminar. **177 → 178 tests** (el test nuevo cierra **P22**).

## Ficheros tocados (3)

| Fichero | Qué |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts` | 3 anclas `0.92 → 0.08`, 3 `align 'right' → 'left'`, JSDoc de la constante |
| `projects/ngx-products-3d/src/lib/badge/badge.config.spec.ts` | los **4** invariantes de la tabla de R3, reescritos |
| `projects/ngx-products-3d/src/lib/badge/badge-texture.component.spec.ts` | 2 tests de anclaje que codificaban `align 'right'` + **test nuevo de P22** |

Diff total: 3 ficheros, +52 / −25. `badge-texture.component.ts` **no se ha tocado** (hash idéntico a
HEAD tras la ronda de mutaciones, ver abajo).

### `badge.config.ts`

```ts
{ field: 'name',         anchor: [0.08, 0.16], align: 'left', size: 0.09, height: 0.01, maxWidth: 0.65 },
{ field: 'memberNumber', anchor: [0.08, 0.08], align: 'left', size: 0.06, height: 0.01, maxWidth: 0.4  },
{ field: 'tier',         anchor: [0.08, 0.24], align: 'left', size: 0.05, height: 0.01, maxWidth: 0.4  },
```

Las **V** (`0.24` / `0.16` / `0.08`), los `size`, los `height` y los `maxWidth` están **intactos**
(verificable en el diff: solo cambian el primer elemento del `anchor` y el `align`).

JSDoc de la constante: «van **ABAJO-DERECHA** alineados a la derecha … la U (0.92) … bandera por la
derecha» → «van **ABAJO-IZQUIERDA** alineados a la izquierda … la U (0.08) … bandera por la
izquierda», con la referencia de spec actualizada a spec-04.

Encaje (confirma el cálculo del leader): `anchorX = (0.08 − 0.5) × 1.6 = −0.672`; el slot más ancho
llega a `−0.672 + 0.65 = −0.022`, dentro del `+0.8` del borde derecho. Lo ata el invariante 4.

## Los cuatro invariantes de `badge.config.spec.ts` (reescritos, no relajados)

| Antes | Ahora |
|---|---|
| `:139` `expect(slot.align).toBe('right')` | `toBe('left')` |
| `:157` `places name and memberNumber at the BOTTOM-RIGHT` + `expect(u).toBeGreaterThan(0.5)` | `BOTTOM-LEFT` + `expect(u).toBeLessThan(0.5)` (la V sigue `< 0.5`) |
| `:169-178` título «flush to the same right edge» + comentario de bandera derecha | «same left edge» + bandera izquierda. **Los tres asserts son los mismos** (U común y apilado de las V), como pide R3 |
| `:181-189` `anchorX ≤ halfWidth` y `anchorX − maxWidth ≥ −halfWidth` | `anchorX ≥ −halfWidth` y `anchorX + maxWidth ≤ halfWidth` |

Ninguno se ha convertido en aserción vacua: los cuatro se comprueban contra `BADGE_FRONT_FACE` o
contra literales del layout, y tres de ellos caen si se revierte el layout (ver discriminancia).

## Tests de `badge-texture.component.spec.ts`

No estaban en el encargo, pero **codificaban `align: 'right'` aplicado al layout publicado** y
fallaban con el cambio (fallo real, no cosmético):

1. `lands the right edge of a SHRUNK text on its anchor` → `lands the left edge …`. Con `align
   'left'` el borde anclado es el izquierdo, así que:
   - `mesh.position.x ≈ anchorX(slot)` (el anchor no se mueve al reducir la escala);
   - `position.x + rawWidth × scale ≈ anchorX + maxWidth` — **conserva la intención original** del
     test (el fit se aplica sobre el ancho **escalado**, no sobre el crudo);
   - se conserva el assert negativo, reapuntado: la posición **no** es la que dejaría un alineado a
     la derecha (`anchorX − ancho escalado`). Es el centinela de la reversión.
2. `anchors each slot of the shipped layout …`: el borde que cae sobre el anchor pasa a ser
   `position.x`, y se **añade** la comprobación del borde derecho
   (`position.x + ancho ≤ halfWidth`) para no perder la mitad de la guarda de encuadre que antes daba
   el `position.x ≥ −halfWidth`.

## P22 cerrado

Test nuevo: `fits each slot against ITS OWN maxWidth, not the maxWidth of the first slot`. Monta un
mesh por slot con el **doble** de su `maxWidth` y exige que cada uno acabe midiendo exactamente su
propio `maxWidth` ya escalado. Lleva además un guardarraíl explícito
(`new Set(maxWidth).size > 1`) para que el caso no deje de discriminar **en silencio** si algún día
se igualan los `maxWidth` del layout.

## Discriminancia (mutaciones temporales, todas revertidas)

Norma de proceso 1: copia previa vía `Edit` inverso + verificación por **sha256**. Cero
`git checkout --` / `git restore` / `git stash`.

| # | Mutación | Resultado |
|---|---|---|
| M1 | `badge-texture.component.ts:348`: `fitTextScale(width, slot.maxWidth)` → `fitTextScale(width, BADGE_TEXT_LAYOUT[0].maxWidth)` (el mutante superviviente de P22) | **1 failed / 177 passed** — cae exactamente el test nuevo. Antes de T2 esta mutación era **indetectable** |
| M2 | `badge.config.ts`: layout revertido a `u = 0.92` / `align: 'right'` | **5 failed / 173 passed**: `replaces the absolute position/rotation…`, `places … at the BOTTOM-LEFT…`, `keeps every slot inside the face even at its full maxWidth`, `lands the left edge of a SHRUNK text…`, `anchors each slot of the shipped layout…` |

Reversión verificada por hash (idénticos a los de antes de mutar):

```
804580ae35e0169e182977c7e25ccf2340a1f9456f5ce14efc073d79765b22c5  badge.config.ts
c225c565ba93505534312c146a470b32d96ec18cafb3242097052d61acf44150  badge-texture.component.ts
```

Nota: el invariante «flush to the same left edge» **no** cae con M2 y es esperado: sus asserts (U
común + apilado de las V) son ciertos con cualquier U compartida, y R3 pide explícitamente
«assert igual, comentario nuevo». Lo que discrimina el lado es el par de invariantes
`BOTTOM-LEFT` + `maxWidth dentro de la cara`.

## Barrido del diff (norma 2)

Sin `.only`, `.skip`, `true ||`, `as boolean`, constantes alteradas ni aserciones relajadas. Revisado
`git diff` completo de los 3 ficheros. `badge-texture.component.ts` vuelve a su hash de HEAD.

## Verificación

```
pnpm build                      ✅  (Build at 2026-08-05T13:37:27 - 3448 ms)
pnpm ng lint ngx-products-3d    ✅  All files pass linting
pnpm ng test ngx-products-3d    ✅  12 files | 178 passed (178)
```

Baseline de entrada: 177/177 (con T1 y T3 ya commiteadas). Salida: **178/178** (+1, el de P22).

## Decisiones y notas para el reviewer

- **`BadgeTextSlot.anchor` JSDoc (`badge.config.ts:308`) no se ha tocado a propósito**: su ejemplo
  «abajo-derecha ≈ `[0.92, 0.10]`» ilustra el **sistema de coordenadas** (origen abajo-izquierda),
  no el layout publicado, y sigue siendo cierto. Cambiar la forma/documentación de `BadgeTextSlot`
  está además en el «No hacer» de la spec.
- La **trampa de la V** queda intacta: no se ha tocado `BADGE_TEXTURE.mapRepeat`/`mapOffset` ni
  ninguna V del layout.
- `badge-texture.spec.ts:114-115` (`places a bottom-right anchor in the bottom-right quadrant`,
  `uvAnchorToRtPosition([0.92, 0.1])`) **se deja como está**: prueba la fn **pura** con un anchor
  arbitrario, no el layout publicado, y sigue siendo un caso válido y verde.
- **Fuera de alcance, ya cubierto por T7**: `projects/ngx-products-3d/README.md:278,296,316-325`
  sigue documentando el layout abajo-derecha y el hueco «abajo-derecha» del arte frontal. No lo toco
  aquí (T7 lo tiene en su descripción y en sus criterios).
- Ninguna discrepancia entre la spec y la API real de angular-three v4 en esta tarea.

## Verificación manual pendiente

Nada automatizable queda fuera, pero el encaje real es **visual** y va en la **N3 de T6**: hoy la
demo no puede mostrarlo (los `fontUrl` apuntan a `font.json`, borrado ⇒ 404 y frente sin texto hasta
T6). Lo que hay que mirar allí y que depende de esta tarea:

- textos abajo-izquierda sin deformar y sin salirse por el borde derecho;
- **colisión con el arte**: `badge_vitality.png` se diseñó dejando hueco abajo-**DERECHA**, así que
  los textos caen ahora sobre la zona con arte. Si estorba, el ajuste es de asset o de
  `BADGE_TEXT_LAYOUT`, nunca de código;
- métrica de `Ballega` contra los `maxWidth` (que no se reduzcan en exceso).

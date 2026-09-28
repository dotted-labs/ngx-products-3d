# Review — spec-04 T2 (`badge-text-bottom-left`, feature id 2)

**Veredicto:** APPROVED

## Criterios de aceptación (feature_list.json id 2)

- Los tres slots tienen u = 0.08 y align 'left'; V, size, height y maxWidth intactos: [x]
  — `badge.config.ts` diff: solo cambia el primer elemento de `anchor` (0.92→0.08) y `align`
  ('right'→'left') en los 3 slots. V (`0.24`/`0.16`/`0.08`), `size`, `height`, `maxWidth`
  idénticos línea a línea.
- BadgeTextSlot no cambia de forma y no se toca ninguna de las tres fns puras de encaje: [x]
  — `git diff` no toca `uvAnchorToRtPosition`, `alignOffsetX` ni `fitTextScale`;
  `badge-texture.component.ts` no aparece en el diff. La interfaz `BadgeTextSlot` no se modifica.
- Los cuatro invariantes de `badge.config.spec.ts` están reescritos y son discriminantes: [x]
  — Verificado uno a uno contra R3 de la spec:
  1. `expect(slot.align).toBe('left')`: cae si `align` vuelve a `'right'`.
  2. `places name and memberNumber at the BOTTOM-LEFT` con `expect(u).toBeLessThan(0.5)`: cae si
     `u = 0.92`.
  3. `flush to the same left edge`: los asserts (V decreciente + misma U) son literalmente los
     mismos que antes; la spec pide explícitamente "assert igual, comentario nuevo" (línea 175 de
     spec-04) para este invariante en particular — no es una discriminancia rota, es lo pedido.
  4. `keeps every slot inside the face`: pasó de `anchorX ≤ halfWidth` + `anchorX − maxWidth ≥
     −halfWidth` a `anchorX ≥ −halfWidth` + `anchorX + maxWidth ≤ halfWidth`. Comprobado a mano
     con el slot más ancho (`name`, maxWidth 0.65): si el layout revirtiera a `u=0.92`,
     `anchorX = 0.672`, y `0.672 + 0.65 = 1.322 > halfWidth (0.8)` → el invariante cae. No quedó
     simétrico ni relajado.
- P22 cerrado: existe un test que falla si se sustituye el maxWidth por slot por el global: [x]
  — `fits each slot against ITS OWN maxWidth, not the maxWidth of the first slot`
  (`badge-texture.component.spec.ts`): monta un mesh por slot al doble de su propio `maxWidth` y
  exige `measuredWidth(mesh) * scale.x ≈ slot.maxWidth` para cada uno. Si `fitTextScale` usara
  `BADGE_TEXT_LAYOUT[0].maxWidth` (0.65) para todos, el slot `memberNumber`/`tier` (maxWidth 0.4)
  quedaría escalado a 0.65 y el assert (`toBeCloseTo(0.4, 10)`) fallaría. Discrimina correctamente
  el `maxWidth` por slot del global. Lleva además el guardarraíl
  `new Set(maxWidth).size > 1` para no perder la capacidad de discriminar en silencio si el layout
  llegara a igualar los `maxWidth`.
- El JSDoc de BADGE_TEXT_LAYOUT ya no dice abajo-derecha: [x]
  — Pasa a "van ABAJO-IZQUIERDA alineados a la izquierda … la U (0.08) … bandera por la izquierda".
- `pnpm build` termina sin errores: [x] (verificado por el leader, no repetido)
- `pnpm ng lint ngx-products-3d` termina sin errores: [x] (verificado por el leader)
- `pnpm ng test ngx-products-3d` muestra > 0 tests y todos verdes: [x]
  — 178/178, +1 sobre el baseline de 177 (verificado por el leader; el +1 es el test de P22).

## Docs

- architecture.md: [x] — cambio de datos puro, cero mecanismo tocado, sin allocations nuevas ni
  cambios de dependencias.
- conventions.md: [x] — JSDoc de la constante exportada actualizado; nombres y estilo de test
  consistentes con el resto del fichero.
- "No hacer" de spec-04: [x] — no se toca la forma de `BadgeTextSlot`/`BADGE_TEXT`, no se toca
  `color` del material, no se toca física/GLB/cámara, no se introduce escalado no uniforme. Nada
  de T4-T7 se coló en este diff (solo 3 ficheros de `badge/`).
- verification.md N1: [x] — lógica de datos con tests de camino feliz (invariantes de layout) y
  discriminancia comprobada por mutación temporal según el informe (M1/M2), revertida por hash.

## Alcance

Solo 3 ficheros tocados en `projects/ngx-products-3d/src/lib/badge/`: `badge.config.ts`,
`badge.config.spec.ts`, `badge-texture.component.spec.ts`. `badge-texture.component.ts` no aparece
en el diff (confirmado por `git diff`). Las modificaciones de `feature_list.json` y
`progress/current.md` en `git status` son del leader, no del implementer. Los borrados/nuevos
`font.json`/`Ballega.otf`/`band.png`/`band.jpg` en `git status` pertenecen a T3/T5, ya commiteadas
según el historial — no forman parte de este diff de T2.

## Nota de seguimiento (no bloquea esta review)

El JSDoc de `BADGE_TEXT_LAYOUT` conserva "el ajuste fino es visual (T7, N3)"; en spec-04 la N3 es
**T6**, no T7. Anotado para corregir en T6 o T7, no es motivo de rechazo en T2.

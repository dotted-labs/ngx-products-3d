# Review — spec-02 F7 `badge-anti-jitter-spin`

**Veredicto:** APROBADO

## Verificación ejecutable (Nivel 2)

- `pnpm build` → **OK**. `Built @dotted-labs/ngx-products-3d` (2204ms), sin errores.
- `pnpm ng lint ngx-products-3d` → **OK**. `All files pass linting.`
- `pnpm ng test ngx-products-3d` → **OK**. `Test Files 4 passed (4)` · `Tests 33 passed (33)`
  (24 previos + 9 nuevos de `badge-stabilize.spec.ts`). Cero fallos.

Los tres verdes, tests > 0, todos pasando.

## Checklist punto por punto

1. **Anti-jitter (lerp): [x]**
   - `j1Lerped`/`j2Lerped` son `Vector3` campos de clase (badge-scene.component.ts:163-164).
   - Actualizados con `lerpTowards(body.translation(), delta, minSpeed, maxSpeed, lerpClampMin, lerpClampMax, out)` (badge-stabilize.ts:16-35). `alpha = delta * (minSpeed + clampedDistance * (maxSpeed − minSpeed))`, `clampedDistance = clamp(distance, clampMin, clampMax)`. Correcto.
   - `lerpInitialized` inicializa con la traslación real en el primer frame (badge-scene.component.ts:165, 273-277): evita el salto desde el origen.
   - La curva usa `j3.translation()`, `j2Lerped`, `j1Lerped`, `fixed.translation()` en orden tarjeta→anclaje (badge-scene.component.ts:298-301). Correcto.

2. **Anti-giro: [x]**
   - Solo en la rama `else if (card)` — NO durante drag (badge-scene.component.ts:253-269).
   - `spinCorrectedAngvelY(ang.y, reuseEuler.y, spinCorrectionFactor)` (badge-stabilize.ts:42-44). Aplica `angY − rotY*factor` con `y` corregido, `x`/`z` intactos vía `reuseAngvel`.
   - CRÍTICO correcto: `rotY` sale de convertir el quaternion a Euler orden `'YXZ'` (`reuseEuler.y` = yaw), NO del componente `y` crudo del quaternion (badge-scene.component.ts:172, 259-260). `reuseQuat.set(rot.x,rot.y,rot.z,rot.w)` + `setFromQuaternion`.
   - `Quaternion` (reuseQuat) y `Euler` (reuseEuler) reutilizados como campos de clase.

3. **No rompe drag ni correa: [x]**
   - Anti-giro en rama else: no corre durante drag (no lucha contra el kinemático).
   - Lerp y curva corren siempre (fuera del if/else, badge-scene.component.ts:271-303).
   - Path de drag feature 6 (badge-scene.component.ts:236-252) intacto.

4. **Cero allocations por frame: [x]**
   - `lerpTowards` opera sobre `Vec3Like` (traslación cruda de Rapier), calcula la distancia a mano, sin construir Vector3 destino ni usar `distanceTo` (badge-stabilize.ts:25-33).
   - `setAngvel(this.reuseAngvel, true)` reutiliza el literal `{x,y,z}` (badge-scene.component.ts:173, 268). Verificado en informe que Rapier copia con `VectorOps.intoRaw`, no retiene la referencia.
   - `reuseQuat`/`reuseEuler`/`j1Lerped`/`j2Lerped` instanciados una vez como `private readonly`.
   - `lerpInitialized` boolean simple, sin allocation.
   - Nota: `curve.getPoints(...)` (línea 303) sigue asignando array por frame, pero es código pre-existente de F5 (ya aceptado); F7 no lo introduce ni lo modifica. No es regresión de esta fase.

5. **Cero números mágicos: [x]**
   - `minSpeed`/`maxSpeed`/`spinCorrectionFactor`/`lerpClampMin`/`lerpClampMax` desde `BADGE_PHYSICS` (badge.config.ts:23-34). El clamp 0.1–1 externalizado con JSDoc que documenta la invariante de física (badge.config.ts:25-30). La fn pura no conoce la config (recibe parámetros).

6. **Sin `any`, imports ordenados, Prettier, orden de miembros: [x]**
   - Sin `any` en código nuevo. `import type` para tipos puros (badge-stabilize.ts:1-2).
   - Imports ordenados: three → angular-three → rapier → meshline → tipos → relativos (badge-scene.component.ts:12-36).
   - Prettier verde vía lint. Miembros nuevos en sección estado (3), orden de clase respetado.

7. **Zoneless-safe, sin console.log/TODO: [x]** Sin console, sin TODO en código nuevo. Todo por signals/beforeRender.

8. **Tests N1 (valores concretos): [x]**
   - `clamp`: dentro de rango, borde inferior, borde superior (badge-stabilize.spec.ts:4-16).
   - `lerpTowards`: camino feliz (out.x≈1.5), distancia>max→clamp a max (out.x≈1), distancia<min→clamp a min (out.x≈0.35, discrimina del 0.3 sin clamp), reuse de instancia (badge-stabilize.spec.ts:18-59). Ambos bordes del clamp cubiertos. Matemática verificada correcta.
   - `spinCorrectedAngvelY`: 0.5−0.8·0.25=0.3, no-op con rotY=0 (badge-stabilize.spec.ts:61-69).
   - Valores concretos con `toBeCloseTo`/`toBe`, no `toBeTruthy`.

## Criterios de aceptación (feature_list id 7)

- CA1 (drag agresivo sin jitter visible): **N3** — no automatable; checklist smoke anotada como pendiente en informe (§Checklist Nivel 3). Aceptable por nota del leader.
- CA2 (tarjeta vuelve a orientación frontal tras soltar): **N3** — ídem, pendiente smoke manual.
- CA3 (minSpeed/maxSpeed/spinCorrectionFactor desde BADGE_PHYSICS): **[x]** verificado en código.
- build / lint / test verdes: **[x]** ejecutado, todo verde.

## Nivel 3

Informe deja la checklist N3 explícita y anotada como pendiente de smoke manual (drag sin jitter, orientación frontal, cursor, 60fps, cero GC spikes en beforeRender). Correcto: los criterios visuales/físicos no son ejecutables aquí y quedan documentados para el smoke en playground.

## Observaciones (no bloqueantes)

- El implementer tocó `feature_list.json` (status F7 pending→in_progress) y `progress/current.md` sin declararlos en "Archivos tocados". Son ficheros de coordinación, no código de producción; el cambio es benigno y no marca `done` (eso corresponde al leader). Recomendación menor: declarar también los ficheros de progreso tocados.

## Conclusión

Cambios ajustados al alcance de F7 (sin ampliación). Lógica pura extraída y testeada con valores concretos y ambos bordes del clamp. Cero allocations introducidas en el loop, cero números mágicos, yaw correcto vía Euler 'YXZ'. Nivel 2 completo en verde. Nivel 3 documentado como pendiente de smoke manual. **APROBADO.**

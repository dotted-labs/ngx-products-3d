# Informe impl — spec-02 F7 `badge-anti-jitter-spin`

Estado: **pendiente review**.

## Archivos tocados

- `projects/ngx-products-3d/src/lib/badge/badge.config.ts` — añadidos
  `BADGE_PHYSICS.lerpClampMin=0.1` y `lerpClampMax=1` con JSDoc explicando la
  invariante de física (no acelerar sobre ruido por debajo de min; saturar por
  encima de max para no dar tirones en saltos grandes).
- `projects/ngx-products-3d/src/lib/badge/badge-stabilize.ts` — **nuevo**.
  Lógica pura: `clamp`, `lerpTowards`, `spinCorrectedAngvelY`.
- `projects/ngx-products-3d/src/lib/badge/badge-stabilize.spec.ts` — **nuevo**.
  9 tests (camino feliz + ambos bordes del clamp + reuse + no-op).
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` — campos de
  frame nuevos y estabilización dentro del único `beforeRender`.

## Decisiones

### Dónde vive el clamp
Externalizado a `BADGE_PHYSICS.lerpClampMin/lerpClampMax` (la spec lo marcaba
como preferible frente al literal). Cero números mágicos en el componente y en
la fn pura (se pasan como parámetros, la fn no conoce la config).

### Cómo obtuve el yaw del quaternion y por qué
El componente `y` del quaternion **no** es el ángulo de giro alrededor de Y
(es `sin(θ/2)·eje_y`). Corregir `angvel.y` con `rot.y` crudo sería físicamente
incorrecto. Convierto a Euler con orden `'YXZ'` (`reuseEuler`), de modo que
`.y` es el yaw real, y ese es el valor que resto escalado por
`spinCorrectionFactor`. Quaternion (`reuseQuat`) y Euler (`reuseEuler`)
instanciados una vez como campos de clase.

### Cómo evité allocations en `beforeRender`
- `j1Lerped`/`j2Lerped` (Vector3), `reuseQuat`, `reuseEuler` y `reuseAngvel`
  (`{x,y,z}` mutable) instanciados una vez como `private readonly`.
- `lerpTowards` opera sobre componentes `Vec3Like` (imitando el patrón de
  `badge-drag.ts`): consume la traslación cruda de Rapier y calcula la distancia
  a mano, sin construir Vector3 destino ni usar `Vector3.distanceTo`.
- `setAngvel` recibe `reuseAngvel` reutilizado: verifiqué en
  `@dimforge/rapier3d-compat` que `setAngvel` hace `VectorOps.intoRaw(vel)`
  (copia los componentes a un `RawVector` fresco y lo libera), por lo que no
  retiene la referencia JS → reutilizar el objeto es seguro. Único literal
  inevitable eliminado.
- Flag `lerpInitialized` (boolean simple) inicializa los lerped con la
  traslación real en el primer frame válido (evita el salto desde el origen).

### Anti-giro solo en reposo
Va en la rama `else if (card)` del `if (this.dragged() && card)`: durante el
drag NO corre (no lucha contra el posicionado kinemático). El lerp y la curva
corren **siempre** (fuera del if/else), alimentando la correa en drag y reposo.

### API verificada en node_modules (angular-three v4 / rapier compat)
- `beforeRender` callback recibe `NgtRenderState` que extiende `NgtState` con
  `delta: number` → `({ camera, pointer, delta })` correcto.
- Rapier `rotation(): Rotation` = `{x,y,z,w}`, `angvel(): Vector` = `{x,y,z}`,
  `setAngvel(vel: Vector, wakeUp: boolean)`. Sin discrepancias con la spec.

## Verificación (N1 + N2)

- `pnpm build` → OK (Built @dotted-labs/ngx-products-3d, 2484ms).
- `pnpm ng lint ngx-products-3d` → All files pass linting.
- `pnpm ng test ngx-products-3d` → **33 passed (33)**, 4 test files, 0 fallos.
  (24 previos verdes + 9 nuevos de `badge-stabilize.spec.ts`.)

Tests nuevos verifican valores concretos (no `toBeTruthy`):
- `clamp`: dentro de rango, borde inferior, borde superior.
- `lerpTowards`: camino feliz (out.x≈1.5), distancia>max→clamp a max (out.x≈1),
  distancia<min→clamp a min (out.x≈0.35, discrimina del 0.3 sin clamp), reuse
  de instancia.
- `spinCorrectedAngvelY`: 0.5−0.8·0.25=0.3; no-op con rotY=0.

## Checklist Nivel 3 pendiente (smoke visual, no ejecutable aquí)

- [ ] Drag agresivo: la correa no muestra jitter visible.
- [ ] Al soltar, la tarjeta recupera orientación frontal (mira a cámara).
- [ ] Cursor grab/grabbing/auto sigue funcionando (no roto por F7).
- [ ] 60fps en devtools Performance durante drag.
- [ ] Profiler: cero allocations/GC spikes en `beforeRender`.

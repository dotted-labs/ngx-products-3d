# Informe impl — spec-02 F1, feature 4 `badge-physics-chain`

- **Fecha**: 2026-07-09 (fix post-N3 aplicado el mismo día, ver sección final)
- **Estado**: implementado + fix post-N3 verificado en runtime, pendiente re-verificación N3 del leader (no marcado `done`)

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` | Sustituido stub por la cadena física: 5 rigid bodies (`fixed`/`j1`/`j2`/`j3`/`card`), colliders explícitos, 3 rope joints + 1 spherical joint, signal `cardBodyType`, mesh placeholder de la tarjeta. Inputs `member`/`theme`/`debug` conservados intactos. |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` | **Nuevo**: 6 tests (default de `cardBodyType`, opciones de bodies, joint data, collider args, layout/placeholder desde config). |
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts` | +`segmentJointAnchor`, `segmentColliderRadius`, `cardColliderHalfExtents` en `BADGE_PHYSICS`; +`BADGE_LAYOUT` (posiciones de mundo de los 5 bodies); +`BADGE_CARD_PLACEHOLDER` (planeSize, color, opacity). JSDoc de una línea en cada export nuevo (van al entry point público). |

No tocados: `badge.component.ts` (feature 3, done), correa/meshline (f5), drag/pointer (f6), lerp (f7), cursor (f8), `feature_list.json`, playground. Sin dependencias nuevas ni cambios de peers.

## API real verificada (node_modules, angular-three-rapier@4.2.3)

- `NgtrRigidBody`: componente, selector `ngt-object3D[rigidBody]`, exportAs `rigidBody`. Input `rigidBody` (alias de `type`, transform admite `'' | NgtrRigidBodyType | undefined`), `options: Partial<NgtrRigidBodyOptions>` (con `colliders?: ... | false`, `linearDamping?`, `angularDamping?`), `position: [x,y,z]`. Expone `rigidBody: Signal<RigidBody | null>` (`types/angular-three-rapier.d.ts:966-1019`).
- `NgtrBallCollider`: directiva `ngt-object3D[ballCollider]`, input `ballCollider: NgtrBallArgs = [radius]` (`:1061-1068`). `NgtrCuboidCollider`: `ngt-object3D[cuboidCollider]`, input `NgtrCuboidArgs = [halfWidth, halfHeight, halfDepth]` (`:1029-1036`).
- `ropeJoint`/`sphericalJoint` (spike S1, caso A): injection functions que devuelven `Signal<Joint | null>`; aceptan getters que devuelven null; el joint se crea reactivamente cuando `physics.worldSingleton()` y ambos bodies existen, y el cleanup (`removeImpulseJoint`) es automático vía effect (`fesm2022/angular-three-rapier.mjs:2241-2290`). Las variantes `inject*Joint` están deprecated → no usadas.
- `NgtArgs` (angular-three): estructural `*args` para los constructor args de `ngt-plane-geometry`.
- Anchors como tuplas `[x,y,z]` válidas (`NgtVector3 = NgtMathType<THREE.Vector3>`).

## Decisiones / desviaciones respecto al boceto de la spec

1. **Sin `<ngt-group [position]="[0,4,0]">`**: el boceto usa un grupo con posiciones relativas; el contrato de la feature da posiciones absolutas de mundo (`[0.5,4,0]`, `[0.5,3..1,0]`, `[2,0,0]`), equivalentes a las del boceto. Se usan posiciones de mundo directas (menos indirección, cero offsets mágicos). Mismo resultado físico.
2. **Joints creados en el constructor sin guardar el signal devuelto**: la Fase 1 no consume el joint (el cleanup es automático); guardarlos como campos privados nunca leídos sería ruido. Patrón del spike (getters `viewChild.required(..., { read: NgtrRigidBody })` → `.rigidBody()`) respetado. Los getters solo se evalúan cuando el mundo Rapier existe (async, post view-init), por lo que `viewChild.required` no puede lanzar NG0951.
3. **`rigidBody="dynamic"` explícito** en j1/j2/j3 (el boceto usa el atributo pelado, que transforma `''` → default): mismo comportamiento, más legible.
4. **Nuevas constantes en config, no literales**: la acceptance exige cero números mágicos, así que radio del ball collider (0.1), half-extents del cuboid ([0.8,1.125,0.01]) y anchor local de los rope joints ([0,0,0]) van a `BADGE_PHYSICS`; posiciones iniciales a `BADGE_LAYOUT`; plano/color/opacity del placeholder a `BADGE_CARD_PLACEHOLDER` (se descartará con el GLB en spec-03).
5. **`CUSTOM_ELEMENTS_SCHEMA` a nivel de este componente** (regla conventions.md): el template usa elementos del renderer (`ngt-mesh`, `ngt-plane-geometry`, `ngt-mesh-basic-material`) y `ngt-object3D[ballCollider|cuboidCollider]` (directivas sobre elemento custom).
6. **Zoneless-safe**: signal `cardBodyType` + campos readonly; sin effects propios, sin Zone.js, sin `beforeRender` (esta feature no tiene código por frame; llega en f5/f6). Sin allocations por frame por construcción.
7. **Sin handlers de puntero ni `hovered`**: el boceto de la spec los incluye en el mesh, pero pertenecen a la feature 6 (fuera de alcance explícito del encargo).

## Tests (15 en verde: 9 previos + 6 nuevos en `badge-scene.component.spec.ts`)

Estrategia: `TestBed.overrideComponent` con template vacío + mock mínimo de `NgtrPhysics` (`worldSingleton`/`rapier` → null: los joints quedan en espera y no tocan Rapier). Conforme a verification.md ("no mockear angular-three/rapier para testear la escena entera"): se testea la derivación de estado desde config, el render 3D va a Nivel 3.

- `defaults cardBodyType to 'dynamic'` — contrato del signal (el switch kinematic es de la feature 6).
- `derives rigid body options from BADGE_PHYSICS with auto-colliders disabled` — damping desde config + `colliders: false`.
- `builds rope joint data from BADGE_PHYSICS: local anchors and segmentLength`.
- `anchors the spherical joint at the card top edge (BADGE_PHYSICS.cardJointAnchor)`.
- `derives collider args from BADGE_PHYSICS: ball radius and cuboid half-extents`.
- `takes body positions and card placeholder values from badge.config` — referencias exactas a `BADGE_LAYOUT`/`BADGE_CARD_PLACEHOLDER`.

## Verificación ejecutada (N1/N2)

```
pnpm build                           → OK (lib empaquetada 2026-07-09 17:07)
pnpm ng lint ngx-products-3d         → All files pass linting
pnpm ng test ngx-products-3d         → 2 files, 15 tests passed
pnpm ng build products-3d-playground → OK (initial 242.98 kB; three/rapier en chunks lazy)
```

## Pendiente de verificación manual (N3, a cargo del leader)

- [ ] `pnpm start:playground` → el plano blanco placeholder cuelga de la cadena y oscila con gravedad al montar (CA1 de la feature 4).
- [ ] Toggle debug física → wireframes de los colliders (3 balls + cuboid) y la cadena visibles (cierra también CA3 pendiente de la feature 3).
- [ ] Encuadre: cámara `[0,0,13]` fov 25 muestra la escena completa (pendiente encadenado de la feature 3).
- [ ] Al soltar/oscilar no hay errores en consola (joints creados tras cargar WASM).

## Fix post-N3 (ronda de fix, 2026-07-09)

La N3 runtime del leader falló: 2× NG0950 (`Input "type" is required but no value is available yet`, `NgtrRigidBody.bodyType` ← `bodyDesc`), el body del card nunca se creaba y el plano placeholder no se renderizaba.

### Causa raíz confirmada (fesm2022/angular-three-rapier.mjs:1317-1327)

```js
bodyType = computed(() => RIGID_BODY_TYPE_MAP[this.type()]);
bodyDesc = computed(() => {
    const [canSleep, bodyType] = [this.canSleep(), untracked(this.bodyType), this.colliders()];
    return new RigidBodyDesc(bodyType).setCanSleep(canSleep);
});
rigidBody = computed(() => { /* worldSingleton() → createRigidBody(this.bodyDesc()) */ });
```

- El input requerido `type` (alias `rigidBody`) se lee vía **`untracked()`** dentro del computed `bodyDesc`.
- Un **atributo estático** (`rigidBody="fixed"` / `rigidBody="dynamic"`) se aplica en la fase de creación de la vista → siempre disponible. Un **property binding** (`[rigidBody]="cardBodyType()"`) se escribe en el primer update pass, que dentro del render loop de angular-three puede llegar DESPUÉS del flush de effects disparado al resolverse el WASM de Rapier.
- Si la primera evaluación de `bodyDesc` ocurre antes de escribirse el binding → `type()` lanza NG0950 y, al ser `untracked`, **el computed cachea el error de forma permanente** (escribir el input después no invalida `bodyDesc`/`rigidBody`): el body del card no se crea nunca, el `sphericalJoint` se queda con getter null y el mesh no se monta. El 2º NG0950 al togglear `debug` es el mismo error cacheado re-lanzado al re-leer `rigidBody()`.
- Coherente con la evidencia: los 4 bodies con atributo estático funcionaban; solo fallaba el único con property binding.

### Decisión (fix mínimo)

- Template: `rigidBody="dynamic"` **estático** en el card (mismo mecanismo que el resto de bodies; elimina la race por construcción, sin timeouts ni CD forzada). Comentario en template y en el signal documentando el porqué.
- El signal `cardBodyType` se conserva con default `'dynamic'` (contrato de la feature). Ya **no** se bindea al input: la feature 6 hará el switch dynamic↔kinematicPosition sobre el body crudo de Rapier (`cardBody.setBodyType(..., true)`), que es además lo que hace internamente `updateRigidBodyEffect` de la propia lib. Nota para la feature 6: no hay re-runs espontáneos de `updateRigidBodyEffect` que puedan revertir el tipo (solo se re-ejecuta si cambian options/type), así que el `setBodyType` manual es estable durante el drag.
- Descartado mantener el binding: cualquier property binding sobre un input requerido leído con `untracked` en la creación del body reintroduce la race (es timing del renderer de angular-three + WASM async, no controlable desde el consumidor).
- Playground (extra pedido): fondo oscuro `#1f2937` + `border-radius` para `products-3d-badge` en `badge-demo.component.ts` (el plano blanco era invisible sobre fondo blanco).

### Archivos tocados en el fix

- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` — tipo estático del card + comentarios de invariante.
- `projects/products-3d-playground/src/app/badge-demo/badge-demo.component.ts` — fondo oscuro del contenedor.

### Verificación del fix

N1/N2:

```
pnpm build                           → OK
pnpm ng lint ngx-products-3d         → All files pass linting
pnpm ng test ngx-products-3d         → 2 files, 15 tests passed (sin cambios de contrato testeable)
pnpm ng build products-3d-playground → OK
```

Runtime (Chrome headless swiftshader vía playwright-core contra el dev server :4200; script `verify-fix.mjs` y PNGs `fix-*.png` en scratchpad de sesión del implementer):

- ✅ Consola limpia: **0 errores** (0× NG0950, 0× NG0951), incluido tras togglear debug.
- ✅ El plano blanco de la tarjeta se renderiza y cuelga bajo la cadena (partió de `[2,0,0]` y quedó colgando en equilibrio bajo j3 → gravedad + joints activos; la oscilación completa la re-verifica el leader).
- ✅ Debug ON: wireframes rojos visibles — ball colliders de los segmentos, línea de la cadena y contorno del cuboid collider alrededor de la tarjeta (cierra la evidencia que faltaba para el CA3 encadenado de la feature 3).

Feature 4 marcada done el 2026-07-09 tras APPROVED en ronda 2 y N3 del leader en verde.

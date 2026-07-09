# Review — spec-02 F1, feature 4 `badge-physics-chain`

**Veredicto:** APPROVED

**Condición de cierre (no bloquea este veredicto):** la parte runtime de CA1 (Nivel 3) queda
explícitamente delegada al leader por división de trabajo acordada; la checklist está anotada en
`progress/impl_spec-02-f1-chain.md:54-59`. No marcar la feature `done` hasta ejecutarla
(incluye cerrar el CA3 pendiente de la feature 3: "debug activa wireframes", encadenado desde
`review_spec-02-f1-canvas.md`).

Fuentes: `feature_list.json` (id 4), `specs/spec-02-badge-physics.md` (Fase 1 — Estructura de la
escena + "No hacer"), `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`,
`docs/spike-notes.md` (S1), `progress/impl_spec-02-f1-chain.md`. Nivel 2 re-ejecutado por el
reviewer el 2026-07-09.

## Criterios de aceptación (feature 4, `feature_list.json`)

- CA1 (el plano placeholder cuelga de la cadena y oscila con gravedad al montar): [~] —
  **construcción validada contra la API real** (parte del reviewer); runtime N3 delegado al leader.
  Evidencia de construcción, contrastada con `node_modules/angular-three-rapier@4.2.3`:
  - Bodies y tipos: `fixed` con `rigidBody="fixed"` sin collider (`badge-scene.component.ts:36-41`);
    `j1`/`j2`/`j3` con `rigidBody="dynamic"` + ball collider (`:42-50`); `card` con
    `[rigidBody]="cardBodyType()"` + cuboid collider (`:51-57`). Los valores `fixed`, `dynamic` y
    `kinematicPosition` son miembros válidos de `NgtrRigidBodyType`
    (`types/angular-three-rapier.d.ts:472`); el input `rigidBody` es alias de `type`
    (`d.ts:967,1019`).
  - Posiciones: `BADGE_LAYOUT` = `[0.5,4,0]`, `[0.5,3,0]`, `[0.5,2,0]`, `[0.5,1,0]`, `[2,0,0]`
    (`badge.config.ts:32-38`) — exactamente la tabla de la spec (coordenadas de mundo).
  - Opciones: `bodyOptions = { colliders: false, angularDamping, linearDamping }` desde
    `BADGE_PHYSICS` aplicado a los 5 bodies (`badge-scene.component.ts:91-95`); los tres campos
    existen en `NgtrRigidBodyOptions` (linearDamping/angularDamping en `d.ts:484,486`;
    `colliders` admite `false`), y el input `options` acepta `Partial<NgtrRigidBodyOptions>`
    (`d.ts:974`).
  - Colliders explícitos: `[ballCollider]="segmentColliderArgs"` con `[0.1]`
    (`NgtrBallCollider`, selector `ngt-object3D[ballCollider]`, `d.ts:1061-1068`) y
    `[cuboidCollider]="cardColliderArgs"` con `[0.8,1.125,0.01]` (`NgtrCuboidCollider`,
    `d.ts:1029-1036`).
  - Joints: 3 ropeJoint (fixed-j1, j1-j2, j2-j3) con anchors `[0,0,0]` y
    `length: segmentLength = 1`, 1 sphericalJoint (j3-card) con `body2Anchor =
    cardJointAnchor = [0,1.45,0]` (`badge-scene.component.ts:101-135`). Firmas exactas de los
    hooks verificadas en `d.ts` (ropeJoint/sphericalJoint, no las variantes inject* deprecated)
    y semántica en `fesm2022/angular-three-rapier.mjs` (`impulseJoint`): el `computed` lee
    `physics.worldSingleton()` ANTES de evaluar los getters de bodies, por lo que los
    `viewChild.required` no se evalúan pre-view-init (sin riesgo NG0951) y el cleanup
    (`removeImpulseJoint`) es automático vía effect. Crearlos en constructor (contexto de
    inyección, `assertInjector`) es correcto.
  - Placeholder: `ngt-plane-geometry *args` `[1.6,2.25]` + basic material white/transparent/0.9/
    DoubleSide desde `BADGE_CARD_PLACEHOLDER` (`badge-scene.component.ts:58-66`,
    `badge.config.ts:41-45`).
- CA2 (damping, longitudes y anchors desde `BADGE_PHYSICS`; cero números mágicos): [x] —
  El componente no contiene ningún literal numérico ni de color: todo referencia
  `BADGE_PHYSICS`/`BADGE_LAYOUT`/`BADGE_CARD_PLACEHOLDER` (`badge-scene.component.ts:87-110`);
  `DoubleSide` es enum de three, no número mágico. Los valores nuevos (radio 0.1, half-extents,
  anchor local [0,0,0], posiciones, plano/color/opacity) movidos a `badge.config.ts:12-45`.
- CA3 (`pnpm build`): [x] — verde (reviewer, 2166ms, 2026-07-09).
- CA4 (`pnpm ng lint ngx-products-3d`): [x] — "All files pass linting".
- CA5 (`pnpm ng test ngx-products-3d` > 0 tests, todos verdes): [x] — 2 files, 15/15 passed
  (9 previos de `badge.component.spec.ts` intactos + 6 nuevos).

## Nivel 2 re-ejecutado por el reviewer (2026-07-09)

```
pnpm build                           -> OK (Build at 2026-07-09T15:11:59, 2166ms)
pnpm ng lint ngx-products-3d         -> All files pass linting
pnpm ng test ngx-products-3d         -> 2 files, 15/15 tests passed (vitest 4.1.10)
pnpm ng build products-3d-playground -> OK (initial 242.98 kB; three/rapier en chunks lazy)
```

Checks de dist: `fesm2022/dotted-labs-ngx-products-3d.mjs` presente; `dist/ngx-products-3d/
package.json` con peers correctos (angular-three*, rapier, three, meshline, ngxtension) y solo
`tslib` como dependency. Sin deps fantasma.

## Alcance y "No hacer" (spec-02)

- Nada de features 5-8: sin meshline/correa, sin `beforeRender`, sin pointer handlers/`hovered`,
  sin lerp, sin cursor. El único guiño a f6 es el signal `cardBodyType` con default `dynamic`,
  que la propia descripción de la feature 4 exige ("dynamic <-> kinematicPosition vía signal
  cardBodyType"). [x]
- Nada de spec-03: sin GLB, texturas ni RenderTexture; placeholder plano documentado como
  descartable. [x]
- `badge.component.ts` sin tocar por esta feature: su diff en el working tree pertenece a la
  feature 3, ya aprobada en `progress/review_spec-02-f1-canvas.md` (ronda 2). [x]
- Sin dependencias ni peers nuevos: `projects/ngx-products-3d/package.json` sin diff. [x]
- Playground sin deep imports a `src/lib` (grep limpio); sus archivos modificados son de la
  feature 3 + bookkeeping del leader (`feature_list.json`, `progress/*`, `specs/*`, `README.md`).
  Feature 4 en `in_progress`, no `done`. [x]
- API pública: sin componentes/inputs/providers nuevos. `BADGE_LAYOUT` y `BADGE_CARD_PLACEHOLDER`
  sí quedan expuestos vía el `export *` preexistente de `badge.config` en `public-api.ts:4` —
  tensión formal con "No API pública nueva", pero es consecuencia forzada de architecture.md
  seccion 2 ("toda constante de física/layout vive en badge.config.ts") + la estructura de
  exports de spec-01 (BADGE_PHYSICS/BADGE_CAMERA ya eran públicos); ambos exports llevan JSDoc
  de una línea. Aceptado con esta justificación; no es ampliación de alcance funcional. [x]

## Desviaciones declaradas (informe, Decisiones 1-7) — todas validadas

1. **Sin `ngt-group [position]="[0,4,0]"`**: CORRECTO. Equivalencia aritmética verificada:
   grupo[0,4,0]+fixed[0.5,0,0]=[0.5,4,0]; +j1[0.5,-1,0]=[0.5,3,0]; +card[2,-4,0]=[2,0,0].
   Coincide con `BADGE_LAYOUT` y con las posiciones de mundo de la tabla de la spec y de la
   descripción de la feature. Boceto = boceto (architecture.md, principio 7).
2. **Joints en constructor sin guardar el signal**: CORRECTO. Fase 1 no consume el joint; cleanup
   automático verificado en `fesm2022` (`impulseJoint`: effect con `onCleanup` que llama a
   `removeImpulseJoint`). El orden worldSingleton-antes-que-getters en el `computed` garantiza
   que `viewChild.required` no se evalúa antes de view-init.
3. **`rigidBody="dynamic"` explícito**: CORRECTO. El transform del input admite cadena vacía,
   `NgtrRigidBodyType` o undefined, y `dynamic` es el default; solo gana legibilidad.
4. **Constantes nuevas en config**: CORRECTO por architecture.md (principio 2) y CA2. JSDoc
   presente en cada export/campo nuevo (`badge.config.ts:11-17,31,40`).
5. **`CUSTOM_ELEMENTS_SCHEMA` a nivel de componente**: CORRECTO y necesario — el template usa
   elementos del renderer (`ngt-mesh`, `ngt-plane-geometry`, `ngt-mesh-basic-material`) que no
   son componentes Angular. Conforme conventions.md (Angular Three: nunca global).
6. **Zoneless-safe / sin código por frame**: CORRECTO. Solo signals + campos readonly, OnPush,
   sin effects propios, sin `beforeRender`, sin Zone.js. Cero allocations por frame por
   construcción (no hay frame path en esta feature).
7. **Sin pointer handlers/`hovered`**: CORRECTO — pertenecen a la feature 6; incluirlos habría
   sido ampliación de alcance.

## Docs

- architecture.md: [x] — capas (badge autocontenido, solo depende de `../types`), config
  data-driven, sin estado global (todo estado en el componente; multi-instancia viable), sin
  RxJS/console/setInterval, boundaries respetados, peers intactos.
- conventions.md: [x] — orden de clase (inputs, queries, estado, constructor), `protected`
  solo para lo que usa el template y `private readonly` para el resto, standalone con imports
  explícitos, prefijos y nombres correctos, imports ordenados (Angular, three/angular-three*,
  propios), template inline <40 líneas, comentarios solo de porqués (semántica reactiva de los
  joints; JSDoc en `cardBodyType` y en exports nuevos de config).
- verification.md N1: [x] — 6 tests nuevos con aserciones concretas (nada de `toBeTruthy`):
  default de `cardBodyType`, `bodyOptions` con `colliders:false` + damping de config, joint data
  (anchors/length), collider args, layout/placeholder desde config. Mock mínimo de `NgtrPhysics`
  (worldSingleton/rapier a null) solo para neutralizar los hooks de joints — exactamente lo
  contrario del anti-patrón "mockear rapier para testear la escena entera": se testea derivación
  desde config y el render va a N3. Esta feature no introduce lógica pura con caminos de error,
  así que no aplica el requisito de test de error/fallback.
- verification.md N2: [x] — re-ejecutado por el reviewer, todo verde (ver arriba), dist OK.
- verification.md N3: [~] — checklist anotada en el informe (`impl_spec-02-f1-chain.md:54-59`),
  delegada al leader por acuerdo explícito del encargo. Pendiente antes de `done`.

## Notas menores (sin efecto en el veredicto)

- `segmentJointData` se comparte entre los 3 rope joints y su `body1Anchor` se reutiliza como
  anchor del lado j3 en el spherical joint (`badge-scene.component.ts:108`): semánticamente
  correcto (anchor local en el centro del segmento) y coherente con la spec ("anchors [0,0,0]").
- Los tests acceden a campos protected/private vía cast tipado (`SceneInternals`): pragmático y
  acotado; conventions.md prefiere fns puras, pero aquí no hay lógica extraíble (solo wiring de
  config) y las aserciones son concretas.

## Conclusión

Construcción de bodies/colliders/joints exacta contra la API real de `angular-three-rapier@4.2.3`,
cero números mágicos, alcance impecable, N1/N2 en verde re-verificados. Las 7 desviaciones del
boceto están documentadas y son correctas (architecture.md, principio 7). La feature puede
marcarse `done` en cuanto el leader ejecute la checklist N3 del informe (CA1 runtime + debug
wireframes + encuadre + consola limpia).

---

# Re-review (ronda 2) — 2026-07-09

**Veredicto final:** APPROVED

Alcance: exclusivamente el fix post-N3 (fallo runtime 2x NG0950 detectado por el leader) +
re-ejecución de Nivel 2. Fuentes: `progress/current.md` (secciones "Verificación N3 runtime del
leader — FALLA" y "Re-verificación N3 del leader tras el fix — PASA"),
`progress/impl_spec-02-f1-chain.md` § "Fix post-N3", `git diff` completo del working tree.

## 1. Causa raíz — CONFIRMADA contra node_modules

Verificado en `fesm2022/angular-three-rapier.mjs` (~1317-1327, clase `NgtrRigidBody`):

```js
bodyType = computed(() => RIGID_BODY_TYPE_MAP[this.type()]);
bodyDesc = computed(() => {
    const [canSleep, bodyType] = [this.canSleep(), untracked(this.bodyType), this.colliders()];
    return new RigidBodyDesc(bodyType).setCanSleep(canSleep);
});
rigidBody = computed(() => { /* worldSingleton() -> createRigidBody(this.bodyDesc()) */ });
```

El análisis del implementer es exacto en los tres puntos que importan:

- `type` es input requerido (`d.ts:967`) y `bodyDesc` lo lee vía **`untracked(this.bodyType)`**:
  si el property binding aún no se ha escrito cuando `worldSingleton` resuelve (WASM async) y
  `rigidBody()` se evalúa por primera vez, `this.type()` lanza NG0950.
- Al estar bajo `untracked`, escribir el input después NO invalida `bodyDesc`: sus únicas deps
  tracked son `canSleep`/`colliders` (derivadas de `options`, que no cambia). Un computed de
  Angular cachea el error y lo re-lanza hasta que una dep tracked cambie → **error permanente**,
  el body del card nunca se crea, el `sphericalJoint` queda con getter null y el subárbol del
  mesh no monta. El 2o NG0950 al togglear `debug` es la re-lectura del mismo computed errado.
- El atributo estático (`rigidBody="dynamic"`) se aplica en la fase de creación de la vista,
  antes de cualquier flush de effects → inmune a la race. Coherente con la evidencia del leader:
  fallaba exactamente (y solo) el único body con property binding.

Discrepancia spec/API real correctamente identificada y documentada (architecture.md, principio
7): el boceto de la spec (`[rigidBody]="cardBodyType()"`) es inviable con la implementación real
de `NgtrRigidBody@4.2.3`.

## 2. Fix en `badge-scene.component.ts` — CORRECTO y mínimo

Diff contrastado con la versión aprobada en ronda 1; cambios exactos:

- Template del card: `rigidBody="dynamic"` estático (`badge-scene.component.ts:59-64`) +
  comentario de template (`:51-58`) explicando el porqué (workaround de API, permitido por
  conventions.md § Comentarios).
- JSDoc ampliado del signal `cardBodyType` (`:87-91`): no se bindea al input; la feature 6 hará
  el switch dynamic<->kinematicPosition vía `cardBody.setBodyType(..., true)` sobre el body crudo
  de Rapier — método real de `RAPIER.RigidBody` y el mismo mecanismo que usa internamente
  `updateRigidBodyEffect` de la propia lib, con la nota (informe § Decisión) de que ese effect
  solo se re-ejecuta si cambian `options`/`type`, así que no revierte el tipo durante el drag.
  Plan para la feature 6 bien documentado en template + JSDoc + informe.
- Nada más cambió en el archivo (bodies, posiciones, options, colliders, joints y constructor
  idénticos a la ronda 1).

Contrato de la acceptance intacto: la descripción de la feature pide "dynamic <->
kinematicPosition vía signal cardBodyType" — el signal existe con default `'dynamic'`
(`:92`) y sigue siendo la fuente de verdad del estado; solo cambia el mecanismo de aplicación
(API del body crudo en la feature 6 en lugar de input binding), desviación forzada por la API
real y documentada. El switch en sí sigue siendo alcance de la feature 6, como en ronda 1.

## 3. Cambio en `badge-demo.component.ts` (playground) — OK

Solo estilos (`:26-41` del diff): altura 32rem, fondo oscuro `#1f2937` + `border-radius` sobre
`products-3d-badge`, con comentario del porqué (placeholder blanco invisible sobre blanco).
Playground only, sin tocar la lib, sin lógica. Dentro del encargo del leader ("extra pedido",
informe § Decisión) y coherente con la nota del propio leader en su N3 fallida.

## 4. Coherencia de tests y conventions — OK

- Ningún test afirmaba el binding `[rigidBody]="cardBodyType()"` del template (los 6 tests usan
  `overrideComponent` con template vacío). El test `defaults cardBodyType to 'dynamic'`
  (`badge-scene.component.spec.ts:65-69`) sigue siendo válido: el signal se conserva con el
  mismo default y su nombre ya remitía el switch a la feature de drag. `badge-scene.component.spec.ts`
  sin cambios respecto a la ronda 1; 15/15 en verde.
- conventions.md: comentarios nuevos son exactamente el caso permitido (workaround de API con
  discrepancia spec<->node_modules documentada); orden de clase, protected/readonly y resto sin
  cambios.
- Alcance del diff verificado con `git status`/`git diff --stat`: respecto a la ronda 1 solo
  cambian `badge-scene.component.ts` (card estático + comentarios) y
  `badge-demo.component.ts` (estilos), más bookkeeping del leader en `progress/current.md`.
  `badge.config.ts`, tests, `public-api.ts`, `package.json` y el resto, intactos. Sin ampliación
  de alcance.

## 5. Nivel 2 re-ejecutado por el reviewer (ronda 2, 2026-07-09)

```
pnpm build                           -> OK (Build at 2026-07-09T15:35:46, 1966ms)
pnpm ng lint ngx-products-3d         -> All files pass linting
pnpm ng test ngx-products-3d         -> 2 files, 15/15 tests passed (vitest 4.1.10)
pnpm ng build products-3d-playground -> OK
```

## Estado de la condición de cierre de la ronda 1

Cumplida: N3 runtime re-verificada por el leader tras el fix (`progress/current.md` §
"Re-verificación N3 del leader tras el fix — PASA"): CA1 en verde (plano colgando y oscilando,
diffs entre capturas confirman movimiento), consola limpia (0x NG0950), debug ON muestra cuerda +
ball colliders + wireframe del cuboid del card (cierra también el CA3 encadenado de la feature 3)
y encuadre correcto. Evidencia adicional del implementer en el informe § "Verificación del fix".

## Conclusión

Causa raíz real y verificada línea a línea en node_modules, fix mínimo y en el mecanismo correcto
(mismo que los demás bodies), contrato de acceptance intacto, plan de la feature 6 documentado,
tests coherentes, N2 en verde y N3 en verde con evidencia. La feature 4 `badge-physics-chain`
puede marcarse `done`.

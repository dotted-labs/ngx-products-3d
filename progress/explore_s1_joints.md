# Spike S1 (spec-02): joints en angular-three-rapier@4

Fecha: 2026-07-07 · Paquete verificado: `angular-three-rapier@4.2.3` (peer: `@dimforge/rapier3d-compat >=0.14.0 <0.20.0`, Angular >=20 <22)

## Veredicto

**Caso A: API nativa.** `angular-three-rapier@4.2.3` exporta hooks `ropeJoint` y `sphericalJoint` (además de `fixedJoint`, `revoluteJoint`, `prismaticJoint`, `springJoint`) desde el entry point raíz `angular-three-rapier`. **No hace falta wrapper propio.**

Confirmado en el export final del paquete (`node_modules/angular-three-rapier/types/angular-three-rapier.d.ts`, línea 1845):

```ts
export { ..., ropeJoint, sphericalJoint, springJoint, injectRopeJoint, injectSphericalJoint, ... };
```

Las variantes `inject*Joint` existen pero están marcadas `@deprecated Use \`ropeJoint\`/\`sphericalJoint\` instead. Will be removed in v5.0.0`. Usar las no prefijadas.

## Evidencia (firmas literales de los .d.ts)

Fuente: `node_modules/angular-three-rapier/types/angular-three-rapier.d.ts`

### `ropeJoint` (líneas 1572-1575)

```ts
declare const ropeJoint: (bodyA: RigidBody | ElementRef<RigidBody> | (() => ElementRef<RigidBody> | RigidBody | undefined | null), bodyB: RigidBody | ElementRef<RigidBody> | (() => ElementRef<RigidBody> | RigidBody | undefined | null), { injector, data }: {
    injector?: Injector;
    data: NgtrRopeJointParams | (() => NgtrRopeJointParams);
}) => _angular_core.Signal<RopeImpulseJoint | null>;
```

### `sphericalJoint` (líneas 1466-1469)

```ts
declare const sphericalJoint: (bodyA: RigidBody | ElementRef<RigidBody> | (() => ElementRef<RigidBody> | RigidBody | undefined | null), bodyB: RigidBody | ElementRef<RigidBody> | (() => ElementRef<RigidBody> | RigidBody | undefined | null), { injector, data }: {
    injector?: Injector;
    data: NgtrSphericalJointParams | (() => NgtrSphericalJointParams);
}) => _angular_core.Signal<SphericalImpulseJoint | null>;
```

Nota de tipos: `RigidBody`, `RopeImpulseJoint`, `SphericalImpulseJoint` se importan de `@dimforge/rapier3d-compat`; `ElementRef`, `Injector`, `Signal` de `@angular/core`.

### Interfaces de parámetros (líneas 734-739 y 833-840)

```ts
interface NgtrSphericalJointParams {
    /** Anchor point on the first body in local coordinates */
    body1Anchor: NgtVector3;
    /** Anchor point on the second body in local coordinates */
    body2Anchor: NgtVector3;
}

interface NgtrRopeJointParams {
    /** Anchor point on the first body in local coordinates */
    body1Anchor: NgtVector3;
    /** Anchor point on the second body in local coordinates */
    body2Anchor: NgtVector3;
    /** Maximum distance between the anchor points */
    length: number;
}
```

`NgtVector3` (de `angular-three`, `types/angular-three.d.ts` línea 99) es `NgtMathType<THREE.Vector3>` = `THREE.Vector3 | [x, y, z] | number` — se pueden pasar tuplas `[0, 1, 0]` directamente.

### Ejemplos JSDoc del propio paquete

```ts
sphericalJoint(bodyA, bodyB, {
  data: { body1Anchor: [0, 1, 0], body2Anchor: [0, -1, 0] }
});

ropeJoint(bodyA, bodyB, {
  data: {
    body1Anchor: [0, 0, 0],
    body2Anchor: [0, 0, 0],
    length: 5
  }
});
```

### Semántica interna (fesm2022/angular-three-rapier.mjs)

- Línea 2340: `sphericalJoint = createJoint((rapier, data) => rapier.JointData.spherical(vector3ToRapierVector(data.body1Anchor), vector3ToRapierVector(data.body2Anchor)))`
- Línea 2442: `ropeJoint = createJoint((rapier, data) => rapier.JointData.rope(data.length, vector3ToRapierVector(data.body1Anchor), vector3ToRapierVector(data.body2Anchor)))`
- `impulseJoint`/`createJoint` (líneas 2241-2284): son **injection functions con `assertInjector`** — hay que llamarlas en contexto de inyección (constructor / field initializer) o pasar `injector` en options. Internamente:
  - `inject(NgtrPhysics)` y `computed()` sobre `physics.worldSingleton()`; devuelve `null` hasta que el mundo está listo y ambos bodies resueltos (`resolveRef`), por lo que **acepta getters/signals que aún devuelven undefined** — el joint se crea reactivamente cuando todo está disponible.
  - Crea con `worldSingleton.proxy.createImpulseJoint(jointData, a, b, true)`.
  - Limpieza automática en `effect` con `onCleanup`: `worldSingleton.proxy.removeImpulseJoint(joint, true)` si el joint sigue vivo. No hay que gestionar el destroy manualmente.
- Si `data` es una función, el `computed` la re-evalúa: cambiar los params **recrea** el joint (destruye el anterior vía cleanup del effect).

### Firmas Rapier subyacentes (por completitud)

`node_modules/@dimforge/rapier3d-compat/dynamics/impulse_joint.d.ts`:

```ts
static rope(length: number, anchor1: Vector, anchor2: Vector): JointData;   // línea 202
static spherical(anchor1: Vector, anchor2: Vector): JointData;              // línea 231
```

`node_modules/@dimforge/rapier3d-compat/pipeline/world.d.ts`:

```ts
createImpulseJoint(params: JointData, parent1: RigidBody, parent2: RigidBody, wakeUp: boolean): ImpulseJoint;  // línea 232
removeImpulseJoint(joint: ImpulseJoint, wakeUp: boolean): void;                                                // línea 288
```

Ojo al orden en `JointData.rope`: `length` va PRIMERO (el hook de angular-three-rapier ya lo maneja).

## Acceso al mundo Rapier (si hiciera falta ir a bajo nivel)

Servicio/componente: `NgtrPhysics` (componente `<ngtr-physics>`, exportado del paquete). Se obtiene con `inject(NgtrPhysics)` desde cualquier componente dentro del árbol de `<ngtr-physics>`. Miembros públicos relevantes (d.ts líneas 1701-1770):

```ts
/** The loaded Rapier module, null if not yet loaded */
rapier: Signal<typeof _dimforge_rapier3d_compat__default | null>;
/** Singleton proxy to the Rapier physics world */
worldSingleton: Signal<{
    proxy: _dimforge_rapier3d_compat__default.World;
    reset: () => void;
    set: (newInstance: World) => void;
} | null>;
paused: Signal<boolean>;
step(delta: number): void;
```

- Estado "ready": ambos signals (`rapier()`, `worldSingleton()`) son `null` hasta que el WASM carga; hay que guardar con `if (!world) return` en computeds/effects.
- Hooks auxiliares exportados: `beforePhysicsStep(callback, injector?)` y `afterPhysicsStep(callback, injector?)` — reciben el `World` en cada step y se desregistran solos al destruir el componente.

## Acceso a RigidBody desde template refs

Directiva: `NgtrRigidBody`, selector `ngt-object3D[rigidBody]`, **exportAs `rigidBody`** (d.ts líneas 966-1019). Miembro clave:

```ts
rigidBody: Signal<RigidBody | null>;   // RAPIER.RigidBody crudo (línea 1003)
objectRef: ElementRef<THREE.Object3D>; // el Object3D subyacente (línea 999)
```

Patrón de uso en template + componente:

```html
<ngt-object3D rigidBody #bodyA="rigidBody" [position]="[0, 4, 0]">...</ngt-object3D>
<ngt-object3D rigidBody #bodyB="rigidBody">...</ngt-object3D>
```

```ts
bodyA = viewChild.required('bodyA', { read: NgtrRigidBody });
bodyB = viewChild.required('bodyB', { read: NgtrRigidBody });

// field initializer (contexto de inyección) — el getter devuelve undefined/null hasta que exista
joint = ropeJoint(
  () => this.bodyA().rigidBody(),
  () => this.bodyB().rigidBody(),
  { data: { body1Anchor: [0, 0, 0], body2Anchor: [0, 0, 0], length: 5 } },
);
```

Los getters se re-evalúan reactivamente dentro del `computed` interno del hook, así que el joint se crea cuando ambos `rigidBody()` dejan de ser `null`.

## Recomendación de implementación

Caso A — usar la API nativa, sin wrapper:

1. Importar `ropeJoint` / `sphericalJoint` (y `NgtrRigidBody` para `viewChild ... read`) desde `angular-three-rapier`.
2. Llamar los hooks en field initializers del componente (o pasar `injector` explícito si se llama fuera de contexto de inyección).
3. Pasar los bodies como getters `() => this.ref().rigidBody()` (patrón recomendado; el hook tolera null/undefined durante el arranque).
4. Anchors en coordenadas **locales** de cada body; tuplas `[x, y, z]` válidas por `NgtVector3`.
5. No usar `injectRopeJoint`/`injectSphericalJoint` (deprecated, se eliminan en v5).
6. No gestionar destrucción: el hook elimina el joint del mundo automáticamente vía effect cleanup.
7. Si `data` debe ser dinámico, pasar `data` como función; tener en cuenta que cada cambio destruye y recrea el joint (no muta el existente). Para mutar límites en caliente habría que usar el `Signal<RopeImpulseJoint | null>` devuelto y la API cruda del joint.

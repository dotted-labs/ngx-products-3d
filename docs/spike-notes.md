# Spike notes — spec-02 Fase 0

> Salida consolidada de los spikes S1 (joints) y S2 (meshline). Detalle completo con
> evidencia línea a línea en `progress/explore_s1_joints.md` y
> `progress/explore_s2_meshline.md`.
>
> Verificado el 2026-07-07 sobre: `angular-three@4.2.3`, `angular-three-rapier@4.2.3`,
> `@dimforge/rapier3d-compat` (peer `>=0.14 <0.20`), `meshline@3.3.1`, `three@0.182.0`.

## S1 — Joints: **caso A, API nativa** (no hace falta wrapper `joints.ts`)

`angular-three-rapier@4.2.3` exporta hooks de joints desde el entry point raíz.
Usar `ropeJoint` y `sphericalJoint`; las variantes `injectRopeJoint`/`injectSphericalJoint`
existen pero están **deprecated** (se eliminan en v5).

Firmas exactas (`node_modules/angular-three-rapier/types/angular-three-rapier.d.ts:1466-1575`):

```ts
declare const ropeJoint: (
	bodyA: RigidBody | ElementRef<RigidBody> | (() => ElementRef<RigidBody> | RigidBody | undefined | null),
	bodyB: RigidBody | ElementRef<RigidBody> | (() => ElementRef<RigidBody> | RigidBody | undefined | null),
	{ injector, data }: { injector?: Injector; data: NgtrRopeJointParams | (() => NgtrRopeJointParams) },
) => Signal<RopeImpulseJoint | null>;

declare const sphericalJoint: (
	bodyA: /* ídem */, bodyB: /* ídem */,
	{ injector, data }: { injector?: Injector; data: NgtrSphericalJointParams | (() => NgtrSphericalJointParams) },
) => Signal<SphericalImpulseJoint | null>;

interface NgtrRopeJointParams {
	body1Anchor: NgtVector3; // coordenadas LOCALES del body
	body2Anchor: NgtVector3;
	length: number; // distancia máxima entre anchors
}
interface NgtrSphericalJointParams {
	body1Anchor: NgtVector3;
	body2Anchor: NgtVector3;
}
```

`NgtVector3` admite tuplas `[x, y, z]` directamente.

Semántica (verificada en `fesm2022/angular-three-rapier.mjs:2241-2442`):

- Son injection functions (`assertInjector`): llamarlas en field initializer/constructor
  o pasar `injector` explícito.
- Aceptan getters que aún devuelven `null`/`undefined`: el joint se crea reactivamente
  cuando el mundo Rapier está listo y ambos bodies resueltos. Devuelven
  `Signal<Joint | null>`.
- **Cleanup automático** vía effect (`removeImpulseJoint`): no gestionar destroy a mano.
- Si `data` es función, cambiarla **destruye y recrea** el joint (no muta el existente).

Patrón de uso con refs de template:

```html
<ngt-object3D rigidBody #j1="rigidBody">...</ngt-object3D>
```

```ts
j1 = viewChild.required('j1', { read: NgtrRigidBody }); // NgtrRigidBody expone rigidBody: Signal<RAPIER.RigidBody | null>

joint = ropeJoint(
	() => this.j1().rigidBody(),
	() => this.j2().rigidBody(),
	{ data: { body1Anchor: [0, 0, 0], body2Anchor: [0, 0, 0], length: BADGE_PHYSICS.segmentLength } },
);
```

Acceso a bajo nivel si hiciera falta: `inject(NgtrPhysics)` → `worldSingleton()` (`{ proxy: World } | null`),
`rapier()` (namespace | null); ambos `null` hasta que carga el WASM. Hooks `beforePhysicsStep`/`afterPhysicsStep` disponibles.

## S2 — meshline: **viable** con renderer v4 (sin fricción con three 0.182)

- `MeshLineGeometry extends THREE.BufferGeometry`, `MeshLineMaterial extends THREE.ShaderMaterial`
  → el renderer v4 los **auto-attachea** a `mesh.geometry`/`mesh.material` (flags `isBufferGeometry`/`isMaterial`), sin `attach` explícito.
- `extend({ MeshLineGeometry, MeshLineMaterial })` registra claves PascalCase; el renderer resuelve
  `ngt-mesh-line-geometry`/`ngt-mesh-line-material` vía `kebabToPascal` → coincidencia exacta.
  `CUSTOM_ELEMENTS_SCHEMA` obligatorio en el componente.
- Compatibilidad three: peer `>=0.137` satisfecha por 0.182; auditadas las APIs internas de meshline
  (copyArray, setAttribute, UniformsLib.fog, guard de `colorspace_fragment` r154+): **ningún riesgo encontrado**.

Firmas clave (`node_modules/meshline/dist/*.d.ts`):

```ts
class MeshLineGeometry extends THREE.BufferGeometry {
	constructor(); // sin args
	setPoints(points: PointsRepresentation, wcb?: WidthCallback): void; // Vector3[] | Float32Array | number[] | ...
	advance({ x, y, z }: THREE.Vector3): void; // camino rápido: memcpy, CERO allocations
}

class MeshLineMaterial extends THREE.ShaderMaterial {
	constructor(parameters: MeshLineMaterialParameters);
	// lineWidth, color, resolution: THREE.Vector2 (hace .copy(value)), sizeAttenuation: number (0|1),
	// dashArray/dashOffset/dashRatio, opacity...  Todas accessors → uniforms: bindings [prop] normales.
	// depthTest/transparent heredados de THREE.Material.
}
```

Notas de implementación para la correa (feature 5):

- Acceso a la instancia: template ref + `viewChild.required<ElementRef<MeshLineGeometry>>('line')`
  → `nativeElement` ES la instancia three.
- Por frame: `beforeRender(cb)` de `angular-three` (nombre canónico v4; `injectBeforeRender` deprecated).
  El state trae `delta`, `camera`, `size` — `size` alimenta el binding `[resolution]` (pasar `Vector2`).
- OJO perf: `setPoints()` asigna arrays nuevos en cada llamada. Como la correa tiene nº de puntos
  constante (32), evaluar en feature 5 rellenar un `Float32Array` reutilizado y pasarlo a `setPoints`,
  o medir con profiler si el coste es aceptable (la spec pide "sin GC spikes").
- `raycast` de meshline se exporta aparte; solo asignarlo si se necesitan pointer-events sobre la línea
  (no es el caso: el drag va sobre la tarjeta).

Pendiente de confirmación runtime (se valida en features 3-5, no bloquea):
render visual del shader (miter joins), binding `[resolution]` con el tamaño real del canvas,
y coste real de `setPoints()` por frame.

### Decisión: meshline ✅ / fallback TubeGeometry ❌

`THREE.TubeGeometry` queda solo como plan B: es inmutable (regenerar + `dispose()` cada frame
= allocations de todos los buffers + re-upload a GPU + presión de GC), genera muchos más vértices
y no ofrece anchura en píxeles de pantalla. Solo compensaría para un tubo volumétrico iluminado
actualizado con poca frecuencia.

# spec-02: Badge — física, correa y drag (Fases 0–2)

## Contexto

Implementa la mecánica del badge dentro de `ngx-products-3d/badge`: cadena física de la correa (lanyard), tarjeta colgante, drag con puntero, estabilización. Sin assets finales: la tarjeta es un plano placeholder. Prerequisito: spec-01 completado.

Referencia conceptual: badge interactivo de Vercel (React Three Fiber + react-three-rapier). NO copiar código React; portar la lógica a Angular Three v4 con signals y `beforeRender`. Consultar docs de angular-three v4 (angularthree.org) para API exacta.

## Fase 0 — Spike (bloqueante, resolver antes de tocar componentes)

### S1: API de joints en `angular-three-rapier@4`

Necesitamos **rope joint** y **spherical joint**. Verificar en `node_modules/angular-three-rapier`:

```bash
grep -ri "ropeJoint\|sphericalJoint\|RopeJoint\|SphericalJoint" node_modules/angular-three-rapier --include="*.d.ts" -l
```

Resultados posibles:

- **A) Existen fns de joints** (estilo `injectRopeJoint`/`ropeJoint`): usarlas. Documentar firma exacta en `docs/spike-notes.md`.
- **B) No existen**: implementar wrapper propio en `badge/src/lib/joints.ts` usando el mundo Rapier crudo:

```ts
// Boceto — ajustar a la API real de acceso al mundo en angular-three-rapier v4
import { DestroyRef, effect, inject } from '@angular/core';
import * as RAPIER from '@dimforge/rapier3d-compat';

export function ropeJoint(
	bodyA: () => RAPIER.RigidBody | null,
	bodyB: () => RAPIER.RigidBody | null,
	opts: { anchorA: [number, number, number]; anchorB: [number, number, number]; length: number },
) {
	// inyectar servicio/contexto Physics de angular-three-rapier → world
	// effect(): cuando ambos bodies existan →
	//   world.createImpulseJoint(RAPIER.JointData.rope(opts.length, anchorA, anchorB), a, b, true)
	// DestroyRef.onDestroy(() => world.removeImpulseJoint(joint, true))
}
```

Mismo patrón con `RAPIER.JointData.spherical(anchorA, anchorB)`.

### S2: meshline con renderer v4

```ts
import { extend } from 'angular-three';
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';

extend({ MeshLineGeometry, MeshLineMaterial });
```

Verificar que `<ngt-mesh-line-geometry>` y `<ngt-mesh-line-material>` renderizan (elementos custom → `CUSTOM_ELEMENTS_SCHEMA`). Probar `setPoints()` sobre la geometría desde `beforeRender`. Si meshline da fricción con three >=0.174, alternativa: `THREE.TubeGeometry` regenerada por frame (peor perf; solo fallback).

Salida del spike: `docs/spike-notes.md` con API confirmada. Si S1 = caso B, `joints.ts` implementado y testeado con dos cubos unidos.

## Fase 1 — Cadena física + correa + drag

### Estructura de la escena (`badge-scene.component.ts`)

Cuerpos (posiciones iniciales, mundo con gravedad `BADGE_PHYSICS.gravity`):

| Body | Tipo inicial | Posición | Collider |
|---|---|---|---|
| `fixed` | fixed | `[0.5, 4, 0]` | ninguno |
| `j1` | dynamic | `[0.5, 3, 0]` | ball radio pequeño (~0.1) |
| `j2` | dynamic | `[0.5, 2, 0]` | ball ~0.1 |
| `j3` | dynamic | `[0.5, 1, 0]` | ball ~0.1 |
| `card` | dynamic ↔ kinematicPosition (drag) | `[2, 0, 0]` | cuboid `[0.8, 1.125, 0.01]` |

Opciones de todos los bodies de la cadena y tarjeta: `angularDamping` y `linearDamping` de `BADGE_PHYSICS`, `colliders: false` (colliders explícitos).

Joints:

- rope `fixed↔j1`, `j1↔j2`, `j2↔j3`: anchors `[0,0,0]`, longitud `BADGE_PHYSICS.segmentLength`
- spherical `j3↔card`: anchor en card = `BADGE_PHYSICS.cardJointAnchor` (`[0, 1.45, 0]`, borde superior donde iría el clip)

Template (boceto, ajustar selectores a API real v4):

```html
<ngt-group [position]="[0, 4, 0]">
	<ngt-object3D #fixedRef rigidBody="fixed" [options]="segmentOptions" [position]="[0.5, 0, 0]" />
	<ngt-object3D #j1Ref rigidBody [options]="segmentOptions" [position]="[0.5, -1, 0]">
		<ngt-object3D [ballCollider]="[0.1]" />
	</ngt-object3D>
	<!-- j2, j3 análogos -->
	<ngt-object3D
		#cardRef
		[rigidBody]="cardBodyType()"
		[options]="cardOptions"
		[position]="[2, -4, 0]"
	>
		<ngt-object3D [cuboidCollider]="[0.8, 1.125, 0.01]" />
		<ngt-mesh
			(pointerdown)="onPointerDown($event)"
			(pointerup)="onPointerUp($event)"
			(pointerover)="hovered.set(true)"
			(pointerout)="hovered.set(false)"
		>
			<!-- placeholder Fase 1 -->
			<ngt-plane-geometry *args="[1.6, 2.25]" />
			<ngt-mesh-basic-material color="white" [transparent]="true" [opacity]="0.9" [side]="DoubleSide" />
		</ngt-mesh>
	</ngt-object3D>
</ngt-group>

<!-- Correa -->
<ngt-mesh>
	<ngt-mesh-line-geometry #bandGeometry />
	<ngt-mesh-line-material
		color="white"
		[resolution]="resolution()"
		[lineWidth]="1"
		[depthTest]="false"
	/>
</ngt-mesh>
```

`cardBodyType` = signal: `'dynamic'` por defecto, `'kinematicPosition'` durante drag.

### Correa por frame

Estado: `THREE.CatmullRomCurve3` con 4 `Vector3` reutilizados (sin allocations por frame). En `beforeRender`:

1. Copiar traslaciones de `j3`, `j2`, `j1`, `fixed` a los puntos de la curva (orden tarjeta→anclaje)
2. `curve.curveType = 'chordal'` (fijar una vez; elimina kinks en la cuerda)
3. `bandGeometry.setPoints(curve.getPoints(BADGE_PHYSICS.curvePoints))`

`resolution` de la material = tamaño del viewport (obtener del store de angular-three, reactivo a resize).

### Drag

`onPointerDown(event)`:

1. `event.target.setPointerCapture(event.pointerId)`
2. Calcular offset: `vec.copy(event.point).sub(vec.copy(cardBody.translation()))` → guardar en signal `dragged`
3. `cardBodyType.set('kinematicPosition')`

En `beforeRender`, si `dragged()`:

1. Unproject puntero → posición mundo:

```ts
vec.set(pointer.x, pointer.y, 0.5).unproject(camera);
dir.copy(vec).sub(camera.position).normalize();
vec.add(dir.multiplyScalar(camera.position.length()));
```

2. Despertar toda la cadena: `[card, j1, j2, j3].forEach((b) => b.wakeUp())`
3. `card.setNextKinematicTranslation({ x: vec.x - dragOffset.x, y: vec.y - dragOffset.y, z: vec.z - dragOffset.z })`

`onPointerUp`: release capture, `dragged.set(false)`, `cardBodyType.set('dynamic')`.

Vectores (`vec`, `dir`, etc.) = instancias `THREE.Vector3` de clase, reutilizadas.

### Canvas wrapper (`badge.component.ts`, sustituye stub)

```html
<ngt-canvas [camera]="BADGE_CAMERA" (created)="..." >
	<ng-template canvasContent>
		<ngtr-physics [options]="{ gravity: BADGE_PHYSICS.gravity, timeStep: BADGE_PHYSICS.timeStep, interpolate: true, debug: debug() }">
			<ng-template>
				<products-3d-badge-scene [member]="member()" [theme]="resolvedTheme()" />
			</ng-template>
		</ngtr-physics>
	</ng-template>
</ngt-canvas>
```

(Selector/estructura exacta de `NgtrPhysics` v4: verificar en docs; el snippet de angularthree.org usa `NgtrPhysics` importado con template de contenido.)

- `provideNgtRenderer()` en providers del componente
- Guard SSR: envolver canvas en `@if (isBrowser)` con `isBrowser = isPlatformBrowser(inject(PLATFORM_ID))`
- Input `debug` (boolean, default false) → passthrough a Physics; playground lo expone como toggle

### Hito Fase 1

Plano blanco colgando de cadena invisible + correa blanca renderizada. Drag funciona: tarjeta sigue puntero, cadena reacciona, al soltar cae y oscila.

## Fase 2 — Estabilización y pulido

### Anti-jitter (lerp de segmentos intermedios)

Problema: joints reciben posiciones bruscas durante drag → temblor. Solución del tutorial: `j1` y `j2` no leen su traslación cruda para la curva; mantienen copia lerped.

Estado extra: `j1Lerped`, `j2Lerped` (`Vector3`). En `beforeRender` (delta disponible):

```ts
[j1, j2].forEach((body, i) => {
	const lerped = i === 0 ? j1Lerped : j2Lerped;
	if (!lerpedInitialized) lerped.copy(body.translation());
	const clampedDistance = Math.max(0.1, Math.min(1, lerped.distanceTo(body.translation())));
	lerped.lerp(
		body.translation(),
		delta * (BADGE_PHYSICS.minSpeed + clampedDistance * (BADGE_PHYSICS.maxSpeed - BADGE_PHYSICS.minSpeed)),
	);
});
```

Curva usa `j3.translation()`, `j2Lerped`, `j1Lerped`, `fixed.translation()`.

### Anti-giro (tarjeta mira a cámara)

En `beforeRender`, cuando NO hay drag:

```ts
const ang = card.angvel();
const rot = card.rotation();
card.setAngvel({ x: ang.x, y: ang.y - rot.y * BADGE_PHYSICS.spinCorrectionFactor, z: ang.z }, true);
```

Nota: tutorial aplica corrección proporcional a `rotation.y`. Si con quaternion crudo el eje no corresponde, convertir a Euler antes.

### Cursor

Effect sobre `hovered`/`dragged`:

- drag → `grabbing`
- hover → `grab`
- resto → `auto`

Aplicar sobre `document.body.style.cursor` solo en browser; restaurar en cleanup del effect y en `DestroyRef`.

### Config

Repasar: ningún número mágico en componentes. Todo desde `badge.config.ts`. Tuning en playground con toggle de `debug` física; opcional Tweakpane solo en playground (nunca dependencia de la lib).

### Hito Fase 2

Drag agresivo sin jitter visible. Tarjeta vuelve a orientación frontal tras soltar. Cursor correcto. `debug` física activable desde playground.

## Criterios de aceptación

- [ ] Spike documentado en `docs/spike-notes.md`; joints funcionando (API nativa o wrapper)
- [ ] Correa curva suave 32 puntos, sin allocations por frame (verificar con profiler: sin GC spikes)
- [ ] Drag: pointer capture, kinematic switch, wakeUp de cadena
- [ ] Anti-jitter y anti-giro activos, valores desde config
- [ ] SSR guard: componente montado en entorno server no toca `document`/canvas
- [ ] 60fps estables en playground (desktop)
- [ ] Zoneless-safe: sin dependencia de Zone.js

## No hacer

- No cargar GLB ni texturas (spec-03)
- No RenderTexture (spec-03)
- No API pública nueva más allá del input `debug`

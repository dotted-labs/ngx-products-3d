import type { Curve, Quaternion, Vector3 } from 'three';

/** Pose TRS de un `Object3D` en el sistema de su padre (`position`/`quaternion`/`scale`). */
export interface BadgeObjectPose {
	position: Vector3;
	quaternion: Quaternion;
	scale: Vector3;
}

/**
 * Lleva un punto LOCAL de un `Object3D` al sistema de su padre con la pose TRS actual (escala →
 * rotación → traslación, el orden de `Object3D.matrix`). No usa `matrix`/`matrixWorld`: three los
 * recalcula en `render()`, DESPUÉS de `beforeRender`, así que irían un frame por detrás de la pose
 * recién interpolada por Rapier. Escribe en `out` (sin allocations) y lo devuelve.
 */
export function localPointToParent(
	local: readonly [number, number, number],
	pose: BadgeObjectPose,
	out: Vector3,
): Vector3 {
	return out
		.set(local[0], local[1], local[2])
		.multiply(pose.scale)
		.applyQuaternion(pose.quaternion)
		.add(pose.position);
}

/**
 * Remuestrea `curve` en `out.length` puntos EQUIESPACIADOS por longitud de arco. Es lo que hace
 * `curve.updateArcLengths()` + `curve.getSpacedPoints(n)` de three, pero sin allocations: aquellos
 * crean un `Vector3` por división y por punto en cada llamada, y esto corre en cada frame.
 *
 * Por qué por arco y no por parámetro (`getPoints`): meshline asigna la U de la textura por ÍNDICE
 * de punto (`uvs.push(j / (l - 1), …)`), así que con muestreo por parámetro la textura se estira y
 * se desliza cuando la cadena se mueve. Equiespaciados por arco, cada tesela mide lo mismo.
 *
 * `samples` y `arcLengths` son buffers de trabajo de la misma longitud (divisiones + 1, mínimo 2);
 * `out` necesita al menos 2 puntos. La curva se mide de nuevo en cada llamada: no hay caché que
 * invalidar aunque sus puntos de control se muten in situ. Devuelve `out`.
 */
export function sampleCurveByArcLength(
	curve: Curve<Vector3>,
	samples: Vector3[],
	arcLengths: Float64Array,
	out: Vector3[],
): Vector3[] {
	const divisions = samples.length - 1;
	curve.getPoint(0, samples[0]);
	arcLengths[0] = 0;
	for (let i = 1; i <= divisions; i++) {
		curve.getPoint(i / divisions, samples[i]);
		arcLengths[i] = arcLengths[i - 1] + samples[i].distanceTo(samples[i - 1]);
	}

	const total = arcLengths[divisions];
	const last = out.length - 1;
	let segment = 0;
	for (let k = 0; k <= last; k++) {
		const target = (k / last) * total;
		while (segment < divisions - 1 && arcLengths[segment + 1] < target) {
			segment++;
		}
		const segmentLength = arcLengths[segment + 1] - arcLengths[segment];
		const fraction = segmentLength > 0 ? (target - arcLengths[segment]) / segmentLength : 0;
		curve.getPoint((segment + fraction) / divisions, out[k]);
	}
	return out;
}

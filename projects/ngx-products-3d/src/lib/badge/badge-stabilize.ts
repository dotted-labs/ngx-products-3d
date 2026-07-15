import type { Vector3 } from 'three';
import type { Vec3Like } from './badge-drag';

/** Acota `value` al rango inclusivo [min, max]. */
export function clamp(value: number, min: number, max: number): number {
	return value < min ? min : value > max ? max : value;
}

/**
 * Interpola `out` hacia `target` in situ, a una velocidad que escala con la
 * distancia actual al objetivo (acotada a [clampMin, clampMax]) por `delta`.
 * Opera sobre componentes `Vec3Like` para consumir la traslación cruda de Rapier
 * sin construir un Vector3, y calcula la distancia a mano (no `Vector3.distanceTo`,
 * que exigiría un Vector3 destino y una allocation por frame). Devuelve `out`.
 */
export function lerpTowards(
	target: Vec3Like,
	delta: number,
	minSpeed: number,
	maxSpeed: number,
	clampMin: number,
	clampMax: number,
	out: Vector3,
): Vector3 {
	const dx = target.x - out.x;
	const dy = target.y - out.y;
	const dz = target.z - out.z;
	const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
	const clampedDistance = clamp(distance, clampMin, clampMax);
	const alpha = delta * (minSpeed + clampedDistance * (maxSpeed - minSpeed));
	out.x += dx * alpha;
	out.y += dy * alpha;
	out.z += dz * alpha;
	return out;
}

/**
 * Velocidad angular en Y corregida para recuperar la orientación frontal:
 * `angY − rotY * factor`. `rotY` es el ángulo de Euler (yaw), no el componente
 * y del quaternion.
 */
export function spinCorrectedAngvelY(angY: number, rotY: number, factor: number): number {
	return angY - rotY * factor;
}

import type { Camera, PerspectiveCamera } from 'three';
import type { Products3dBadgeCamera } from '../types';
import {
	BADGE_BAND,
	BADGE_CAMERA,
	BADGE_CAMERA_DEFAULTS,
	BADGE_CAMERA_LIMITS,
	BADGE_LAYOUT,
} from './badge.config';

/**
 * Cámara configurable del badge (feature badge-center-camera): lógica pura, sin Angular ni WebGL. El
 * wrapper la usa para configurar su canvas y la escena para derivar la correa y la pose de salida.
 */

/** Cámara del badge con todos los campos resueltos y válidos */
export type BadgeCameraSettings = Required<Products3dBadgeCamera>;

/** Options de `<ngt-canvas [camera]>` para una cámara del badge */
export interface BadgeCanvasCameraOptions {
	position: [number, number, number];
	fov: number;
}

/** `fov` en [`BADGE_CAMERA_LIMITS.minFov`, `BADGE_CAMERA_LIMITS.maxFov`) */
function isValidFov(fov: unknown): fov is number {
	return (
		typeof fov === 'number' &&
		Number.isFinite(fov) &&
		fov >= BADGE_CAMERA_LIMITS.minFov &&
		fov < BADGE_CAMERA_LIMITS.maxFov
	);
}

function isValidDistance(distance: unknown): distance is number {
	return typeof distance === 'number' && Number.isFinite(distance) && distance > 0;
}

/**
 * Holgura que se exige entre el anclaje fijo de la correa y el borde superior del frustum, con ese
 * `fov`: el medio ancho de la correa en mundo (`BADGE_BAND.lineWidth · tan(fov/2) / 2`; al inclinarse,
 * la esquina de su extremo sube hasta ahí por encima del anclaje) más `BADGE_CAMERA_LIMITS.anchorMargin`.
 * ≈ 0.26 con 25°, ≈ 0.44 con 60°.
 */
export function badgeAnchorClearance(fov: number): number {
	const bandHalfWidth = (BADGE_BAND.lineWidth * Math.tan((fov * Math.PI) / 360)) / 2;

	return bandHalfWidth + BADGE_CAMERA_LIMITS.anchorMargin;
}

/**
 * Distancia máxima a la que la cámara (con ese `fov`) deja el anclaje fijo de la correa por encima
 * del viewport, con `badgeAnchorClearance(fov)` de holgura. El borde superior del frustum en el plano
 * del anclaje es `camY + (distance − anclajeZ) · tan(fov/2)`; despejando `distance` con ese borde en
 * `anclajeY − holgura` sale este máximo. Con la cámara por defecto (25°) es ≈ 16.9.
 */
export function maxBadgeCameraDistance(fov: number): number {
	const [, anchorY, anchorZ] = BADGE_LAYOUT.fixedPosition;
	const [, cameraY] = BADGE_CAMERA.position;
	const visibleTop = anchorY - badgeAnchorClearance(fov) - cameraY;

	return anchorZ + visibleTop / Math.tan((fov * Math.PI) / 360);
}

/**
 * Resuelve el input `camera` del badge. Nunca lanza ni devuelve `NaN`:
 * - Campo ausente ⇒ su default (`BADGE_CAMERA_DEFAULTS`), sin aviso.
 * - `fov` no numérico, no finito o fuera de [`minFov`, `maxFov`) (`BADGE_CAMERA_LIMITS`), o
 *   `distance` no numérica, no finita o ≤ 0 ⇒ su default + aviso dev `[ngx-products-3d]`.
 * - Si la cámara resultante dejaría ver el anclaje de la correa (`maxBadgeCameraDistance`), la
 *   `distance` se acorta a ese máximo + aviso dev. Es la decisión de la feature: el extremo cortado de
 *   la correa no se ve nunca, a cambio de no poder alejar la cámara más allá de ese punto.
 *
 * Idempotente: resolver una cámara ya resuelta devuelve los mismos valores y no avisa (el wrapper
 * resuelve y pasa el resultado a la escena, que vuelve a resolver).
 */
export function resolveBadgeCamera(
	camera: Products3dBadgeCamera | null | undefined,
): BadgeCameraSettings {
	const requestedFov = camera?.fov;
	const requestedDistance = camera?.distance;
	let fov = BADGE_CAMERA_DEFAULTS.fov;
	let distance = BADGE_CAMERA_DEFAULTS.distance;

	if (isValidFov(requestedFov)) {
		fov = requestedFov;
	} else if (requestedFov !== undefined && ngDevMode) {
		console.warn(
			`[ngx-products-3d] badge: camera.fov inválido (${String(requestedFov)}). Debe ser un número de grados en [${BADGE_CAMERA_LIMITS.minFov}, ${BADGE_CAMERA_LIMITS.maxFov}); se usa ${fov}.`,
		);
	}
	if (isValidDistance(requestedDistance)) {
		distance = requestedDistance;
	} else if (requestedDistance !== undefined && ngDevMode) {
		console.warn(
			`[ngx-products-3d] badge: camera.distance inválida (${String(requestedDistance)}). Debe ser un número > 0; se usa ${distance}.`,
		);
	}

	const maxDistance = maxBadgeCameraDistance(fov);
	if (distance > maxDistance) {
		if (ngDevMode) {
			console.warn(
				`[ngx-products-3d] badge: con camera.fov ${fov} y camera.distance ${distance} el anclaje superior de la correa asomaría en el viewport; se usa distance ${maxDistance}. Para una tarjeta más pequeña, reduce el contenedor.`,
			);
		}
		distance = maxDistance;
	}

	return { fov, distance };
}

/** Options de `<ngt-canvas [camera]>`: x/y de `BADGE_CAMERA` (centrada) y z = `distance` */
export function badgeCanvasCamera(camera: BadgeCameraSettings): BadgeCanvasCameraOptions {
	const [x, y] = BADGE_CAMERA.position;

	return { position: [x, y, camera.distance], fov: camera.fov };
}

/**
 * Aplica una cámara del badge a la cámara YA CREADA del canvas (cambio en caliente). Hace falta porque
 * `<ngt-canvas>` solo aplica sus options de cámara al crearla: re-configurado con otras options, no
 * toca la cámara que ya existe. Solo actúa sobre una `PerspectiveCamera` (la que crea el canvas del
 * badge); devuelve si la ha aplicado. Sin allocations: muta la cámara en sitio.
 */
export function applyBadgeCamera(target: Camera, camera: BadgeCameraSettings): boolean {
	if (!(target as PerspectiveCamera).isPerspectiveCamera) {
		return false;
	}
	const perspective = target as PerspectiveCamera;
	const [x, y] = BADGE_CAMERA.position;
	perspective.fov = camera.fov;
	perspective.position.set(x, y, camera.distance);
	perspective.updateProjectionMatrix();
	perspective.updateMatrixWorld();
	return true;
}

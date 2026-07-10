import type { Camera, Vector3 } from 'three';

/** Cualquier objeto con componentes cartesianas (THREE.Vector3, Rapier `Vector`, literal). */
export interface Vec3Like {
	x: number;
	y: number;
	z: number;
}

/**
 * Resta componente a componente (`a − b`) sobre un Vector3 reutilizado (`out`), sin allocations.
 * Acepta `Vec3Like` para poder operar con la `Vector` cruda de Rapier sin construir Vector3.
 */
export function subtractInto(a: Vec3Like, b: Vec3Like, out: Vector3): Vector3 {
	out.x = a.x - b.x;
	out.y = a.y - b.y;
	out.z = a.z - b.z;
	return out;
}

/**
 * Proyecta el puntero normalizado (NDC x/y) al plano de arrastre en coordenadas de mundo.
 * Reutiliza `vec` (resultado) y `dir` (dirección cámara→puntero) sin allocations por frame.
 * Devuelve `vec` ya situado sobre el rayo del puntero a la distancia de la cámara al origen.
 */
export function projectPointerToWorld(
	pointerX: number,
	pointerY: number,
	depth: number,
	camera: Camera,
	vec: Vector3,
	dir: Vector3,
): Vector3 {
	vec.set(pointerX, pointerY, depth).unproject(camera);
	dir.copy(vec).sub(camera.position).normalize();
	return vec.add(dir.multiplyScalar(camera.position.length()));
}

import type { ShaderMaterial } from 'three';
import { MeshLineMaterial, type MeshLineMaterialParameters } from 'meshline';
import { BADGE_BAND } from './badge.config';

/**
 * Comparaciones con las que el vertex shader de meshline 3.3.1 detecta los extremos de la línea
 * (`process()` le pasa como `previous` del primer punto y como `next` del último una copia del
 * propio punto). Cada una se sustituye por una distancia con tolerancia.
 */
const MESHLINE_END_CAP_TESTS = [
	{ source: 'nextP == currentP', neighbour: 'nextP' },
	{ source: 'prevP == currentP', neighbour: 'prevP' },
] as const;

/**
 * Devuelve el vertex shader de meshline con los extremos detectados por DISTANCIA (`< tolerance`)
 * en vez de por igualdad exacta, o `undefined` si el shader no contiene exactamente una vez cada
 * comparación (meshline ha cambiado): todo o nada, nunca un parche a medias.
 *
 * Por qué: `currentP` sale de `(aspect·X) / (aspect·W)` y `nextP`/`prevP` de `X / W`. En float32
 * no son bit a bit iguales, el `==` falla en el extremo, el shader normaliza una diferencia de
 * ruido (~1e-7) y la normal del último par de vértices gira al azar en cada frame. El `* aspect`
 * de `finalPosition` NO se toca: compensa el offset de la normal y fija el ancho de la correa.
 */
export function patchMeshLineEndCaps(vertexShader: string, tolerance: number): string | undefined {
	// toExponential() siempre da un literal float válido en GLSL ("1e-4", "1e+0"); String(1) no.
	const literal = tolerance.toExponential();
	let patched = vertexShader;
	for (const { source, neighbour } of MESHLINE_END_CAP_TESTS) {
		if (patched.split(source).length !== 2) {
			return undefined;
		}
		patched = patched.replace(source, `distance(${neighbour}, currentP) < ${literal}`);
	}
	return patched;
}

/**
 * Aplica `patchMeshLineEndCaps` al `vertexShader` del material. Si el patrón no está, deja el
 * shader intacto (el material sigue funcionando, con el defecto de origen) y avisa en dev.
 * Devuelve si se aplicó.
 */
export function applyBandEndCapPatch(
	material: ShaderMaterial,
	tolerance: number = BADGE_BAND.endCapTolerance,
): boolean {
	const patched = patchMeshLineEndCaps(material.vertexShader, tolerance);
	if (patched === undefined) {
		if (ngDevMode) {
			console.warn(
				'[ngx-products-3d] badge: el vertex shader de meshline ya no tiene las comparaciones de extremo esperadas (nextP == currentP / prevP == currentP); la correa se dibuja sin el parche de extremos y su final puede parpadear. Revisa la versión de meshline.',
			);
		}
		return false;
	}
	material.vertexShader = patched;
	return true;
}

/**
 * Material de la correa: `MeshLineMaterial` con los extremos detectados con tolerancia
 * (`applyBandEndCapPatch`). Mismos uniforms y propiedades que el original. Se reescribe la fuente
 * y no se usa `onBeforeCompile`: three indexa el programa por el texto del shader, así que no
 * comparte programa con un `MeshLineMaterial` sin parchear ni necesita `customProgramCacheKey`.
 */
export class BadgeBandMaterial extends MeshLineMaterial {
	constructor(parameters?: MeshLineMaterialParameters) {
		// angular-three instancia los elementos sin argumentos; meshline acepta undefined en runtime
		// (setValues(undefined) no hace nada), aunque su .d.ts lo declare obligatorio.
		super(parameters as MeshLineMaterialParameters);
		applyBandEndCapPatch(this);
	}
}

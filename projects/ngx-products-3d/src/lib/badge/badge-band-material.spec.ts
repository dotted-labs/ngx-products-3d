import { ShaderMaterial, Texture, Vector2 } from 'three';
import { MeshLineMaterial } from 'meshline';
import {
	applyBandEndCapPatch,
	BadgeBandMaterial,
	patchMeshLineEndCaps,
} from './badge-band-material';
import { BADGE_BAND } from './badge.config';

const EXACT_END_TESTS = ['nextP == currentP', 'prevP == currentP'];

/** Vertex shader REAL de meshline (el de la versión instalada), sin parchear. */
function meshlineVertexShader(): string {
	return new MeshLineMaterial(undefined as never).vertexShader;
}

function occurrences(haystack: string, needle: string): number {
	return haystack.split(needle).length - 1;
}

/** Literal float de GLSL ES: con punto decimal o con exponente (un entero a secas no compila). */
const GLSL_FLOAT = /^((\d+\.\d*|\.\d+)([eE][+-]?\d+)?|\d+[eE][+-]?\d+)$/;

describe('patchMeshLineEndCaps', () => {
	it('finds each exact end-cap comparison exactly once in the installed meshline shader', () => {
		// Centinela de versión: si meshline cambia estas líneas, este test cae antes de que el
		// parche deje de aplicarse en silencio.
		const source = meshlineVertexShader();

		for (const test of EXACT_END_TESTS) {
			expect(occurrences(source, test)).toBe(1);
		}
	});

	it('replaces both exact comparisons with a tolerance distance on the REAL meshline shader', () => {
		const patched = patchMeshLineEndCaps(meshlineVertexShader(), 1e-4);

		expect(patched).toBeDefined();
		for (const test of EXACT_END_TESTS) {
			expect(patched).not.toContain(test);
		}
		expect(patched).toContain(
			'if (distance(nextP, currentP) < 1e-4) dir = normalize(currentP - prevP);',
		);
		expect(patched).toContain(
			'else if (distance(prevP, currentP) < 1e-4) dir = normalize(nextP - currentP);',
		);
	});

	it('touches nothing else: width scaling (* aspect) and the rest of the shader stay intact', () => {
		const source = meshlineVertexShader();
		const patched = patchMeshLineEndCaps(source, 1e-4) ?? '';

		// Deshacer las dos sustituciones devuelve el original byte a byte.
		const reverted = patched
			.replace('distance(nextP, currentP) < 1e-4', 'nextP == currentP')
			.replace('distance(prevP, currentP) < 1e-4', 'prevP == currentP');
		expect(reverted).toBe(source);
		expect(patched).toContain('vec4 finalPosition = m * vec4(position, 1.0) * aspect;');
	});

	it('writes the tolerance as a valid GLSL float literal, also for integral values', () => {
		for (const tolerance of [1e-4, 2.5e-5, 1]) {
			const patched = patchMeshLineEndCaps(meshlineVertexShader(), tolerance) ?? '';
			const literal = /distance\(nextP, currentP\) < ([^)\s]+)\)/.exec(patched)?.[1] ?? '';

			expect(literal).toMatch(GLSL_FLOAT);
			expect(Number(literal)).toBe(tolerance);
		}
	});

	it('returns undefined when the shader has no end-cap comparisons (meshline changed)', () => {
		expect(patchMeshLineEndCaps('void main() { gl_Position = vec4(0.0); }', 1e-4)).toBeUndefined();
	});

	it('is all-or-nothing: a shader with only one of the comparisons is not half-patched', () => {
		const onlyNext = meshlineVertexShader().replace('prevP == currentP', 'prevP.x > 0.0');

		expect(patchMeshLineEndCaps(onlyNext, 1e-4)).toBeUndefined();
	});

	it('refuses an ambiguous shader where a comparison appears more than once', () => {
		const twice = `${meshlineVertexShader()}\n// nextP == currentP`;

		expect(patchMeshLineEndCaps(twice, 1e-4)).toBeUndefined();
	});
});

describe('applyBandEndCapPatch', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('patches the material in place and reports it', () => {
		const material = new ShaderMaterial({ vertexShader: meshlineVertexShader() });

		expect(applyBandEndCapPatch(material)).toBe(true);
		expect(material.vertexShader).not.toContain('nextP == currentP');
	});

	it('warns in dev and leaves the shader untouched when the pattern is missing', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		const vertexShader = 'void main() { gl_Position = vec4(0.0); }';
		const material = new ShaderMaterial({ vertexShader });

		expect(applyBandEndCapPatch(material)).toBe(false);
		expect(material.vertexShader).toBe(vertexShader);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toMatch(/^\[ngx-products-3d\] .*meshline/);
	});
});

describe('BadgeBandMaterial', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('is a MeshLineMaterial whose vertex shader detects the ends with BADGE_BAND.endCapTolerance', () => {
		const material = new BadgeBandMaterial();

		expect(material).toBeInstanceOf(MeshLineMaterial);
		for (const test of EXACT_END_TESTS) {
			expect(material.vertexShader).not.toContain(test);
		}
		expect(material.vertexShader).toBe(
			patchMeshLineEndCaps(meshlineVertexShader(), BADGE_BAND.endCapTolerance),
		);
	});

	it('patches the real shader without warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		new BadgeBandMaterial();

		expect(warn).not.toHaveBeenCalled();
	});

	it('keeps the fragment shader and the uniform set of MeshLineMaterial', () => {
		const original = new MeshLineMaterial(undefined as never);
		const material = new BadgeBandMaterial();

		expect(material.fragmentShader).toBe(original.fragmentShader);
		expect(Object.keys(material.uniforms).sort()).toEqual(Object.keys(original.uniforms).sort());
	});

	it('routes the scene bindings to the same uniforms and properties as MeshLineMaterial', () => {
		const material = new BadgeBandMaterial();
		const map = new Texture();

		material.map = map;
		material.useMap = 1;
		material.repeat = new Vector2(-1.3, 1);
		material.lineWidth = 2;
		material.resolution = new Vector2(800, 600);
		material.color.set('#ff0055');
		material.depthTest = false;
		material.transparent = true;

		expect(material.uniforms['map'].value).toBe(map);
		expect(material.uniforms['useMap'].value).toBe(1);
		expect(material.uniforms['repeat'].value.toArray()).toEqual([-1.3, 1]);
		expect(material.uniforms['lineWidth'].value).toBe(2);
		expect(material.uniforms['resolution'].value.toArray()).toEqual([800, 600]);
		expect(material.uniforms['color'].value.getHexString()).toBe('ff0055');
		expect(material.depthTest).toBe(false);
		expect(material.transparent).toBe(true);
	});

	it('keeps the patch through clone()', () => {
		const clone = new BadgeBandMaterial().clone();

		expect(clone).toBeInstanceOf(BadgeBandMaterial);
		expect(clone.vertexShader).not.toContain('nextP == currentP');
	});
});

import { BADGE_FRONT_FACE, BADGE_PHYSICS, BADGE_TEXTURE } from './badge.config';

/**
 * Ratio de la cara frontal de la tarjeta, FIJADO A MANO desde el contrato del GLB
 * (`membresia.glb`: accessor POSITION de `cardMesh` X[-0.8, 0.8] · Y[-1.125, 1.125] → 1.6 × 2.25,
 * y su UV 0-1 cubre esa cara entera). Es el ancla INDEPENDIENTE de estos tests: no se calcula desde
 * la config, así que cualquier desalineación —cambiar los half-extents, el FBO o el frustum sin
 * tocar los otros dos— rompe la comparación y obliga a revisar el modelo.
 */
const GLB_FRONT_FACE_ASPECT = 32 / 45;

/** Tolerancia del invariante: 1e-9 (los tres ratios deben coincidir salvo error de coma flotante). */
const ASPECT_TOLERANCE = 1e-9;

describe('BADGE_FRONT_FACE', () => {
	it('derives the front face rect from BADGE_PHYSICS.cardColliderHalfExtents', () => {
		const [halfWidth, halfHeight] = BADGE_PHYSICS.cardColliderHalfExtents;

		expect(BADGE_FRONT_FACE.halfWidth).toBe(halfWidth);
		expect(BADGE_FRONT_FACE.halfHeight).toBe(halfHeight);
		expect(BADGE_FRONT_FACE.width).toBe(halfWidth * 2);
		expect(BADGE_FRONT_FACE.height).toBe(halfHeight * 2);
	});

	it('measures 1.6 x 2.25 world units (the GLB card face contract)', () => {
		expect(BADGE_FRONT_FACE.width).toBeCloseTo(1.6, 10);
		expect(BADGE_FRONT_FACE.height).toBeCloseTo(2.25, 10);
	});
});

describe('front face aspect ratio invariant (FBO == frustum == GLB face)', () => {
	const faceAspect = BADGE_FRONT_FACE.width / BADGE_FRONT_FACE.height;
	const fboAspect = BADGE_TEXTURE.width / BADGE_TEXTURE.height;
	const { left, right, top, bottom } = BADGE_TEXTURE.cameraFrustum;
	const frustumAspect = (right - left) / (top - bottom);

	it('keeps the GLB card face at 32:45', () => {
		expect(faceAspect).toBeCloseTo(GLB_FRONT_FACE_ASPECT, 10);
	});

	it('keeps the render texture FBO at 32:45 (1600 x 2250 px, 1000 px per world unit)', () => {
		expect(BADGE_TEXTURE.width).toBe(1600);
		expect(BADGE_TEXTURE.height).toBe(2250);
		expect(fboAspect).toBeCloseTo(GLB_FRONT_FACE_ASPECT, 10);
	});

	it('keeps the RT camera frustum at 32:45', () => {
		expect(frustumAspect).toBeCloseTo(GLB_FRONT_FACE_ASPECT, 10);
	});

	it('aligns the three chained aspect ratios with each other', () => {
		// El invariante de spec-03-F4v2: mientras las tres coincidan, un píxel del FBO es un
		// cuadrado en la cara de la tarjeta y nada se estira. Comparación cruzada (no solo contra
		// el literal) para que romper cualquiera de las tres haga caer este test.
		expect(Math.abs(fboAspect - frustumAspect)).toBeLessThan(ASPECT_TOLERANCE);
		expect(Math.abs(frustumAspect - faceAspect)).toBeLessThan(ASPECT_TOLERANCE);
		expect(Math.abs(fboAspect - faceAspect)).toBeLessThan(ASPECT_TOLERANCE);
	});

	it('frames the front face exactly with the orthographic frustum (no crop, no margin)', () => {
		// No basta el ratio: el frustum tiene que encuadrar la cara COMPLETA y centrada en el
		// origen (el origen del GLB es el centro de la tarjeta), o el arte saldría recortado o
		// con banda muerta aun con el aspecto correcto.
		expect(left).toBe(-BADGE_FRONT_FACE.halfWidth);
		expect(right).toBe(BADGE_FRONT_FACE.halfWidth);
		expect(top).toBe(BADGE_FRONT_FACE.halfHeight);
		expect(bottom).toBe(-BADGE_FRONT_FACE.halfHeight);
		expect(right - left).toBe(BADGE_FRONT_FACE.width);
		expect(top - bottom).toBe(BADGE_FRONT_FACE.height);
	});
});

describe('BADGE_TEXTURE front layers', () => {
	it('sizes both front quads exactly like the card front face', () => {
		const [width, height] = BADGE_TEXTURE.frontPlaneSize;

		expect(width).toBe(BADGE_FRONT_FACE.width);
		expect(height).toBe(BADGE_FRONT_FACE.height);
	});

	it('fills the orthographic frustum edge to edge (no dead bands, no crop)', () => {
		// El defecto que cierra spec-03-F4v2 T4: el plano anterior medía 5 × 5 contra un frustum de
		// 1.6 × 2.25, así que el arte del tier se veía recortado por los cuatro lados.
		const { left, right, top, bottom } = BADGE_TEXTURE.cameraFrustum;
		const [width, height] = BADGE_TEXTURE.frontPlaneSize;

		expect(width).toBeCloseTo(right - left, 10);
		expect(height).toBeCloseTo(top - bottom, 10);
	});

	it('stacks the tier art in front of the opaque baseColor quad', () => {
		const [backdropX, backdropY, backdropZ] = BADGE_TEXTURE.backdropPosition;
		const [artX, artY, artZ] = BADGE_TEXTURE.artPosition;

		// Ambas capas centradas en el origen, que es donde el frustum encuadra la cara.
		expect([backdropX, backdropY]).toEqual([0, 0]);
		expect([artX, artY]).toEqual([0, 0]);
		// La cámara mira -Z desde z > 0 → el arte va DELANTE del fondo opaco. Con el orden
		// invertido, el quad de baseColor taparía el arte del tier (frente de color plano).
		expect(artZ).toBeGreaterThan(backdropZ);
		// ...y delante de la cámara, no detrás (ni fuera del frustum de profundidad).
		expect(BADGE_TEXTURE.cameraPosition[2]).toBeGreaterThan(artZ);
	});
});

describe('BADGE_TEXTURE map transform', () => {
	it('keeps the V inversion of the card map (v -> 1 - v)', () => {
		// Regresión explícitamente prohibida por spec-03-F4v2 R1: borrar repeat/offset al rehacer
		// la escena RT deja el frente del socio espejado en vertical (UV glTF vs orientación GL
		// del render target). Se ancla aquí, en la config, además de en la escena.
		const [repeatU, repeatV] = BADGE_TEXTURE.mapRepeat;
		const [offsetU, offsetV] = BADGE_TEXTURE.mapOffset;

		expect(offsetV + 0 * repeatV).toBe(1);
		expect(offsetV + 1 * repeatV).toBe(0);
		expect(offsetU + 0 * repeatU).toBe(0);
		expect(offsetU + 1 * repeatU).toBe(1);
	});
});

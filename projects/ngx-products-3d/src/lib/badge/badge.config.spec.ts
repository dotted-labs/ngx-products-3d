import {
	bandRepeatFor,
	BADGE_BAND,
	BADGE_CAMERA,
	BADGE_FRONT_FACE,
	BADGE_PHYSICS,
	BADGE_TEXT_LAYOUT,
	BADGE_TEXTURE,
	type BadgeTextField,
	type BadgeTextSlot,
} from './badge.config';

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

describe('BADGE_TEXT_LAYOUT', () => {
	/** Slot del layout publicado, por campo (el orden del array es el de render, no el de lectura). */
	function slotFor(field: BadgeTextField): BadgeTextSlot {
		const slot = BADGE_TEXT_LAYOUT.find((candidate) => candidate.field === field);
		if (!slot) {
			throw new Error(`No hay slot para el campo '${field}' en BADGE_TEXT_LAYOUT`);
		}
		return slot;
	}

	it('covers the three member fields exactly once', () => {
		expect(BADGE_TEXT_LAYOUT.map((slot) => slot.field).sort()).toEqual([
			'memberNumber',
			'name',
			'tier',
		]);
	});

	it('replaces the absolute position/rotation of each slot with anchor + align', () => {
		// La forma vieja (position/rotation en unidades de mundo) quedó atada al encuadre anterior:
		// con el frustum de 1.6 × 2.25 esos valores mandaban los textos fuera de cuadro. Si alguien
		// los reintroduce, la colocación pasa a tener dos fuentes y este test cae.
		for (const slot of BADGE_TEXT_LAYOUT) {
			expect(slot).not.toHaveProperty('position');
			expect(slot).not.toHaveProperty('rotation');
			expect(slot.anchor).toHaveLength(2);
			expect(slot.align).toBe('left');
			expect(slot.size).toBeGreaterThan(0);
			expect(slot.height).toBeGreaterThan(0);
			expect(slot.maxWidth).toBeGreaterThan(0);
		}
	});

	it('anchors every slot inside the front face (normalized 0-1)', () => {
		for (const slot of BADGE_TEXT_LAYOUT) {
			const [u, v] = slot.anchor;

			expect(u).toBeGreaterThanOrEqual(0);
			expect(u).toBeLessThanOrEqual(1);
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThanOrEqual(1);
		}
	});

	it('places name and memberNumber at the BOTTOM-LEFT of the face', () => {
		// El anchor tiene el origen abajo-izquierda: u < 0.5 es la mitad izquierda y v < 0.5 la mitad
		// inferior (spec-04 R3). Es la mitad INFERIOR de la tarjeta porque la escena RT tiene
		// +Y arriba, no la V del GLB.
		for (const field of ['name', 'memberNumber'] as const) {
			const [u, v] = slotFor(field).anchor;

			expect(u).toBeLessThan(0.5);
			expect(v).toBeLessThan(0.5);
		}
	});

	it('stacks the tier above name and memberNumber, flush to the same left edge', () => {
		const tier = slotFor('tier');
		const name = slotFor('name');
		const memberNumber = slotFor('memberNumber');

		expect(tier.anchor[1]).toBeGreaterThan(name.anchor[1]);
		expect(name.anchor[1]).toBeGreaterThan(memberNumber.anchor[1]);
		// Misma U en los tres = bandera por la izquierda (con align 'left', el borde izquierdo común).
		expect(tier.anchor[0]).toBe(name.anchor[0]);
		expect(memberNumber.anchor[0]).toBe(name.anchor[0]);
	});

	it('keeps every slot inside the face even at its full maxWidth', () => {
		// Con align 'left' el texto ocupa [anchorX, anchorX + maxWidth]: un maxWidth mayor que el
		// hueco disponible sacaría el texto por el borde derecho de la tarjeta.
		for (const slot of BADGE_TEXT_LAYOUT) {
			const anchorX = (slot.anchor[0] - 0.5) * BADGE_FRONT_FACE.width;

			expect(anchorX).toBeGreaterThanOrEqual(-BADGE_FRONT_FACE.halfWidth);
			expect(anchorX + slot.maxWidth).toBeLessThanOrEqual(BADGE_FRONT_FACE.halfWidth);
		}
	});

	it('draws the texts in front of the tier art and inside the depth frustum', () => {
		expect(BADGE_TEXTURE.textLayerZ).toBeGreaterThan(BADGE_TEXTURE.artPosition[2]);
		expect(BADGE_TEXTURE.artPosition[2]).toBeGreaterThan(BADGE_TEXTURE.backdropPosition[2]);
		// Extrusión incluida (los textos crecen hacia +z), siguen muy por delante de la cámara.
		const deepest = Math.max(...BADGE_TEXT_LAYOUT.map((slot) => slot.height));
		expect(BADGE_TEXTURE.textLayerZ + deepest).toBeLessThan(BADGE_TEXTURE.cameraPosition[2]);
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

describe('bandRepeatFor', () => {
	/**
	 * ANCLA de la derivación: `-3.383` es el valor que estuvo precalculado A MANO en
	 * `BADGE_BAND.repeat` desde spec-03-F3 (con el arte de referencia 4:1, `band.jpg` 1024×256).
	 * Fijado como literal a propósito: es independiente de la config, así que si la fn deja de
	 * reproducirlo, la derivación se inventó algo.
	 */
	const HAND_DERIVED_REFERENCE_REPEAT_X = -3.383;

	it('reproduces the hand-derived -3.383 for the 4:1 reference artwork', () => {
		expect(bandRepeatFor(4)[0]).toBeCloseTo(HAND_DERIVED_REFERENCE_REPEAT_X, 3);
	});

	it('derives the tiling from the camera fov and the band geometry, not from a literal', () => {
		// Misma invariante geométrica, escrita desde las constantes: con sizeAttenuation (default de
		// meshline) el ancho de la correa en unidades de mundo es lineWidth * tan(fov/2), NO
		// lineWidth; el largo son los rope joints de la cadena. Discrimina un fov o un lineWidth
		// cambiados sin recalcular (que era justo lo que se degradaba en silencio antes).
		const bandWidth = BADGE_BAND.lineWidth * Math.tan((BADGE_CAMERA.fov * Math.PI) / 360);
		const bandLength = BADGE_BAND.ropeJoints * BADGE_PHYSICS.segmentLength;

		expect(bandRepeatFor(4)[0]).toBeCloseTo(-(bandLength / (4 * bandWidth)), 12);
		expect(bandRepeatFor(16)[0]).toBeCloseTo(-(bandLength / (16 * bandWidth)), 12);
	});

	it('tiles a 16:1 strip four times less than a 4:1 one (same band, longer artwork)', () => {
		// El aspecto entra de verdad en la cuenta: cuádruple de tesela, cuarto de repeticiones.
		expect(bandRepeatFor(16)[0]).toBeCloseTo(bandRepeatFor(4)[0] / 4, 12);
		expect(bandRepeatFor(16)[0]).toBeCloseTo(-0.846, 3);
	});

	it('always keeps the U inverted (negative X) and the V untiled (exactly 1)', () => {
		// El signo negativo es la inversión de la U (orientación del arte del lanyard, spec-03
		// feature 4): no depende del asset y no se pierde en ningún camino, ni en el de fallback.
		for (const aspect of [0.5, 1, 4, 16, 1024, 0, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
			const [x, y] = bandRepeatFor(aspect);
			expect(x).toBeLessThan(0);
			expect(y).toBe(1);
		}
	});

	it('falls back to the reference aspect for unmeasurable aspects, never NaN', () => {
		// Un NaN en el uniform deja la correa sin textura sin decir por qué: 0, NaN, negativo o
		// infinito degradan al teselado del arte de referencia.
		const reference = bandRepeatFor(BADGE_BAND.referenceTextureAspect);

		for (const aspect of [0, -4, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
			expect(bandRepeatFor(aspect)).toEqual(reference);
			expect(Number.isNaN(bandRepeatFor(aspect)[0])).toBe(false);
		}
		// El fallback es el valor de referencia de siempre, no un cero disfrazado.
		expect(reference[0]).toBeCloseTo(HAND_DERIVED_REFERENCE_REPEAT_X, 3);
	});

	it('keeps BADGE_BAND.referenceTextureAspect at the 4:1 of the reference artwork', () => {
		expect(BADGE_BAND.referenceTextureAspect).toBe(1024 / 256);
	});
});

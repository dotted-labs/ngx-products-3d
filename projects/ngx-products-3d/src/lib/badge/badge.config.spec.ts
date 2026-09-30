import { PerspectiveCamera, Vector3 } from 'three';
import type { Products3dBadgeCamera } from '../types';
import { badgeAnchorClearance, maxBadgeCameraDistance } from './badge-camera';
import {
	badgeDropLayout,
	bandRepeatFor,
	BADGE_BAND,
	BADGE_CAMERA,
	BADGE_CAMERA_DEFAULTS,
	BADGE_CAMERA_LIMITS,
	BADGE_CARD_MODEL,
	BADGE_DROP,
	BADGE_FRONT_FACE,
	BADGE_LAYOUT,
	BADGE_LOADING,
	BADGE_LOOP_PRIORITY,
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
	 * `BADGE_BAND.repeat` desde spec-03-F3, cuando el arte de correa era 4:1 (asset ya retirado).
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

	describe('with the ACTIVE camera fov (badge-center-camera)', () => {
		it('defaults the fov to BADGE_CAMERA.fov (same tiling as before the camera input)', () => {
			expect(bandRepeatFor(4)).toEqual(bandRepeatFor(4, BADGE_CAMERA.fov));
			expect(bandRepeatFor(4, 25)[0]).toBeCloseTo(HAND_DERIVED_REFERENCE_REPEAT_X, 3);
		});

		it('derives the band width from the fov it receives, not from the constant', () => {
			// Ancho en mundo = lineWidth * tan(fov/2), escrito a mano para 15° (ancla independiente de
			// la fn). Con 15° la correa es más estrecha ⇒ cada tesela más corta ⇒ MÁS repeticiones.
			const narrowWidth = BADGE_BAND.lineWidth * Math.tan((15 * Math.PI) / 360);
			const bandLength = BADGE_BAND.ropeJoints * BADGE_PHYSICS.segmentLength;

			expect(bandRepeatFor(4, 15)[0]).toBeCloseTo(-(bandLength / (4 * narrowWidth)), 12);
			expect(bandRepeatFor(4, 15)[0]).toBeCloseTo(-5.697, 3);
			expect(Math.abs(bandRepeatFor(4, 15)[0])).toBeGreaterThan(Math.abs(bandRepeatFor(4)[0]));
			expect(Math.abs(bandRepeatFor(4, 40)[0])).toBeLessThan(Math.abs(bandRepeatFor(4)[0]));
		});

		it('falls back to BADGE_CAMERA.fov for an unusable fov, never NaN', () => {
			for (const fov of [
				0,
				-25,
				Number.NaN,
				Number.POSITIVE_INFINITY,
				BADGE_CAMERA_LIMITS.maxFov,
				180,
			]) {
				expect(bandRepeatFor(4, fov)).toEqual(bandRepeatFor(4));
			}
		});

		it('also falls back for a positive but degenerate fov (below minFov), never Infinity', () => {
			// Sin cota inferior, tan(fov/2) → 0 y el teselado salía −Infinity (review ronda 1).
			for (const fov of [
				Number.MIN_VALUE,
				1e-310,
				1e-6,
				BADGE_CAMERA_LIMITS.minFov - 1e-9,
			]) {
				expect(bandRepeatFor(4, fov)).toEqual(bandRepeatFor(4));
				expect(Number.isFinite(bandRepeatFor(4, fov)[0])).toBe(true);
			}
			// El mínimo mismo es válido (incluido): no cae al default.
			expect(bandRepeatFor(4, BADGE_CAMERA_LIMITS.minFov)).not.toEqual(bandRepeatFor(4));
			expect(Number.isFinite(bandRepeatFor(4, BADGE_CAMERA_LIMITS.minFov)[0])).toBe(true);
		});

		it('keeps the tiling finite for a positive but degenerate aspect (reference aspect)', () => {
			for (const aspect of [Number.MIN_VALUE, 1e-310]) {
				expect(bandRepeatFor(aspect)).toEqual(bandRepeatFor(BADGE_BAND.referenceTextureAspect));
			}
		});
	});
});

/**
 * Huecos pasantes del `clamp` de `membresia.glb` en el eje x = 0, FIJADOS A MANO desde el GLB
 * (transform del nodo aplicado; intersección de sus triángulos con el plano x = 0). Anclas
 * INDEPENDIENTES de `BADGE_CARD_MODEL.bandAttachPoint`: si alguien lo mueve fuera de la ranura, o
 * cambia el modelo sin revisar el punto, estos tests caen.
 */
const CLAMP_SLOT_Y: [number, number] = [1.458, 1.5];
const CLAMP_LOOP_Y: [number, number] = [1.176, 1.298];
/** Ancho de la ranura a media altura (X[-0.123, 0.128]) y ancho máx. del ojal (X[-0.108, 0.109]). */
const CLAMP_SLOT_WIDTH = 0.251;
const CLAMP_LOOP_WIDTH = 0.218;

describe('BADGE_CARD_MODEL.bandAttachPoint (band end at the clamp slot)', () => {
	const [x, y, z] = BADGE_CARD_MODEL.bandAttachPoint;

	it('sits inside the upper slot of the clamp, where the strap goes through', () => {
		expect(y).toBeGreaterThan(CLAMP_SLOT_Y[0]);
		expect(y).toBeLessThan(CLAMP_SLOT_Y[1]);
		expect(y).toBeCloseTo((CLAMP_SLOT_Y[0] + CLAMP_SLOT_Y[1]) / 2, 3);
	});

	it('is centred on the card axis and on the clamp plane', () => {
		expect(x).toBe(0);
		expect(z).toBe(0);
	});

	it('is not the physical joint anchor: it sits above the clip top, out of the lower loop', () => {
		// El clip engancha en el ojal inferior (su top, cardJointAnchor, cae dentro del ojal); la
		// correa pasa por la ranura de arriba. Confundirlos devolvería el extremo a j3/el clip.
		expect(BADGE_PHYSICS.cardJointAnchor[1]).toBeGreaterThan(CLAMP_LOOP_Y[0]);
		expect(BADGE_PHYSICS.cardJointAnchor[1]).toBeLessThan(CLAMP_LOOP_Y[1]);
		expect(y).toBeGreaterThan(CLAMP_LOOP_Y[1]);
		expect(y).toBeGreaterThan(BADGE_PHYSICS.cardJointAnchor[1]);
	});

	it('picks the only opening the strap fits through (band width vs slot/loop width)', () => {
		// Ancho real de la correa en mundo: lineWidth * tan(fov/2) (ver BADGE_BAND.lineWidth).
		const bandWidth = BADGE_BAND.lineWidth * Math.tan((BADGE_CAMERA.fov * Math.PI) / 360);

		expect(bandWidth).toBeLessThan(CLAMP_SLOT_WIDTH);
		expect(bandWidth).toBeGreaterThan(CLAMP_LOOP_WIDTH);
	});
});

describe('BADGE_LOOP_PRIORITY (frame order: input -> physics step -> band)', () => {
	it('runs the physics input before the Rapier step and the band after it', () => {
		expect(BADGE_LOOP_PRIORITY.input).toBeLessThan(BADGE_LOOP_PRIORITY.physicsStep);
		expect(BADGE_LOOP_PRIORITY.physicsStep).toBeLessThan(BADGE_LOOP_PRIORITY.band);
	});

	it('never takes over the render loop (angular-three renders manually above priority 0)', () => {
		for (const priority of Object.values(BADGE_LOOP_PRIORITY)) {
			expect(priority).toBeLessThanOrEqual(0);
		}
	});
});

/**
 * Máxima discrepancia entre las dos proyecciones de un MISMO punto en el shader de meshline
 * (`(aspect·X) / (aspect·W)` frente a `X / W`), FIJADA A MANO emulando float32 con `Math.fround`
 * sobre 1e6 puntos del encuadre de la correa: 4.8e-7. Ancla independiente de la config.
 */
const FLOAT32_PROJECTION_NOISE = 5e-7;

describe('BADGE_BAND.endCapTolerance (band end-cap detection in the vertex shader)', () => {
	it('stays at least 100 times above the float32 noise of the exact comparison it replaces', () => {
		expect(BADGE_BAND.endCapTolerance).toBeGreaterThanOrEqual(100 * FLOAT32_PROJECTION_NOISE);
	});

	it('stays at least 100 times below the projected length of a real band segment', () => {
		// Espacio del shader: xy / w con la X por el aspecto → isótropo, 1 = media altura del
		// encuadre, que a la distancia de la cámara mide distance · tan(fov/2) uds de mundo.
		const segment =
			(BADGE_BAND.ropeJoints * BADGE_PHYSICS.segmentLength) / BADGE_PHYSICS.curvePoints;
		const halfHeight = BADGE_CAMERA.position[2] * Math.tan((BADGE_CAMERA.fov * Math.PI) / 360);

		expect(BADGE_BAND.endCapTolerance).toBeLessThanOrEqual(segment / halfHeight / 100);
	});

	it('stays 100 times below a band segment with the widest view any configured camera gets', () => {
		// La vista más abierta que acepta el badge deja el anclaje justo en su holgura (medio ancho de
		// la correa + anchorMargin). Cota superior, sin el medio ancho: anclajeY − anchorMargin − camY.
		const segment =
			(BADGE_BAND.ropeJoints * BADGE_PHYSICS.segmentLength) / BADGE_PHYSICS.curvePoints;
		const [, anchorY] = BADGE_LAYOUT.fixedPosition;
		const widestHalfHeight = anchorY - BADGE_CAMERA_LIMITS.anchorMargin - BADGE_CAMERA.position[1];

		expect(BADGE_BAND.endCapTolerance).toBeLessThanOrEqual(segment / widestHalfHeight / 100);
	});
});

type Tuple3 = readonly [number, number, number];

function distance(a: Tuple3, b: Tuple3): number {
	return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

describe('BADGE_LAYOUT (rest pose, the reduced-motion start)', () => {
	it('hangs the card with its joint anchor exactly on j3 (the spherical joint starts satisfied)', () => {
		const { cardPosition, j3Position } = BADGE_LAYOUT;
		const anchor = BADGE_PHYSICS.cardJointAnchor;

		for (let axis = 0; axis < 3; axis++) {
			expect(cardPosition[axis] + anchor[axis]).toBeCloseTo(j3Position[axis], 10);
		}
	});

	it('hangs the chain straight down from the fixed anchor with every rope taut', () => {
		const { fixedPosition, j1Position, j2Position, j3Position } = BADGE_LAYOUT;
		const chain = [fixedPosition, j1Position, j2Position, j3Position];

		chain.slice(1).forEach((body, i) => {
			expect(distance(body, chain[i])).toBeCloseTo(BADGE_PHYSICS.segmentLength, 10);
			expect(body[0]).toBe(fixedPosition[0]);
			expect(body[1]).toBeLessThan(chain[i][1]);
		});
	});

	it('no longer places the card sideways (the old [2, 0, 0] made it swing on every load)', () => {
		expect(BADGE_LAYOUT.cardPosition[0]).toBe(BADGE_LAYOUT.fixedPosition[0]);
		expect(BADGE_LAYOUT.cardPosition).not.toEqual([2, 0, 0]);
	});

	it('hangs every body centred on x = 0, the camera axis (no x = 0.5 left from 0.3.1)', () => {
		const { fixedPosition, j1Position, j2Position, j3Position, cardPosition } = BADGE_LAYOUT;

		for (const body of [fixedPosition, j1Position, j2Position, j3Position, cardPosition]) {
			expect(body[0]).toBe(0);
			expect(body[0]).toBe(BADGE_CAMERA.position[0]);
		}
	});

	it('shows the resting card centred on screen with the default camera', () => {
		// Proyección real: el centro de la tarjeta cae en el centro horizontal del viewport.
		const camera = new PerspectiveCamera(BADGE_CAMERA.fov, 16 / 9, 0.1, 100);
		camera.position.set(...BADGE_CAMERA.position);
		camera.updateMatrixWorld();

		expect(new Vector3(...BADGE_LAYOUT.cardPosition).project(camera).x).toBeCloseTo(0, 12);
	});

	it('keeps the fixed anchor (the cut end of the band) above the default viewport', () => {
		const camera = new PerspectiveCamera(BADGE_CAMERA.fov, 1, 0.1, 100);
		camera.position.set(...BADGE_CAMERA.position);
		camera.updateMatrixWorld();

		expect(new Vector3(...BADGE_LAYOUT.fixedPosition).project(camera).y).toBeGreaterThan(1);
	});
});

describe('BADGE_CAMERA_DEFAULTS / BADGE_CAMERA_LIMITS', () => {
	it('mirrors BADGE_CAMERA in the shape of the camera input', () => {
		expect(BADGE_CAMERA_DEFAULTS).toEqual({ fov: 25, distance: 13 });
		expect(BADGE_CAMERA_DEFAULTS.fov).toBe(BADGE_CAMERA.fov);
		expect(BADGE_CAMERA_DEFAULTS.distance).toBe(BADGE_CAMERA.position[2]);
	});

	it('accepts the default camera itself (it does not show the band anchor)', () => {
		expect(BADGE_CAMERA_DEFAULTS.fov).toBeLessThan(BADGE_CAMERA_LIMITS.maxFov);
		expect(BADGE_CAMERA_DEFAULTS.distance).toBeLessThan(
			maxBadgeCameraDistance(BADGE_CAMERA_DEFAULTS.fov),
		);
	});

	it('leaves room above the camera for the anchor clearance, even at the widest fov', () => {
		// La holgura crece con el fov (medio ancho de la correa): la peor es justo por debajo de maxFov.
		expect(BADGE_CAMERA_LIMITS.anchorMargin).toBeGreaterThan(0);
		expect(
			BADGE_LAYOUT.fixedPosition[1] - badgeAnchorClearance(BADGE_CAMERA_LIMITS.maxFov),
		).toBeGreaterThan(BADGE_CAMERA.position[1]);
	});

	it('bounds the fov on both sides: a positive minimum and a range that contains the default', () => {
		expect(BADGE_CAMERA_LIMITS.minFov).toBeGreaterThan(0);
		expect(BADGE_CAMERA_LIMITS.minFov).toBeLessThanOrEqual(BADGE_CAMERA_DEFAULTS.fov);
		expect(BADGE_CAMERA_DEFAULTS.fov).toBeLessThan(BADGE_CAMERA_LIMITS.maxFov);
	});
});

describe('BADGE_CARD_MODEL.bounds (whole model AABB)', () => {
	it('encloses the card collider, the clip top where the joint grabs and the band slot', () => {
		const { min, max } = BADGE_CARD_MODEL.bounds;
		const half = BADGE_PHYSICS.cardColliderHalfExtents;

		for (let axis = 0; axis < 3; axis++) {
			expect(min[axis]).toBeLessThanOrEqual(-half[axis]);
			expect(max[axis]).toBeGreaterThanOrEqual(half[axis]);
		}
		expect(max[1]).toBeGreaterThanOrEqual(BADGE_PHYSICS.cardJointAnchor[1]);
		expect(max[1]).toBeGreaterThanOrEqual(BADGE_CARD_MODEL.bandAttachPoint[1]);
	});

	it('reaches the top of the clamp (y 1.564 in membresia.glb), above the card itself', () => {
		// Ancla independiente: vértices del nodo clamp con su transform aplicado.
		expect(BADGE_CARD_MODEL.bounds.max[1]).toBeGreaterThanOrEqual(1.564);
		expect(BADGE_CARD_MODEL.bounds.min[2]).toBeLessThanOrEqual(-0.09);
	});
});

describe('badgeDropLayout (start pose, above the viewport)', () => {
	/** Cámara REAL de three con la config de la lib: ancla independiente de la fórmula. */
	function libCamera(aspect: number): PerspectiveCamera {
		const camera = new PerspectiveCamera(BADGE_CAMERA.fov, aspect, 0.1, 100);
		camera.position.set(...BADGE_CAMERA.position);
		camera.updateMatrixWorld();
		return camera;
	}

	/** Las 8 esquinas del AABB del modelo con la tarjeta en `center` (sin rotar). */
	function cardCorners(center: Tuple3): Vector3[] {
		const { min, max } = BADGE_CARD_MODEL.bounds;
		const corners: Vector3[] = [];
		for (const x of [min[0], max[0]]) {
			for (const y of [min[1], max[1]]) {
				for (const z of [min[2], max[2]]) {
					corners.push(new Vector3(center[0] + x, center[1] + y, center[2] + z));
				}
			}
		}
		return corners;
	}

	it.each([16 / 9, 1, 9 / 16])(
		'keeps every corner of the whole card AABB above the frustum top (aspect %s)',
		(aspect) => {
			const camera = libCamera(aspect);

			for (const corner of cardCorners(badgeDropLayout().cardPosition)) {
				// NDC y > 1 = por encima del borde superior del viewport.
				expect(corner.project(camera).y).toBeGreaterThan(1);
			}
		},
	);

	it('leaves exactly BADGE_DROP.frustumMargin under the farthest bottom corner', () => {
		const card = badgeDropLayout().cardPosition;
		const { min } = BADGE_CARD_MODEL.bounds;
		const tanHalfFov = Math.tan((BADGE_CAMERA.fov * Math.PI) / 360);
		const farZ = card[2] + min[2];
		const frustumTopAtFarZ = (BADGE_CAMERA.position[2] - farZ) * tanHalfFov;

		expect(card[1] + min[1] - frustumTopAtFarZ).toBeCloseTo(BADGE_DROP.frustumMargin, 10);
		// Con la config actual: 13.09 · tan(12.5°) + 0.25 + 1.125 ≈ 4.277 (derivación del JSDoc).
		expect(card[1]).toBeCloseTo(4.277, 3);
	});

	it('comes from right above the rest pose: the card lands inside the viewport', () => {
		const camera = libCamera(16 / 9);
		const rest = new Vector3(...BADGE_LAYOUT.cardPosition).project(camera);

		expect(Math.abs(rest.y)).toBeLessThan(1);
	});

	it('shifts the card sideways by BADGE_DROP.lateralOffset, keeping the fixed anchor', () => {
		const layout = badgeDropLayout();

		expect(layout.fixedPosition).toEqual(BADGE_LAYOUT.fixedPosition);
		expect(layout.cardPosition[0] - layout.fixedPosition[0]).toBeCloseTo(
			BADGE_DROP.lateralOffset,
			10,
		);
		// Casi a plomo: el desplazamiento es pequeño frente a la longitud de la cadena.
		expect(Math.abs(BADGE_DROP.lateralOffset)).toBeLessThan(BADGE_PHYSICS.segmentLength);
	});

	it('takes the lateral offset as a parameter (0 = straight drop)', () => {
		const straight = badgeDropLayout(0);

		expect(straight.cardPosition[0]).toBe(BADGE_LAYOUT.fixedPosition[0]);
		expect(badgeDropLayout(-0.5).cardPosition[0]).toBeCloseTo(
			BADGE_LAYOUT.fixedPosition[0] - 0.5,
			10,
		);
	});

	it('starts with every joint satisfied: clip anchor on j3 and every rope within segmentLength', () => {
		const { fixedPosition, j1Position, j2Position, j3Position, cardPosition } = badgeDropLayout();
		const anchor = BADGE_PHYSICS.cardJointAnchor;

		for (let axis = 0; axis < 3; axis++) {
			expect(cardPosition[axis] + anchor[axis]).toBeCloseTo(j3Position[axis], 10);
		}
		const chain = [fixedPosition, j1Position, j2Position, j3Position];
		chain.slice(1).forEach((body, i) => {
			expect(distance(body, chain[i])).toBeLessThanOrEqual(BADGE_PHYSICS.segmentLength);
		});
	});

	it('keeps the lateral offset at 0.3 from the (now centred) anchor', () => {
		expect(BADGE_DROP.lateralOffset).toBe(0.3);
		expect(badgeDropLayout().fixedPosition[0]).toBe(0);
		expect(badgeDropLayout().cardPosition[0]).toBeCloseTo(0.3, 12);
	});

	describe('with a configured camera (badge-center-camera)', () => {
		/** Cámara REAL de three con una cámara del badge ya resuelta (x/y de BADGE_CAMERA). */
		function configuredCamera(
			settings: Required<Products3dBadgeCamera>,
			aspect: number,
		): PerspectiveCamera {
			const camera = new PerspectiveCamera(settings.fov, aspect, 0.1, 100);
			camera.position.set(BADGE_CAMERA.position[0], BADGE_CAMERA.position[1], settings.distance);
			camera.updateMatrixWorld();
			return camera;
		}

		// Todas ABREN más que la de por defecto (su borde superior en z = 0 queda por encima de 2.88):
		// con la pose derivada de BADGE_CAMERA la tarjeta asomaría en todas.
		const WIDER_CAMERAS: Required<Products3dBadgeCamera>[] = [
			{ fov: 40, distance: 10 },
			{ fov: 25, distance: maxBadgeCameraDistance(25) },
			{ fov: 60, distance: maxBadgeCameraDistance(60) },
		];

		it('is not the default pose: a camera that sees more starts the card higher', () => {
			const layout = badgeDropLayout(BADGE_DROP.lateralOffset, WIDER_CAMERAS[0]);

			expect(layout.cardPosition[1]).toBeGreaterThan(badgeDropLayout().cardPosition[1]);
		});

		it.each(WIDER_CAMERAS.flatMap((camera) => [16 / 9, 9 / 16].map((aspect) => [camera, aspect])))(
			'keeps every corner of the card AABB above the frustum of camera %o (aspect %s)',
			(settings, aspect) => {
				const cameraSettings = settings as Required<Products3dBadgeCamera>;
				const camera = configuredCamera(cameraSettings, aspect as number);
				const layout = badgeDropLayout(BADGE_DROP.lateralOffset, cameraSettings);

				for (const corner of cardCorners(layout.cardPosition)) {
					expect(corner.project(camera).y).toBeGreaterThan(1);
				}
			},
		);

		it('leaves exactly BADGE_DROP.frustumMargin under the farthest corner for that camera', () => {
			const settings = WIDER_CAMERAS[0];
			const card = badgeDropLayout(BADGE_DROP.lateralOffset, settings).cardPosition;
			const { min } = BADGE_CARD_MODEL.bounds;
			const tanHalfFov = Math.tan((settings.fov * Math.PI) / 360);
			const frustumTopAtFarZ = (settings.distance - (card[2] + min[2])) * tanHalfFov;

			expect(card[1] + min[1] - frustumTopAtFarZ).toBeCloseTo(BADGE_DROP.frustumMargin, 10);
		});

		it('also follows a camera that sees LESS (bigger card): starts lower, still off screen', () => {
			const closer = { fov: 20, distance: 9 };
			const layout = badgeDropLayout(BADGE_DROP.lateralOffset, closer);
			const camera = configuredCamera(closer, 16 / 9);

			expect(layout.cardPosition[1]).toBeLessThan(badgeDropLayout().cardPosition[1]);
			for (const corner of cardCorners(layout.cardPosition)) {
				expect(corner.project(camera).y).toBeGreaterThan(1);
			}
		});

		it.each([10, 25, 60, BADGE_CAMERA_LIMITS.maxFov - 1])(
			'starts with every rope within segmentLength at the widest accepted camera (fov %s)',
			(fov) => {
				const { fixedPosition, j1Position, j2Position, j3Position } = badgeDropLayout(
					BADGE_DROP.lateralOffset,
					{ fov, distance: maxBadgeCameraDistance(fov) },
				);
				const chain = [fixedPosition, j1Position, j2Position, j3Position];

				chain.slice(1).forEach((body, i) => {
					expect(distance(body, chain[i])).toBeLessThanOrEqual(BADGE_PHYSICS.segmentLength);
				});
			},
		);

		it('falls back to the default camera fields for unusable values, never NaN', () => {
			const layout = badgeDropLayout(BADGE_DROP.lateralOffset, {
				fov: Number.NaN,
				distance: -3,
			});

			expect(layout).toEqual(badgeDropLayout());
		});

		it.each([Number.MIN_VALUE, 1e-310, BADGE_CAMERA_LIMITS.minFov - 1e-9])(
			'falls back to the default fov for a degenerate fov %s (finite pose)',
			(fov) => {
				const layout = badgeDropLayout(BADGE_DROP.lateralOffset, { fov, distance: 13 });

				expect(layout).toEqual(badgeDropLayout());
				expect(layout.cardPosition.every(Number.isFinite)).toBe(true);
			},
		);
	});

	it('starts with no chain collider inside the card collider or inside another link', () => {
		const { j1Position, j2Position, j3Position, cardPosition } = badgeDropLayout();
		const radius = BADGE_PHYSICS.segmentColliderRadius;
		const half = BADGE_PHYSICS.cardColliderHalfExtents;

		// j1 y j2 caen dentro del rect X·Y de la tarjeta (la cadena sale plegada por encima del
		// anclaje): el pliegue en z los deja delante de su cuboid, sin tocarlo.
		for (const link of [j1Position, j2Position]) {
			expect(Math.abs(link[2] - cardPosition[2])).toBeGreaterThan(half[2] + radius);
		}
		// j3 es el top del clip: queda por encima del borde superior del cuboid.
		expect(j3Position[1] - cardPosition[1]).toBeGreaterThan(half[1] + radius);
		// Y los eslabones no nacen solapados entre sí.
		const links = [j1Position, j2Position, j3Position];
		links.slice(1).forEach((link, i) => {
			expect(distance(link, links[i])).toBeGreaterThan(2 * radius);
		});
	});
});

describe('BADGE_LOADING', () => {
	it('waits about ten seconds at most before releasing with whatever loaded', () => {
		expect(BADGE_LOADING.timeoutMs).toBe(10_000);
	});

	it('queries the standard reduced-motion media feature', () => {
		expect(BADGE_LOADING.reducedMotionQuery).toBe('(prefers-reduced-motion: reduce)');
	});
});

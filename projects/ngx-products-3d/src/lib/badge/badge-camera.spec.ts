import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import type { Products3dBadgeCamera } from '../types';
import {
	applyBadgeCamera,
	badgeAnchorClearance,
	badgeCanvasCamera,
	maxBadgeCameraDistance,
	resolveBadgeCamera,
} from './badge-camera';
import {
	BADGE_BAND,
	BADGE_CAMERA,
	BADGE_CAMERA_DEFAULTS,
	BADGE_CAMERA_LIMITS,
	BADGE_LAYOUT,
} from './badge.config';

/** Cámara REAL de three con una cámara del badge (ancla independiente de las fns). */
function threeCamera(settings: Required<Products3dBadgeCamera>, aspect = 1): PerspectiveCamera {
	const camera = new PerspectiveCamera(settings.fov, aspect, 0.1, 100);
	camera.position.set(BADGE_CAMERA.position[0], BADGE_CAMERA.position[1], settings.distance);
	camera.updateMatrixWorld();
	return camera;
}

/** NDC y del anclaje fijo de la correa: > 1 = por encima del borde superior del viewport. */
function anchorNdcY(settings: Required<Products3dBadgeCamera>): number {
	return new Vector3(...BADGE_LAYOUT.fixedPosition).project(threeCamera(settings)).y;
}

describe('resolveBadgeCamera', () => {
	let warn: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('resolves to BADGE_CAMERA (fov 25, distance 13) without input, silently', () => {
		expect(resolveBadgeCamera(undefined)).toEqual({ fov: 25, distance: 13 });
		expect(resolveBadgeCamera(undefined)).toEqual(BADGE_CAMERA_DEFAULTS);
		expect(resolveBadgeCamera({})).toEqual(BADGE_CAMERA_DEFAULTS);
		expect(warn).not.toHaveBeenCalled();
	});

	it('takes each field on its own and fills the missing one with its default', () => {
		expect(resolveBadgeCamera({ fov: 18 })).toEqual({ fov: 18, distance: 13 });
		expect(resolveBadgeCamera({ distance: 9 })).toEqual({ fov: 25, distance: 9 });
		expect(resolveBadgeCamera({ fov: 20, distance: 8 })).toEqual({ fov: 20, distance: 8 });
		expect(warn).not.toHaveBeenCalled();
	});

	it.each<unknown>([
		0,
		-25,
		Number.NaN,
		Number.POSITIVE_INFINITY,
		BADGE_CAMERA_LIMITS.maxFov,
		180,
		'20',
		null,
		// Positivos pero degenerados (review ronda 1): sin cota inferior daban una proyección con NaN,
		// un teselado infinito y un «máximo» de distancia infinito que desactivaba el acotado.
		Number.MIN_VALUE,
		1e-310,
		1e-6,
		BADGE_CAMERA_LIMITS.minFov - 1e-9,
	])('falls back to the default fov with a dev warning for fov %s', (fov) => {
		const resolved = resolveBadgeCamera({ fov, distance: 9 } as unknown as Products3dBadgeCamera);

		expect(resolved).toEqual({ fov: BADGE_CAMERA_DEFAULTS.fov, distance: 9 });
		expect(warn).toHaveBeenCalledTimes(1);
		const message = String(warn.mock.calls[0][0]);
		expect(message).toContain('[ngx-products-3d]');
		expect(message).toContain('camera.fov');
	});

	it('accepts the minimum fov itself (inclusive) and yields a finite projection with it', () => {
		const resolved = resolveBadgeCamera({ fov: BADGE_CAMERA_LIMITS.minFov });

		expect(resolved.fov).toBe(BADGE_CAMERA_LIMITS.minFov);
		expect(Number.isFinite(resolved.distance)).toBe(true);
		expect(threeCamera(resolved).projectionMatrix.elements.every(Number.isFinite)).toBe(true);
		expect(warn).not.toHaveBeenCalled();
	});

	it('never builds a non-finite projection nor disables the anchor bound for a tiny fov', () => {
		for (const fov of [Number.MIN_VALUE, 1e-310, 1e-320]) {
			const resolved = resolveBadgeCamera({ fov, distance: 30 });

			expect(threeCamera(resolved).projectionMatrix.elements.every(Number.isFinite)).toBe(true);
			// Sigue acotada: 30 uds con el fov de fallback (25°) enseñarían el anclaje.
			expect(resolved.distance).toBeCloseTo(maxBadgeCameraDistance(BADGE_CAMERA_DEFAULTS.fov), 12);
			expect(anchorNdcY(resolved)).toBeGreaterThan(1);
		}
	});

	it.each<unknown>([0, -13, Number.NaN, Number.POSITIVE_INFINITY, '9', null])(
		'falls back to the default distance with a dev warning for distance %s',
		(distance) => {
			const camera = { fov: 20, distance } as unknown as Products3dBadgeCamera;
			const resolved = resolveBadgeCamera(camera);

			expect(resolved).toEqual({ fov: 20, distance: BADGE_CAMERA_DEFAULTS.distance });
			expect(warn).toHaveBeenCalledTimes(1);
			const message = String(warn.mock.calls[0][0]);
			expect(message).toContain('[ngx-products-3d]');
			expect(message).toContain('camera.distance');
		},
	);

	it('never throws nor returns NaN, whatever arrives from a JS consumer', () => {
		for (const camera of [null, { fov: 'x', distance: {} }, { fov: -1, distance: Number.NaN }]) {
			const resolved = resolveBadgeCamera(camera as unknown as Products3dBadgeCamera);

			expect(Number.isFinite(resolved.fov)).toBe(true);
			expect(Number.isFinite(resolved.distance)).toBe(true);
		}
	});

	it('pulls the camera closer when it would show the top end of the band, with a dev warning', () => {
		// 30 uds con 25° dejarían el anclaje (y = 4) dentro del viewport: 30 · tan(12.5°) ≈ 6.65.
		expect(anchorNdcY({ fov: 25, distance: 30 })).toBeLessThan(1);

		const resolved = resolveBadgeCamera({ fov: 25, distance: 30 });

		expect(resolved.fov).toBe(25);
		expect(resolved.distance).toBeCloseTo(maxBadgeCameraDistance(25), 12);
		expect(resolved.distance).toBeLessThan(30);
		expect(anchorNdcY(resolved)).toBeGreaterThan(1);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0][0])).toContain('[ngx-products-3d]');
		expect(String(warn.mock.calls[0][0])).toContain('anclaje');
	});

	it('also bounds a wide fov with the default distance (the anchor would show at 60°)', () => {
		expect(anchorNdcY({ fov: 60, distance: 13 })).toBeLessThan(1);

		const resolved = resolveBadgeCamera({ fov: 60 });

		expect(resolved).toEqual({ fov: 60, distance: maxBadgeCameraDistance(60) });
		expect(anchorNdcY(resolved)).toBeGreaterThan(1);
	});

	it('leaves a closer or narrower camera untouched (a bigger card never shows the anchor)', () => {
		for (const camera of [
			{ fov: 25, distance: 8 },
			{ fov: 15, distance: 13 },
			{ fov: 20, distance: 16 },
		]) {
			expect(resolveBadgeCamera(camera)).toEqual(camera);
			expect(anchorNdcY(camera)).toBeGreaterThan(1);
		}
		expect(warn).not.toHaveBeenCalled();
	});

	it('is idempotent: resolving a resolved camera changes nothing and does not warn again', () => {
		const resolved = resolveBadgeCamera({ fov: 25, distance: 30 });
		warn.mockClear();

		expect(resolveBadgeCamera(resolved)).toEqual(resolved);
		expect(warn).not.toHaveBeenCalled();
	});
});

describe('maxBadgeCameraDistance', () => {
	it.each([25, 60])(
		'puts the frustum top exactly the band half width + anchorMargin under the anchor (fov %s)',
		(fov) => {
			const settings = { fov, distance: maxBadgeCameraDistance(fov) };
			const [x, anchorY, z] = BADGE_LAYOUT.fixedPosition;
			// Medio ancho de la correa en mundo, escrito a mano (ancho = lineWidth · tan(fov/2)).
			const bandHalfWidth = (BADGE_BAND.lineWidth * Math.tan((fov * Math.PI) / 360)) / 2;
			const edge = new Vector3(x, anchorY - bandHalfWidth - BADGE_CAMERA_LIMITS.anchorMargin, z);

			expect(badgeAnchorClearance(fov)).toBeCloseTo(
				bandHalfWidth + BADGE_CAMERA_LIMITS.anchorMargin,
				12,
			);
			expect(edge.project(threeCamera(settings)).y).toBeCloseTo(1, 10);
		},
	);

	it('pins the documented figures: ≈ 16.87 at 25° and ≈ 6.17 at 60°', () => {
		expect(maxBadgeCameraDistance(25)).toBeCloseTo(16.866, 3);
		expect(maxBadgeCameraDistance(60)).toBeCloseTo(6.168, 3);
	});

	it('keeps the corner of the band end off screen at 60°, where the band is wider (O2)', () => {
		// A 60° el medio ancho de la correa (tan(30°)/2 ≈ 0.289) supera cualquier holgura fija de 0.25:
		// con ella la esquina del extremo asomaría. La holgura derivada del fov la deja fuera.
		const resolved = resolveBadgeCamera({ fov: 60 });
		const [x, anchorY, z] = BADGE_LAYOUT.fixedPosition;
		const bandHalfWidth = (BADGE_BAND.lineWidth * Math.tan((60 * Math.PI) / 360)) / 2;
		const corner = new Vector3(x, anchorY - bandHalfWidth, z);

		expect(bandHalfWidth).toBeGreaterThan(0.25);
		expect(corner.project(threeCamera(resolved)).y).toBeGreaterThan(1);
	});

	it('shrinks as the fov opens (a wider lens has to come closer)', () => {
		expect(maxBadgeCameraDistance(40)).toBeLessThan(maxBadgeCameraDistance(25));
		expect(maxBadgeCameraDistance(15)).toBeGreaterThan(maxBadgeCameraDistance(25));
	});
});

describe('badgeCanvasCamera', () => {
	it('keeps the camera centred (x/y of BADGE_CAMERA) and moves it only along z', () => {
		expect(badgeCanvasCamera({ fov: 18, distance: 9 })).toEqual({ position: [0, 0, 9], fov: 18 });
		expect(badgeCanvasCamera(BADGE_CAMERA_DEFAULTS)).toEqual(BADGE_CAMERA);
	});
});

describe('applyBadgeCamera', () => {
	it('mutates the created perspective camera in place: fov, z and projection', () => {
		const camera = threeCamera(BADGE_CAMERA_DEFAULTS, 4 / 3);
		const expected = threeCamera({ fov: 18, distance: 9 }, 4 / 3);

		expect(applyBadgeCamera(camera, { fov: 18, distance: 9 })).toBe(true);

		expect(camera.fov).toBe(18);
		expect(camera.position.toArray()).toEqual([0, 0, 9]);
		// La proyección se recalcula (sin updateProjectionMatrix el fov nuevo no se vería) y el
		// aspecto del viewport se conserva.
		expect(camera.aspect).toBe(4 / 3);
		expect(camera.projectionMatrix.elements).toEqual(expected.projectionMatrix.elements);
		expect(camera.matrixWorld.elements).toEqual(expected.matrixWorld.elements);
	});

	it('leaves a non-perspective camera untouched', () => {
		const camera = new OrthographicCamera();
		camera.position.set(1, 2, 3);

		expect(applyBadgeCamera(camera, { fov: 18, distance: 9 })).toBe(false);
		expect(camera.position.toArray()).toEqual([1, 2, 3]);
	});
});

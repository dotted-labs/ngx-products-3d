import { PerspectiveCamera, Vector3 } from 'three';
import { BADGE_CAMERA, BADGE_DRAG } from './badge.config';
import { projectPointerToWorld, subtractInto } from './badge-drag';

describe('subtractInto', () => {
	it('writes the component-wise difference (a − b) into the reused output vector', () => {
		const out = new Vector3(9, 9, 9);

		const result = subtractInto({ x: 5, y: 3, z: 2 }, { x: 1, y: 4, z: -2 }, out);

		expect(result).toBe(out);
		expect(result.x).toBe(4);
		expect(result.y).toBe(-1);
		expect(result.z).toBe(4);
	});

	it('supports aliasing the minuend as the output (drag target reuses dragVec)', () => {
		const shared = new Vector3(10, 8, 6);
		const offset = new Vector3(1, 2, 3);

		subtractInto(shared, offset, shared);

		expect(shared.x).toBe(9);
		expect(shared.y).toBe(6);
		expect(shared.z).toBe(3);
	});
});

describe('projectPointerToWorld', () => {
	function makeCamera(): PerspectiveCamera {
		const camera = new PerspectiveCamera(BADGE_CAMERA.fov, 1, 0.1, 100);
		const [x, y, z] = BADGE_CAMERA.position;
		camera.position.set(x, y, z);
		camera.updateMatrixWorld(true);
		camera.updateProjectionMatrix();
		return camera;
	}

	it('maps the centered pointer to a world point on the camera axis (x≈0, y≈0)', () => {
		const camera = makeCamera();
		const vec = new Vector3();
		const dir = new Vector3();

		const result = projectPointerToWorld(0, 0, BADGE_DRAG.unprojectDepth, camera, vec, dir);

		expect(result).toBe(vec);
		expect(result.x).toBeCloseTo(0, 5);
		expect(result.y).toBeCloseTo(0, 5);
	});

	it('maps a pointer to the right edge to a positive world x (follows the cursor)', () => {
		const camera = makeCamera();
		const vec = new Vector3();
		const dir = new Vector3();

		const result = projectPointerToWorld(1, 0, BADGE_DRAG.unprojectDepth, camera, vec, dir);

		expect(result.x).toBeGreaterThan(0);
	});

	it('reuses the same output vector instance across calls (no per-frame allocations)', () => {
		const camera = makeCamera();
		const vec = new Vector3();
		const dir = new Vector3();

		const first = projectPointerToWorld(0.2, 0.4, BADGE_DRAG.unprojectDepth, camera, vec, dir);
		const second = projectPointerToWorld(-0.3, 0.1, BADGE_DRAG.unprojectDepth, camera, vec, dir);

		expect(first).toBe(vec);
		expect(second).toBe(vec);
	});
});

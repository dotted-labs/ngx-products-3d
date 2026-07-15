import { Vector3 } from 'three';
import { clamp, lerpTowards, spinCorrectedAngvelY } from './badge-stabilize';

describe('clamp', () => {
	it('returns the value untouched when inside the range', () => {
		expect(clamp(0.5, 0.1, 1)).toBe(0.5);
	});

	it('clamps to the lower bound when below min', () => {
		expect(clamp(0.05, 0.1, 1)).toBe(0.1);
	});

	it('clamps to the upper bound when above max', () => {
		expect(clamp(2, 0.1, 1)).toBe(1);
	});
});

describe('lerpTowards', () => {
	it('advances out toward target by delta * (minSpeed + distance * (maxSpeed − minSpeed))', () => {
		// distance 0.5 in [0.1, 1] → alpha = 0.1 * (10 + 0.5 * 40) = 3 → out.x = 0.5 * 3
		const out = new Vector3(0, 0, 0);

		const result = lerpTowards({ x: 0.5, y: 0, z: 0 }, 0.1, 10, 50, 0.1, 1, out);

		expect(result).toBe(out);
		expect(result.x).toBeCloseTo(1.5, 10);
		expect(result.y).toBe(0);
		expect(result.z).toBe(0);
	});

	it('clamps the distance to clampMax when target is far (no yank on big jumps)', () => {
		// distance 2 → clamped to 1 → alpha = 0.01 * (10 + 1 * 40) = 0.5 → out.x = 2 * 0.5
		const out = new Vector3(0, 0, 0);

		lerpTowards({ x: 2, y: 0, z: 0 }, 0.01, 10, 50, 0.1, 1, out);

		expect(out.x).toBeCloseTo(1, 10);
	});

	it('clamps the distance to clampMin when target is very close (no acceleration on noise)', () => {
		// distance 0.05 → clamped to 0.1 → alpha = 0.5 * (10 + 0.1 * 40) = 7 → out.x = 0.05 * 7 = 0.35
		// Sin clamp sería 0.5 * (10 + 0.05 * 40) = 6 → 0.3; el 0.35 discrimina el clamp inferior.
		const out = new Vector3(0, 0, 0);

		lerpTowards({ x: 0.05, y: 0, z: 0 }, 0.5, 10, 50, 0.1, 1, out);

		expect(out.x).toBeCloseTo(0.35, 10);
	});

	it('reuses the same out instance across calls (no per-frame allocations)', () => {
		const out = new Vector3(0, 0, 0);

		const first = lerpTowards({ x: 1, y: 0, z: 0 }, 0.1, 10, 50, 0.1, 1, out);
		const second = lerpTowards({ x: 1, y: 0, z: 0 }, 0.1, 10, 50, 0.1, 1, out);

		expect(first).toBe(out);
		expect(second).toBe(out);
	});
});

describe('spinCorrectedAngvelY', () => {
	it('subtracts rotY * factor from the current yaw angular velocity', () => {
		expect(spinCorrectedAngvelY(0.5, 0.8, 0.25)).toBeCloseTo(0.3, 10);
	});

	it('is a no-op when the card is already frontal (rotY = 0)', () => {
		expect(spinCorrectedAngvelY(0.5, 0, 0.25)).toBe(0.5);
	});
});

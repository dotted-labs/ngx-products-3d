import { CatmullRomCurve3, Euler, Object3D, Quaternion, Vector3 } from 'three';
import { localPointToParent, sampleCurveByArcLength } from './badge-band';

/** Longitudes de las cuerdas entre puntos consecutivos. */
function chordLengths(points: Vector3[]): number[] {
	return points.slice(1).map((point, i) => point.distanceTo(points[i]));
}

/** Máxima / mínima cuerda: 1 = puntos perfectamente equiespaciados. */
function spacingRatio(points: Vector3[]): number {
	const chords = chordLengths(points);
	return Math.max(...chords) / Math.min(...chords);
}

function buffers(divisions: number, points: number) {
	return {
		samples: Array.from({ length: divisions + 1 }, () => new Vector3()),
		arcLengths: new Float64Array(divisions + 1),
		out: Array.from({ length: points + 1 }, () => new Vector3()),
	};
}

/**
 * Curva muy desigual por parámetro: un tramo corto (0→1) y uno largo (1→10). Con `getPoints` la
 * mitad de las muestras cae en el tramo corto; es el caso que hace discriminante al test de arco.
 */
function unevenCurve(): CatmullRomCurve3 {
	const curve = new CatmullRomCurve3([
		new Vector3(0, 0, 0),
		new Vector3(0, 1, 0),
		new Vector3(0, 1.5, 0),
		new Vector3(9, 10, 0),
	]);
	curve.curveType = 'chordal';
	return curve;
}

describe('localPointToParent', () => {
	it('returns the local point untouched for an identity pose', () => {
		const object = new Object3D();

		const out = localPointToParent([0, 1.479, 0], object, new Vector3());

		expect(out.toArray()).toEqual([0, 1.479, 0]);
	});

	it('matches Object3D.localToWorld for a rotated, scaled and translated pose', () => {
		// Ancla independiente: el camino de three por matrices (matrixWorld), no el TRS a mano.
		const object = new Object3D();
		object.position.set(2, -1, 0.3);
		object.quaternion.setFromEuler(new Euler(0.3, -0.5, 0.7));
		object.scale.set(1.5, 0.5, 2);
		object.updateMatrixWorld();
		const expected = object.localToWorld(new Vector3(0.2, 1.479, -0.1));

		const out = localPointToParent([0.2, 1.479, -0.1], object, new Vector3());

		expect(out.x).toBeCloseTo(expected.x, 10);
		expect(out.y).toBeCloseTo(expected.y, 10);
		expect(out.z).toBeCloseTo(expected.z, 10);
	});

	it('writes into and returns the given vector (no allocation)', () => {
		const out = new Vector3();
		const pose = {
			position: new Vector3(1, 2, 3),
			quaternion: new Quaternion(),
			scale: new Vector3(1, 1, 1),
		};

		expect(localPointToParent([1, 1, 1], pose, out)).toBe(out);
		expect(out.toArray()).toEqual([2, 3, 4]);
	});
});

describe('sampleCurveByArcLength', () => {
	it('spaces the samples evenly by arc length where getPoints does not', () => {
		const curve = unevenCurve();
		const { samples, arcLengths, out } = buffers(200, 32);

		sampleCurveByArcLength(curve, samples, arcLengths, out);

		// El caso NO es trivial: muestreado por parámetro, el espaciado varía mucho.
		expect(spacingRatio(curve.getPoints(32))).toBeGreaterThan(3);
		expect(spacingRatio(out)).toBeLessThan(1.02);
	});

	it('matches three updateArcLengths() + getSpacedPoints() on the same curve', () => {
		const curve = unevenCurve();
		const { samples, arcLengths, out } = buffers(200, 32);

		sampleCurveByArcLength(curve, samples, arcLengths, out);
		curve.updateArcLengths();
		const reference = curve.getSpacedPoints(32);

		out.forEach((point, i) => {
			expect(point.distanceTo(reference[i])).toBeLessThan(1e-9);
		});
	});

	it('keeps both ends of the curve exactly (band end at the card, start at the anchor)', () => {
		const curve = unevenCurve();
		const { samples, arcLengths, out } = buffers(200, 32);

		sampleCurveByArcLength(curve, samples, arcLengths, out);

		expect(out[0].distanceTo(curve.points[0])).toBeLessThan(1e-12);
		expect(out[32].distanceTo(curve.points[3])).toBeLessThan(1e-9);
	});

	it('never glues the second or penultimate sample onto an end (meshline end-cap direction)', () => {
		// meshline orienta el extremo con el vecino (currentP - prevP en el último punto): un vecino
		// casi coincidente daría una dirección de ruido en el extremo aunque el shader use tolerancia.
		const curve = unevenCurve();
		const { samples, arcLengths, out } = buffers(200, 32);

		sampleCurveByArcLength(curve, samples, arcLengths, out);
		const chord = curve.getLength() / 32;

		expect(out[1].distanceTo(out[0]) / chord).toBeCloseTo(1, 1);
		expect(out[32].distanceTo(out[31]) / chord).toBeCloseTo(1, 1);
	});

	it('re-measures the curve after its control points are mutated in place (no stale cache)', () => {
		// La correa muta sus 4 puntos in situ cada frame: la caché de longitudes de Curve NO se
		// invalida sola, que es justo el fallo de getSpacedPoints sin updateArcLengths().
		const curve = unevenCurve();
		const { samples, arcLengths, out } = buffers(200, 32);
		sampleCurveByArcLength(curve, samples, arcLengths, out);

		curve.points[3].set(-9, -8, 0);
		curve.points[0].set(0, 0, 4);
		sampleCurveByArcLength(curve, samples, arcLengths, out);

		curve.updateArcLengths();
		const reference = curve.getSpacedPoints(32);
		out.forEach((point, i) => {
			expect(point.distanceTo(reference[i])).toBeLessThan(1e-9);
		});
	});

	it('reuses the given output vectors (no allocation per call)', () => {
		const curve = unevenCurve();
		const { samples, arcLengths, out } = buffers(200, 32);
		const before = [...out];

		const result = sampleCurveByArcLength(curve, samples, arcLengths, out);

		expect(result).toBe(out);
		result.forEach((point, i) => expect(point).toBe(before[i]));
	});

	it('degrades to the collapsed point without NaN when the curve has zero length', () => {
		const curve = new CatmullRomCurve3([1, 2, 3, 4].map(() => new Vector3(1, 2, 3)));
		const { samples, arcLengths, out } = buffers(200, 32);

		sampleCurveByArcLength(curve, samples, arcLengths, out);

		out.forEach((point) => expect(point.toArray()).toEqual([1, 2, 3]));
	});
});

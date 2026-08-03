import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import {
	alignOffsetX,
	badgeTextFor,
	fitTextScale,
	isRatioWithinTolerance,
	resolveBaseTextureUrl,
	uvAnchorToRtPosition,
} from './badge-texture';
import { BADGE_FRONT_FACE, BADGE_TEXT_LAYOUT, BADGE_TEXTURE } from './badge.config';

const THEME: Products3dBadgeTheme = {
	bandTextureUrl: 'assets/band.jpg',
	baseTextures: {
		gold: 'assets/base-gold.png',
		silver: 'assets/base-silver.png',
	},
	defaultBaseTextureUrl: 'assets/base-default.png',
	fontUrl: 'assets/font.json',
};

const MEMBER: BadgeMemberData = {
	name: 'Ada Lovelace',
	memberNumber: '0042',
	tier: 'gold',
};

describe('resolveBaseTextureUrl', () => {
	it('returns the tier texture when the tier exists in baseTextures', () => {
		expect(resolveBaseTextureUrl(THEME, 'gold')).toBe('assets/base-gold.png');
		expect(resolveBaseTextureUrl(THEME, 'silver')).toBe('assets/base-silver.png');
	});

	it('falls back to defaultBaseTextureUrl when tier unknown', () => {
		expect(resolveBaseTextureUrl(THEME, 'platinum')).toBe('assets/base-default.png');
	});

	it('falls back to defaultBaseTextureUrl when tier is empty', () => {
		expect(resolveBaseTextureUrl(THEME, '')).toBe('assets/base-default.png');
	});
});

describe('badgeTextFor', () => {
	it('returns the member name verbatim for the name slot', () => {
		expect(badgeTextFor(MEMBER, 'name', '#')).toBe('Ada Lovelace');
	});

	it('prefixes the member number with the configured prefix', () => {
		expect(badgeTextFor(MEMBER, 'memberNumber', '#')).toBe('#0042');
		expect(badgeTextFor(MEMBER, 'memberNumber', 'Nº ')).toBe('Nº 0042');
	});

	it('uppercases the tier label', () => {
		expect(badgeTextFor(MEMBER, 'tier', '#')).toBe('GOLD');
	});
});

describe('fitTextScale', () => {
	it('shrinks a long text so it does not exceed maxWidth', () => {
		expect(fitTextScale(7.2, 3.6)).toBe(0.5);
		expect(fitTextScale(7.2, 3.6) * 7.2).toBeLessThanOrEqual(3.6);
	});

	it('does not enlarge a short text (scale clamped to 1)', () => {
		expect(fitTextScale(1.5, 3.6)).toBe(1);
		expect(fitTextScale(3.6, 3.6)).toBe(1);
	});

	it('returns 1 for a non-measurable width (empty geometry bbox)', () => {
		expect(fitTextScale(Number.NEGATIVE_INFINITY, 3.6)).toBe(1);
		expect(fitTextScale(Number.POSITIVE_INFINITY, 3.6)).toBe(1);
		expect(fitTextScale(Number.NaN, 3.6)).toBe(1);
		expect(fitTextScale(0, 3.6)).toBe(1);
		expect(fitTextScale(-2, 3.6)).toBe(1);
	});
});

/**
 * Cara frontal FIJADA A MANO desde el contrato del GLB (1.6 × 2.25): ancla independiente de la
 * config, para que estos tests midan la conversión y no repitan la aritmética de `BADGE_FRONT_FACE`.
 */
const GLB_FACE = { width: 1.6, height: 2.25 };

describe('uvAnchorToRtPosition', () => {
	it('maps the center of the face to the origin of the RT scene', () => {
		// El origen de la escena RT es lo que encuadra el frustum ortográfico centrado.
		expect(uvAnchorToRtPosition([0.5, 0.5], GLB_FACE)).toEqual([0, 0]);
	});

	it('maps the four corners with the origin at the BOTTOM-LEFT of the face', () => {
		const [blX, blY] = uvAnchorToRtPosition([0, 0], GLB_FACE);
		const [trX, trY] = uvAnchorToRtPosition([1, 1], GLB_FACE);
		const [tlX, tlY] = uvAnchorToRtPosition([0, 1], GLB_FACE);
		const [brX, brY] = uvAnchorToRtPosition([1, 0], GLB_FACE);

		expect([blX, blY]).toEqual([-0.8, -1.125]);
		expect([trX, trY]).toEqual([0.8, 1.125]);
		expect([tlX, tlY]).toEqual([-0.8, 1.125]);
		expect([brX, brY]).toEqual([0.8, -1.125]);
	});

	it('grows V upwards (NOT the glTF UV convention of the card, where v = 0 is the top)', () => {
		// La trampa de esta feature: los UV del GLB son `v = (1.125 − y) / 2.25` (v = 0 arriba). Si
		// alguien "corrige" la fn a esa convención, este test cae y los textos salen espejados en
		// vertical respecto al arte del frente.
		const low = uvAnchorToRtPosition([0.5, 0.1], GLB_FACE)[1];
		const high = uvAnchorToRtPosition([0.5, 0.9], GLB_FACE)[1];

		expect(low).toBeLessThan(high);
		expect(low).toBeLessThan(0);
		expect(high).toBeGreaterThan(0);
	});

	it('places a bottom-right anchor in the bottom-right quadrant', () => {
		const [x, y] = uvAnchorToRtPosition([0.92, 0.1], GLB_FACE);

		expect(x).toBeCloseTo(0.672, 10);
		expect(y).toBeCloseTo(-0.9, 10);
	});

	it('scales with the face rect it receives, not with a hardcoded 1.6 x 2.25', () => {
		expect(uvAnchorToRtPosition([0.75, 0.75], { width: 4, height: 2 })).toEqual([1, 0.5]);
		expect(uvAnchorToRtPosition([0.25, 0.25], { width: 4, height: 2 })).toEqual([-1, -0.5]);
	});

	it('derives the shipped layout anchors from BADGE_FRONT_FACE', () => {
		// Contrato de punta a punta: la cara que consume el componente es la derivada del GLB.
		for (const slot of BADGE_TEXT_LAYOUT) {
			const [x, y] = uvAnchorToRtPosition(slot.anchor, BADGE_FRONT_FACE);
			const [manualX, manualY] = uvAnchorToRtPosition(slot.anchor, GLB_FACE);

			expect(x).toBeCloseTo(manualX, 10);
			expect(y).toBeCloseTo(manualY, 10);
		}
	});
});

describe('alignOffsetX', () => {
	it('does not move a left-aligned text (TextGeometry origin is its left edge)', () => {
		expect(alignOffsetX(0.5, 'left')).toBe(0);
	});

	it('shifts a right-aligned text by its full width', () => {
		expect(alignOffsetX(0.5, 'right')).toBe(-0.5);
	});

	it('shifts a centered text by half its width', () => {
		expect(alignOffsetX(0.5, 'center')).toBe(-0.25);
	});

	it('lands the aligned edge exactly on the anchor', () => {
		// Lo que de verdad significa alinear: con el offset aplicado, el borde pedido cae en el
		// anchor. El texto ocupa [anchor + offset, anchor + offset + width].
		const anchorX = 0.672;
		const width = 0.4;
		const leftEdge = (align: 'left' | 'right' | 'center') => anchorX + alignOffsetX(width, align);

		expect(leftEdge('right') + width).toBeCloseTo(anchorX, 10);
		expect(leftEdge('center') + width / 2).toBeCloseTo(anchorX, 10);
		expect(leftEdge('left')).toBeCloseTo(anchorX, 10);
	});

	it('returns 0 for a non-measurable width (empty geometry bbox), for every align', () => {
		// Sin medida no se puede alinear: el texto se queda en su anchor en lugar de irse a NaN
		// (mismo criterio que fitTextScale). Un NaN aquí borraría el texto de la escena.
		for (const align of ['left', 'right', 'center'] as const) {
			expect(alignOffsetX(Number.NaN, align)).toBe(0);
			expect(alignOffsetX(Number.POSITIVE_INFINITY, align)).toBe(0);
			expect(alignOffsetX(Number.NEGATIVE_INFINITY, align)).toBe(0);
			expect(alignOffsetX(0, align)).toBe(0);
			expect(alignOffsetX(-1, align)).toBe(0);
		}
	});
});

/**
 * Ratio de la cara frontal FIJADO A MANO desde el contrato del GLB (1.6 × 2.25 → 32:45), igual que
 * en `badge.config.spec.ts`: ancla INDEPENDIENTE de la config, para que estos tests no se limiten a
 * repetir la aritmética de `BADGE_TEXTURE.assetAspect`.
 */
const GLB_FRONT_FACE_ASPECT = 32 / 45;
const ONE_PERCENT = 0.01;

describe('isRatioWithinTolerance', () => {
	it('accepts the exact target ratio (the 1600 x 2250 reference asset)', () => {
		expect(isRatioWithinTolerance(1600, 2250, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		// Resolución mínima del contrato del asset (800 × 1125): mismo ratio, también válido.
		expect(isRatioWithinTolerance(800, 1125, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		// Con tolerancia 0 solo pasa el ratio exacto: la comparación es del ratio, no de los píxeles.
		expect(isRatioWithinTolerance(800, 1125, GLB_FRONT_FACE_ASPECT, 0)).toBe(true);
	});

	it('accepts a deviation inside the tolerance, in both directions', () => {
		// 1600 × 2240 = +0.45% de desviación relativa; 1600 × 2260 = −0.44%. Ambas por debajo del 1%.
		expect(isRatioWithinTolerance(1600, 2240, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		expect(isRatioWithinTolerance(1600, 2260, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		// Y esas mismas dimensiones SÍ se rechazan con una tolerancia más estricta (0.1%): lo que
		// decide es la tolerancia recibida, no un margen escondido en la fn.
		expect(isRatioWithinTolerance(1600, 2240, GLB_FRONT_FACE_ASPECT, 0.001)).toBe(false);
		expect(isRatioWithinTolerance(1600, 2260, GLB_FRONT_FACE_ASPECT, 0.001)).toBe(false);
	});

	it('rejects a deviation just outside the tolerance, in both directions', () => {
		// 1600 × 2225 = +1.12%; 1600 × 2276 = −1.14%. A un pelo del 1%, pero fuera.
		expect(isRatioWithinTolerance(1600, 2225, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(false);
		expect(isRatioWithinTolerance(1600, 2276, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(false);
	});

	it('rejects a wildly wrong ratio (square asset, rotated asset)', () => {
		// El PNG 256 × 256 que el playground conserva como `base-wrong-ratio.png` (T7): +40.6%.
		expect(isRatioWithinTolerance(256, 256, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(false);
		// Asset exportado en horizontal (2250 × 1600): +97.8%.
		expect(isRatioWithinTolerance(2250, 1600, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(false);
	});

	it('treats non-measurable dimensions as valid (resource still loading, no intrinsic size)', () => {
		// Criterio documentado en el JSDoc: sin medida no hay nada que reprochar al asset, así que no
		// se avisa. Cada caso invalida una sola de las dos dimensiones.
		expect(isRatioWithinTolerance(0, 2250, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		expect(isRatioWithinTolerance(1600, 0, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		expect(isRatioWithinTolerance(Number.NaN, 2250, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		expect(isRatioWithinTolerance(1600, Number.NaN, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		expect(
			isRatioWithinTolerance(Number.POSITIVE_INFINITY, 2250, GLB_FRONT_FACE_ASPECT, ONE_PERCENT),
		).toBe(true);
		expect(
			isRatioWithinTolerance(1600, Number.POSITIVE_INFINITY, GLB_FRONT_FACE_ASPECT, ONE_PERCENT),
		).toBe(true);
		expect(isRatioWithinTolerance(-1600, 2250, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		expect(isRatioWithinTolerance(1600, -2250, GLB_FRONT_FACE_ASPECT, ONE_PERCENT)).toBe(true);
		// Y un objetivo no medible tampoco puede decidir nada (evita comparar contra NaN o dividir
		// por 0 al escalar la tolerancia).
		expect(isRatioWithinTolerance(256, 256, Number.NaN, ONE_PERCENT)).toBe(true);
		expect(isRatioWithinTolerance(256, 256, 0, ONE_PERCENT)).toBe(true);
	});
});

describe('front asset ratio contract (shipped config)', () => {
	it('targets the derived front face ratio, not a literal', () => {
		expect(BADGE_TEXTURE.assetAspect).toBe(BADGE_FRONT_FACE.width / BADGE_FRONT_FACE.height);
		expect(BADGE_TEXTURE.assetAspect).toBeCloseTo(GLB_FRONT_FACE_ASPECT, 10);
	});

	it('tolerates 1% of relative deviation (spec-03-F4v2 R1)', () => {
		expect(BADGE_TEXTURE.assetAspectTolerance).toBe(ONE_PERCENT);
	});

	it('validates the recommended asset and rejects the wrong-ratio demo asset', () => {
		// Contrato de punta a punta con los valores que se PUBLICAN: el asset del contrato pasa y el
		// PNG cuadrado del demo (T7) dispara el aviso. Si alguien afloja la tolerancia hasta volverla
		// inocua, este test cae.
		expect(
			isRatioWithinTolerance(
				BADGE_TEXTURE.width,
				BADGE_TEXTURE.height,
				BADGE_TEXTURE.assetAspect,
				BADGE_TEXTURE.assetAspectTolerance,
			),
		).toBe(true);
		expect(
			isRatioWithinTolerance(
				256,
				256,
				BADGE_TEXTURE.assetAspect,
				BADGE_TEXTURE.assetAspectTolerance,
			),
		).toBe(false);
	});
});

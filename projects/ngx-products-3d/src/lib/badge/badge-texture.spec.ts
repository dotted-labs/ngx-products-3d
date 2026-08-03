import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import {
	badgeTextFor,
	fitTextScale,
	isRatioWithinTolerance,
	resolveBaseTextureUrl,
} from './badge-texture';
import { BADGE_FRONT_FACE, BADGE_TEXTURE } from './badge.config';

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

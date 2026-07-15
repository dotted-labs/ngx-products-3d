import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { badgeTextFor, fitTextScale, resolveBaseTextureUrl } from './badge-texture';

const THEME: Products3dBadgeTheme = {
	bandTextureUrl: 'assets/band.png',
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

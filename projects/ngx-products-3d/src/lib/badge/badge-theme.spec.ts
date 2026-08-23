import type { Products3dBadgeTheme } from '../types';
import { assertValidBadgeTheme, resolveBaseColor, resolveClipColor } from './badge-theme';
import { BADGE_BASE_COLOR } from './badge.config';

function makeTheme(overrides: Partial<Products3dBadgeTheme> = {}): Products3dBadgeTheme {
	return {
		bandTextureUrl: 'assets/band.png',
		baseTextures: { gold: 'assets/gold.png' },
		defaultBaseTextureUrl: 'assets/default.png',
		fontUrl: 'assets/font.json',
		...overrides,
	};
}

// Temas runtime-inválidos: el cast simula un consumidor JS (o un objeto mal construido)
// que se salta el tipado estricto de Products3dBadgeTheme.
function themeWithout(...fields: ('defaultBaseTextureUrl' | 'fontUrl')[]): Products3dBadgeTheme {
	const theme: Record<string, unknown> = { ...makeTheme() };
	for (const field of fields) {
		delete theme[field];
	}
	return theme as unknown as Products3dBadgeTheme;
}

describe('assertValidBadgeTheme', () => {
	it('returns the exact same theme reference when both required URLs are present', () => {
		const theme = makeTheme();

		expect(assertValidBadgeTheme(theme)).toBe(theme);
	});

	it('throws a prefixed, actionable error when defaultBaseTextureUrl is missing', () => {
		expect(() => assertValidBadgeTheme(themeWithout('defaultBaseTextureUrl'))).toThrowError(
			'[ngx-products-3d] badge: al tema le falta defaultBaseTextureUrl. ' +
				'Añade esa URL al tema que registras con provideProducts3dBadgeTheme() ' +
				'o pasas por el input [theme]',
		);
	});

	it('throws a prefixed, actionable error when fontUrl is missing', () => {
		expect(() => assertValidBadgeTheme(themeWithout('fontUrl'))).toThrowError(
			'[ngx-products-3d] badge: al tema le falta fontUrl. ' +
				'Añade esa URL al tema que registras con provideProducts3dBadgeTheme() ' +
				'o pasas por el input [theme]',
		);
	});

	it('reports both fields in a single error when both are missing', () => {
		expect(() =>
			assertValidBadgeTheme(themeWithout('defaultBaseTextureUrl', 'fontUrl')),
		).toThrowError(
			'[ngx-products-3d] badge: al tema le falta defaultBaseTextureUrl y fontUrl. ' +
				'Añade esas URLs al tema que registras con provideProducts3dBadgeTheme() ' +
				'o pasas por el input [theme]',
		);
	});

	it('treats an empty string URL as missing (an empty URL cannot load an asset)', () => {
		expect(() => assertValidBadgeTheme(makeTheme({ fontUrl: '' }))).toThrowError(
			/\[ngx-products-3d\] badge: al tema le falta fontUrl/,
		);
	});
});

describe('resolveBaseColor', () => {
	it('falls back to BADGE_BASE_COLOR (near-black #111111) when the theme defines no baseColor', () => {
		expect(resolveBaseColor(makeTheme())).toBe(BADGE_BASE_COLOR);
		expect(BADGE_BASE_COLOR).toBe('#111111');
	});

	it('returns theme.baseColor when defined', () => {
		expect(resolveBaseColor(makeTheme({ baseColor: '#123456' }))).toBe('#123456');
	});

	it('ignores colors.clip: the front backdrop is never tinted by the clip override', () => {
		expect(
			resolveBaseColor(makeTheme({ baseColor: '#123456', colors: { clip: '#ff0000' } })),
		).toBe('#123456');
		expect(resolveBaseColor(makeTheme({ colors: { clip: '#ff0000' } }))).toBe(BADGE_BASE_COLOR);
	});
});

describe('resolveClipColor', () => {
	it('falls back to BADGE_BASE_COLOR (near-black #111111) when neither colors.clip nor baseColor are defined', () => {
		expect(resolveClipColor(makeTheme())).toBe(BADGE_BASE_COLOR);
	});

	it('uses baseColor when only baseColor is defined', () => {
		expect(resolveClipColor(makeTheme({ baseColor: '#123456' }))).toBe('#123456');
	});

	it('gives colors.clip priority over baseColor', () => {
		expect(
			resolveClipColor(makeTheme({ baseColor: '#123456', colors: { clip: '#ff0000' } })),
		).toBe('#ff0000');
	});

	it('uses colors.clip when baseColor is absent', () => {
		expect(resolveClipColor(makeTheme({ colors: { clip: '#ff0000' } }))).toBe('#ff0000');
	});

	it('ignores unrelated color overrides (band/text) when resolving the metal tint', () => {
		expect(resolveClipColor(makeTheme({ colors: { band: '#00ff00', text: '#0000ff' } }))).toBe(
			BADGE_BASE_COLOR,
		);
	});
});

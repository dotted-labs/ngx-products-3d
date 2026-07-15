import type { Products3dBadgeTheme } from '../types';
import { assertValidBadgeTheme } from './badge-theme';

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

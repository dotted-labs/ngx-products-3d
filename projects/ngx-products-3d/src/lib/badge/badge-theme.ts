import type { Products3dBadgeTheme } from '../types';

const REQUIRED_THEME_URL_FIELDS = ['defaultBaseTextureUrl', 'fontUrl'] as const;

/**
 * Valida el tema resuelto: `defaultBaseTextureUrl` y `fontUrl` son obligatorios (ausentes o
 * vacíos → Error accionable con prefijo `[ngx-products-3d]`). Devuelve el tema intacto si es válido.
 */
export function assertValidBadgeTheme(theme: Products3dBadgeTheme): Products3dBadgeTheme {
	const missing = REQUIRED_THEME_URL_FIELDS.filter((field) => !theme[field]);
	if (missing.length > 0) {
		throw new Error(
			`[ngx-products-3d] badge: al tema le falta ${missing.join(' y ')}. ` +
				`Añade ${missing.length > 1 ? 'esas URLs' : 'esa URL'} al tema que registras con ` +
				'provideProducts3dBadgeTheme() o pasas por el input [theme]',
		);
	}
	return theme;
}

import type { Products3dBadgeTheme } from '../types';
import { BADGE_BASE_COLOR } from './badge.config';

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

/**
 * Color base del frente de la tarjeta: el que pinta el quad de fondo opaco de la escena de la
 * RenderTexture, visible allí donde el arte del tier es transparente (`baseColor` → default).
 */
export function resolveBaseColor(theme: Products3dBadgeTheme): string {
	return theme.baseColor ?? BADGE_BASE_COLOR;
}

/**
 * Color con el que se tiñe el metal de clip/clamp: `colors.clip` es el override específico y gana
 * al `baseColor` global, que a su vez cae al default. Siempre devuelve color (nunca `undefined`),
 * así que el tinte del metal deja de tener rama "sin color → material original del GLB".
 */
export function resolveClipColor(theme: Products3dBadgeTheme): string {
	return theme.colors?.clip ?? resolveBaseColor(theme);
}

import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import type { BadgeTextField } from './badge.config';

/** Textura base del frente por tier, con fallback obligatorio a `defaultBaseTextureUrl` si el tier no existe en `baseTextures`. */
export function resolveBaseTextureUrl(theme: Products3dBadgeTheme, tier: string): string {
	return theme.baseTextures[tier] ?? theme.defaultBaseTextureUrl;
}

/** Texto que pinta un slot del layout: nombre tal cual, número de socio con prefijo, tier en mayúsculas. */
export function badgeTextFor(
	member: BadgeMemberData,
	field: BadgeTextField,
	memberNumberPrefix: string,
): string {
	switch (field) {
		case 'name':
			return member.name;
		case 'memberNumber':
			return `${memberNumberPrefix}${member.memberNumber}`;
		case 'tier':
			return member.tier.toUpperCase();
	}
}

/**
 * Factor de escala para encajar un texto de ancho `bboxWidth` en `maxWidth`: reduce
 * los textos largos (maxWidth / bboxWidth) pero nunca agranda los cortos (clamp a <=1).
 * Un ancho no medible (geometría vacía → ±Infinity, NaN, <=0) devuelve 1 (sin escalar).
 */
export function fitTextScale(bboxWidth: number, maxWidth: number): number {
	if (!Number.isFinite(bboxWidth) || bboxWidth <= 0) {
		return 1;
	}
	return Math.min(1, maxWidth / bboxWidth);
}

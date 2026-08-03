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

/**
 * ¿El ratio `width / height` de un asset cae dentro de `tolerance` (desviación RELATIVA, 0.01 = 1%)
 * del ratio `target`? Se usa para avisar en dev de un arte del frente que saldría estirado.
 *
 * Dimensiones NO MEDIBLES —0, negativas, `NaN` o `±Infinity`— devuelven `true` a propósito: son un
 * recurso a medio cargar o un entorno que no expone el tamaño intrínseco de la imagen, no un asset
 * mal exportado. La validación existe para señalar arte con el ratio equivocado, no para gritar
 * sobre una medición ausente (mismo criterio que `fitTextScale` con un bbox no medible). Idem con un
 * `target` no medible: sin referencia válida no hay nada que comparar.
 */
export function isRatioWithinTolerance(
	width: number,
	height: number,
	target: number,
	tolerance: number,
): boolean {
	const measurable = (value: number): boolean => Number.isFinite(value) && value > 0;
	if (!measurable(width) || !measurable(height) || !measurable(target)) {
		return true;
	}
	return Math.abs(width / height - target) <= target * tolerance;
}

import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import type { BadgeTextAlign, BadgeTextField } from './badge.config';

/**
 * Rect de la cara frontal que consume `uvAnchorToRtPosition`: lo mínimo de `BADGE_FRONT_FACE` que
 * necesita la conversión. Se recibe por parámetro (no se importa la config) para que la fn siga
 * siendo pura y testeable contra un rect fijado a mano.
 */
export interface BadgeFaceRect {
	readonly width: number;
	readonly height: number;
}

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
 * Anclaje normalizado de un slot de texto → posición (x, y) en unidades de mundo de la escena RT.
 *
 * El anchor tiene el origen ABAJO-IZQUIERDA de la cara y `[1, 1]` en arriba-derecha, así que el
 * centro de la cara (el origen de la escena RT, que es lo que encuadra la cámara ortográfica) cae en
 * `[0.5, 0.5]`: `x = (u − 0.5) · face.width`, `y = (v − 0.5) · face.height`.
 *
 * **Trampa principal: NO son los UV del GLB.** En los UV de la tarjeta `v = 0` es el borde SUPERIOR
 * (`v = (1.125 − y) / 2.25`, convención glTF); aquí la V crece hacia ARRIBA, como la Y de la escena
 * RT. Las dos convenciones las concilia la inversión de V del `map`
 * (`BADGE_TEXTURE.mapRepeat`/`mapOffset`), no esta función: usar un UV del GLB como anchor coloca el
 * texto reflejado en vertical respecto al arte.
 *
 * El rect llega por parámetro (`BADGE_FRONT_FACE`), nunca literal: es la misma fuente del 1.6 × 2.25
 * que usan el FBO, el frustum y los quads del fondo.
 */
export function uvAnchorToRtPosition(
	anchor: readonly [number, number],
	face: BadgeFaceRect,
): [number, number] {
	const [u, v] = anchor;
	return [(u - 0.5) * face.width, (v - 0.5) * face.height];
}

/**
 * Desplazamiento en X que hay que sumar a la posición del anchor para que el borde `align` del texto
 * caiga sobre él. El origen de un `TextGeometry` está en el borde IZQUIERDO de la línea base (el
 * texto crece hacia +X), así que `left` no desplaza, `right` desplaza el ancho entero y `center` la
 * mitad.
 *
 * `bboxWidth` debe ser el ancho YA ESCALADO por `fitTextScale` (bbox crudo × escala): el mesh se
 * reduce alrededor de su origen, de modo que aplicar el offset sobre el ancho crudo separaría el
 * texto de su anchor en la misma proporción en que se hubiera reducido.
 *
 * Un ancho no medible (geometría vacía → `NaN`, `±Infinity`, `<= 0`) devuelve 0: sin medida no se
 * puede alinear, y dejar el texto en su anchor es preferible a mandarlo a `NaN` (mismo criterio que
 * `fitTextScale`, que en ese caso devuelve 1). El siguiente pase con la geometría ya creada lo
 * coloca.
 */
export function alignOffsetX(bboxWidth: number, align: BadgeTextAlign): number {
	if (!Number.isFinite(bboxWidth) || bboxWidth <= 0) {
		return 0;
	}
	switch (align) {
		case 'left':
			return 0;
		case 'center':
			return -bboxWidth / 2;
		case 'right':
			return -bboxWidth;
	}
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

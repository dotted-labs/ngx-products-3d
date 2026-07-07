import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';

/**
 * Escena secundaria renderizada a textura (frente de la tarjeta):
 * textura base por tier + Text3D con datos del socio.
 * Stub — impl completa en spec-03 (Fase 4).
 */
@Component({
	selector: 'products-3d-badge-texture',
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeTexture {
	readonly member = input.required<BadgeMemberData>();
	readonly theme = input.required<Products3dBadgeTheme>();

	/** Textura base por tier con fallback obligatorio */
	protected readonly baseTextureUrl = computed(() => {
		const theme = this.theme();
		return theme.baseTextures[this.member().tier] ?? theme.defaultBaseTextureUrl;
	});
}

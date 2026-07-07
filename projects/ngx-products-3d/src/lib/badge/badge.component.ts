import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';

/**
 * Acreditación 3D de socio. Wrapper todo-en-uno (canvas incluido en spec-02).
 *
 * Consumo recomendado (SSR/hydration): envolver en `@defer (on viewport)`
 * con `@placeholder` estático. Ver README.
 */
@Component({
	selector: 'products-3d-badge',
	template: `
		<!-- spec-02: <ngt-canvas> + NgtrPhysics + escena -->
		<p>badge stub — member: {{ member().name }} · tier: {{ resolvedTheme() ? member().tier : '' }}</p>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadge {
	/** Datos del socio renderizados en la tarjeta */
	readonly member = input.required<BadgeMemberData>();

	/** Tema. Si no se pasa, cae al token PRODUCTS_3D_BADGE_THEME */
	readonly theme = input<Products3dBadgeTheme>();

	/** Debug de física (spec-02) */
	readonly debug = input<boolean>(false);

	private readonly themeFromToken = inject(PRODUCTS_3D_BADGE_THEME, { optional: true });

	protected readonly resolvedTheme = computed<Products3dBadgeTheme>(() => {
		const theme = this.theme() ?? this.themeFromToken;
		if (!theme) {
			throw new Error(
				'[ngx-products-3d] badge: no theme. Pasa [theme] o provideProducts3dBadgeTheme()',
			);
		}
		return theme;
	});
}

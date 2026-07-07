import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';

/**
 * Escena física del badge: cadena de rigid bodies + correa + drag.
 * Stub — impl completa en spec-02 (Fases 0–2).
 *
 * Exportado también para consumidores con canvas propio (composición
 * con otros elementos 3D futuros, spec-03 Fase 5).
 */
@Component({
	selector: 'products-3d-badge-scene',
	template: ``,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeScene {
	readonly member = input.required<BadgeMemberData>();
	readonly theme = input.required<Products3dBadgeTheme>();
	readonly debug = input<boolean>(false);
}

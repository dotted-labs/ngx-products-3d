import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	PLATFORM_ID,
} from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { NgtrPhysics } from 'angular-three-rapier';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadgeScene } from './badge-scene.component';
import { BADGE_CAMERA, BADGE_PHYSICS } from './badge.config';

/**
 * Acreditación 3D de socio. Wrapper todo-en-uno: canvas + mundo físico + escena.
 *
 * Consumo recomendado (SSR/hydration): envolver en `@defer (on viewport)` con
 * `@placeholder` estático. La app consumidora debe registrar `provideNgtRenderer()`
 * (de `angular-three/dom`) en los providers de su ruta: devuelve
 * `EnvironmentProviders`, que Angular no admite en providers de componente.
 * Ver README.
 */
@Component({
	selector: 'products-3d-badge',
	template: `
		@if (isBrowser) {
			<ngt-canvas [camera]="camera">
				<ng-template canvasContent>
					<ngtr-physics [options]="physicsOptions()">
						<ng-template>
							<products-3d-badge-scene [member]="member()" [theme]="resolvedTheme()" />
						</ng-template>
					</ngtr-physics>
				</ng-template>
			</ngt-canvas>
		}
	`,
	styles: `
		:host {
			display: block;
		}
	`,
	imports: [NgtCanvas, NgtrPhysics, Products3dBadgeScene],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadge {
	/** Datos del socio renderizados en la tarjeta */
	readonly member = input.required<BadgeMemberData>();

	/** Tema. Si no se pasa, cae al token PRODUCTS_3D_BADGE_THEME */
	readonly theme = input<Products3dBadgeTheme>();

	/** Debug de física (passthrough a NgtrPhysics) */
	readonly debug = input<boolean>(false);

	private readonly themeFromToken = inject(PRODUCTS_3D_BADGE_THEME, { optional: true });

	// Guard SSR: canvas y física solo montan en browser; en server el template queda vacío
	protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	protected readonly camera = BADGE_CAMERA;

	protected readonly physicsOptions = computed(() => ({
		gravity: BADGE_PHYSICS.gravity,
		timeStep: BADGE_PHYSICS.timeStep,
		interpolate: true,
		debug: this.debug(),
	}));

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

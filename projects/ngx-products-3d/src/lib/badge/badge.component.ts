import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	PLATFORM_ID,
} from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { NgtrPhysics } from 'angular-three-rapier';
import { NgtsEnvironment, NgtsLightformer } from 'angular-three-soba/staging';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadgeScene } from './badge-scene.component';
import { BADGE_CAMERA, BADGE_LIGHTING, BADGE_PHYSICS } from './badge.config';

/**
 * Acreditación 3D de socio. Wrapper todo-en-uno: canvas + mundo físico + escena.
 *
 * Consumo recomendado (SSR/hydration): envolver en `@defer (on viewport)` con
 * `@placeholder` estático. La app consumidora debe registrar `provideNgtRenderer()`
 * (de `angular-three/dom`) en los providers de su ruta: devuelve
 * `EnvironmentProviders`, que Angular no admite en providers de componente.
 *
 * IMPORTANTE (detección de cambios): el badge carga geometría/física de forma async
 * (WASM de Rapier, `gltfResource`, `textureResource`, `NgtsEnvironment`) y todo su
 * contenido visible vive detrás de `@if` de recursos. La app consumidora DEBE tener un
 * scheduler de CD que reaccione a signals: `provideZonelessChangeDetection()` en apps
 * zoneless (sin zone.js) o `provideZoneChangeDetection()` + zone.js. Sin él, la escena no
 * se pinta hasta que un evento del DOM fuerza un ciclo de CD. Ver README.
 */
@Component({
	selector: 'products-3d-badge',
	template: `
		@if (isBrowser) {
			<ngt-canvas [camera]="camera">
				<ng-template canvasContent>
					<!--
						Iluminación: hermana de la física (las luces y el environment no son cuerpos
						físicos). El ambient da relleno; el <ngts-environment> proyecta los
						<ngts-lightformer> hijos como reflejos sobre el clearcoat de la tarjeta. Los
						lightformers van dentro de un <ng-template> porque NgtsEnvironment consume su
						contenido vía contentChild(TemplateRef) → lo renderiza en una escena virtual
						(portal); sin ese template caería al cube por defecto (carga ficheros → red).
					-->
					<ngt-ambient-light [intensity]="ambientIntensity" />
					<ngts-environment [options]="environmentOptions">
						<ng-template>
							@for (lightformer of lightformers; track $index) {
								<ngts-lightformer [options]="lightformer" />
							}
						</ng-template>
					</ngts-environment>
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
	imports: [NgtCanvas, NgtrPhysics, NgtsEnvironment, NgtsLightformer, Products3dBadgeScene],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
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

	// Intensidad del ambient. Math.PI (no 1) por la iluminación físicamente correcta de
	// three r155+: con la escala lineal actual una ambientLight de 1 queda apagada; ver
	// BADGE_LIGHTING. Data-driven: sin números mágicos en el componente.
	protected readonly ambientIntensity = BADGE_LIGHTING.ambientIntensity;
	protected readonly environmentOptions = BADGE_LIGHTING.environment;
	protected readonly lightformers = BADGE_LIGHTING.lightformers;

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

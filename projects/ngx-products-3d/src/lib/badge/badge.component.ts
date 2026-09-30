import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	effect,
	inject,
	input,
	output,
	PLATFORM_ID,
	signal,
	untracked,
} from '@angular/core';
import type { Camera } from 'three';
import type { NgtState } from 'angular-three';
import { NgtCanvas } from 'angular-three/dom';
import { NgtrPhysics } from 'angular-three-rapier';
import { NgtsEnvironment, NgtsLightformer } from 'angular-three-soba/staging';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeCamera, Products3dBadgeTheme } from '../types';
import { applyBadgeCamera, badgeCanvasCamera, resolveBadgeCamera } from './badge-camera';
import { Products3dBadgeScene } from './badge-scene.component';
import { assertValidBadgeTheme } from './badge-theme';
import { BADGE_LIGHTING, BADGE_LOOP_PRIORITY, BADGE_PHYSICS } from './badge.config';

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
			<!--
				La cámara del canvas se crea con canvasCamera() (leída una vez) y, como el canvas no
				reaplica sus options a una cámara ya creada, los cambios posteriores del input camera los
				aplica el effect del constructor sobre la instancia que entrega (created).
			-->
			<ngt-canvas [camera]="canvasCamera()" (created)="onCanvasCreated($event)">
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
							<products-3d-badge-scene
								[member]="member()"
								[theme]="resolvedTheme()"
								[camera]="resolvedCamera()"
								(ready)="onSceneReady()"
							/>
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

	/**
	 * Cámara: `fov` vertical (grados) y `distance` al badge. Opcional; sin él, `BADGE_CAMERA`. Sirve
	 * para agrandar la tarjeta sin agrandar el contenedor (menos `distance` o menos `fov`). Valores
	 * inválidos caen al default con aviso dev; se puede cambiar en caliente (la caída no se repite).
	 */
	readonly camera = input<Products3dBadgeCamera>();

	/**
	 * El badge terminó de cargar y se soltó (cae o, con movimiento reducido, aparece en reposo). Una
	 * sola vez; re-emisión del `ready` de `Products3dBadgeScene`.
	 */
	readonly ready = output<void>();

	private readonly themeFromToken = inject(PRODUCTS_3D_BADGE_THEME, { optional: true });

	// Guard SSR: canvas y física solo montan en browser; en server el template queda vacío
	protected readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

	/** Cámara ya creada del canvas (output `created`), destino de los cambios en caliente */
	private readonly canvasCameraRef = signal<Camera | undefined>(undefined);

	// Intensidad del ambient. Math.PI (no 1) por la iluminación físicamente correcta de
	// three r155+: con la escala lineal actual una ambientLight de 1 queda apagada; ver
	// BADGE_LIGHTING. Data-driven: sin números mágicos en el componente.
	protected readonly ambientIntensity = BADGE_LIGHTING.ambientIntensity;
	protected readonly environmentOptions = BADGE_LIGHTING.environment;
	protected readonly lightformers = BADGE_LIGHTING.lightformers;

	/**
	 * Cámara resuelta: defaults, fallback con aviso dev y distancia acotada para que el anclaje de la
	 * correa no asome. La recibe también la escena, que deriva de ella la correa y
	 * la pose de salida; como ya va resuelta, la escena no vuelve a avisar.
	 */
	protected readonly resolvedCamera = computed(() => resolveBadgeCamera(this.camera()));
	/**
	 * Options de cámara del `<ngt-canvas>`, leídas UNA vez (primer CD): el canvas solo las usa al crear
	 * su cámara, y cada options nuevas le harían re-configurarse entero (incluido un `gl.setSize` que
	 * reasigna el buffer del canvas) para nada. Los cambios posteriores, e incluso uno que llegue antes
	 * de que exista la cámara, los aplica el effect del constructor al recibir `(created)`.
	 */
	protected readonly canvasCamera = computed(() =>
		untracked(() => badgeCanvasCamera(this.resolvedCamera())),
	);

	// updatePriority: el paso físico corre ANTES de la correa de la escena, que se construye con la
	// pose ya interpolada del frame (orden completo del loop en BADGE_LOOP_PRIORITY).
	protected readonly physicsOptions = computed(() => ({
		gravity: BADGE_PHYSICS.gravity,
		timeStep: BADGE_PHYSICS.timeStep,
		interpolate: true,
		updatePriority: BADGE_LOOP_PRIORITY.physicsStep,
		debug: this.debug(),
	}));

	// Validación temprana: este computed se evalúa en el primer CD del wrapper (binding
	// [theme] de la escena), antes de cargar recursos o arrancar el loop de render. Un tema
	// inválido revienta aquí con Error accionable, nunca a mitad de frame ni en silencio.
	protected readonly resolvedTheme = computed<Products3dBadgeTheme>(() => {
		const theme = this.theme() ?? this.themeFromToken;
		if (!theme) {
			throw new Error(
				'[ngx-products-3d] badge: no theme. Pasa [theme] o provideProducts3dBadgeTheme()',
			);
		}
		return assertValidBadgeTheme(theme);
	});

	constructor() {
		// Cámara en caliente: <ngt-canvas> crea su cámara UNA vez con canvasCamera() y, re-configurado
		// con otras options, no la toca (compara contra las options de la primera vez, no contra la
		// instancia). Así que cada cambio del input camera se aplica aquí sobre la instancia creada.
		// One-shot por cambio, no por frame; aplicarla al crearse es idempotente (mismos valores).
		effect(() => {
			const target = this.canvasCameraRef();
			if (target) {
				applyBadgeCamera(target, this.resolvedCamera());
			}
		});
	}

	/** El canvas creó su store: se guarda su cámara para aplicarle los cambios del input `camera`. */
	protected onCanvasCreated(state: NgtState): void {
		this.canvasCameraRef.set(state.camera);
	}

	/** Re-emite el `ready` de la escena hacia la app consumidora. */
	protected onSceneReady(): void {
		this.ready.emit();
	}
}

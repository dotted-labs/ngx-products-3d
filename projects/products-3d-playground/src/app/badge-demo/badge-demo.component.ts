import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
	BADGE_BASE_COLOR,
	BADGE_CAMERA_DEFAULTS,
	BADGE_TEXT,
	Products3dBadge,
	type BadgeMemberData,
	type Products3dBadgeCamera,
	type Products3dBadgeTheme,
} from '@dotted-labs/ngx-products-3d';
import { Color } from 'three';

type DemoThemeKey = 'violet' | 'ember';

/**
 * Tema demo SIN `baseColor` (spec-04 R4): lo que se ve en pantalla es el default de la lib
 * (`BADGE_BASE_COLOR`). Omitirlo del tipo convierte en error de compilación que alguien vuelva a
 * fijarlo en un tema demo. El color base solo lo pone el control del formulario.
 */
type DemoTheme = Omit<Products3dBadgeTheme, 'baseColor'>;

/**
 * `<input type="color">` solo acepta `#rrggbb` en minúsculas: con cualquier otra cosa el navegador
 * lo sanea a `#000000` sin avisar. El fallback del texto de la lib es un nombre CSS
 * (`BADGE_TEXT.color` = `'black'`), así que se normaliza con el parser de color de three — el mismo
 * que acaba aplicando el color al material, de modo que el control enseña lo que se pinta.
 */
function toColorInputValue(color: string): string {
	return `#${new Color(color).getHexString()}`;
}

/** Valor inicial del control de color base: el default de la lib (ningún tema demo lo fija) */
function initialBaseColor(): string {
	return toColorInputValue(BADGE_BASE_COLOR);
}

/** Valor inicial del control de color de texto: el mismo fallback que aplica la lib a los textos */
function initialTextColor(theme: DemoTheme): string {
	return toColorInputValue(theme.colors?.text ?? BADGE_TEXT.color);
}

// Único arte frontal de la demo: 800 × 1125 px (ratio 32:45 exacto, el de la cara de
// membresia.glb) y con canal alfa — un tercio de sus píxeles es totalmente transparente,
// que es por donde asoma el baseColor del tema.
const FRONT_ART_URL = '/assets/badge_vitality.png';
// Fixture del aviso de ratio (spec-03-F4v2 T5): 256 × 256 → ratio 1.0 contra el 0.7111
// esperado. Cableado a un tier a propósito: la lib avisa en dev y sigue renderizando el
// frente (estirado). NO borrar: es la única forma de ver ese camino en la demo.
const WRONG_RATIO_ART_URL = '/assets/base-wrong-ratio.png';

// GOTCHA (resolvedTheme de la lib): el input [theme] PISA por completo al tema del
// provideProducts3dBadgeTheme de badge-demo.routes.ts (no hay merge). El tema 'violet'
// debe mantenerse IDÉNTICO al del provider para que ambas fuentes no diverjan.
const DEMO_THEMES: Record<DemoThemeKey, DemoTheme> = {
	violet: {
		bandTextureUrl: '/assets/band.png',
		baseTextures: {
			gold: FRONT_ART_URL,
			silver: WRONG_RATIO_ART_URL,
		},
		defaultBaseTextureUrl: FRONT_ART_URL,
		fontUrl: '/assets/Ballega.otf',
		// Sin baseColor ni colors a propósito (spec-04 R4): este tema enseña los defaults de la
		// lib. El frente muestra BADGE_BASE_COLOR (#111111) por las zonas transparentes del arte,
		// el metal de clip/clamp se tiñe con ese mismo color (no hay colors.clip que lo pise,
		// así que sale casi negro) y los textos salen en BADGE_TEXT.color. Para otro metal:
		// control «Color base» del formulario, o colors.clip como en ember.
	},
	ember: {
		// Misma correa que violet: band.png es arte blanco sobre alfa (neutro/tintable), la
		// diferencia entre temas la marca colors.band (no hay una textura de correa por tema).
		bandTextureUrl: '/assets/band.png',
		// Sin entradas por tier a propósito: TODOS los tiers caen en defaultBaseTextureUrl.
		// Es el camino de fallback de la lib y, de paso, el tema sin ningún asset de ratio
		// inválido (cero warns en consola mientras esté seleccionado).
		baseTextures: {},
		defaultBaseTextureUrl: FRONT_ART_URL,
		fontUrl: '/assets/Ballega.otf',
		// Tampoco fija baseColor (spec-04 R4): el frente enseña el mismo #111111 que violet.
		// Alternar temas se nota en correa (tinte), clip (metal cobrizo) y texto.
		// colors.clip gana a baseColor en el metal: es el override específico de la lib, así
		// que el control «Color base» aquí solo cambia el frente.
		colors: {
			band: '#ffe3c2',
			clip: '#b45309',
			text: '#2a1205',
		},
	},
};

const INITIAL_THEME_KEY: DemoThemeKey = 'violet';

/**
 * Rangos de los sliders de cámara (demo, no config de la lib). La distancia llega a propósito más
 * allá del máximo que acepta la lib con el fov por defecto (≈ 16.9 a 25°): al pasarlo, la lib acorta
 * la distancia y avisa en consola (el anclaje de la correa no llega a verse). El fov tampoco se
 * limita a lo "bonito": la N3 mira también los extremos.
 */
const CAMERA_CONTROLS = {
	fov: { min: 10, max: 60, step: 1 },
	distance: { min: 5, max: 22, step: 0.5 },
} as const;

@Component({
	selector: 'app-badge-demo',
	imports: [Products3dBadge],
	template: `
		@defer (on viewport) {
			<products-3d-badge
				[member]="member()"
				[theme]="theme()"
				[camera]="camera()"
				[debug]="debug()"
			/>
		} @placeholder {
			<div class="badge-placeholder">Cargando badge…</div>
		}

		<!-- Controles fuera del @defer: mutan signals, nunca re-montan el canvas -->
		<div class="controls">
			<label>
				Nombre
				<input type="text" [value]="member().name" (input)="onNameInput($event)" />
			</label>
			<label>
				Nº socio
				<input type="text" [value]="member().memberNumber" (input)="onMemberNumberInput($event)" />
			</label>
			<label>
				Tier
				<select [value]="member().tier" (change)="onTierChange($event)">
					@for (tier of tierOptions; track tier.value) {
						<option [value]="tier.value">{{ tier.label }}</option>
					}
				</select>
			</label>
			<label>
				Tema
				<select [value]="themeKey()" (change)="onThemeChange($event)">
					@for (option of themeOptions; track option.key) {
						<option [value]="option.key">{{ option.label }}</option>
					}
				</select>
			</label>
			<label>
				Color base
				<input type="color" [value]="baseColor()" (input)="onBaseColorInput($event)" />
			</label>
			<label>
				Color texto
				<input type="color" [value]="textColor()" (input)="onTextColorInput($event)" />
			</label>
			<label>
				Cámara fov: {{ cameraFov() }}°
				<input
					type="range"
					[min]="cameraControls.fov.min"
					[max]="cameraControls.fov.max"
					[step]="cameraControls.fov.step"
					[value]="cameraFov()"
					(input)="onCameraFovInput($event)"
				/>
			</label>
			<label>
				Cámara distancia: {{ cameraDistance() }}
				<input
					type="range"
					[min]="cameraControls.distance.min"
					[max]="cameraControls.distance.max"
					[step]="cameraControls.distance.step"
					[value]="cameraDistance()"
					(input)="onCameraDistanceInput($event)"
				/>
			</label>
			<button type="button" (click)="onCameraReset()">Cámara por defecto</button>
			<label class="debug">
				<input type="checkbox" [checked]="debug()" (change)="debug.set(!debug())" />
				debug física
			</label>
		</div>
	`,
	styles: `
		:host {
			display: block;
			padding: 1rem;
            height: 97vh;
		}

		products-3d-badge,
		.badge-placeholder {
			height: 100%;
		}

		/* Fondo oscuro: el placeholder blanco de la tarjeta es invisible sobre blanco */
		products-3d-badge {
			display: block;
			background: hsl(215deg 32.02% 1.31% / 96%);
			border-radius: 0.5rem;
		}

		.badge-placeholder {
			display: grid;
			place-items: center;
			background: #f3f4f6;
			border-radius: 0.5rem;
		}

		.controls {
			display: flex;
			flex-wrap: wrap;
			align-items: end;
			gap: 1rem;
			margin-top: 1rem;
			font: 0.875rem/1.4 system-ui, sans-serif;
		}

		.controls label {
			display: grid;
			gap: 0.25rem;
		}

		.controls input[type='text'],
		.controls input[type='color'],
		.controls select {
			padding: 0.375rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 0.375rem;
			background: #fff;
			font: inherit;
		}

		.controls input[type='color'] {
			inline-size: 4rem;
			block-size: 2.25rem;
			padding: 0.125rem;
		}

		.controls button {
			padding: 0.375rem 0.75rem;
			border: 1px solid #d1d5db;
			border-radius: 0.375rem;
			background: #fff;
			font: inherit;
			cursor: pointer;
		}

		.controls .debug {
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeDemoComponent {
	protected readonly debug = signal(false);

	protected readonly member = signal<BadgeMemberData>({
		name: 'Sergio',
		memberNumber: '0042',
		tier: 'gold',
	});

	// 'bronze' NO existe en baseTextures de ningún tema demo: verifica visualmente
	// el fallback a defaultBaseTextureUrl con un tier desconocido. 'silver' apunta al
	// asset 256×256 en el tema violet: es el que dispara el aviso de ratio en dev.
	protected readonly tierOptions = [
		{ value: 'gold', label: 'gold' },
		{ value: 'silver', label: 'silver (violet → ratio inválido, warn dev)' },
		{ value: 'bronze', label: 'bronze (desconocido → default)' },
	] as const;

	protected readonly themeOptions = [
		{ key: 'violet', label: 'Violeta (marca)' },
		{ key: 'ember', label: 'Ember (cobre)' },
	] as const satisfies readonly { key: DemoThemeKey; label: string }[];

	protected readonly themeKey = signal<DemoThemeKey>(INITIAL_THEME_KEY);

	// Control en caliente del baseColor. Ningún tema demo lo fija, así que arranca en el default
	// de la lib (BADGE_BASE_COLOR) y vuelve a él al cambiar de tema; a partir de ahí manda el
	// formulario.
	protected readonly baseColor = signal(initialBaseColor());

	// Control en caliente de colors.text. Arranca en el color que la lib pintaría para el tema
	// inicial (colors.text ?? BADGE_TEXT.color) y lo sigue al cambiar de tema, porque ember trae
	// el suyo; a partir de ahí manda el formulario.
	protected readonly textColor = signal(initialTextColor(DEMO_THEMES[INITIAL_THEME_KEY]));

	// baseColor y colors.text del formulario se superponen al tema demo: mismo objeto de tema
	// salvo esos dos campos (colors se mergea para conservar band/clip de ember). Cambiarlos
	// repinta el fondo del frente (lo que asoma por el alpha del arte), el metal de clip/clamp
	// sin colors.clip y los tres textos, sin remontar el canvas: es un binding, no un provider.
	protected readonly theme = computed<Products3dBadgeTheme>(() => {
		const demo = DEMO_THEMES[this.themeKey()];
		return {
			...demo,
			baseColor: this.baseColor(),
			colors: { ...demo.colors, text: this.textColor() },
		};
	});

	protected readonly cameraControls = CAMERA_CONTROLS;

	// Controles en caliente de la cámara (input camera de la lib). Arrancan en la cámara por defecto
	// de la lib (BADGE_CAMERA_DEFAULTS): mismo patrón signal + computed que los colores. Cambiarlos
	// aplica la cámara al canvas existente, sin remontarlo y sin repetir la caída.
	protected readonly cameraFov = signal<number>(BADGE_CAMERA_DEFAULTS.fov);
	protected readonly cameraDistance = signal<number>(BADGE_CAMERA_DEFAULTS.distance);
	protected readonly camera = computed<Products3dBadgeCamera>(() => ({
		fov: this.cameraFov(),
		distance: this.cameraDistance(),
	}));

	protected onNameInput(event: Event): void {
		const name = (event.target as HTMLInputElement).value;
		this.member.update((member) => ({ ...member, name }));
	}

	protected onMemberNumberInput(event: Event): void {
		const memberNumber = (event.target as HTMLInputElement).value;
		this.member.update((member) => ({ ...member, memberNumber }));
	}

	protected onTierChange(event: Event): void {
		const tier = (event.target as HTMLSelectElement).value;
		this.member.update((member) => ({ ...member, tier }));
	}

	protected onThemeChange(event: Event): void {
		const key = (event.target as HTMLSelectElement).value as DemoThemeKey;
		this.themeKey.set(key);
		this.baseColor.set(initialBaseColor());
		this.textColor.set(initialTextColor(DEMO_THEMES[key]));
	}

	protected onBaseColorInput(event: Event): void {
		this.baseColor.set((event.target as HTMLInputElement).value);
	}

	protected onTextColorInput(event: Event): void {
		this.textColor.set((event.target as HTMLInputElement).value);
	}

	protected onCameraFovInput(event: Event): void {
		this.cameraFov.set((event.target as HTMLInputElement).valueAsNumber);
	}

	protected onCameraDistanceInput(event: Event): void {
		this.cameraDistance.set((event.target as HTMLInputElement).valueAsNumber);
	}

	protected onCameraReset(): void {
		this.cameraFov.set(BADGE_CAMERA_DEFAULTS.fov);
		this.cameraDistance.set(BADGE_CAMERA_DEFAULTS.distance);
	}
}

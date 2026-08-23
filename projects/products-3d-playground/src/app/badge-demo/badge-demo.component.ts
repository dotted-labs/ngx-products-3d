import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
	Products3dBadge,
	type BadgeMemberData,
	type Products3dBadgeTheme,
} from '@dotted-labs/ngx-products-3d';

type DemoThemeKey = 'violet' | 'ember';

/** Tema demo con `baseColor` obligatorio: el control del formulario arranca desde él */
type DemoTheme = Products3dBadgeTheme & { baseColor: string };

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
		fontUrl: '/assets/font.json',
		// Sin baseColor explícito el clip/clamp de este tema saldría negro (no define
		// colors.clip): con él, el metal se tiñe de violeta y el frente enseña ese mismo
		// color por las zonas transparentes del arte.
		baseColor: '#3b0764',
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
		fontUrl: '/assets/font.json',
		// baseColor distinto al de violet: alternar temas debe notarse en el frente (color
		// que asoma por el alpha del arte) aunque el arte sea el mismo fichero.
		baseColor: '#7c2d12',
		// colors distintos a propósito: el cambio de tema debe notarse también en
		// correa (tinte), clip (metal cobrizo) y texto, no solo en las texturas.
		// colors.clip gana a baseColor en el metal: es el override específico de la lib.
		colors: {
			band: '#ffe3c2',
			clip: '#b45309',
			text: '#2a1205',
		},
	},
};

const INITIAL_THEME_KEY: DemoThemeKey = 'violet';

@Component({
	selector: 'app-badge-demo',
	imports: [Products3dBadge],
	template: `
		@defer (on viewport) {
			<products-3d-badge [member]="member()" [theme]="theme()" [debug]="debug()" />
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

	// Control en caliente del baseColor del tema. Arranca en el del tema inicial y lo sigue
	// al cambiar de tema (cada tema demo trae el suyo); a partir de ahí manda el formulario.
	protected readonly baseColor = signal(DEMO_THEMES[INITIAL_THEME_KEY].baseColor);

	// El baseColor del formulario se superpone al del tema demo: mismo objeto de tema salvo
	// ese campo. Cambiarlo repinta el fondo del frente (lo que asoma por el alpha del arte) y
	// el metal de clip/clamp, sin remontar el canvas — es un binding, no un provider.
	protected readonly theme = computed<Products3dBadgeTheme>(() => ({
		...DEMO_THEMES[this.themeKey()],
		baseColor: this.baseColor(),
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
		this.baseColor.set(DEMO_THEMES[key].baseColor);
	}

	protected onBaseColorInput(event: Event): void {
		this.baseColor.set((event.target as HTMLInputElement).value);
	}
}

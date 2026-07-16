import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import {
	Products3dBadge,
	type BadgeMemberData,
	type Products3dBadgeTheme,
} from '@dotted-labs/ngx-products-3d';

type DemoThemeKey = 'violet' | 'ember';

// GOTCHA (resolvedTheme de la lib): el input [theme] PISA por completo al tema del
// provideProducts3dBadgeTheme de badge-demo.routes.ts (no hay merge). El tema 'violet'
// debe mantenerse IDÉNTICO al del provider para que ambas fuentes no diverjan.
const DEMO_THEMES: Record<DemoThemeKey, Products3dBadgeTheme> = {
	violet: {
		bandTextureUrl: '/assets/band.png',
		baseTextures: {
			gold: '/assets/base-gold.png',
			silver: '/assets/base-silver.png',
		},
		defaultBaseTextureUrl: '/assets/base-default.png',
		fontUrl: '/assets/font.json',
	},
	ember: {
		bandTextureUrl: '/assets/band-ember.png',
		baseTextures: {
			gold: '/assets/base-ember-gold.png',
			silver: '/assets/base-ember-silver.png',
		},
		defaultBaseTextureUrl: '/assets/base-ember-default.png',
		fontUrl: '/assets/font.json',
		// colors distintos a propósito: el cambio de tema debe notarse también en
		// correa (tinte), clip (metal cobrizo) y texto, no solo en las texturas.
		colors: {
			band: '#ffe3c2',
			clip: '#b45309',
			text: '#2a1205',
		},
	},
};

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
		.controls select {
			padding: 0.375rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 0.375rem;
			background: #fff;
			font: inherit;
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
	// el fallback a defaultBaseTextureUrl con un tier desconocido.
	protected readonly tierOptions = [
		{ value: 'gold', label: 'gold' },
		{ value: 'silver', label: 'silver' },
		{ value: 'bronze', label: 'bronze (desconocido → default)' },
	] as const;

	protected readonly themeOptions = [
		{ key: 'violet', label: 'Violeta (marca)' },
		{ key: 'ember', label: 'Ember (cobre)' },
	] as const satisfies readonly { key: DemoThemeKey; label: string }[];

	protected readonly themeKey = signal<DemoThemeKey>('violet');

	protected readonly theme = computed<Products3dBadgeTheme>(() => DEMO_THEMES[this.themeKey()]);

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
		this.themeKey.set((event.target as HTMLSelectElement).value as DemoThemeKey);
	}
}

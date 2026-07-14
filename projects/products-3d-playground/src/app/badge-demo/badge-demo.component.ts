import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import {
	Products3dBadge,
	type BadgeMemberData,
	type Products3dBadgeTheme,
} from '@dotted-labs/ngx-products-3d';

@Component({
	selector: 'app-badge-demo',
	imports: [Products3dBadge],
	template: `
		@defer (on viewport) {
			<products-3d-badge [member]="member()" [theme]="theme()" [debug]="debug()" />
		} @placeholder {
			<div class="badge-placeholder">Cargando badge…</div>
		}

		<label>
			<input type="checkbox" [checked]="debug()" (change)="debug.set(!debug())" />
			debug física
		</label>
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

		label {
			display: block;
			margin-top: 1rem;
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgeDemoComponent {
	readonly debug = signal(false);

	readonly member = signal<BadgeMemberData>({
		name: 'Sergio',
		memberNumber: '0042',
		tier: 'silverFUnc',
	});

	readonly theme = signal<Products3dBadgeTheme>({
		bandTextureUrl: '/assets/band.png',
		baseTextures: {
			gold: '/assets/base-gold.png',
			silver: '/assets/base-silver.png',
		},
		defaultBaseTextureUrl: '/assets/base-default.png',
		fontUrl: '/assets/font.json',
	});
}

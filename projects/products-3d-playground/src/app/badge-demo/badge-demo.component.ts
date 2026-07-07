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
		}

		.badge-placeholder {
			min-height: 12rem;
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
		tier: 'gold',
	});

	readonly theme = signal<Products3dBadgeTheme>({
		bandTextureUrl: '/assets/band.jpg',
		baseTextures: {
			gold: '/assets/base-gold.jpg',
			silver: '/assets/base-silver.jpg',
		},
		defaultBaseTextureUrl: '/assets/base-default.jpg',
		fontUrl: '/assets/font.json',
	});
}

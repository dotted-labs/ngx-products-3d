import type { Routes } from '@angular/router';
import { provideProducts3d, provideProducts3dBadgeTheme } from '@dotted-labs/ngx-products-3d';

export const appRoutes: Routes = [
	{
		path: '',
		providers: [
			provideProducts3d({ cardModelUrl: '/assets/card.glb' }),
			provideProducts3dBadgeTheme({
				bandTextureUrl: '/assets/band.jpg',
				baseTextures: {
					gold: '/assets/base-gold.jpg',
					silver: '/assets/base-silver.jpg',
				},
				defaultBaseTextureUrl: '/assets/base-default.jpg',
				fontUrl: '/assets/font.json',
			}),
		],
		loadComponent: () =>
			import('./badge-demo/badge-demo.component').then((m) => m.BadgeDemoComponent),
	},
];

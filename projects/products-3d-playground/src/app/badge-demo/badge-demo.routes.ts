import type { Routes } from '@angular/router';
import { provideNgtRenderer } from 'angular-three/dom';
import { provideProducts3d, provideProducts3dBadgeTheme } from '@dotted-labs/ngx-products-3d';
import { BadgeDemoComponent } from './badge-demo.component';

export const badgeDemoRoutes: Routes = [
	{
		path: '',
		providers: [
			// EnvironmentProviders → nivel ruta (no cabe en providers de componente).
			// Ruta lazy para que angular-three/three no entren en el bundle inicial.
			provideNgtRenderer(),
			provideProducts3d({ cardModelUrl: '/assets/card.glb' }),
			provideProducts3dBadgeTheme({
				bandTextureUrl: '/assets/band.png',
				baseTextures: {
					gold: '/assets/base-gold.png',
					silver: '/assets/base-silver.png',
				},
				defaultBaseTextureUrl: '/assets/base-default.png',
				fontUrl: '/assets/font.json',
			}),
		],
		component: BadgeDemoComponent,
	},
];

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
			provideProducts3d({ cardModelUrl: '/assets/membresia.glb' }),
			// GOTCHA: el componente demo pasa [theme] y ese input PISA por completo a este
			// provider (resolvedTheme no hace merge). Este tema debe mantenerse IDÉNTICO al
			// tema 'violet' de DEMO_THEMES en badge-demo.component.ts para no divergir.
			provideProducts3dBadgeTheme({
				bandTextureUrl: '/assets/band.jpg',
				baseTextures: {
					// badge_vitality.png: 800 × 1125 (ratio 32:45) con alfa.
					gold: '/assets/badge_vitality.png',
					// base-wrong-ratio.png: 256 × 256, fixture del aviso de ratio en dev.
					silver: '/assets/base-wrong-ratio.png',
				},
				defaultBaseTextureUrl: '/assets/badge_vitality.png',
				fontUrl: '/assets/font.json',
				baseColor: '#3b0764',
			}),
		],
		component: BadgeDemoComponent,
	},
];

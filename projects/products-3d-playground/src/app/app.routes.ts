import type { Routes } from '@angular/router';

export const appRoutes: Routes = [
	{
		path: '',
		loadChildren: () => import('./badge-demo/badge-demo.routes').then((m) => m.badgeDemoRoutes),
	},
];

import {
	ApplicationConfig,
	provideBrowserGlobalErrorListeners,
	provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
	providers: [
		// El proyecto es zoneless (sin zone.js, ver architecture.md). Sin este provider NO
		// existe un scheduler de detección de cambios que reaccione a escrituras de signals:
		// las resoluciones async de recursos (WASM de Rapier, gltfResource, textureResource,
		// NgtsEnvironment) marcan la vista sucia pero nunca agendan un tick, así que la escena
		// 3D — que está 100% detrás de @if de recursos async — no se pinta hasta que un evento
		// del DOM (p.ej. el checkbox "debug") fuerza un ciclo de CD. provideZonelessChangeDetection
		// instala ChangeDetectionSchedulerImpl, que agenda un tick en cada notificación de signal.
		provideZonelessChangeDetection(),
		provideBrowserGlobalErrorListeners(),
		provideRouter(appRoutes),
	],
};

import { makeEnvironmentProviders, type EnvironmentProviders } from '@angular/core';
import { PRODUCTS_3D_BADGE_THEME, PRODUCTS_3D_CONFIG } from './tokens';
import type { Products3dBadgeTheme, Products3dConfig } from './types';

export function provideProducts3d(config: Products3dConfig): EnvironmentProviders {
	return makeEnvironmentProviders([{ provide: PRODUCTS_3D_CONFIG, useValue: config }]);
}

export function provideProducts3dBadgeTheme(theme: Products3dBadgeTheme): EnvironmentProviders {
	return makeEnvironmentProviders([{ provide: PRODUCTS_3D_BADGE_THEME, useValue: theme }]);
}

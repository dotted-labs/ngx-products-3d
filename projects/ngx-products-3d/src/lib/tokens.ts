import { InjectionToken } from '@angular/core';
import type { Products3dBadgeTheme, Products3dConfig } from './types';

export const PRODUCTS_3D_CONFIG = new InjectionToken<Products3dConfig>('PRODUCTS_3D_CONFIG');

export const PRODUCTS_3D_BADGE_THEME = new InjectionToken<Products3dBadgeTheme>(
	'PRODUCTS_3D_BADGE_THEME',
);

import { PLATFORM_ID } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadge } from './badge.component';
import { BADGE_PHYSICS } from './badge.config';

interface BadgeInternals {
	resolvedTheme: () => Products3dBadgeTheme;
	physicsOptions: () => {
		gravity: readonly [number, number, number];
		timeStep: number;
		interpolate: boolean;
		debug: boolean;
	};
	isBrowser: boolean;
}

const MEMBER: BadgeMemberData = {
	name: 'Ada Lovelace',
	memberNumber: '0042',
	tier: 'gold',
};

function makeTheme(fontUrl: string): Products3dBadgeTheme {
	return {
		bandTextureUrl: 'assets/band.png',
		baseTextures: { gold: 'assets/gold.png' },
		defaultBaseTextureUrl: 'assets/default.png',
		fontUrl,
	};
}

function createBadge(options: {
	inputTheme?: Products3dBadgeTheme;
	tokenTheme?: Products3dBadgeTheme;
	platform?: 'browser' | 'server';
}): ComponentFixture<Products3dBadge> {
	TestBed.configureTestingModule({
		providers: [
			...(options.tokenTheme
				? [{ provide: PRODUCTS_3D_BADGE_THEME, useValue: options.tokenTheme }]
				: []),
			...(options.platform ? [{ provide: PLATFORM_ID, useValue: options.platform }] : []),
		],
	});
	const fixture = TestBed.createComponent(Products3dBadge);
	fixture.componentRef.setInput('member', MEMBER);
	if (options.inputTheme) {
		fixture.componentRef.setInput('theme', options.inputTheme);
	}
	return fixture;
}

function internalsOf(fixture: ComponentFixture<Products3dBadge>): BadgeInternals {
	// resolvedTheme/physicsOptions/isBrowser son protected (solo template); narrow tipado para test
	return fixture.componentInstance as unknown as BadgeInternals;
}

function resolvedThemeOf(fixture: ComponentFixture<Products3dBadge>): Products3dBadgeTheme {
	return internalsOf(fixture).resolvedTheme();
}

describe('Products3dBadge', () => {
	it('resolves the theme from the [theme] input', () => {
		const inputTheme = makeTheme('assets/from-input.json');
		const fixture = createBadge({ inputTheme });

		expect(resolvedThemeOf(fixture)).toBe(inputTheme);
	});

	it('falls back to the PRODUCTS_3D_BADGE_THEME token when [theme] input is absent', () => {
		const tokenTheme = makeTheme('assets/from-token.json');
		const fixture = createBadge({ tokenTheme });

		expect(resolvedThemeOf(fixture)).toBe(tokenTheme);
	});

	it('prefers the [theme] input over the token when both are present', () => {
		const inputTheme = makeTheme('assets/from-input.json');
		const tokenTheme = makeTheme('assets/from-token.json');
		const fixture = createBadge({ inputTheme, tokenTheme });

		expect(resolvedThemeOf(fixture)).toBe(inputTheme);
	});

	it('throws a prefixed error when neither [theme] input nor token provide a theme', () => {
		const fixture = createBadge({});

		expect(() => resolvedThemeOf(fixture)).toThrowError(
			'[ngx-products-3d] badge: no theme. Pasa [theme] o provideProducts3dBadgeTheme()',
		);
	});

	describe('physics options', () => {
		it('defaults the debug input to false', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });

			expect(fixture.componentInstance.debug()).toBe(false);
			expect(internalsOf(fixture).physicsOptions().debug).toBe(false);
		});

		it('passes the debug input through to the physics options', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });

			fixture.componentRef.setInput('debug', true);

			expect(internalsOf(fixture).physicsOptions().debug).toBe(true);
		});

		it('builds gravity, timeStep and interpolate from BADGE_PHYSICS', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			const options = internalsOf(fixture).physicsOptions();

			expect(options.gravity).toBe(BADGE_PHYSICS.gravity);
			expect(options.timeStep).toBe(BADGE_PHYSICS.timeStep);
			expect(options.interpolate).toBe(true);
		});
	});

	describe('SSR guard', () => {
		it('renders nothing on the server platform: no ngt-canvas, no <canvas> in document', () => {
			const fixture = createBadge({
				inputTheme: makeTheme('assets/font.json'),
				platform: 'server',
			});

			fixture.detectChanges();

			expect(internalsOf(fixture).isBrowser).toBe(false);
			expect((fixture.nativeElement as HTMLElement).childElementCount).toBe(0);
			expect((fixture.nativeElement as HTMLElement).querySelector('ngt-canvas')).toBeNull();
			expect(document.querySelector('canvas')).toBeNull();
		});
	});

	describe('browser platform', () => {
		// jsdom no implementa ResizeObserver (lo usa NgxResize dentro de ngt-canvas)
		beforeAll(() => {
			if (typeof globalThis.ResizeObserver === 'undefined') {
				vi.stubGlobal(
					'ResizeObserver',
					class {
						observe(): void {
							/* noop jsdom */
						}
						unobserve(): void {
							/* noop jsdom */
						}
						disconnect(): void {
							/* noop jsdom */
						}
					},
				);
			}
		});

		afterAll(() => {
			vi.unstubAllGlobals();
		});

		it('mounts ngt-canvas with its host <canvas> element on the browser platform', () => {
			const fixture = createBadge({
				inputTheme: makeTheme('assets/font.json'),
				platform: 'browser',
			});

			fixture.detectChanges();

			expect(internalsOf(fixture).isBrowser).toBe(true);
			const ngtCanvas = (fixture.nativeElement as HTMLElement).querySelector('ngt-canvas');
			expect(ngtCanvas).not.toBeNull();
			expect(ngtCanvas?.querySelector('canvas')).not.toBeNull();
		});
	});
});

// El wrapper importa <ngts-environment>/<ngts-lightformer> de angular-three-soba/staging, que a su
// vez arrastra troika-three-text y @monogrid/gainmap-js. Esos módulos, en tiempo de carga, crean un
// <canvas> y piden getContext('2d'); jsdom devuelve null → `ctx.fillStyle = ...` peta y la suite
// entera falla al IMPORTAR el componente (0 tests). Se stubea getContext('2d') con un contexto 2D
// inerte ANTES de cualquier import (vi.hoisted corre antes que los imports estáticos). Solo afecta al
// entorno de test; no toca código de producción.
vi.hoisted(() => {
	const canvasProto = globalThis.HTMLCanvasElement?.prototype;
	if (!canvasProto) {
		return;
	}
	const originalGetContext = canvasProto.getContext;
	canvasProto.getContext = function (
		this: HTMLCanvasElement,
		contextId: string,
		...args: unknown[]
	): unknown {
		if (contextId !== '2d') {
			return originalGetContext.apply(this, [contextId, ...args] as never);
		}
		const backing: Record<string, unknown> = {};
		const imageData = (width = 1, height = 1) => ({
			data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
			width,
			height,
		});
		return new Proxy(backing, {
			get: (target, prop) => {
				if (prop in target) {
					return target[prop as string];
				}
				switch (prop) {
					case 'canvas':
						return this;
					case 'measureText':
						return () => ({ width: 0 });
					case 'getImageData':
						return (_x: number, _y: number, w = 1, h = 1) => imageData(w, h);
					case 'createImageData':
						return (w = 1, h = 1) => imageData(w, h);
					default:
						// Cualquier otro método del contexto 2D (fillRect, fillText, drawImage, save…) → noop.
						return () => undefined;
				}
			},
			set: (target, prop, value) => {
				target[prop as string] = value;
				return true;
			},
		});
	} as typeof canvasProto.getContext;
});

import { PLATFORM_ID } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadge } from './badge.component';
import { BADGE_LIGHTING, BADGE_PHYSICS } from './badge.config';

interface BadgeInternals {
	resolvedTheme: () => Products3dBadgeTheme;
	physicsOptions: () => {
		gravity: readonly [number, number, number];
		timeStep: number;
		interpolate: boolean;
		debug: boolean;
	};
	isBrowser: boolean;
	ambientIntensity: number;
	environmentOptions: { background: boolean; backgroundBlurriness: number };
	lightformers: readonly {
		intensity: number;
		color: string;
		form: string;
		scale: readonly number[];
		position: readonly number[];
		rotation: readonly number[];
	}[];
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

	describe('theme validation (assertValidBadgeTheme on the resolved theme)', () => {
		// El input [theme] pisa al provider sin merge, así que la validación cubre ambas fuentes
		function themeWithout(field: 'defaultBaseTextureUrl' | 'fontUrl'): Products3dBadgeTheme {
			const theme: Record<string, unknown> = { ...makeTheme('assets/font.json') };
			delete theme[field];
			return theme as unknown as Products3dBadgeTheme;
		}

		it('throws an actionable prefixed error when the [theme] input lacks defaultBaseTextureUrl', () => {
			const fixture = createBadge({ inputTheme: themeWithout('defaultBaseTextureUrl') });

			expect(() => resolvedThemeOf(fixture)).toThrowError(
				/\[ngx-products-3d\] badge: al tema le falta defaultBaseTextureUrl/,
			);
		});

		it('throws an actionable prefixed error when the token theme lacks fontUrl', () => {
			const fixture = createBadge({ tokenTheme: themeWithout('fontUrl') });

			expect(() => resolvedThemeOf(fixture)).toThrowError(
				/\[ngx-products-3d\] badge: al tema le falta fontUrl/,
			);
		});
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

	describe('lighting', () => {
		it('exposes the ambient intensity as Math.PI (physically-correct scale)', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });

			expect(internalsOf(fixture).ambientIntensity).toBe(Math.PI);
			expect(BADGE_LIGHTING.ambientIntensity).toBe(Math.PI);
		});

		it('configures the environment with backgroundBlurriness 0.75, no background, no blur/preset', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			const env = internalsOf(fixture).environmentOptions;

			expect(env.background).toBe(false);
			expect(env.backgroundBlurriness).toBe(0.75);
			expect(env).toBe(BADGE_LIGHTING.environment);
			// backgroundBlurriness sustituye a `blur` (deprecado) y no hay preset (evita CDN/red)
			expect('blur' in BADGE_LIGHTING.environment).toBe(false);
			expect('preset' in BADGE_LIGHTING.environment).toBe(false);
		});

		it('exposes exactly four lightformers, each a well-formed options object', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			const lightformers = internalsOf(fixture).lightformers;

			expect(lightformers).toBe(BADGE_LIGHTING.lightformers);
			expect(lightformers.length).toBe(4);
			for (const lf of lightformers) {
				expect(typeof lf.intensity).toBe('number');
				expect(typeof lf.color).toBe('string');
				expect(['circle', 'ring', 'rect']).toContain(lf.form);
				expect(lf.scale).toHaveLength(3);
				expect(lf.position).toHaveLength(3);
				expect(lf.rotation).toHaveLength(3);
			}
		});

		it('spreads lightformer intensities across a fill-to-accent range (2..10)', () => {
			const intensities = BADGE_LIGHTING.lightformers.map((lf) => lf.intensity);

			expect(Math.min(...intensities)).toBe(2);
			expect(Math.max(...intensities)).toBe(10);
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

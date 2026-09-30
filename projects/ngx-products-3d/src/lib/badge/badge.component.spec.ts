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
import { PerspectiveCamera } from 'three';
import type { NgtState } from 'angular-three';
import { PRODUCTS_3D_BADGE_THEME } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadge } from './badge.component';
import { BADGE_CAMERA, BADGE_LIGHTING, BADGE_LOOP_PRIORITY, BADGE_PHYSICS } from './badge.config';

interface BadgeInternals {
	resolvedTheme: () => Products3dBadgeTheme;
	physicsOptions: () => {
		gravity: readonly [number, number, number];
		timeStep: number;
		interpolate: boolean;
		updatePriority: number;
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

		it('steps the physics before the scene band reads the interpolated pose', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });

			// Sin updatePriority el orden paso↔correa queda al azar de la suscripción (el stepper
			// se suscribe en un effect) y el extremo de la correa se desfasa de la tarjeta.
			expect(internalsOf(fixture).physicsOptions().updatePriority).toBe(
				BADGE_LOOP_PRIORITY.physicsStep,
			);
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

	describe('ready output', () => {
		/** Template REAL del wrapper (los tests no montan el canvas con WebGL). */
		function wrapperTemplate(): string {
			const metadata = Products3dBadge as unknown as {
				decorators?: { args?: { template?: string }[] }[];
			};
			return metadata.decorators?.[0]?.args?.[0]?.template ?? '';
		}

		it('listens to the ready output of the scene', () => {
			const sceneTag = /<products-3d-badge-scene\b[^>]*\/>/.exec(wrapperTemplate())?.[0] ?? '';

			expect(sceneTag).toContain('(ready)="onSceneReady()"');
		});

		it('re-emits the scene ready as its own (ready) output', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			let emissions = 0;
			fixture.componentInstance.ready.subscribe(() => {
				emissions += 1;
			});

			(fixture.componentInstance as unknown as { onSceneReady: () => void }).onSceneReady();

			expect(emissions).toBe(1);
		});
	});

	describe('camera input (badge-center-camera)', () => {
		interface CameraInternals {
			resolvedCamera: () => { fov: number; distance: number };
			canvasCamera: () => { position: [number, number, number]; fov: number };
			onCanvasCreated: (state: NgtState) => void;
		}

		function cameraInternalsOf(fixture: ComponentFixture<Products3dBadge>): CameraInternals {
			return fixture.componentInstance as unknown as CameraInternals;
		}

		/** Template REAL del wrapper (los tests no montan el canvas con WebGL). */
		function wrapperTemplate(): string {
			const metadata = Products3dBadge as unknown as {
				decorators?: { args?: { template?: string }[] }[];
			};
			return metadata.decorators?.[0]?.args?.[0]?.template ?? '';
		}

		/** La cámara que crea <ngt-canvas> con las options por defecto del badge. */
		function createdCanvasCamera(): PerspectiveCamera {
			const camera = new PerspectiveCamera(BADGE_CAMERA.fov, 16 / 9, 0.1, 1000);
			camera.position.set(...BADGE_CAMERA.position);
			camera.updateProjectionMatrix();
			return camera;
		}

		afterEach(() => {
			vi.restoreAllMocks();
		});

		it('creates the canvas camera from BADGE_CAMERA when no camera is given', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });

			expect(cameraInternalsOf(fixture).canvasCamera()).toEqual({ position: [0, 0, 13], fov: 25 });
			expect(cameraInternalsOf(fixture).canvasCamera()).toEqual(BADGE_CAMERA);
		});

		it('creates the canvas camera from the camera input: centred, at the given distance', () => {
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			fixture.componentRef.setInput('camera', { fov: 18, distance: 9 });

			expect(cameraInternalsOf(fixture).canvasCamera()).toEqual({ position: [0, 0, 9], fov: 18 });
			expect(cameraInternalsOf(fixture).resolvedCamera()).toEqual({ fov: 18, distance: 9 });
		});

		it('hands the canvas its camera options once: later changes go to the created camera', () => {
			// Options nuevas harían re-configurarse al canvas entero (gl.setSize incluido) y él no las
			// aplicaría a la cámara ya creada: el cambio en caliente va por el effect (test de abajo).
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			const initial = cameraInternalsOf(fixture).canvasCamera();

			fixture.componentRef.setInput('camera', { fov: 18, distance: 9 });

			expect(cameraInternalsOf(fixture).canvasCamera()).toBe(initial);
			expect(cameraInternalsOf(fixture).resolvedCamera()).toEqual({ fov: 18, distance: 9 });
		});

		it('falls back to the default camera with a dev warning for invalid values, never NaN', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
			const fixture = createBadge({ inputTheme: makeTheme('assets/font.json') });
			fixture.componentRef.setInput('camera', { fov: -10, distance: Number.NaN });

			expect(() => cameraInternalsOf(fixture).canvasCamera()).not.toThrow();
			expect(cameraInternalsOf(fixture).canvasCamera()).toEqual(BADGE_CAMERA);
			expect(warn).toHaveBeenCalledTimes(2);
			for (const [message] of warn.mock.calls) {
				expect(String(message)).toContain('[ngx-products-3d]');
			}
		});

		it('hands the RESOLVED camera to the scene (it derives the band and the drop from it)', () => {
			const sceneTag = /<products-3d-badge-scene\b[^>]*\/>/.exec(wrapperTemplate())?.[0] ?? '';
			const canvasTag = /<ngt-canvas\b[^>]*>/.exec(wrapperTemplate())?.[0] ?? '';

			expect(sceneTag).toContain('[camera]="resolvedCamera()"');
			expect(canvasTag).toContain('[camera]="canvasCamera()"');
			expect(canvasTag).toContain('(created)="onCanvasCreated($event)"');
		});

		it('applies a camera change in hot to the camera the canvas already created', () => {
			// Plataforma server: el template queda vacío (sin WebGL) pero los effects del wrapper corren.
			const fixture = createBadge({
				inputTheme: makeTheme('assets/font.json'),
				platform: 'server',
			});
			const camera = createdCanvasCamera();
			cameraInternalsOf(fixture).onCanvasCreated({ camera } as unknown as NgtState);
			fixture.detectChanges();

			// Sin input: la cámara creada no cambia (aplicar los mismos valores es idempotente).
			expect(camera.fov).toBe(BADGE_CAMERA.fov);
			expect(camera.position.toArray()).toEqual(BADGE_CAMERA.position);

			fixture.componentRef.setInput('camera', { fov: 18, distance: 9 });
			fixture.detectChanges();

			const expected = new PerspectiveCamera(18, 16 / 9, 0.1, 1000);
			expect(camera.fov).toBe(18);
			expect(camera.position.toArray()).toEqual([0, 0, 9]);
			expect(camera.projectionMatrix.elements).toEqual(expected.projectionMatrix.elements);

			// Y otra vez: cada cambio posterior del input llega a la misma cámara.
			fixture.componentRef.setInput('camera', { distance: 11 });
			fixture.detectChanges();

			expect(camera.fov).toBe(BADGE_CAMERA.fov);
			expect(camera.position.toArray()).toEqual([0, 0, 11]);
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

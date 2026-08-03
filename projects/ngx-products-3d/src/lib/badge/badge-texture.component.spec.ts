// El componente importa angular-three-soba/abstractions y /cameras, que arrastran módulos (lottie
// de three, troika, gainmap) que en tiempo de carga crean un <canvas> y piden getContext('2d');
// jsdom devuelve null → la suite entera falla al IMPORTAR (0 tests). Mismo stub inerte de contexto
// 2D que badge-scene.component.spec.ts / badge.component.spec.ts (patrón ya aceptado en review;
// vi.hoisted corre antes que los imports estáticos). Solo test env.
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

import { TestBed, type ComponentFixture } from '@angular/core/testing';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadgeTexture } from './badge-texture.component';
import { BADGE_BASE_COLOR, BADGE_FRONT_FACE, BADGE_PHYSICS, BADGE_TEXTURE } from './badge.config';

// Neutraliza el loader de soba: en jsdom sin WebGL no se debe cargar la textura base. La fn de
// entrada se CAPTURA sin invocarla (lee el input `theme`, que aún no tiene valor en construcción →
// NG0950 si se evalúa eager), mismo patrón que badge-scene.component.spec.ts. hasValue()=false +
// status()='loading' (default) = recurso sin resolver → baseMap() undefined y los effects no
// disparan. `status` es mutable para poder simular una URL rota (ver el bloque «degraded front»);
// se fija ANTES de crear el componente, porque no es una signal y no reevalúa por sí sola.
const textureMock = vi.hoisted(() => ({
	inputs: [] as (() => string)[],
	status: 'loading' as 'loading' | 'error',
}));
vi.mock('angular-three-soba/loaders', () => ({
	textureResource: (input: () => string) => {
		textureMock.inputs.push(input);
		return { value: () => undefined, hasValue: () => false, status: () => textureMock.status };
	},
}));

interface TextureInternals {
	cameraOptions: {
		makeDefault?: boolean;
		manual?: boolean;
		position?: [number, number, number];
		left?: number;
		right?: number;
		top?: number;
		bottom?: number;
	};
	frontPlaneArgs: [number, number];
	backdropPosition: [number, number, number];
	artPosition: [number, number, number];
	baseColor: () => string;
	baseMap: () => unknown;
	baseTextureUrl: () => string;
	textColor: () => string;
}

const MEMBER: BadgeMemberData = {
	name: 'Ada Lovelace',
	memberNumber: '0042',
	tier: 'gold',
};

const THEME: Products3dBadgeTheme = {
	bandTextureUrl: 'assets/band.jpg',
	baseTextures: { gold: 'assets/base-gold.webp' },
	defaultBaseTextureUrl: 'assets/base-default.webp',
	fontUrl: 'assets/font.json',
};

function createTextureScene(): ComponentFixture<Products3dBadgeTexture> {
	TestBed.configureTestingModule({});
	// Template vacío: se testea la derivación de estado desde badge.config, no el render 3D
	// (requiere canvas + WebGL reales; lo visual es Nivel 3, ver docs/verification.md).
	TestBed.overrideComponent(Products3dBadgeTexture, { set: { template: '' } });
	const fixture = TestBed.createComponent(Products3dBadgeTexture);
	fixture.componentRef.setInput('member', MEMBER);
	fixture.componentRef.setInput('theme', THEME);
	return fixture;
}

function internalsOf(fixture: ComponentFixture<Products3dBadgeTexture>): TextureInternals {
	// Campos protected (solo template); narrow tipado para test.
	return fixture.componentInstance as unknown as TextureInternals;
}

describe('Products3dBadgeTexture camera', () => {
	it('registers the RT camera as the portal default and disables automatic framing', () => {
		const opts = internalsOf(createTextureScene()).cameraOptions;

		// makeDefault: es la opción de soba la que registra la cámara en el store del portal.
		expect(opts.makeDefault).toBe(true);
		// manual: sin él, updateCamera() del core (angular-three.mjs:601-615) sobrescribe el
		// frustum con el `size` del store, y el portal del NgtsRenderTexture no pasa `size`
		// propio (angular-three-soba-staging.mjs:3315) → hereda el del canvas y el frente se
		// deforma al redimensionar la ventana.
		expect(opts.manual).toBe(true);
	});

	it('frames exactly the card front face with an explicit frustum from config', () => {
		const opts = internalsOf(createTextureScene()).cameraOptions;

		expect(opts.left).toBe(BADGE_TEXTURE.cameraFrustum.left);
		expect(opts.right).toBe(BADGE_TEXTURE.cameraFrustum.right);
		expect(opts.top).toBe(BADGE_TEXTURE.cameraFrustum.top);
		expect(opts.bottom).toBe(BADGE_TEXTURE.cameraFrustum.bottom);
		// Y ese frustum es el rect derivado del contrato del GLB, no un encuadre cualquiera.
		expect(opts.right! - opts.left!).toBeCloseTo(BADGE_FRONT_FACE.width, 10);
		expect(opts.top! - opts.bottom!).toBeCloseTo(BADGE_FRONT_FACE.height, 10);
		expect(opts.position).toBe(BADGE_TEXTURE.cameraPosition);
	});

	it('matches the FBO aspect ratio with the camera frustum and the GLB face', () => {
		const opts = internalsOf(createTextureScene()).cameraOptions;
		const frustumAspect = (opts.right! - opts.left!) / (opts.top! - opts.bottom!);
		const fboAspect = BADGE_TEXTURE.width / BADGE_TEXTURE.height;
		const faceAspect =
			BADGE_PHYSICS.cardColliderHalfExtents[0] / BADGE_PHYSICS.cardColliderHalfExtents[1];

		// Invariante de spec-03-F4v2 sobre lo que el COMPONENTE pide de verdad (no solo la
		// config): las tres relaciones de aspecto encadenadas del frente coinciden.
		expect(frustumAspect).toBeCloseTo(fboAspect, 10);
		expect(frustumAspect).toBeCloseTo(faceAspect, 10);
	});
});

describe('Products3dBadgeTexture state', () => {
	it('resolves the base texture url per tier from the theme (never hardcoded)', () => {
		expect(internalsOf(createTextureScene()).baseTextureUrl()).toBe('assets/base-gold.webp');
	});

	it('falls back to defaultBaseTextureUrl for an unknown tier', () => {
		const fixture = createTextureScene();
		fixture.componentRef.setInput('member', { ...MEMBER, tier: 'platinum' });

		expect(internalsOf(fixture).baseTextureUrl()).toBe('assets/base-default.webp');
	});
});

describe('Products3dBadgeTexture front layers', () => {
	it('sizes the two front quads with the derived front face rect, never with a literal', () => {
		const internals = internalsOf(createTextureScene());

		// Es el mismo args para el quad de baseColor y para el arte del tier: si difirieran, el arte
		// quedaría desalineado respecto al color que asoma por su alpha.
		expect(internals.frontPlaneArgs).toBe(BADGE_TEXTURE.frontPlaneSize);
		expect(internals.frontPlaneArgs[0]).toBe(BADGE_FRONT_FACE.width);
		expect(internals.frontPlaneArgs[1]).toBe(BADGE_FRONT_FACE.height);
	});

	it('covers exactly what the camera frames (no bands, no crop)', () => {
		const internals = internalsOf(createTextureScene());
		const opts = internals.cameraOptions;
		const [width, height] = internals.frontPlaneArgs;

		expect(width).toBeCloseTo(opts.right! - opts.left!, 10);
		expect(height).toBeCloseTo(opts.top! - opts.bottom!, 10);
	});

	it('places the tier art in front of the opaque baseColor quad', () => {
		const internals = internalsOf(createTextureScene());

		expect(internals.backdropPosition).toBe(BADGE_TEXTURE.backdropPosition);
		expect(internals.artPosition).toBe(BADGE_TEXTURE.artPosition);
		// Con la cámara mirando -Z, el arte tiene que quedar por delante del fondo o el quad opaco
		// lo taparía (frente de color plano, sin arte).
		expect(internals.artPosition[2]).toBeGreaterThan(internals.backdropPosition[2]);
	});
});

describe('Products3dBadgeTexture base color', () => {
	it('paints the backdrop quad with the theme default when baseColor is absent', () => {
		// El quad de baseColor es la ÚNICA vía por la que el color llega al frente (el [color] del
		// material de la tarjeta multiplicaría el map). Sin baseColor en el tema → default de config.
		expect(internalsOf(createTextureScene()).baseColor()).toBe(BADGE_BASE_COLOR);
	});

	it('uses the theme baseColor when the theme defines one', () => {
		const fixture = createTextureScene();
		fixture.componentRef.setInput('theme', { ...THEME, baseColor: '#123456' });

		expect(internalsOf(fixture).baseColor()).toBe('#123456');
	});

	it('repaints on a theme change through the same component instance (no re-creation)', () => {
		const fixture = createTextureScene();
		// Referencia capturada ANTES del cambio: si el valor nuevo se lee por aquí, lo ha producido
		// la MISMA instancia (el color es un binding sobre un computed, no un canvas remontado).
		const internals = internalsOf(fixture);
		expect(internals.baseColor()).toBe(BADGE_BASE_COLOR);

		fixture.componentRef.setInput('theme', { ...THEME, baseColor: '#ff0000' });

		expect(internals.baseColor()).toBe('#ff0000');
	});
});

describe('Products3dBadgeTexture degraded front', () => {
	afterEach(() => {
		textureMock.status = 'loading';
		vi.restoreAllMocks();
	});

	it('degrades to a front without art (warning in dev) instead of a blank scene', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		// URL rota: el recurso queda en error ANTES de construir el componente (status() no es una
		// signal en el mock; el effect lo lee en su primera ejecución).
		textureMock.status = 'error';
		const fixture = createTextureScene();
		fixture.detectChanges();
		const internals = internalsOf(fixture);

		// Sin textura resuelta no se monta el plano del arte (gate hasValue()),...
		expect(internals.baseMap()).toBeUndefined();
		// ...pero el quad de fondo sigue teniendo color: el frente queda del color base, no en blanco.
		expect(internals.baseColor()).toBe(BADGE_BASE_COLOR);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('assets/base-gold.webp');
	});
});

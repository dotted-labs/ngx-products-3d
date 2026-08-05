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
import { BufferGeometry, Float32BufferAttribute, Mesh, SRGBColorSpace } from 'three';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { Products3dBadgeTexture } from './badge-texture.component';
import {
	BADGE_BASE_COLOR,
	BADGE_FRONT_FACE,
	BADGE_PHYSICS,
	BADGE_TEXT_LAYOUT,
	BADGE_TEXTURE,
	type BadgeTextSlot,
} from './badge.config';

// Neutraliza el loader de soba: en jsdom sin WebGL no se debe cargar la textura base. La fn de
// entrada se CAPTURA sin invocarla (lee el input `theme`, que aún no tiene valor en construcción →
// NG0950 si se evalúa eager), mismo patrón que badge-scene.component.spec.ts. Por defecto
// `value`=undefined → hasValue()=false y status()='loading' = recurso sin resolver → baseMap()
// undefined y los effects no disparan. `status` y `value` son mutables para simular una URL rota
// (ver «degraded front») o una textura ya resuelta con dimensiones conocidas (ver «front asset
// ratio»); se fijan ANTES de crear el componente, porque no son signals y no reevalúan por sí solas.
const textureMock = vi.hoisted(() => ({
	inputs: [] as (() => string)[],
	status: 'loading' as 'loading' | 'error',
	value: undefined as ResolvedTextureMock | undefined,
}));
vi.mock('angular-three-soba/loaders', () => ({
	textureResource: (input: () => string) => {
		textureMock.inputs.push(input);
		return {
			value: () => textureMock.value,
			hasValue: () => textureMock.value !== undefined,
			status: () => textureMock.status,
		};
	},
}));

// Doble del TTFLoader de three, que el componente pide por import() DINÁMICO al resolver una fuente
// binaria: el módulo real arrastra el `opentype` embebido (~467 KB) y su loadAsync haría una
// petición HTTP real, imposible en jsdom. `failures` marca una URL como rota para el degradado.
const ttfLoaderMock = vi.hoisted(() => ({
	loaded: [] as string[],
	failures: new Set<string>(),
}));
vi.mock('three/addons/loaders/TTFLoader.js', () => ({
	TTFLoader: class {
		async loadAsync(url: string): Promise<unknown> {
			ttfLoaderMock.loaded.push(url);
			if (ttfLoaderMock.failures.has(url)) {
				throw new Error(`fetch for "${url}" responded with 404: Not Found`);
			}
			return { familyName: 'Ballega', resolution: 1000, glyphs: {} };
		}
	},
}));

/**
 * Mínimo de `Texture` de three que toca el effect de la textura base: el `image` del que se leen las
 * dimensiones del asset más las dos propiedades que el effect muta (`colorSpace`, `needsUpdate`).
 * No se instancia una `Texture` real: haría falta WebGL y no aportaría nada a lo que se verifica.
 */
interface ResolvedTextureMock {
	image?: { width?: number; height?: number };
	colorSpace?: string;
	needsUpdate?: boolean;
}

/** Textura resuelta de `width × height` px, tal como la vería el effect tras cargar el asset. */
function resolvedTexture(width: number, height: number): ResolvedTextureMock {
	return { image: { width, height } };
}

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
	resolvedFont: () => unknown;
	textColor: () => string;
	textSlots: () => {
		slot: BadgeTextSlot;
		text: string;
		options: { size: number; height: number };
	}[];
	fitTextMeshes: (meshes: readonly Mesh[]) => void;
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

function createTextureScene(
	theme: Products3dBadgeTheme = THEME,
): ComponentFixture<Products3dBadgeTexture> {
	TestBed.configureTestingModule({});
	// Template vacío: se testea la derivación de estado desde badge.config, no el render 3D
	// (requiere canvas + WebGL reales; lo visual es Nivel 3, ver docs/verification.md).
	TestBed.overrideComponent(Products3dBadgeTexture, { set: { template: '' } });
	const fixture = TestBed.createComponent(Products3dBadgeTexture);
	fixture.componentRef.setInput('member', MEMBER);
	fixture.componentRef.setInput('theme', theme);
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

describe('Products3dBadgeTexture front asset ratio', () => {
	afterEach(() => {
		textureMock.value = undefined;
		vi.restoreAllMocks();
	});

	/** Monta la escena con la textura base YA resuelta y espía el warn dev del effect. */
	function mountWithTexture(texture: ResolvedTextureMock) {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		textureMock.value = texture;
		const fixture = createTextureScene();
		fixture.detectChanges();
		return { fixture, warn };
	}

	it('warns in dev with the url, the expected ratio and the measured one', () => {
		// El PNG cuadrado que el playground conserva para esta prueba (T7): 40% fuera del 32:45.
		const texture = resolvedTexture(256, 256);
		const { fixture, warn } = mountWithTexture(texture);

		expect(warn).toHaveBeenCalledTimes(1);
		const message = String(warn.mock.calls[0][0]);
		expect(message).toContain('[ngx-products-3d]');
		// Las tres cosas que exige el criterio de aceptación: url, ratio esperado y ratio medido.
		expect(message).toContain('assets/base-gold.webp');
		expect(message).toContain(BADGE_TEXTURE.assetAspect.toFixed(4));
		expect(message).toContain((256 / 256).toFixed(4));
		// Y el ratio esperado que se imprime NO es un literal del componente: sale de la config.
		expect(BADGE_TEXTURE.assetAspect.toFixed(4)).not.toBe((256 / 256).toFixed(4));
		// Avisa y sigue: la textura se aplica igual (el plano del arte se monta y se corrige el
		// colorSpace), un frente estirado nunca degrada a frente sin arte.
		expect(internalsOf(fixture).baseMap()).toBe(texture);
		expect(texture.colorSpace).toBe(SRGBColorSpace);
	});

	it('stays silent for an asset that matches the front face ratio', () => {
		const texture = resolvedTexture(BADGE_TEXTURE.width, BADGE_TEXTURE.height);
		const { fixture, warn } = mountWithTexture(texture);

		expect(warn).not.toHaveBeenCalled();
		expect(internalsOf(fixture).baseMap()).toBe(texture);
		expect(texture.colorSpace).toBe(SRGBColorSpace);
	});

	it('stays silent for a deviation inside the configured tolerance', () => {
		// 1600 × 2240 = 0.45% de desviación: por debajo del 1% de BADGE_TEXTURE.assetAspectTolerance.
		const { warn } = mountWithTexture(resolvedTexture(1600, 2240));

		expect(warn).not.toHaveBeenCalled();
	});

	it('stays silent when the image exposes no measurable size', () => {
		// Recurso resuelto pero sin tamaño intrínseco (o a medio decodificar): no se avisa sobre una
		// medición ausente, y el colorSpace se sigue corrigiendo.
		const texture: ResolvedTextureMock = {};
		const { warn } = mountWithTexture(texture);

		expect(warn).not.toHaveBeenCalled();
		expect(texture.colorSpace).toBe(SRGBColorSpace);
	});

	it('stays silent for zero-sized image dimensions', () => {
		const { warn } = mountWithTexture(resolvedTexture(0, 0));

		expect(warn).not.toHaveBeenCalled();
	});
});

describe('Products3dBadgeTexture font', () => {
	afterEach(() => {
		ttfLoaderMock.loaded = [];
		ttfLoaderMock.failures.clear();
		vi.restoreAllMocks();
	});

	/** Tema del test con otra fuente. Cada caso usa su propia URL: la caché de typefaces es por URL. */
	function themeWithFont(fontUrl: string): Products3dBadgeTheme {
		return { ...THEME, fontUrl };
	}

	it('passes a typeface JSON url straight through to soba, untouched', () => {
		const internals = internalsOf(createTextureScene(themeWithFont('assets/font.json')));

		// La URL llega a NgtsText3D tal cual y SIN esperar a nada (misma detección de cambios), que
		// es lo que deja intacto el camino de siempre: la carga y la caché siguen siendo de soba.
		expect(internals.resolvedFont()).toBe('assets/font.json');
		expect(typeof internals.resolvedFont()).toBe('string');
		// Y no se toca el TTFLoader: quien usa typeface JSON no paga el import() dinámico.
		expect(ttfLoaderMock.loaded).toEqual([]);
	});

	it('resolves an .otf font to the parsed typeface data, not to the url', async () => {
		const fixture = createTextureScene(themeWithFont('assets/Ballega.otf'));
		fixture.detectChanges();

		// Mientras convierte no hay fuente: el gate del template deja el frente SIN TEXTO...
		expect(internalsOf(fixture).resolvedFont()).toBeUndefined();

		await fixture.whenStable();

		// ...y al resolver llega el typeface JSON como OBJETO (NgtsText3D lo acepta sin transform;
		// una url .otf reventaría en el loadFontData de soba, que hace response.json()).
		expect(internalsOf(fixture).resolvedFont()).toMatchObject({ familyName: 'Ballega' });
		expect(ttfLoaderMock.loaded).toEqual(['assets/Ballega.otf']);
	});

	it('keeps the same font reference when the theme object changes but the url does not', async () => {
		const fixture = createTextureScene(themeWithFont('assets/Stable.otf'));
		fixture.detectChanges();
		await fixture.whenStable();
		const internals = internalsOf(fixture);
		const first = internals.resolvedFont();
		expect(first).toMatchObject({ familyName: 'Ballega' });

		// Caso REAL del playground: el color picker produce un tema NUEVO en cada tick, con la misma
		// fontUrl. Eso reevalúa la cadena entera de computed.
		fixture.componentRef.setInput('theme', {
			...themeWithFont('assets/Stable.otf'),
			colors: { text: '#ff0000' },
		});
		fixture.detectChanges();
		await fixture.whenStable();

		// La caché de fontResource de soba está keyed por IDENTIDAD del parámetro: un objeto nuevo
		// aquí la haría re-parsear la fuente entera en cada tick del picker.
		expect(internals.resolvedFont()).toBe(first);
		expect(internals.textColor()).toBe('#ff0000');
		expect(ttfLoaderMock.loaded).toEqual(['assets/Stable.otf']);
	});

	it('accepts a .ttf as well, with the same conversion path', async () => {
		const fixture = createTextureScene(themeWithFont('assets/Ballega.ttf'));
		fixture.detectChanges();
		await fixture.whenStable();

		expect(internalsOf(fixture).resolvedFont()).toMatchObject({ familyName: 'Ballega' });
		expect(ttfLoaderMock.loaded).toEqual(['assets/Ballega.ttf']);
	});

	it('degrades to a front WITHOUT TEXT (warning in dev) when the font fails, never throwing', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		ttfLoaderMock.failures.add('assets/Broken.otf');

		const fixture = createTextureScene(themeWithFont('assets/Broken.otf'));
		fixture.detectChanges();
		await fixture.whenStable();
		const internals = internalsOf(fixture);

		// Sin fuente resuelta no se montan los <ngts-text-3d>: si se les pasara la fuente ausente,
		// el value() del recurso de soba LANZARÍA en plena detección de cambios.
		expect(internals.resolvedFont()).toBeUndefined();
		// El resto del frente sigue en pie: color base y arte del tier.
		expect(internals.baseColor()).toBe(BADGE_BASE_COLOR);

		const fontWarnings = warn.mock.calls
			.map((call) => String(call[0]))
			.filter((message) => message.includes('assets/Broken.otf'));
		expect(fontWarnings).toHaveLength(1);
		expect(fontWarnings[0]).toContain('[ngx-products-3d]');
		expect(fontWarnings[0]).toContain('sin texto');
		// Y lleva la causa: sin ella el aviso solo diría que algo falló, que es justo lo que un dev
		// no puede accionar. Ata además el warn al estado de ERROR (en loading no hay causa).
		expect(fontWarnings[0]).toContain('404');
	});

	it('does not warn about the font when the theme uses a typeface JSON', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
		// Trampa deliberada: si el typeface JSON acabara pasando por el conversor binario, el doble
		// del TTFLoader fallaría y el warn del camino binario aparecería aquí. URL propia, distinta
		// de la del test de passthrough: la caché de typefaces es de módulo y sobrevive al afterEach,
		// así que reutilizarla dejaría este caso pasando por un acierto de caché.
		ttfLoaderMock.failures.add('assets/only-json.json');

		const fixture = createTextureScene(themeWithFont('assets/only-json.json'));
		fixture.detectChanges();
		await fixture.whenStable();

		// El recurso de conversión queda IDLE (params undefined), no en error.
		expect(ttfLoaderMock.loaded).toEqual([]);
		expect(warn.mock.calls.map((call) => String(call[0])).join('\n')).not.toContain('fuente');
	});
});

/**
 * Default de `height` (profundidad de extrusión del TextGeometry) del propio NgtsText3D, leído en
 * `node_modules/angular-three-soba/fesm2022/angular-three-soba-abstractions.mjs:1303-1314`. Soba lo
 * mergea sobre las options recibidas (`mergeInputs`), así que si el componente dejara de pasar el
 * `height` del slot la extrusión caería aquí EN SILENCIO — veinte veces la del layout.
 */
const SOBA_TEXT3D_DEFAULT_HEIGHT = 0.2;

describe('Products3dBadgeTexture text slots', () => {
	it('renders one text per layout slot, in layout order, with the member data', () => {
		const slots = internalsOf(createTextureScene()).textSlots();

		expect(slots.map((entry) => entry.slot.field)).toEqual(
			BADGE_TEXT_LAYOUT.map((slot) => slot.field),
		);
		expect(slots.map((entry) => entry.text)).toEqual(['Ada Lovelace', '#0042', 'GOLD']);
	});

	it('feeds the typography of each slot to the TextGeometry (no silent soba default)', () => {
		const slots = internalsOf(createTextureScene()).textSlots();

		for (const entry of slots) {
			expect(entry.options.size).toBe(entry.slot.size);
			// El criterio de la feature: `height` sigue alimentando la extrusión. Si desapareciera de
			// las options, soba aplicaría su propio default sin avisar.
			expect(entry.options.height).toBe(entry.slot.height);
			expect(entry.options.height).not.toBe(SOBA_TEXT3D_DEFAULT_HEIGHT);
		}
	});

	it('keeps placement out of the options: the mesh has a single writer', () => {
		// La posición depende del ancho MEDIDO (anchor + align), así que la aplica fitTextMeshes. Si
		// volviera a las options, el binding repondría el anchor sin el offset de alineado en cuanto
		// cambiara el socio.
		for (const entry of internalsOf(createTextureScene()).textSlots()) {
			expect(entry.options).not.toHaveProperty('position');
			expect(entry.options).not.toHaveProperty('scale');
		}
	});
});

describe('Products3dBadgeTexture text anchoring', () => {
	/**
	 * Mesh como el que crea NgtsText3D: geometría real de three con el bbox arrancando en x = 0 (el
	 * origen de un TextGeometry es el borde izquierdo de su línea base). Sin WebGL: solo atributos.
	 */
	function textMesh(width: number): Mesh {
		const geometry = new BufferGeometry();
		geometry.setAttribute(
			'position',
			new Float32BufferAttribute([0, 0, 0, width, 0, 0, width, 0.05, 0], 3),
		);
		return new Mesh(geometry);
	}

	/** Posición X del anchor de un slot en unidades de mundo de la escena RT. */
	function anchorX(slot: BadgeTextSlot): number {
		return (slot.anchor[0] - 0.5) * BADGE_FRONT_FACE.width;
	}

	/** Posición Y del anchor de un slot en unidades de mundo de la escena RT. */
	function anchorY(slot: BadgeTextSlot): number {
		return (slot.anchor[1] - 0.5) * BADGE_FRONT_FACE.height;
	}

	/**
	 * Ancho del bbox tal como lo mide el componente. Se lee del propio mesh (el atributo `position`
	 * es float32, así que el ancho guardado no es exactamente el pedido) para que las aserciones de
	 * borde comparen contra la medida real y no arrastren el redondeo del float32.
	 */
	function measuredWidth(mesh: Mesh): number {
		const box = mesh.geometry.boundingBox;
		if (!box) {
			throw new Error('fitTextMeshes debe medir el bbox de la geometría');
		}
		return box.max.x - box.min.x;
	}

	it('shrinks a long text with a UNIFORM scale that respects the slot maxWidth', () => {
		const [nameSlot] = BADGE_TEXT_LAYOUT;
		const mesh = textMesh(nameSlot.maxWidth * 2);

		internalsOf(createTextureScene()).fitTextMeshes([mesh]);

		// Prohibición explícita de la spec: nunca comprimir en un solo eje.
		expect(mesh.scale.x).toBe(mesh.scale.y);
		expect(mesh.scale.y).toBe(mesh.scale.z);
		// Se ha reducido de verdad (el doble de ancho → la mitad)...
		expect(mesh.scale.x).toBeCloseTo(0.5, 6);
		// ...y justo hasta caber en el maxWidth del slot, ni más ni menos.
		expect(measuredWidth(mesh) * mesh.scale.x).toBeCloseTo(nameSlot.maxWidth, 10);
	});

	it('does not enlarge a text that already fits', () => {
		const [nameSlot] = BADGE_TEXT_LAYOUT;
		const mesh = textMesh(nameSlot.maxWidth / 2);

		internalsOf(createTextureScene()).fitTextMeshes([mesh]);

		expect(mesh.scale.x).toBe(1);
		expect(mesh.scale.y).toBe(1);
		expect(mesh.scale.z).toBe(1);
	});

	it('lands the right edge of a SHRUNK text on its anchor (offset over the scaled width)', () => {
		const [nameSlot] = BADGE_TEXT_LAYOUT;
		const mesh = textMesh(nameSlot.maxWidth * 2);

		internalsOf(createTextureScene()).fitTextMeshes([mesh]);

		const rawWidth = measuredWidth(mesh);
		expect(mesh.position.x + rawWidth * mesh.scale.x).toBeCloseTo(anchorX(nameSlot), 10);
		// ...y NO donde lo dejaría el ancho crudo: con el bbox sin escalar, este texto se despegaría
		// del borde derecho justo la mitad de su ancho (criterio 4 de la feature).
		expect(mesh.position.x).not.toBeCloseTo(anchorX(nameSlot) - rawWidth, 3);
	});

	it('anchors each slot of the shipped layout on its own anchor and the shared text layer', () => {
		const meshes = BADGE_TEXT_LAYOUT.map((slot) => textMesh(slot.maxWidth / 2));

		internalsOf(createTextureScene()).fitTextMeshes(meshes);

		meshes.forEach((mesh, index) => {
			const slot = BADGE_TEXT_LAYOUT[index];
			// align 'right' con escala 1: el borde derecho (x + ancho) cae sobre el anchor.
			expect(mesh.scale.x).toBe(1);
			expect(mesh.position.x + measuredWidth(mesh)).toBeCloseTo(anchorX(slot), 10);
			expect(mesh.position.y).toBeCloseTo(anchorY(slot), 10);
			expect(mesh.position.z).toBe(BADGE_TEXTURE.textLayerZ);
			// Y todos caen dentro de la cara: los textos vuelven al cuadro (fuera de él desde T3).
			expect(mesh.position.x).toBeGreaterThanOrEqual(-BADGE_FRONT_FACE.halfWidth);
			expect(Math.abs(mesh.position.y)).toBeLessThanOrEqual(BADGE_FRONT_FACE.halfHeight);
		});
	});

	it('leaves a text with no measurable geometry on its anchor, never at NaN', () => {
		// Estado real mientras la fuente no ha resuelto: NgtsText3D monta el mesh sin geometría. Un
		// NaN en position/scale sacaría el texto de la escena para siempre.
		const [nameSlot] = BADGE_TEXT_LAYOUT;
		const mesh = new Mesh(new BufferGeometry());

		internalsOf(createTextureScene()).fitTextMeshes([mesh]);

		expect(mesh.scale.x).toBe(1);
		expect(mesh.position.x).toBeCloseTo(anchorX(nameSlot), 10);
		expect(mesh.position.y).toBeCloseTo(anchorY(nameSlot), 10);
	});

	it('ignores meshes without a matching slot instead of crashing', () => {
		// El viewChildren puede ir por delante del computed en un cambio de layout.
		const extra = textMesh(0.2);
		const meshes = [...BADGE_TEXT_LAYOUT.map((slot) => textMesh(slot.maxWidth / 2)), extra];

		internalsOf(createTextureScene()).fitTextMeshes(meshes);

		expect(extra.position.x).toBe(0);
		expect(extra.scale.x).toBe(1);
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

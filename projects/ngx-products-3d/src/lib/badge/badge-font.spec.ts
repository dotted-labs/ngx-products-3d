import { FileLoader, ShapeUtils } from 'three';
import { Font, type FontData } from 'three/addons/loaders/FontLoader.js';

// Dobles de la descarga y del parseo de fuentes binarias. En jsdom no hay red: la descarga
// (`FileLoader.loadAsync` de three, espiado en el prototipo: mockear el módulo `three` entero
// rompe el orden de inicialización del bundle de tests) sirve los bytes de `files` o, si la URL está
// en `failures` o no se sirve, el mismo rechazo que da un 404. El `TTFLoader` extiende el REAL para
// apuntar con qué `reversed` y qué bytes se llamó a `parse`; por defecto devuelve un typeface falso
// (no hace falta una fuente entera para probar la caché), y con `parseForReal` delega en el parseo
// real (test de integración con `Ballega.otf`). vi.hoisted corre antes que la factory de vi.mock,
// que intercepta también el import() DINÁMICO.
const fontLoaderMock = vi.hoisted(() => ({
	files: new Map<string, ArrayBuffer>(),
	failures: new Set<string>(),
	downloaded: [] as string[],
	responseTypes: [] as string[],
	parsed: [] as { reversed: boolean; buffer: ArrayBuffer }[],
	parseForReal: false,
}));

beforeEach(() => {
	vi.spyOn(FileLoader.prototype, 'loadAsync').mockImplementation(async function (
		this: FileLoader,
		url: string,
	) {
		fontLoaderMock.downloaded.push(url);
		fontLoaderMock.responseTypes.push(this.responseType);
		const bytes = fontLoaderMock.files.get(url);
		if (fontLoaderMock.failures.has(url) || !bytes) {
			// Mismo mensaje que el HttpError de FileLoader de three ante un 404.
			throw new Error(`fetch for "${url}" responded with 404: Not Found`);
		}
		return bytes;
	});
});

afterEach(() => {
	vi.restoreAllMocks();
});

vi.mock('three/addons/loaders/TTFLoader.js', async (importOriginal) => {
	const { TTFLoader } = await importOriginal<typeof import('three/addons/loaders/TTFLoader.js')>();
	return {
		TTFLoader: class extends TTFLoader {
			override parse(buffer: ArrayBuffer): FontData {
				fontLoaderMock.parsed.push({ reversed: this.reversed, buffer });
				if (fontLoaderMock.parseForReal) {
					return super.parse(buffer);
				}
				return { familyName: 'Ballega', resolution: 1000, glyphs: {} } as unknown as FontData;
			}
		},
	};
});

import { isOpentypeFontUrl, loadOpentypeFontData, sfntOutlineFormat } from './badge-font';

/** Firmas sfnt, como uint32 big-endian (así las escribe una fuente en sus 4 primeros bytes). */
const SIGNATURE = {
	cff: 0x4f54544f, // 'OTTO'
	trueType: 0x00010000,
	appleTrueType: 0x74727565, // 'true'
	woff: 0x774f4646, // 'wOFF'
	woff2: 0x774f4632, // 'wOF2'
	collection: 0x74746366, // 'ttcf'
} as const;

/** Cabecera sfnt mínima: la firma y unos bytes de relleno, lo único que mira la detección. */
function sfntBuffer(signature: number, byteLength = 12): ArrayBuffer {
	const buffer = new ArrayBuffer(byteLength);
	new DataView(buffer).setUint32(0, signature);
	return buffer;
}

/** Sirve `bytes` en `url` a través del doble del FileLoader. */
function serveFont(url: string, bytes: ArrayBuffer): void {
	fontLoaderMock.files.set(url, bytes);
}

describe('sfntOutlineFormat', () => {
	it('reads a CFF font from its OTTO signature', () => {
		expect(sfntOutlineFormat(sfntBuffer(SIGNATURE.cff))).toBe('cff');
	});

	it('reads a TrueType font from both TrueType signatures', () => {
		expect(sfntOutlineFormat(sfntBuffer(SIGNATURE.trueType))).toBe('truetype');
		expect(sfntOutlineFormat(sfntBuffer(SIGNATURE.appleTrueType))).toBe('truetype');
	});

	it('does not recognise compressed or collection containers (no WOFF support)', () => {
		expect(sfntOutlineFormat(sfntBuffer(SIGNATURE.woff))).toBeUndefined();
		expect(sfntOutlineFormat(sfntBuffer(SIGNATURE.woff2))).toBeUndefined();
		expect(sfntOutlineFormat(sfntBuffer(SIGNATURE.collection))).toBeUndefined();
	});

	it('reads the signature big-endian, as the sfnt spec stores it', () => {
		// 0x00010000 leído little-endian sería 0x00000100: una detección con el endianness del host
		// no reconocería ninguna TrueType en x86/ARM.
		const littleEndianTrueType = new ArrayBuffer(12);
		new DataView(littleEndianTrueType).setUint32(0, SIGNATURE.trueType, true);

		expect(sfntOutlineFormat(littleEndianTrueType)).toBeUndefined();
	});

	it('says undefined for a buffer shorter than the signature instead of throwing', () => {
		expect(sfntOutlineFormat(new ArrayBuffer(0))).toBeUndefined();
		// 'OTT': el principio de una firma CFF, truncado.
		expect(sfntOutlineFormat(new Uint8Array([0x4f, 0x54, 0x54]).buffer)).toBeUndefined();
	});
});

describe('isOpentypeFontUrl', () => {
	it('detects a binary font by extension, case-insensitively', () => {
		expect(isOpentypeFontUrl('/assets/Ballega.otf')).toBe(true);
		expect(isOpentypeFontUrl('/assets/Ballega.OTF')).toBe(true);
		expect(isOpentypeFontUrl('/assets/Ballega.ttf')).toBe(true);
		expect(isOpentypeFontUrl('/assets/Ballega.TtF')).toBe(true);
	});

	it('ignores the query and the hash, which are not part of the path', () => {
		// Cache busters y fragmentos: la extensión sigue siendo la de la ruta.
		expect(isOpentypeFontUrl('/assets/Ballega.otf?v=2')).toBe(true);
		expect(isOpentypeFontUrl('/assets/Ballega.otf#hash')).toBe(true);
		expect(isOpentypeFontUrl('https://cdn.example.com/f/Ballega.TTF?v=2#hash')).toBe(true);
	});

	it('treats a typeface JSON url as NOT binary (passthrough a soba)', () => {
		expect(isOpentypeFontUrl('/assets/font.json')).toBe(false);
		expect(isOpentypeFontUrl('/assets/font.typeface.json')).toBe(false);
	});

	it('does not confuse the extension with the rest of the url', () => {
		// La detección es por extensión de la RUTA, no por «la url contiene .otf».
		expect(isOpentypeFontUrl('/assets/font.json?family=Ballega.otf')).toBe(false);
		expect(isOpentypeFontUrl('/assets/font.json#Ballega.ttf')).toBe(false);
		expect(isOpentypeFontUrl('/assets/otf/font.json')).toBe(false);
		expect(isOpentypeFontUrl('/assets/Ballega.otf.json')).toBe(false);
	});

	it('says no for an empty url instead of throwing', () => {
		// `fontUrl` vacío ya lo rechaza assertValidBadgeTheme, pero la fn pura no puede explotar.
		expect(isOpentypeFontUrl('')).toBe(false);
		expect(isOpentypeFontUrl('?v=2')).toBe(false);
	});
});

describe('loadOpentypeFontData', () => {
	afterEach(() => {
		fontLoaderMock.files.clear();
		fontLoaderMock.failures.clear();
		fontLoaderMock.downloaded = [];
		fontLoaderMock.responseTypes = [];
		fontLoaderMock.parsed = [];
		fontLoaderMock.parseForReal = false;
	});

	it('converts a binary font into typeface data through the dynamic TTFLoader', async () => {
		const bytes = sfntBuffer(SIGNATURE.cff);
		serveFont('/assets/converted.otf', bytes);

		const font = await loadOpentypeFontData('/assets/converted.otf');

		// Los bytes se piden como ArrayBuffer y llegan TAL CUAL al parse del TTFLoader.
		expect(fontLoaderMock.downloaded).toEqual(['/assets/converted.otf']);
		expect(fontLoaderMock.responseTypes).toEqual(['arraybuffer']);
		expect(fontLoaderMock.parsed).toHaveLength(1);
		expect(fontLoaderMock.parsed[0].buffer).toBe(bytes);
		// Lo que devuelve TTFLoader.parse es el typeface JSON que NgtsText3D acepta como objeto.
		expect(font).toMatchObject({ familyName: 'Ballega', resolution: 1000 });
	});

	it('parses a CFF font (OTTO) with reversed = true', async () => {
		serveFont('/assets/cff.otf', sfntBuffer(SIGNATURE.cff));

		await loadOpentypeFontData('/assets/cff.otf');

		// Sin esto, ShapePath.toShapes toma el hueco de la «o» por su exterior y viceversa.
		expect(fontLoaderMock.parsed.map(({ reversed }) => reversed)).toEqual([true]);
	});

	it('parses a TrueType font with reversed = false, for both TrueType signatures', async () => {
		serveFont('/assets/truetype.ttf', sfntBuffer(SIGNATURE.trueType));
		serveFont('/assets/apple.ttf', sfntBuffer(SIGNATURE.appleTrueType));

		await loadOpentypeFontData('/assets/truetype.ttf');
		await loadOpentypeFontData('/assets/apple.ttf');

		expect(fontLoaderMock.parsed.map(({ reversed }) => reversed)).toEqual([false, false]);
	});

	it('decides reversed from the bytes, not from the extension', async () => {
		// Un .otf puede llevar contornos TrueType, y la extensión la elige quien sirve el fichero.
		serveFont('/assets/truetype-outlines.otf', sfntBuffer(SIGNATURE.trueType));
		serveFont('/assets/cff-outlines.ttf', sfntBuffer(SIGNATURE.cff));

		await loadOpentypeFontData('/assets/truetype-outlines.otf');
		await loadOpentypeFontData('/assets/cff-outlines.ttf');

		expect(fontLoaderMock.parsed.map(({ reversed }) => reversed)).toEqual([false, true]);
	});

	it('rejects a font whose header is not OTF/TTF, naming the url and the header', async () => {
		serveFont('/assets/compressed.otf', sfntBuffer(SIGNATURE.woff));

		const failure = loadOpentypeFontData('/assets/compressed.otf');

		await expect(failure).rejects.toThrow('[ngx-products-3d]');
		await expect(failure).rejects.toThrow('/assets/compressed.otf');
		await expect(failure).rejects.toThrow('"wOFF"');
		// No se llega a parsear: el opentype de three sí abre WOFF, y lo haría con el giro sin fijar.
		expect(fontLoaderMock.parsed).toEqual([]);
	});

	it('rejects a download too short to carry a signature', async () => {
		serveFont('/assets/truncated.otf', new ArrayBuffer(2));

		await expect(loadOpentypeFontData('/assets/truncated.otf')).rejects.toThrow('OTF/TTF');
		expect(fontLoaderMock.parsed).toEqual([]);
	});

	it('does not cache an unsupported header: the next attempt downloads again', async () => {
		serveFont('/assets/redeployed.otf', sfntBuffer(SIGNATURE.woff2));
		await expect(loadOpentypeFontData('/assets/redeployed.otf')).rejects.toThrow('OTF/TTF');

		// Se re-despliega el asset como OTF de verdad en la misma URL.
		serveFont('/assets/redeployed.otf', sfntBuffer(SIGNATURE.cff));
		const font = await loadOpentypeFontData('/assets/redeployed.otf');

		expect(font).toMatchObject({ familyName: 'Ballega' });
		expect(fontLoaderMock.downloaded).toEqual(['/assets/redeployed.otf', '/assets/redeployed.otf']);
	});

	it('returns the SAME object reference for the same url (soba cachea por identidad)', async () => {
		serveFont('/assets/stable.otf', sfntBuffer(SIGNATURE.cff));

		const first = await loadOpentypeFontData('/assets/stable.otf');
		const second = await loadOpentypeFontData('/assets/stable.otf');

		// Si esto fuera un objeto nuevo, la caché de fontResource (Map keyed por identidad del
		// parámetro) re-parsearía la fuente en cada detección de cambios.
		expect(second).toBe(first);
		expect(fontLoaderMock.downloaded).toEqual(['/assets/stable.otf']);
		expect(fontLoaderMock.parsed).toHaveLength(1);
	});

	it('shares one single parse between concurrent callers of the same url', async () => {
		serveFont('/assets/concurrent.otf', sfntBuffer(SIGNATURE.cff));

		// Dos badges montados a la vez: sin cachear la PROMESA saldrían dos objetos distintos para
		// la misma fuente.
		const [first, second] = await Promise.all([
			loadOpentypeFontData('/assets/concurrent.otf'),
			loadOpentypeFontData('/assets/concurrent.otf'),
		]);

		expect(second).toBe(first);
		expect(fontLoaderMock.downloaded).toEqual(['/assets/concurrent.otf']);
		expect(fontLoaderMock.parsed).toHaveLength(1);
	});

	it('keeps different urls apart', async () => {
		serveFont('/assets/one.otf', sfntBuffer(SIGNATURE.cff));
		serveFont('/assets/two.ttf', sfntBuffer(SIGNATURE.trueType));

		const first = await loadOpentypeFontData('/assets/one.otf');
		const second = await loadOpentypeFontData('/assets/two.ttf');

		expect(second).not.toBe(first);
		expect(fontLoaderMock.downloaded).toEqual(['/assets/one.otf', '/assets/two.ttf']);
	});

	it('rejects when the font cannot be downloaded, without swallowing the error', async () => {
		fontLoaderMock.failures.add('/assets/broken.otf');

		await expect(loadOpentypeFontData('/assets/broken.otf')).rejects.toThrow('404');
		expect(fontLoaderMock.parsed).toEqual([]);
	});

	it('does not cache a failure: the next attempt loads again', async () => {
		serveFont('/assets/flaky.otf', sfntBuffer(SIGNATURE.cff));
		fontLoaderMock.failures.add('/assets/flaky.otf');
		await expect(loadOpentypeFontData('/assets/flaky.otf')).rejects.toThrow();

		// El asset vuelve a estar disponible (deploy arreglado, red recuperada): una promesa
		// rechazada cacheada dejaría esta fuente rota para siempre en la sesión.
		fontLoaderMock.failures.clear();
		const font = await loadOpentypeFontData('/assets/flaky.otf');

		expect(font).toMatchObject({ familyName: 'Ballega' });
		expect(fontLoaderMock.downloaded).toEqual(['/assets/flaky.otf', '/assets/flaky.otf']);
	});
});

describe('loadOpentypeFontData with the real Ballega.otf (integration)', () => {
	/**
	 * Área con signo de un glifo: |exterior| − |huecos|, sumado por shape. Es positiva si
	 * `ShapePath.toShapes` distinguió bien exterior y hueco; si los intercambia (giro invertido) el
	 * «exterior» es el contorno interior y el «hueco» el exterior, y sale negativa.
	 */
	function glyphSignedArea(font: Font, glyph: string): number {
		const absoluteArea = (points: Parameters<typeof ShapeUtils.area>[0]) =>
			Math.abs(ShapeUtils.area(points));
		return font.generateShapes(glyph, 1).reduce((total, shape) => {
			const holesArea = shape.holes.reduce((sum, hole) => sum + absoluteArea(hole.getPoints()), 0);
			return total + absoluteArea(shape.getPoints()) - holesArea;
		}, 0);
	}

	afterEach(() => {
		fontLoaderMock.files.clear();
		fontLoaderMock.downloaded = [];
		fontLoaderMock.responseTypes = [];
		fontLoaderMock.parsed = [];
		fontLoaderMock.parseForReal = false;
	});

	it('keeps the holes of «o», «D», «A» and «e» as holes (positive signed area)', async () => {
		// El asset real del playground (70 KB, CFF), leído del disco: el runner corre en Node aunque
		// el entorno sea jsdom. La ruta es relativa a la raíz del workspace, desde donde se lanza
		// `ng test`.
		const { readFileSync } = await vi.importActual<{
			readFileSync(path: string): Uint8Array;
		}>('node:fs');
		const bytes = readFileSync('projects/products-3d-playground/public/assets/Ballega.otf');
		serveFont('/assets/Ballega-real.otf', new Uint8Array(bytes).buffer);
		fontLoaderMock.parseForReal = true;

		const font = new Font(
			(await loadOpentypeFontData('/assets/Ballega-real.otf')) as unknown as FontData,
		);

		expect(fontLoaderMock.parsed.map(({ reversed }) => reversed)).toEqual([true]);
		// Con el giro sin corregir, estas cuatro dan −0.411, −0.511, −0.465 y −0.463 (medido).
		for (const glyph of ['o', 'D', 'A', 'e']) {
			expect(glyphSignedArea(font, glyph), glyph).toBeGreaterThan(0);
		}
		// Control: un glifo sin hueco no depende del giro y ya salía bien.
		expect(glyphSignedArea(font, 'G')).toBeGreaterThan(0);
	});
});

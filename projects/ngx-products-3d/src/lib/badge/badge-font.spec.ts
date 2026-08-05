// Doble del TTFLoader de three: el módulo real arrastra el `opentype` embebido (~467 KB) y su
// `loadAsync` haría una petición HTTP de verdad, que en jsdom no existe. Se cuenta cada carga (es lo
// que demuestra que la caché no re-parsea) y se puede marcar una URL como rota. vi.hoisted corre
// antes que la factory de vi.mock, que a su vez intercepta también el import() DINÁMICO.
const ttfLoaderMock = vi.hoisted(() => ({
	loaded: [] as string[],
	failures: new Set<string>(),
}));

vi.mock('three/addons/loaders/TTFLoader.js', () => ({
	TTFLoader: class {
		async loadAsync(url: string): Promise<unknown> {
			ttfLoaderMock.loaded.push(url);
			if (ttfLoaderMock.failures.has(url)) {
				// Mismo mensaje que el HttpError de FileLoader de three ante un 404.
				throw new Error(`fetch for "${url}" responded with 404: Not Found`);
			}
			return { familyName: 'Ballega', resolution: 1000, glyphs: {} };
		}
	},
}));

import { isOpentypeFontUrl, loadOpentypeFontData } from './badge-font';

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
		ttfLoaderMock.loaded = [];
		ttfLoaderMock.failures.clear();
	});

	it('converts a binary font into typeface data through the dynamic TTFLoader', async () => {
		const font = await loadOpentypeFontData('/assets/converted.otf');

		expect(ttfLoaderMock.loaded).toEqual(['/assets/converted.otf']);
		// Lo que devuelve TTFLoader.parse es el typeface JSON que NgtsText3D acepta como objeto.
		expect(font).toMatchObject({ familyName: 'Ballega', resolution: 1000 });
	});

	it('returns the SAME object reference for the same url (soba cachea por identidad)', async () => {
		const first = await loadOpentypeFontData('/assets/stable.otf');
		const second = await loadOpentypeFontData('/assets/stable.otf');

		// Si esto fuera un objeto nuevo, la caché de fontResource (Map keyed por identidad del
		// parámetro) re-parsearía la fuente en cada detección de cambios.
		expect(second).toBe(first);
		expect(ttfLoaderMock.loaded).toEqual(['/assets/stable.otf']);
	});

	it('shares one single parse between concurrent callers of the same url', async () => {
		// Dos badges montados a la vez: sin cachear la PROMESA saldrían dos objetos distintos para
		// la misma fuente.
		const [first, second] = await Promise.all([
			loadOpentypeFontData('/assets/concurrent.otf'),
			loadOpentypeFontData('/assets/concurrent.otf'),
		]);

		expect(second).toBe(first);
		expect(ttfLoaderMock.loaded).toEqual(['/assets/concurrent.otf']);
	});

	it('keeps different urls apart', async () => {
		const first = await loadOpentypeFontData('/assets/one.otf');
		const second = await loadOpentypeFontData('/assets/two.ttf');

		expect(second).not.toBe(first);
		expect(ttfLoaderMock.loaded).toEqual(['/assets/one.otf', '/assets/two.ttf']);
	});

	it('rejects when the font cannot be downloaded or parsed, without swallowing the error', async () => {
		ttfLoaderMock.failures.add('/assets/broken.otf');

		await expect(loadOpentypeFontData('/assets/broken.otf')).rejects.toThrow('404');
	});

	it('does not cache a failure: the next attempt loads again', async () => {
		ttfLoaderMock.failures.add('/assets/flaky.otf');
		await expect(loadOpentypeFontData('/assets/flaky.otf')).rejects.toThrow();

		// El asset vuelve a estar disponible (deploy arreglado, red recuperada): una promesa
		// rechazada cacheada dejaría esta fuente rota para siempre en la sesión.
		ttfLoaderMock.failures.clear();
		const font = await loadOpentypeFontData('/assets/flaky.otf');

		expect(font).toMatchObject({ familyName: 'Ballega' });
		expect(ttfLoaderMock.loaded).toEqual(['/assets/flaky.otf', '/assets/flaky.otf']);
	});
});

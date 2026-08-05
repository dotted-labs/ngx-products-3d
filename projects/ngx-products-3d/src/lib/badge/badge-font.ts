import type { NgtsFontInput } from 'angular-three-soba/loaders';

/**
 * Extensiones de fuente BINARIA que la lib convierte a typeface JSON antes de pasársela a soba.
 * Las dos van juntas a propósito: las parsea el mismo `TTFLoader` de three, cuyo `opentype`
 * embebido incluye el intérprete CFF (que es lo que distingue a OTF de TTF). No existe `OTFLoader`.
 */
const OPENTYPE_FONT_EXTENSIONS = ['.otf', '.ttf'] as const;

/**
 * ¿`url` apunta a una fuente binaria (`.otf`/`.ttf`) en lugar de a un typeface JSON de three?
 *
 * Insensible a mayúsculas y tolerante a `?query` y `#hash` (cache busters, fragmentos): no forman
 * parte de la ruta, así que no deciden el formato. La detección es por extensión de la RUTA, no por
 * la URL entera, para que `font.json?family=x.otf` siga siendo JSON.
 */
export function isOpentypeFontUrl(url: string): boolean {
	const [path] = url.split(/[?#]/);
	const lowerCasePath = path.toLowerCase();
	return OPENTYPE_FONT_EXTENSIONS.some((extension) => lowerCasePath.endsWith(extension));
}

/**
 * Typefaces ya convertidos, indexados por URL, con la PROMESA como valor.
 *
 * Existe por dos razones, y las dos exigen que la referencia devuelta para una misma URL sea
 * SIEMPRE la misma: (1) la caché de `fontResource` de soba está keyed por IDENTIDAD del parámetro
 * (`angular-three-soba/fesm2022/angular-three-soba-loaders.mjs:139-149`), así que un objeto nuevo
 * por detección de cambios la haría re-parsear la fuente en bucle; (2) dos badges con el mismo tema
 * comparten el parseo. Se cachea la promesa, no el resultado, para que dos montajes simultáneos no
 * produzcan dos objetos distintos para la misma URL.
 *
 * A nivel de módulo, como la de soba: es caché de ASSET (inmutable, compartible), no estado de
 * escena. Un fallo se descachea (ver `loadOpentypeFontData`) para no envenenar reintentos.
 */
const parsedOpentypeFonts = new Map<string, Promise<NgtsFontInput>>();

/**
 * Descarga una fuente binaria (`.otf`/`.ttf`) y la convierte al typeface JSON que `NgtsText3D`
 * acepta como objeto de fuente (`font` no tiene transform: un string se fetchea como JSON, un
 * objeto se pasa tal cual a `FontLoader.parse`).
 *
 * Rechaza si la descarga o el parseo fallan: el degradado lo decide quien llama, aquí no se
 * silencia nada.
 */
export function loadOpentypeFontData(url: string): Promise<NgtsFontInput> {
	const cached = parsedOpentypeFonts.get(url);
	if (cached) {
		return cached;
	}
	const pending = parseOpentypeFont(url).catch((error: unknown) => {
		// Una URL que falla (404, bytes corruptos) no se queda cacheada: si no, un reintento con la
		// misma URL devolvería para siempre el rechazo original.
		parsedOpentypeFonts.delete(url);
		throw error;
	});
	parsedOpentypeFonts.set(url, pending);
	return pending;
}

/**
 * `import()` DINÁMICO, nunca estático: `TTFLoader` arrastra el `opentype` embebido de three
 * (~467 KB) y un import estático se lo cobraría a todo consumidor de la lib, use o no una fuente
 * binaria. Además mantiene la ruta SSR-safe (el módulo solo se pide cuando hay algo que cargar).
 */
async function parseOpentypeFont(url: string): Promise<NgtsFontInput> {
	const { TTFLoader } = await import('three/addons/loaders/TTFLoader.js');
	const fontData = await new TTFLoader().loadAsync(url);
	// El `FontData` de @types/three y el de soba describen el MISMO typeface JSON, pero el de soba
	// declara `_cachedOutline` obligatorio en cada glifo y ese campo lo rellena el `FontLoader` de
	// three en caliente: ningún typeface lo trae de origen (tampoco el que produce `TTFLoader`).
	// Conversión de tipos, no de datos.
	return fontData as unknown as NgtsFontInput;
}

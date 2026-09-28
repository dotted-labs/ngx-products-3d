import { FileLoader } from 'three';
import type { NgtsFontInput } from 'angular-three-soba/loaders';

/**
 * Extensiones de fuente BINARIA que la lib convierte a typeface JSON antes de pasársela a soba.
 * Las dos van juntas a propósito: las parsea el mismo `TTFLoader` de three, cuyo `opentype`
 * embebido incluye el intérprete CFF (que es lo que distingue a OTF de TTF). No existe `OTFLoader`.
 * Lo que sí cambia entre ellas es el sentido de giro de los contornos, y eso NO lo decide la
 * extensión sino la cabecera de los bytes: ver `sfntOutlineFormat`.
 */
const OPENTYPE_FONT_EXTENSIONS = ['.otf', '.ttf'] as const;

/** Formato de contorno de una fuente sfnt: CFF (curvas cúbicas, `OTTO`) o TrueType (`glyf`). */
export type SfntOutlineFormat = 'cff' | 'truetype';

/** Bytes de la firma sfnt (`sfntVersion`, uint32 big-endian al principio del fichero). */
const SFNT_SIGNATURE_BYTES = 4;

/**
 * Firmas sfnt que la lib sabe convertir, con su formato de contorno. Cualquier otra (WOFF `wOFF`,
 * WOFF2 `wOF2`, colección `ttcf`, bytes que no son una fuente) se rechaza: la lib no promete más
 * que OTF/TTF sin comprimir.
 */
const SFNT_OUTLINE_SIGNATURES: ReadonlyMap<number, SfntOutlineFormat> = new Map([
	[0x4f54544f, 'cff'], // 'OTTO'
	[0x00010000, 'truetype'],
	[0x74727565, 'truetype'], // 'true' (TrueType de Apple)
]);

/**
 * Formato de contorno de una fuente, leído de su firma sfnt (los 4 primeros bytes). `undefined` si
 * la firma es desconocida o el buffer no llega a los 4 bytes.
 *
 * Existe porque `TTFLoader.reversed` depende del formato: la convención de giro de CFF (exterior
 * antihorario) es la contraria a la de TrueType (exterior horario), y `ShapePath.toShapes` de three
 * decide exterior/hueco por el giro. Con `reversed = false` en una fuente CFF se intercambian, y los
 * glifos con hueco salen rotos: con `Ballega.otf` (CFF) el área con signo de «o» da −0.411 con
 * `false` y +0.411 con `true`; con una TrueType (arial.ttf) es al revés, +0.223 con `false`
 * (diagnóstico de la feature 10, `progress/task_font-cff-winding.md`).
 *
 * Se lee la CABECERA y no la extensión porque un `.otf` puede llevar contornos TrueType y la
 * extensión la elige quien sirve el fichero.
 */
export function sfntOutlineFormat(buffer: ArrayBuffer): SfntOutlineFormat | undefined {
	if (buffer.byteLength < SFNT_SIGNATURE_BYTES) {
		return undefined;
	}
	return SFNT_OUTLINE_SIGNATURES.get(new DataView(buffer).getUint32(0));
}

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
 * Rechaza si la descarga o el parseo fallan, o si la cabecera no es OTF/TTF: el degradado lo decide
 * quien llama, aquí no se silencia nada.
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
 *
 * Descarga y parseo van por separado (no `TTFLoader.loadAsync`) porque `reversed` tiene que estar
 * fijado ANTES de `parse` y solo se sabe con los bytes en la mano: `loadAsync` descarga y parsea de
 * una vez.
 */
async function parseOpentypeFont(url: string): Promise<NgtsFontInput> {
	const [{ TTFLoader }, buffer] = await Promise.all([
		import('three/addons/loaders/TTFLoader.js'),
		downloadFontBuffer(url),
	]);
	const outlineFormat = sfntOutlineFormat(buffer);
	if (!outlineFormat) {
		throw new Error(
			`[ngx-products-3d] badge: fontUrl "${url}" no es una fuente OTF/TTF ` +
				`(cabecera ${sfntSignatureLabel(buffer)}). Sirve un .otf o .ttf sin comprimir ` +
				'(WOFF/WOFF2 no están soportados) o un typeface JSON de three',
		);
	}
	const loader = new TTFLoader();
	loader.reversed = outlineFormat === 'cff';
	const fontData = loader.parse(buffer);
	// El `FontData` de @types/three y el de soba describen el MISMO typeface JSON, pero el de soba
	// declara `_cachedOutline` obligatorio en cada glifo y ese campo lo rellena el `FontLoader` de
	// three en caliente: ningún typeface lo trae de origen (tampoco el que produce `TTFLoader`).
	// Conversión de tipos, no de datos.
	return fontData as unknown as NgtsFontInput;
}

/**
 * Con `FileLoader` y no con `fetch`: es la MISMA descarga que hacía `TTFLoader.loadAsync` por dentro
 * (`FileLoader` en modo `arraybuffer`), así que conserva el rechazo en 404 (su `HttpError`), las
 * data URIs y el `DefaultLoadingManager` que escucha el `injectProgress` de soba. `fetch` obligaría
 * a reimplementar el `response.ok` y dejaría la fuente fuera del progreso de carga.
 */
async function downloadFontBuffer(url: string): Promise<ArrayBuffer> {
	const data = await new FileLoader().setResponseType('arraybuffer').loadAsync(url);
	// Con `responseType: 'arraybuffer'` el resultado es siempre un `ArrayBuffer`; el
	// `string | ArrayBuffer` es el tipo de la clase, no el de este modo.
	return data as ArrayBuffer;
}

/** Firma de la cabecera legible para el mensaje de error (`"wOFF"`, `"\u0000\u0001"`...). */
function sfntSignatureLabel(buffer: ArrayBuffer): string {
	const signatureBytes = new Uint8Array(
		buffer,
		0,
		Math.min(buffer.byteLength, SFNT_SIGNATURE_BYTES),
	);
	return JSON.stringify(String.fromCharCode(...signatureBytes));
}

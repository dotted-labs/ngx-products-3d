export const BADGE_CAMERA = {
	position: [0, 0, 13] as [number, number, number],
	fov: 25,
} as const;

export const BADGE_PHYSICS = {
	gravity: [0, -40, 0] as [number, number, number],
	timeStep: 1 / 60,
	/** Longitud de cada rope joint entre segmentos de la correa */
	segmentLength: 1,
	/** Anchor local (centro del body) de los rope joints entre segmentos */
	segmentJointAnchor: [0, 0, 0] as [number, number, number],
	/** Anchor del spherical joint tarjeta↔último segmento */
	cardJointAnchor: [0, 1.45, 0] as [number, number, number],
	/** Radio del ball collider de cada segmento de la correa */
	segmentColliderRadius: 0.1,
	/** Half-extents del cuboid collider de la tarjeta */
	cardColliderHalfExtents: [0.8, 1.125, 0.01] as [number, number, number],
	/** Damping de la tarjeta */
	angularDamping: 2,
	linearDamping: 2,
	/** Estabilización anti-jitter (lerp de segmentos intermedios) */
	minSpeed: 10,
	maxSpeed: 50,
	/**
	 * Rango al que se acota la distancia lerped→body antes de escalar la velocidad
	 * del lerp. Invariante de física: por debajo de `lerpClampMin` el segmento ya
	 * está prácticamente encima (no acelerar sobre ruido); por encima de
	 * `lerpClampMax` se satura para no dar tirones en saltos grandes de la cadena.
	 */
	lerpClampMin: 0.1,
	lerpClampMax: 1,
	/** Corrección anti-giro: angvel.y -= rotation.y * factor */
	spinCorrectionFactor: 0.25,
	/** Puntos de muestreo de la curva Catmull-Rom para la correa */
	curvePoints: 32,
} as const;

/** Drag de la tarjeta con puntero (spec-02 Fase 1, feature badge-drag) */
export const BADGE_DRAG = {
	/** Profundidad NDC a la que se desproyecta el puntero para situar el plano de arrastre */
	unprojectDepth: 0.5,
} as const;

/** Posiciones iniciales (coordenadas de mundo) de los cuerpos de la cadena y la tarjeta */
export const BADGE_LAYOUT = {
	fixedPosition: [0.5, 4, 0] as [number, number, number],
	j1Position: [0.5, 3, 0] as [number, number, number],
	j2Position: [0.5, 2, 0] as [number, number, number],
	j3Position: [0.5, 1, 0] as [number, number, number],
	cardPosition: [2, 0, 0] as [number, number, number],
} as const;

/** Correa (lanyard) renderizada por frame con meshline (spec-02 Fase 1) */
export const BADGE_BAND = {
	/** Color base de la correa; fallback cuando `theme.colors.band` no está definido */
	color: 'white',
	/** Ancho de línea de la correa en unidades de mundo (meshline lineWidth) */
	lineWidth: 1,
	/** La correa se dibuja siempre encima; sin test de profundidad para evitar clipping con la tarjeta */
	depthTest: false,
	/**
	 * Repetición de la textura de la correa (meshline `repeat`, un `Vector2`). La X negativa
	 * (-4) tesela la textura 4 veces a lo largo de la correa invirtiendo la U (orientación del
	 * arte del lanyard); la Y (1) no repite en el ancho. spec-03 feature 4.
	 */
	repeat: [-4, 1] as [number, number],
} as const;

/** Placeholder plano de la tarjeta (spec-02 Fase 1; se sustituye por el GLB en spec-03) */
export const BADGE_CARD_PLACEHOLDER = {
	planeSize: [1.6, 2.25] as [number, number],
	color: 'white',
	opacity: 0.9,
} as const;

export const BADGE_TEXTURE = {
	/** Resolución de la RenderTexture del frente de la tarjeta */
	size: 2000,
	/**
	 * Frames que renderiza la RenderTexture: `Infinity` = re-render continuo (un render del
	 * frente por frame del canvas). NO se usa `frames: 1` (render estático): el contador de
	 * frames del NgtsRenderTextureContainer de soba solo se resetea cuando se re-ejecuta su
	 * effect (trackea renderPriority y el store del portal, p. ej. el makeDefault de la cámara);
	 * el montaje async del contenido (textura base, fuente del Text3D) y los cambios de
	 * member/theme NO lo resetean → el frente quedaría en blanco/congelado
	 * (angular-three-soba/fesm2022/angular-three-soba-staging.mjs:3132-3159). Coste asumido y
	 * documentado (spec-03 Fase 4): un render extra de una escena mínima (plano + 3 textos) a un
	 * FBO de `size`² por frame — mismo patrón que el ejemplo lanyard de drei (RenderTexture sin
	 * `frames`, default Infinity).
	 */
	frames: Infinity,
	/** Posición de la cámara propia (makeDefault) de la escena de textura */
	cameraPosition: [0, 0, 5] as [number, number, number],
	/** Tamaño (ancho, alto) del plano de fondo; cubre el encuadre de la cámara a z=0 */
	planeSize: [5, 5] as [number, number],
} as const;

/** Campo de `BadgeMemberData` que pinta cada slot de texto del frente de la tarjeta */
export type BadgeTextField = 'name' | 'memberNumber' | 'tier';

/**
 * Un slot de texto del frente de la tarjeta (escena de textura, spec-03 feature 6).
 * Tuplas mutables a propósito: los inputs de soba (`NgtsText3D.options`) no admiten
 * `readonly` (mismo criterio que `BadgeLightformerOptions`). Exportado para que los
 * `.d.ts` de la lib puedan nombrar el tipo de `BADGE_TEXT_LAYOUT` (evita TS4029).
 */
export interface BadgeTextSlot {
	field: BadgeTextField;
	position: [number, number, number];
	rotation: [number, number, number];
	/** Tamaño de la fuente (TextGeometry `size`, unidades de mundo de la escena de textura) */
	size: number;
	/** Profundidad de extrusión del texto (TextGeometry `height`) */
	height: number;
}

/**
 * Layout data-driven de los textos del socio sobre el frente de la tarjeta: la escena de
 * textura solo itera este array (reordenar/ajustar slots NO toca el componente). La z
 * positiva (0.01) separa los textos del plano de fondo (evita z-fighting). Valores de
 * arranque plausibles; el ajuste fino visual llega con la RenderTexture (feature 7, N3).
 */
export const BADGE_TEXT_LAYOUT: BadgeTextSlot[] = [
	{ field: 'name', position: [-1.8, 0.6, 0.01], rotation: [0, 0, 0], size: 0.45, height: 0.05 },
	{
		field: 'memberNumber',
		position: [-1.8, -0.2, 0.01],
		rotation: [0, 0, 0],
		size: 0.3,
		height: 0.05,
	},
	{ field: 'tier', position: [-1.8, -0.9, 0.01], rotation: [0, 0, 0], size: 0.25, height: 0.05 },
];

/** Textos del frente de la tarjeta: formato y encaje (spec-03 feature 6) */
export const BADGE_TEXT = {
	/** Prefijo del número de socio (`#1234`) */
	memberNumberPrefix: '#',
	/**
	 * Ancho máximo (unidades de mundo de la escena de textura) de cada texto antes de
	 * escalarlo hacia abajo (nombres largos). Nunca agranda (clamp a <=1, ver `fitTextScale`).
	 */
	maxWidth: 3.6,
	/** Color fallback del texto cuando `theme.colors.text` no está definido */
	color: 'black',
} as const;

/** Defaults del meshPhysicalMaterial de la tarjeta (spec-03; override vía theme.material) */
export const BADGE_MATERIAL_DEFAULTS = {
	clearcoat: 1,
	clearcoatRoughness: 0.15,
	roughness: 0.3,
	metalness: 0.5,
	iridescence: 0,
	iridescenceIOR: 1,
} as const;

/**
 * Filtrado anisotrópico del `map` de la tarjeta (nitidez del frente en ángulos rasantes).
 * Es una propiedad de la TEXTURA, no de MeshPhysicalMaterial → vive fuera de
 * BADGE_MATERIAL_DEFAULTS y se pasa en las options del NgtsRenderTexture, que las aplica
 * como parameters sobre `fbo.texture` (el map real). Un binding [mapAnisotropy] sobre el
 * material sería un no-op: el renderer de angular-three solo "pierce" claves con punto.
 */
export const BADGE_MAP_ANISOTROPY = 16;

/**
 * Un lightformer del entorno de estudio: un mesh emisivo que se proyecta en el environment map
 * como reflejo sobre el clearcoat de la tarjeta. Tipo INTERNO (no API pública). `scale` se tipa
 * como tupla mutable a propósito: `NgtsLightformerOptions.scale` es `number | [n,n,n] | [n,n]`
 * mutable, y un `readonly` (que introduciría `as const`) no es asignable a ese input de soba.
 *
 * Exportado (no re-exportado en el índice público) solo para que los `.d.ts` de la lib puedan
 * nombrar el tipo del campo `lightformers` que expone el wrapper (evita TS4029).
 */
export interface BadgeLightformerOptions {
	intensity: number;
	color: string;
	form: 'circle' | 'ring' | 'rect';
	scale: [number, number, number];
	position: [number, number, number];
	rotation: [number, number, number];
}

/**
 * Cuatro áreas de luz (estilo estudio del ejemplo lanyard de drei) que forman los reflejos
 * del environment map: una barra superior tenue, dos barras laterales y un acento frontal
 * intenso. Cada objeto ES el `[options]` que consume `<ngts-lightformer>` (incluye `position`
 * y `rotation`, que soba spreadea al mesh vía `NgtThreeElement<Mesh>`). Valores de arranque
 * plausibles; el ajuste fino visual del brillo/barridos es verificación manual (Nivel 3).
 */
const BADGE_LIGHTFORMERS: BadgeLightformerOptions[] = [
	// Barra superior amplia y tenue: llena el reflejo base sobre el frente de la tarjeta.
	{
		intensity: 2,
		color: 'white',
		form: 'rect',
		scale: [100, 0.1, 1],
		position: [0, -1, 5],
		rotation: [0, 0, Math.PI / 3],
	},
	// Lateral izquierdo: barrido diagonal que da relieve al clearcoat.
	{
		intensity: 3,
		color: 'white',
		form: 'rect',
		scale: [100, 0.1, 1],
		position: [-1, -1, 1],
		rotation: [0, 0, Math.PI / 3],
	},
	// Lateral derecho / superior: segundo barrido cruzado.
	{
		intensity: 3,
		color: 'white',
		form: 'rect',
		scale: [100, 0.1, 1],
		position: [1, 1, 1],
		rotation: [0, 0, Math.PI / 3],
	},
	// Acento frontal intenso: el destello lateral marcado sobre el barniz.
	{
		intensity: 10,
		color: 'white',
		form: 'rect',
		scale: [100, 10, 1],
		position: [-10, 0, 14],
		rotation: [0, Math.PI / 2, Math.PI / 3],
	},
];

/**
 * Iluminación del badge (spec-03 feature 5). Data-driven: el wrapper solo itera esta config.
 *
 * - `ambientIntensity: Math.PI` → three r155+ usa iluminación físicamente correcta; con la
 *   escala lineal actual una `ambientLight` de intensidad 1 queda apagada, y `Math.PI` (≈3.14)
 *   recupera el nivel percibido pre-r155 (convención de los ejemplos de drei).
 * - `environment`: sin `preset` (los presets resuelven HDRs desde un CDN externo → requiere
 *   red); los reflejos vienen de los `lightformers` proyectados como hijos. Se usa
 *   `backgroundBlurriness` (0..1), NO `blur` (deprecado en soba v4). `background: false` → el
 *   environment solo ilumina/refleja, no se pinta como fondo.
 */
export const BADGE_LIGHTING = {
	ambientIntensity: Math.PI,
	environment: {
		background: false,
		backgroundBlurriness: 0.75,
	},
	lightformers: BADGE_LIGHTFORMERS,
} as const;

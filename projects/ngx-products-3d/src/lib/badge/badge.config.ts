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
	/**
	 * Anchor del spherical joint tarjeta↔último segmento, expresado en el sistema LOCAL del
	 * rigid body de la tarjeta (origen del body = centro de la tarjeta, ver
	 * `BADGE_CARD_MODEL.groupPosition`).
	 *
	 * Y = 1.286 es el borde SUPERIOR del `clipMesh` del GLB (accessor POSITION del modelo:
	 * X[-0.06, 0.06] · Y[0.917, **1.286**] · Z[-0.09, 0.09]), es decir el punto por el que el
	 * aro agarra la correa. Queda por encima del borde superior de la tarjeta
	 * (`cardColliderHalfExtents[1]` = 1.125), que es justo lo que hace que el clip sobresalga
	 * de la ranura. NO confundir con el anclaje visual: este valor solo lo consume el joint.
	 *
	 * (Histórico: con el `card.glb` demo valía 1.45 porque aquel modelo tenía el origen en el
	 * anclaje del clip y el nodo `card` compensaba con una translation `y = −1.45`.)
	 */
	cardJointAnchor: [0, 1.286, 0] as [number, number, number],
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
	/**
	 * `lineWidth` de la meshline. OJO: NO son unidades de mundo. Con `sizeAttenuation` (default 1
	 * de meshline) el shader suma el offset en espacio de clip, así que el ancho real de la correa
	 * es `lineWidth * tan(fov/2)` = **0.2217 uds** con `BADGE_CAMERA.fov` = 25 (constante con la
	 * distancia). De ahí sale el teselado de `repeat`; recalcularlo si se toca este valor.
	 */
	lineWidth: 1,
	/** La correa se dibuja siempre encima; sin test de profundidad para evitar clipping con la tarjeta */
	depthTest: false,
	/**
	 * Repetición de la textura de la correa (meshline `repeat`, un `Vector2`; el shader muestrea
	 * `texture2D(map, vUV * repeat)`, con `vUV.x` a lo largo de la correa y `vUV.y` a lo ancho).
	 * La Y (1) hace que el alto de la textura cubra exactamente el ancho de la correa.
	 *
	 * El MÓDULO de la X (3.383) es el número de teselas que mantiene el aspecto del arte sin
	 * estirarlo, derivado (spec-03-F3, feature 14):
	 * - Longitud de la correa = 3 rope joints × `BADGE_PHYSICS.segmentLength` (1) = **3 uds**
	 *   (el rope joint es una distancia MÁXIMA: en reposo la cadena cuelga tensa).
	 * - Ancho de la correa = **0.2217 uds**, NO `lineWidth`: con `sizeAttenuation` (default 1 de
	 *   meshline) el shader suma el offset en espacio de CLIP (`normal.xy *= .5 * lineWidth`),
	 *   de donde el ancho en mundo es `lineWidth * tan(fov/2)` = 1 × tan(12.5°) con
	 *   `BADGE_CAMERA.fov` = 25 (constante con la distancia).
	 * - Textura de referencia 4:1 (`band.jpg`, 1024×256) → una tesela debe medir 4 × 0.2217 =
	 *   0.887 uds de largo ⇒ repeticiones = 3 / 0.887 = **3.383**.
	 *
	 * El SIGNO negativo invierte la U (orientación del arte del lanyard, spec-03 feature 4).
	 * Recalcular si cambian `BADGE_CAMERA.fov`, `lineWidth`, `segmentLength` o el aspecto de la
	 * textura del tema.
	 */
	repeat: [-3.383, 1] as [number, number],
} as const;

/**
 * Colocación del modelo GLB dentro del rigid body de la tarjeta (spec-03-F3). Es el anclaje
 * VISUAL, deliberadamente separado de `BADGE_PHYSICS.cardJointAnchor` (anclaje FÍSICO del
 * spherical joint): comparten sistema de coordenadas pero no significado, y confundirlos es
 * lo que rompió el enganche al cambiar de modelo.
 */
export const BADGE_CARD_MODEL = {
	/**
	 * Posición del grupo que contiene los nodos `card`/`clip`/`clamp` del GLB, relativa al
	 * origen del rigid body de la tarjeta.
	 *
	 * Vale el origen (sin offset) porque el contrato del GLB fija su origen en el CENTRO de la
	 * tarjeta: el accessor POSITION de `cardMesh` es X[-0.8, 0.8] · Y[-1.125, 1.125] ·
	 * Z[-0.01, 0.01], exactamente `BADGE_PHYSICS.cardColliderHalfExtents` ([0.8, 1.125, 0.01]),
	 * que es un cuboid CENTRADO en el origen del body. Origen del GLB = centro del collider →
	 * offset cero, y el visual cae siempre donde colisiona y se arrastra la tarjeta.
	 */
	groupPosition: [0, 0, 0] as [number, number, number],
} as const;

/**
 * Rect de la cara frontal de la tarjeta, en unidades de mundo. DERIVADO, nunca literal: sale de
 * `BADGE_PHYSICS.cardColliderHalfExtents` ([0.8, 1.125, 0.01]), que ya es el contrato del GLB (el
 * accessor POSITION de `cardMesh` es X[-0.8, 0.8] · Y[-1.125, 1.125] · Z[-0.01, 0.01], y su UV 0-1
 * cubre esa cara entera: `u = (x + 0.8) / 1.6`, `v = (1.125 − y) / 2.25`).
 *
 * Es la ÚNICA fuente del ratio 32:45 (1.6 × 2.25 ≈ 0.711) al que deben alinearse las tres
 * relaciones de aspecto encadenadas del frente (spec-03-F4v2):
 * 1. el FBO de la RenderTexture (`BADGE_TEXTURE.width`/`height`),
 * 2. el frustum de la cámara ortográfica de la escena RT (`BADGE_TEXTURE.cameraFrustum`),
 * 3. la propia cara del GLB.
 * Si se desalinean, el arte y los textos del frente salen estirados. El test de invariante de
 * `badge.config.spec.ts` compara las tres contra el 32:45 del contrato del modelo.
 */
export const BADGE_FRONT_FACE = {
	halfWidth: BADGE_PHYSICS.cardColliderHalfExtents[0],
	halfHeight: BADGE_PHYSICS.cardColliderHalfExtents[1],
	width: BADGE_PHYSICS.cardColliderHalfExtents[0] * 2,
	height: BADGE_PHYSICS.cardColliderHalfExtents[1] * 2,
} as const;

/**
 * Color base del modelo cuando el tema no define `Products3dBadgeTheme.baseColor` (spec-03-F4v2 R2).
 * Único sitio donde vive este literal: los componentes lo consumen a través de las fns de
 * resolución de `badge-theme.ts`, nunca escriben el color a mano.
 */
export const BADGE_BASE_COLOR = '#000000';

/**
 * Separación en z entre las capas de la escena de textura (fondo opaco de `baseColor` → arte del
 * tier). Se declara aquí, y no como literal en el componente, para que el orden de las capas sea
 * una decisión de config.
 *
 * Con la cámara ORTOGRÁFICA el depth es lineal (no hay pérdida de precisión con la distancia), así
 * que un delta mínimo basta para ordenar las capas sin z-fighting. Se mantiene MUY por debajo de la
 * z de los textos (`BADGE_TEXT_LAYOUT`) para que el arte nunca los tape.
 */
const BADGE_RT_LAYER_GAP = 0.001;

export const BADGE_TEXTURE = {
	/**
	 * Resolución en píxeles del FBO de la RenderTexture del frente. NO es cuadrada: su ratio tiene
	 * que ser el de la cara frontal (`BADGE_FRONT_FACE`, 32:45) o el frente sale estirado. A la
	 * densidad de referencia del arte del tema (1000 px por unidad de mundo), 1.6 × 2.25 uds =
	 * **1600 × 2250 px** (spec-03-F4v2 R1).
	 *
	 * Se dejan explícitos en vez de calcularlos (`BADGE_FRONT_FACE.width * 1000`) a propósito: así
	 * el test de invariante de `badge.config.spec.ts` puede DETECTAR una desalineación real, en
	 * lugar de volverla imposible por construcción y quedarse sin poder fallar. Recalcular ambos si
	 * cambia `BADGE_PHYSICS.cardColliderHalfExtents` (= si cambia el GLB).
	 *
	 * Coste: `fboParams` de soba multiplica por `viewport.dpr()`, así que a dpr 2 son 3200 × 4500
	 * (menos píxel que el 2000² anterior, que daba 4000 × 4000).
	 */
	width: 1600,
	height: 2250,
	/**
	 * Frames que renderiza la RenderTexture: `Infinity` = re-render continuo (un render del
	 * frente por frame del canvas). NO se usa `frames: 1` (render estático): el contador de
	 * frames del NgtsRenderTextureContainer de soba solo se resetea cuando se re-ejecuta su
	 * effect (trackea renderPriority y el store del portal, p. ej. el makeDefault de la cámara);
	 * el montaje async del contenido (textura base, fuente del Text3D) y los cambios de
	 * member/theme NO lo resetean → el frente quedaría en blanco/congelado
	 * (angular-three-soba/fesm2022/angular-three-soba-staging.mjs:3132-3159). Coste asumido y
	 * documentado (spec-03 Fase 4): un render extra de una escena mínima (plano + 3 textos) al FBO
	 * de `width` × `height` por frame — mismo patrón que el ejemplo lanyard de drei (RenderTexture sin
	 * `frames`, default Infinity).
	 */
	frames: Infinity,
	/**
	 * Transformada UV con la que se muestrea el `map` de la tarjeta. Va en las options del
	 * NgtsRenderTexture (soba pasa las claves no reservadas como parameters sobre `fbo.texture`,
	 * igual que `BADGE_MAP_ANISOTROPY`), no como binding del material.
	 *
	 * Invierte la V — `v' = mapOffset.y + v · mapRepeat.y = 1 − v` — porque las dos convenciones
	 * que se encuentran aquí son opuestas (spec-03-F3, feature 14):
	 * - glTF fija el origen UV en la esquina SUPERIOR izquierda, y los UV del `card` del GLB lo
	 *   cumplen: en la cara +Z de `membresia.glb`, `u = (x + 0.8) / 1.6` y
	 *   `v = (1.125 − y) / 2.25` (ajuste exacto, r² = 1 sobre el accessor TEXCOORD_0) → v = 0 es
	 *   el borde SUPERIOR de la tarjeta.
	 * - La textura de un render target NO pasa por `texImage2D`, así que su `flipY` no se aplica:
	 *   su contenido queda en orientación GL, con v = 0 en el borde INFERIOR de lo renderizado.
	 *
	 * Sin esta corrección el frente del socio se pinta espejado en vertical. La U no se toca (la
	 * cara +Z no está espejada en horizontal).
	 */
	mapRepeat: [1, -1] as [number, number],
	/** Desplazamiento UV del `map` de la tarjeta; con `mapRepeat` compone la inversión de la V */
	mapOffset: [0, 1] as [number, number],
	/** Posición de la cámara propia (makeDefault) de la escena de textura */
	cameraPosition: [0, 0, 5] as [number, number, number],
	/**
	 * Frustum EXPLÍCITO (unidades de mundo) de la cámara ORTOGRÁFICA de la escena de textura:
	 * encuadra exactamente la cara frontal, derivado de `BADGE_FRONT_FACE` (nada de literales
	 * ±0.8 / ±1.125 sueltos). Con la cámara mirando −Z desde `cameraPosition`, este rect es lo que
	 * acaba ocupando el FBO entero → ratio del frustum = ratio del FBO = ratio de la cara.
	 *
	 * Se pasa SIEMPRE junto con `manual: true` en las options de la cámara: sin `manual`, ni el
	 * frustum ni el encuadre están garantizados (el porqué, con referencias a `node_modules`, en
	 * `cameraOptions` de `badge-texture.component.ts`).
	 */
	cameraFrustum: {
		left: -BADGE_FRONT_FACE.halfWidth,
		right: BADGE_FRONT_FACE.halfWidth,
		top: BADGE_FRONT_FACE.halfHeight,
		bottom: -BADGE_FRONT_FACE.halfHeight,
	},
	/**
	 * Tamaño (ancho, alto, unidades de mundo) de los DOS quads del fondo de la escena de textura: el
	 * de `baseColor` y el del arte del tier. Es exactamente el rect de la cara frontal
	 * (`BADGE_FRONT_FACE`), que es también lo que encuadra `cameraFrustum` → los quads llenan el FBO
	 * borde a borde: sin bandas muertas, sin recorte y sin estirar el arte (spec-03-F4v2 R1).
	 *
	 * Derivado, nunca literal: el 5 × 5 anterior venía del encuadre de la cámara en perspectiva que
	 * retiró la feature 3 y dejaba el arte recortado contra el frustum de 1.6 × 2.25.
	 */
	frontPlaneSize: [BADGE_FRONT_FACE.width, BADGE_FRONT_FACE.height] as [number, number],
	/**
	 * Posición del quad OPACO de `baseColor`: la capa del fondo, en el plano z = 0 de la escena de
	 * textura (el mismo plano en el que el frustum encuadra la cara).
	 */
	backdropPosition: [0, 0, 0] as [number, number, number],
	/**
	 * Posición del plano del arte del tier (webp con alpha): el mismo rect que el fondo, adelantado
	 * `BADGE_RT_LAYER_GAP` hacia la cámara para que quede DELANTE del quad de `baseColor` y sus
	 * zonas transparentes lo revelen. Invertir el signo dejaría el arte detrás del fondo opaco, es
	 * decir invisible.
	 */
	artPosition: [0, 0, BADGE_RT_LAYER_GAP] as [number, number, number],
	/**
	 * Ratio (ancho / alto) que debe cumplir el arte del tier para no salir estirado: el de la cara
	 * frontal (`BADGE_FRONT_FACE`, 32:45 ≈ 0.711). DERIVADO, nunca literal — es el mismo rect que
	 * encuadra `cameraFrustum` y que cubren los quads de `frontPlaneSize`, así que el arte se estira
	 * exactamente en la proporción en la que su ratio se desvíe de éste.
	 *
	 * Es el contrato que la lib valida al resolver la textura base (`isRatioWithinTolerance` +
	 * warn dev en `badge-texture.component.ts`); el asset recomendado, 1600 × 2250 px, lo cumple.
	 */
	assetAspect: BADGE_FRONT_FACE.width / BADGE_FRONT_FACE.height,
	/**
	 * Desviación RELATIVA máxima del ratio del arte del tier respecto a `assetAspect` antes de que la
	 * lib avise en dev: 0.01 = **1%** (spec-03-F4v2 R1). Fracción, no porcentaje.
	 *
	 * No es cero a propósito: un asset exportado a un número redondo de píxeles rara vez da el ratio
	 * exacto (p. ej. 1600 × 2249 se desvía un 0.04%) y ese error es invisible en pantalla. Un 1% sobre
	 * la altura de la tarjeta son ~22 px del asset de referencia: por debajo no merece un aviso.
	 */
	assetAspectTolerance: 0.01,
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

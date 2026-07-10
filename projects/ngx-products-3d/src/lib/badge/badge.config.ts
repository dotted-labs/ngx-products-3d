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
	color: 'white',
	/** Ancho de línea de la correa en unidades de mundo (meshline lineWidth) */
	lineWidth: 1,
	/** La correa se dibuja siempre encima; sin test de profundidad para evitar clipping con la tarjeta */
	depthTest: false,
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

export interface BadgeMemberData {
	/** Nombre completo mostrado en la tarjeta */
	name: string;
	/** Número de socio */
	memberNumber: string;
	/** Tier de membresía. Clave abierta, selecciona textura base del tema */
	tier: string;
}

export interface BadgePhysicalMaterialOptions {
	clearcoat: number;
	clearcoatRoughness: number;
	roughness: number;
	metalness: number;
	iridescence: number;
	iridescenceIOR: number;
}

export interface Products3dBadgeTheme {
	/** Textura de la correa (lanyard). RepeatWrapping aplicado por la lib */
	bandTextureUrl: string;
	/** Textura base de la tarjeta por tier. Key = BadgeMemberData.tier */
	baseTextures: Record<string, string>;
	/** Fallback obligatorio si el tier no existe en baseTextures */
	defaultBaseTextureUrl: string;
	/** Typeface JSON (three) para Text3D */
	fontUrl: string;
	/**
	 * Color base global del modelo. Default `BADGE_BASE_COLOR` (`badge.config.ts`, negro).
	 *
	 * Reparto (spec-03-F4v2 R2), porque no llega igual a todas las piezas:
	 * - **Frente de la tarjeta**: pinta el quad de fondo opaco de la escena de la RenderTexture,
	 *   detrás del arte del tier. Las zonas transparentes del asset lo revelan. NO es el `color`
	 *   del material de la tarjeta: three multiplica `map × color` y el `map` es la RenderTexture,
	 *   así que un color oscuro ahí pintaría el frente entero de negro.
	 * - **clip/clamp**: tinte del material `metal` del GLB, con `colors.clip` como override
	 *   específico que gana a este global (`colors.clip ?? baseColor`).
	 * - **Canto y dorso de la tarjeta**: fuera de alcance. Comparten material y `map` con el
	 *   frente, así que muestran lo que caiga en sus UV; este color no los controla.
	 */
	baseColor?: string;
	colors?: {
		band?: string;
		text?: string;
		/** Tinte del metal de clip/clamp. Override específico: gana a `baseColor` */
		clip?: string;
	};
	material?: Partial<BadgePhysicalMaterialOptions>;
}

export interface Products3dConfig {
	/**
	 * GLB de la tarjeta. Geometría única para todos los temas.
	 * Contrato de nodos: `card`, `clip`, `clamp` (ver spec-03)
	 */
	cardModelUrl: string;
}

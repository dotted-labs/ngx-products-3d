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
	colors?: {
		band?: string;
		text?: string;
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

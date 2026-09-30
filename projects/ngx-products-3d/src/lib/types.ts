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
	/** Fuente de los textos: typeface JSON de three, `.otf` o `.ttf` (detección por extensión) */
	fontUrl: string;
	/**
	 * Color base global del modelo. Default `BADGE_BASE_COLOR` (`badge.config.ts`, `'#111111'`).
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

/**
 * Cámara del badge (input `camera` de `Products3dBadge` y `Products3dBadgeScene`). Los dos campos son
 * opcionales: el que falte toma el valor de `BADGE_CAMERA_DEFAULTS` (`fov` 25, `distance` 13). La
 * cámara sigue centrada (x = 0, y = 0) mirando al badge; solo se elige cuánto abre y a qué distancia
 * está, así que el badge sigue centrado en el contenedor.
 *
 * Validación (nunca lanza): una `distance` no finita o ≤ 0, o un `fov` fuera de [1, 120)
 * (`BADGE_CAMERA_LIMITS.minFov` / `maxFov`), cae a su default con un aviso dev. Si la combinación dejaría ver el anclaje superior de la correa,
 * `distance` se acorta al máximo que lo mantiene fuera del viewport (también con aviso dev).
 */
export interface Products3dBadgeCamera {
	/**
	 * Campo de visión VERTICAL, en grados, en [1, 120). Menor = tarjeta más grande en pantalla, pero
	 * también correa más estrecha respecto a la tarjeta (su ancho en mundo es proporcional a
	 * `tan(fov/2)`); para agrandar sin ese efecto, reduce `distance`.
	 */
	fov?: number;
	/**
	 * Distancia de la cámara al plano del badge (z = 0), en unidades de mundo (> 0). Menor = tarjeta
	 * más grande en pantalla. Se llama distancia y no `z` a propósito: la cámara no se mueve en X/Y y
	 * el valor siempre es positivo (una `z` negativa pondría la cámara detrás del badge).
	 */
	distance?: number;
}

export interface Products3dConfig {
	/**
	 * GLB de la tarjeta. Geometría única para todos los temas.
	 * Contrato de nodos: `card`, `clip`, `clamp` (ver spec-03)
	 */
	cardModelUrl: string;
}

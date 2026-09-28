import type { ResourceStatus } from '@angular/core';
import type { BufferGeometry } from 'three';
import { BADGE_LAYOUT, badgeDropLayout, type BadgeLayout } from './badge.config';

/**
 * Gate de arranque del badge (hotfix badge-loading-drop): lógica pura, sin Angular ni WebGL. La
 * escena la consulta para decidir cuándo soltar la física y enseñar el badge.
 */

/**
 * Un recurso async ha TERMINADO para el gate: resuelto o en error. El error cuenta igual que el
 * éxito a propósito: con un recurso roto el badge se suelta con su fallback de siempre (color plano,
 * sin tarjeta, sin textos) en vez de quedarse esperando. `local` es un valor fijado a mano (también
 * terminado); `idle`, `loading` y `reloading` siguen pendientes.
 */
export function isResourceSettled(status: ResourceStatus): boolean {
	return status === 'resolved' || status === 'error' || status === 'local';
}

/** Estado de los recursos que espera la escena antes de soltar el badge */
export interface BadgeLoadState {
	/** GLB de la tarjeta (`config.cardModelUrl`) */
	gltf: ResourceStatus;
	/** Textura de la correa (`theme.bandTextureUrl`) */
	bandTexture: ResourceStatus;
	/** El frente de la tarjeta (textura base del tier + fuente) ha terminado, ver `frontSettled` */
	frontReady: boolean;
}

/**
 * Todos los recursos de la escena han terminado (resueltos o en error). El frente solo existe si el
 * GLB resuelve (vive dentro de la tarjeta): con el GLB en error no hay frente que esperar.
 */
export function badgeLoadSettled(state: BadgeLoadState): boolean {
	return (
		isResourceSettled(state.gltf) &&
		isResourceSettled(state.bandTexture) &&
		(state.gltf === 'error' || state.frontReady)
	);
}

/** Recursos aún pendientes, con el nombre del campo que los configura (para el aviso del timeout) */
export function pendingBadgeLoads(state: BadgeLoadState): string[] {
	const pending: string[] = [];
	if (!isResourceSettled(state.gltf)) {
		pending.push('config.cardModelUrl');
	}
	if (!isResourceSettled(state.bandTexture)) {
		pending.push('theme.bandTextureUrl');
	}
	if (state.gltf !== 'error' && !state.frontReady) {
		pending.push('frente de la tarjeta (theme.baseTextures / theme.fontUrl)');
	}
	return pending;
}

/** Estado de carga del frente de la tarjeta (`Products3dBadgeTexture`) */
export interface BadgeFrontLoadState {
	/** Textura base del tier */
	baseTexture: ResourceStatus;
	/** La fuente no se pudo cargar: el frente queda sin textos, no hay nada más que esperar */
	fontFailed: boolean;
	/** Las geometrías de todos los textos del frente ya están construidas */
	textsBuilt: boolean;
}

/**
 * El frente ha terminado: textura base resuelta o en error, y fuente en error o con TODOS los textos
 * ya construidos. Se mira la geometría y no la fuente porque el typeface JSON lo carga `NgtsText3D`
 * por dentro, con un recurso privado; que los textos existan es la única señal común a los dos
 * caminos (JSON y `.otf`/`.ttf`).
 */
export function frontSettled(state: BadgeFrontLoadState): boolean {
	return isResourceSettled(state.baseTexture) && (state.fontFailed || state.textsBuilt);
}

/**
 * Hay tantos meshes de texto como se esperan y todos tienen ya su geometría construida. El mesh de
 * `NgtsText3D` nace con la `BufferGeometry` vacía por defecto de three (sin atributos) y recibe la
 * `TextGeometry` cuando su fuente resuelve; esa sí trae `position` siempre, incluso con texto vacío.
 */
export function textMeshesBuilt(
	meshes: readonly { geometry?: BufferGeometry }[],
	expected: number,
): boolean {
	return (
		meshes.length === expected &&
		meshes.every((mesh) => mesh.geometry?.getAttribute('position') !== undefined)
	);
}

/**
 * Fases del arranque: `loading` (recursos en vuelo) → `compiling` (todo terminado, precompilando
 * shaders) → `released` (física suelta y badge visible).
 */
export type BadgeLoadPhase = 'loading' | 'compiling' | 'released';

/** Lo que hace avanzar el arranque */
export type BadgeLoadEvent = 'settled' | 'compiled' | 'timeout';

/**
 * Transición del arranque. `released` es absorbente: una vez suelto, el badge NUNCA vuelve a
 * esconderse ni a congelarse (cambios de theme/member posteriores se aplican en sitio). El timeout
 * suelta desde cualquier fase previa; un `compiled` que llega sin haber pedido la compilación no
 * cuenta.
 */
export function nextLoadPhase(phase: BadgeLoadPhase, event: BadgeLoadEvent): BadgeLoadPhase {
	if (phase === 'released' || event === 'timeout') {
		return 'released';
	}
	if (phase === 'loading' && event === 'settled') {
		return 'compiling';
	}
	if (phase === 'compiling' && event === 'compiled') {
		return 'released';
	}
	return phase;
}

/** Lo mínimo de `Window` que necesita `prefersReducedMotion` */
export interface MatchMediaSource {
	matchMedia?: (query: string) => { matches: boolean };
}

/**
 * El sistema pide reducir el movimiento. Guard SSR / entornos sin `matchMedia` (jsdom, server):
 * sin ventana o sin `matchMedia` ⇒ `false`, y el badge usa la caída normal.
 */
export function prefersReducedMotion(
	view: MatchMediaSource | null | undefined,
	query: string,
): boolean {
	return typeof view?.matchMedia === 'function' && view.matchMedia(query).matches;
}

/**
 * Pose de salida de los cuerpos: la de reposo (`BADGE_LAYOUT`) si se pide movimiento reducido —
 * aparece ya colgando, sin caída— y si no la de la caída (`badgeDropLayout()`, fuera del viewport por
 * arriba).
 */
export function badgeStartLayout(reducedMotion: boolean): BadgeLayout {
	return reducedMotion ? BADGE_LAYOUT : badgeDropLayout();
}

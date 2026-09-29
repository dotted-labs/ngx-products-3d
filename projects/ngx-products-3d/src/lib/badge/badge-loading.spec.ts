import type { ResourceStatus } from '@angular/core';
import { BufferGeometry, Float32BufferAttribute, Mesh } from 'three';
import {
	badgeLoadSettled,
	badgeStartLayout,
	frontSettled,
	isResourceSettled,
	nextLoadPhase,
	pendingBadgeLoads,
	prefersReducedMotion,
	textMeshesBuilt,
	type BadgeLoadEvent,
	type BadgeLoadPhase,
	type BadgeLoadState,
} from './badge-loading';
import { BADGE_LAYOUT, BADGE_LOADING, badgeDropLayout } from './badge.config';

/** Estado con TODO terminado con éxito; cada test rompe una sola pieza. */
const ALL_LOADED: BadgeLoadState = { gltf: 'resolved', bandTexture: 'resolved', frontReady: true };

describe('isResourceSettled', () => {
	it.each<ResourceStatus>(['resolved', 'error', 'local'])('counts %s as finished', (status) => {
		expect(isResourceSettled(status)).toBe(true);
	});

	it.each<ResourceStatus>(['idle', 'loading', 'reloading'])(
		'counts %s as still pending',
		(status) => {
			expect(isResourceSettled(status)).toBe(false);
		},
	);
});

describe('badgeLoadSettled (everything finished, resolved or error alike)', () => {
	it('is settled when the GLB, the band texture and the front have all loaded', () => {
		expect(badgeLoadSettled(ALL_LOADED)).toBe(true);
	});

	it.each<[string, Partial<BadgeLoadState>]>([
		['the GLB', { gltf: 'loading' }],
		['the band texture', { bandTexture: 'loading' }],
		['the band texture (reloading)', { bandTexture: 'reloading' }],
		['the card front', { frontReady: false }],
	])('waits while %s is missing', (_name, missing) => {
		expect(badgeLoadSettled({ ...ALL_LOADED, ...missing })).toBe(false);
	});

	it('counts a band texture in error as finished (flat colour fallback)', () => {
		expect(badgeLoadSettled({ ...ALL_LOADED, bandTexture: 'error' })).toBe(true);
	});

	it('does not wait for the front when the GLB failed (no card, hence no front to load)', () => {
		expect(badgeLoadSettled({ gltf: 'error', bandTexture: 'error', frontReady: false })).toBe(true);
	});

	it('does wait for the front when the GLB resolved (the front lives on the card)', () => {
		expect(badgeLoadSettled({ ...ALL_LOADED, frontReady: false })).toBe(false);
		expect(badgeLoadSettled({ ...ALL_LOADED, gltf: 'resolved', frontReady: true })).toBe(true);
	});
});

describe('pendingBadgeLoads (what the timeout warning reports)', () => {
	it('names every pending resource by the field that configures it', () => {
		expect(
			pendingBadgeLoads({ gltf: 'loading', bandTexture: 'loading', frontReady: false }),
		).toEqual([
			'config.cardModelUrl',
			'theme.bandTextureUrl',
			'frente de la tarjeta (theme.baseTextures / theme.fontUrl)',
		]);
	});

	it('reports nothing once everything settled, and never the front of a failed GLB', () => {
		expect(pendingBadgeLoads(ALL_LOADED)).toEqual([]);
		expect(
			pendingBadgeLoads({ gltf: 'error', bandTexture: 'resolved', frontReady: false }),
		).toEqual([]);
	});
});

describe('frontSettled (base texture + font of the card front)', () => {
	it('is settled with the base texture resolved and every text built', () => {
		expect(frontSettled({ baseTexture: 'resolved', fontFailed: false, textsBuilt: true })).toBe(
			true,
		);
	});

	it('waits for the base texture even if the texts are already there', () => {
		expect(frontSettled({ baseTexture: 'loading', fontFailed: false, textsBuilt: true })).toBe(
			false,
		);
	});

	it('waits for the texts while the font is still loading', () => {
		expect(frontSettled({ baseTexture: 'resolved', fontFailed: false, textsBuilt: false })).toBe(
			false,
		);
	});

	it('counts a broken base texture and a broken font as finished (front without art nor text)', () => {
		expect(frontSettled({ baseTexture: 'error', fontFailed: true, textsBuilt: false })).toBe(true);
	});
});

describe('textMeshesBuilt', () => {
	/** Mesh con una geometría ya construida (como la TextGeometry de NgtsText3D: trae `position`). */
	function builtMesh(): Mesh {
		const geometry = new BufferGeometry();
		geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
		return new Mesh(geometry);
	}

	it('is false while a mesh still has the empty default geometry of three', () => {
		// Así nace el mesh de NgtsText3D antes de que su fuente resuelva.
		expect(textMeshesBuilt([builtMesh(), new Mesh(), builtMesh()], 3)).toBe(false);
	});

	it('is true once every expected mesh has its geometry', () => {
		expect(textMeshesBuilt([builtMesh(), builtMesh(), builtMesh()], 3)).toBe(true);
	});

	it('is false while fewer text meshes exist than slots (the @for has not mounted them all)', () => {
		expect(textMeshesBuilt([builtMesh(), builtMesh()], 3)).toBe(false);
		expect(textMeshesBuilt([], 3)).toBe(false);
	});
});

describe('nextLoadPhase (startup gate state machine)', () => {
	it.each<[BadgeLoadPhase, BadgeLoadEvent, BadgeLoadPhase]>([
		['loading', 'settled', 'compiling'],
		['compiling', 'compiled', 'released'],
		['loading', 'timeout', 'released'],
		['compiling', 'timeout', 'released'],
		// Un compiled sin compilación pedida no suelta nada.
		['loading', 'compiled', 'loading'],
		// Repetir el settled no reinicia la compilación.
		['compiling', 'settled', 'compiling'],
	])('%s + %s -> %s', (phase, event, next) => {
		expect(nextLoadPhase(phase, event)).toBe(next);
	});

	it.each<BadgeLoadEvent>(['settled', 'compiled', 'timeout'])(
		'never leaves released (%s): the badge is never hidden or frozen again',
		(event) => {
			expect(nextLoadPhase('released', event)).toBe('released');
		},
	);
});

describe('prefersReducedMotion (SSR-safe)', () => {
	it('is false without a window (server) or without matchMedia (jsdom)', () => {
		expect(prefersReducedMotion(undefined, BADGE_LOADING.reducedMotionQuery)).toBe(false);
		expect(prefersReducedMotion(null, BADGE_LOADING.reducedMotionQuery)).toBe(false);
		expect(prefersReducedMotion({}, BADGE_LOADING.reducedMotionQuery)).toBe(false);
	});

	it('asks matchMedia for the configured query and follows its answer', () => {
		const matchMedia = vi.fn((query: string) => ({ matches: query.includes('reduce') }));

		expect(prefersReducedMotion({ matchMedia }, BADGE_LOADING.reducedMotionQuery)).toBe(true);
		expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
		expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) }, 'q')).toBe(false);
	});
});

describe('badgeStartLayout (reduced motion decision)', () => {
	it('starts from the rest pose, no drop, when reduced motion is requested', () => {
		expect(badgeStartLayout(true)).toBe(BADGE_LAYOUT);
	});

	it('starts from the drop pose above the viewport otherwise', () => {
		expect(badgeStartLayout(false)).toEqual(badgeDropLayout());
		expect(badgeStartLayout(false).cardPosition[1]).toBeGreaterThan(BADGE_LAYOUT.fixedPosition[1]);
	});
});

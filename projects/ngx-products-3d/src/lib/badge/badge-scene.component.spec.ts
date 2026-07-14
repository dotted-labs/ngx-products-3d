// La escena importa ahora angular-three-soba/staging (NgtsRenderTexture) vía el propio componente
// y Products3dBadgeTexture, y staging arrastra módulos (lottie de three, troika, gainmap) que en
// tiempo de carga crean un <canvas> y piden getContext('2d'); jsdom devuelve null → la suite entera
// falla al IMPORTAR (0 tests). Mismo stub inerte de contexto 2D que badge.component.spec.ts
// (patrón ya aceptado en review; vi.hoisted corre antes que los imports estáticos). Solo test env.
vi.hoisted(() => {
	const canvasProto = globalThis.HTMLCanvasElement?.prototype;
	if (!canvasProto) {
		return;
	}
	const originalGetContext = canvasProto.getContext;
	canvasProto.getContext = function (
		this: HTMLCanvasElement,
		contextId: string,
		...args: unknown[]
	): unknown {
		if (contextId !== '2d') {
			return originalGetContext.apply(this, [contextId, ...args] as never);
		}
		const backing: Record<string, unknown> = {};
		const imageData = (width = 1, height = 1) => ({
			data: new Uint8ClampedArray(Math.max(1, width * height * 4)),
			width,
			height,
		});
		return new Proxy(backing, {
			get: (target, prop) => {
				if (prop in target) {
					return target[prop as string];
				}
				switch (prop) {
					case 'canvas':
						return this;
					case 'measureText':
						return () => ({ width: 0 });
					case 'getImageData':
						return (_x: number, _y: number, w = 1, h = 1) => imageData(w, h);
					case 'createImageData':
						return (w = 1, h = 1) => imageData(w, h);
					default:
						// Cualquier otro método del contexto 2D (fillRect, fillText, drawImage, save…) → noop.
						return () => undefined;
				}
			},
			set: (target, prop, value) => {
				target[prop as string] = value;
				return true;
			},
		});
	} as typeof canvasProto.getContext;
});

import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { NGT_STORE, type NgtSize } from 'angular-three';
import {
	NgtrPhysics,
	type NgtrRigidBodyOptions,
	type NgtrRopeJointParams,
	type NgtrSphericalJointParams,
} from 'angular-three-rapier';
import { Vector2 } from 'three';
import { PRODUCTS_3D_CONFIG } from '../tokens';
import type {
	BadgeMemberData,
	BadgePhysicalMaterialOptions,
	Products3dBadgeTheme,
	Products3dConfig,
} from '../types';
import { Products3dBadgeScene } from './badge-scene.component';
import {
	BADGE_BAND,
	BADGE_LAYOUT,
	BADGE_MAP_ANISOTROPY,
	BADGE_MATERIAL_DEFAULTS,
	BADGE_PHYSICS,
	BADGE_TEXTURE,
} from './badge.config';

// Neutraliza el loader de soba: en jsdom sin WebGL no se debe cargar el GLB. Se captura la
// URL que el componente deriva del config (vía la fn de entrada) para verificar que NO está
// hardcodeada. `value()` = undefined simula "recurso sin resolver" (el @if del template lo
// gatea). `vi.hoisted` expone el registro dentro de la factory izada de `vi.mock`.
const gltfMock = vi.hoisted(() => ({ urls: [] as string[] }));
// La correa lee su textura vía textureResource. Se CAPTURA la fn de entrada (no se invoca en
// construcción: `theme` es un input y aún no tiene valor → NG0950 si se lee eager, a diferencia
// del gltf que deriva la URL de un inject disponible ya). Los tests la invocan tras setInput.
const textureMock = vi.hoisted(() => ({ inputs: [] as (() => string)[] }));
// El componente lee los recursos vía el API NO-lanzante (hasValue()/status() + value()) para no
// romper el render si una URL falla. El mock expone las tres: hasValue()=false + status()='loading'
// simulan "recurso sin resolver" (value()=undefined) → gltfData()/bandMap() dan undefined (sin
// montar render ni flash de map roto en jsdom sin WebGL), y los effects de warn dev no disparan.
vi.mock('angular-three-soba/loaders', () => ({
	gltfResource: (input: () => string) => {
		gltfMock.urls.push(input());
		return { value: () => undefined, scene: () => null, hasValue: () => false, status: () => 'loading' };
	},
	textureResource: (input: () => string) => {
		textureMock.inputs.push(input);
		return { value: () => undefined, hasValue: () => false, status: () => 'loading' };
	},
}));

interface SceneInternals {
	cardBodyType: () => string;
	dragged: () => boolean;
	layout: typeof BADGE_LAYOUT;
	band: typeof BADGE_BAND;
	cardAnchor: typeof BADGE_PHYSICS.cardJointAnchor;
	gltf: { value: () => unknown };
	bandTexture: { value: () => unknown };
	gltfData: () => unknown;
	bandMap: () => unknown;
	materialOpts: () => BadgePhysicalMaterialOptions;
	renderTextureOptions: { width: number; height: number; frames: number; anisotropy: number };
	bandColor: () => string;
	resolution: () => Vector2;
	bodyOptions: Partial<NgtrRigidBodyOptions>;
	segmentColliderArgs: [number];
	cardColliderArgs: [number, number, number];
	segmentJointData: NgtrRopeJointParams;
	cardJointData: NgtrSphericalJointParams;
}

const MEMBER: BadgeMemberData = {
	name: 'Ada Lovelace',
	memberNumber: '0042',
	tier: 'gold',
};

const THEME: Products3dBadgeTheme = {
	bandTextureUrl: 'assets/band.png',
	baseTextures: { gold: 'assets/gold.png' },
	defaultBaseTextureUrl: 'assets/default.png',
	fontUrl: 'assets/font.json',
};

const CONFIG: Products3dConfig = {
	cardModelUrl: '/assets/card.glb',
};

// Mock mínimo de NgtrPhysics para los hooks de joints (ropeJoint/sphericalJoint):
// con worldSingleton/rapier a null los joints quedan en espera y nunca tocan Rapier.
// La escena real (bodies, colliders, joints activos) se verifica en playground (Nivel 3):
// montar el template ngt-* en jsdom sin WebGL no es viable ni deseable (verification.md).
const PHYSICS_MOCK = {
	worldSingleton: () => null,
	rapier: () => null,
};

// Mock del store de angular-three (NGT_STORE): expone `size` como signal (alimenta la
// `resolution` reactiva de la MeshLineMaterial) y `snapshot.internal.subscribe` (usado por
// `beforeRender`, que aquí devuelve un unsubscribe no-op y nunca invoca el callback de frame).
const sizeSignal = signal<NgtSize>({ width: 800, height: 600, top: 0, left: 0 });
const STORE_MOCK = {
	size: sizeSignal,
	snapshot: { internal: { subscribe: () => () => undefined } },
};

function createScene(): ComponentFixture<Products3dBadgeScene> {
	TestBed.configureTestingModule({
		providers: [
			{ provide: NgtrPhysics, useValue: PHYSICS_MOCK },
			{ provide: NGT_STORE, useValue: STORE_MOCK },
			{ provide: PRODUCTS_3D_CONFIG, useValue: CONFIG },
		],
	});
	// Template vacío: se testea la derivación de estado desde badge.config,
	// no el render 3D (requiere canvas + WebGL reales).
	TestBed.overrideComponent(Products3dBadgeScene, { set: { template: '' } });
	const fixture = TestBed.createComponent(Products3dBadgeScene);
	fixture.componentRef.setInput('member', MEMBER);
	fixture.componentRef.setInput('theme', THEME);
	return fixture;
}

function internalsOf(fixture: ComponentFixture<Products3dBadgeScene>): SceneInternals {
	// Campos protected/private (solo template/joints); narrow tipado para test
	return fixture.componentInstance as unknown as SceneInternals;
}

describe('Products3dBadgeScene', () => {
	it("defaults cardBodyType to 'dynamic' (kinematicPosition switch belongs to the drag feature)", () => {
		const fixture = createScene();

		expect(internalsOf(fixture).cardBodyType()).toBe('dynamic');
	});

	it('starts with dragging disabled (no card grabbed until pointerdown)', () => {
		const fixture = createScene();

		expect(internalsOf(fixture).dragged()).toBe(false);
	});

	it('derives rigid body options from BADGE_PHYSICS with auto-colliders disabled', () => {
		const fixture = createScene();

		expect(internalsOf(fixture).bodyOptions).toEqual({
			colliders: false,
			angularDamping: BADGE_PHYSICS.angularDamping,
			linearDamping: BADGE_PHYSICS.linearDamping,
		});
	});

	it('builds rope joint data from BADGE_PHYSICS: local anchors and segmentLength', () => {
		const fixture = createScene();
		const jointData = internalsOf(fixture).segmentJointData;

		expect(jointData.body1Anchor).toBe(BADGE_PHYSICS.segmentJointAnchor);
		expect(jointData.body2Anchor).toBe(BADGE_PHYSICS.segmentJointAnchor);
		expect(jointData.length).toBe(BADGE_PHYSICS.segmentLength);
	});

	it('anchors the spherical joint at the card top edge (BADGE_PHYSICS.cardJointAnchor)', () => {
		const fixture = createScene();
		const jointData = internalsOf(fixture).cardJointData;

		expect(jointData.body1Anchor).toBe(BADGE_PHYSICS.segmentJointAnchor);
		expect(jointData.body2Anchor).toBe(BADGE_PHYSICS.cardJointAnchor);
	});

	it('derives collider args from BADGE_PHYSICS: ball radius and cuboid half-extents', () => {
		const fixture = createScene();
		const internals = internalsOf(fixture);

		expect(internals.segmentColliderArgs).toEqual([BADGE_PHYSICS.segmentColliderRadius]);
		expect(internals.cardColliderArgs).toBe(BADGE_PHYSICS.cardColliderHalfExtents);
	});

	it('takes body positions from badge.config', () => {
		const fixture = createScene();

		expect(internalsOf(fixture).layout).toBe(BADGE_LAYOUT);
	});

	it('positions the GLB visual group at the clip anchor (BADGE_PHYSICS.cardJointAnchor)', () => {
		const fixture = createScene();

		// El grupo del GLB se sitúa en cardJointAnchor: alinea el centro de la tarjeta con el
		// cuboid collider y el clip con el punto del spherical joint (sin offsets mágicos).
		expect(internalsOf(fixture).cardAnchor).toBe(BADGE_PHYSICS.cardJointAnchor);
		expect(internalsOf(fixture).cardAnchor).toBe(internalsOf(fixture).cardJointData.body2Anchor);
	});

	it('loads the card GLB from PRODUCTS_3D_CONFIG.cardModelUrl (no hardcoded URL)', () => {
		gltfMock.urls.length = 0;
		const fixture = createScene();

		// La URL que el componente pasa a gltfResource se deriva del token de config.
		expect(gltfMock.urls).toContain(CONFIG.cardModelUrl);
		// Recurso sin resolver → value() undefined: el template gatea el render con @if (sin flash).
		expect(internalsOf(fixture).gltf.value()).toBeUndefined();
	});

	it('exposes gltfData() undefined via the non-throwing safe accessor while the GLB is unresolved', () => {
		const fixture = createScene();

		// gltfData() gatea con hasValue() antes de value() → nunca lanza; recurso sin resolver = undefined.
		// El @if del template usa este computed: una URL de modelo rota degrada a "sin tarjeta", no blanquea.
		expect(internalsOf(fixture).gltfData()).toBeUndefined();
	});

	it('exposes bandMap() undefined via the non-throwing safe accessor while the texture is unresolved', () => {
		const fixture = createScene();

		// bandMap() gatea con hasValue() antes de value() → nunca lanza (evita ResourceValueError en CD);
		// recurso sin resolver = undefined → useMap=0, la correa se pinta con color plano.
		expect(internalsOf(fixture).bandMap()).toBeUndefined();
	});

	it('derives the card physical material from BADGE_MATERIAL_DEFAULTS when theme.material is absent', () => {
		const fixture = createScene();

		// THEME no define `material` → materialOpts() debe igualar los defaults del proyecto.
		expect(internalsOf(fixture).materialOpts()).toEqual({
			clearcoat: BADGE_MATERIAL_DEFAULTS.clearcoat,
			clearcoatRoughness: BADGE_MATERIAL_DEFAULTS.clearcoatRoughness,
			roughness: BADGE_MATERIAL_DEFAULTS.roughness,
			metalness: BADGE_MATERIAL_DEFAULTS.metalness,
			iridescence: BADGE_MATERIAL_DEFAULTS.iridescence,
			iridescenceIOR: BADGE_MATERIAL_DEFAULTS.iridescenceIOR,
		});
	});

	it('applies theme.material as a partial override on top of the material defaults', () => {
		const fixture = createScene();
		fixture.componentRef.setInput('theme', { ...THEME, material: { roughness: 0.9 } });

		const opts = internalsOf(fixture).materialOpts();

		expect(opts.roughness).toBe(0.9);
		expect(opts.clearcoat).toBe(BADGE_MATERIAL_DEFAULTS.clearcoat);
		expect(opts.metalness).toBe(BADGE_MATERIAL_DEFAULTS.metalness);
	});

	it('derives the render texture options from BADGE_TEXTURE and BADGE_MAP_ANISOTROPY', () => {
		const fixture = createScene();

		// Config-driven, cero números mágicos: width/height = size del FBO; frames continuo
		// (porqué documentado en BADGE_TEXTURE.frames); anisotropy va en las options porque
		// es propiedad de la textura (fbo.texture), no del material.
		expect(internalsOf(fixture).renderTextureOptions).toEqual({
			width: BADGE_TEXTURE.size,
			height: BADGE_TEXTURE.size,
			frames: BADGE_TEXTURE.frames,
			anisotropy: BADGE_MAP_ANISOTROPY,
		});
	});

	it('exposes the lanyard band material config from BADGE_BAND (no magic numbers)', () => {
		const fixture = createScene();

		expect(internalsOf(fixture).band).toBe(BADGE_BAND);
	});

	it('drives the band texture repeat from BADGE_BAND.repeat ([-4, 1], no magic numbers)', () => {
		const fixture = createScene();

		// El template bindea [repeat]="band.repeat"; la tupla vive en config, no en el componente.
		expect(internalsOf(fixture).band.repeat).toEqual([-4, 1]);
	});

	it('loads the band texture from theme.bandTextureUrl (no hardcoded URL)', () => {
		textureMock.inputs.length = 0;
		const fixture = createScene();

		// La fn de entrada de textureResource deriva la URL del tema (inputs ya aplicados), no
		// hardcodeada. Recurso sin resolver → value() undefined: el template gatea useMap con
		// `value() ? 1 : 0` (sin flash de correa con map roto en el primer frame).
		const urls = textureMock.inputs.map((fn) => fn());
		expect(urls).toContain(THEME.bandTextureUrl);
		expect(internalsOf(fixture).bandTexture.value()).toBeUndefined();
	});

	it('falls back to BADGE_BAND.color when theme.colors.band is absent', () => {
		const fixture = createScene();

		// THEME no define colors → bandColor() cae al default de config ('white').
		expect(internalsOf(fixture).bandColor()).toBe(BADGE_BAND.color);
		expect(internalsOf(fixture).bandColor()).toBe('white');
	});

	it('uses theme.colors.band as the band color when present', () => {
		const fixture = createScene();
		fixture.componentRef.setInput('theme', { ...THEME, colors: { band: '#ff0055' } });

		expect(internalsOf(fixture).bandColor()).toBe('#ff0055');
	});

	it('derives band resolution as a Vector2 mirroring the viewport size', () => {
		sizeSignal.set({ width: 800, height: 600, top: 0, left: 0 });
		const fixture = createScene();

		const resolution = internalsOf(fixture).resolution();

		expect(resolution).toBeInstanceOf(Vector2);
		expect(resolution.x).toBe(800);
		expect(resolution.y).toBe(600);
	});

	it('reacts to viewport resize reusing the same Vector2 instance', () => {
		sizeSignal.set({ width: 800, height: 600, top: 0, left: 0 });
		const fixture = createScene();
		const internals = internalsOf(fixture);
		const first = internals.resolution();

		sizeSignal.set({ width: 1280, height: 720, top: 0, left: 0 });
		const second = internals.resolution();

		expect(second).toBe(first);
		expect(second.x).toBe(1280);
		expect(second.y).toBe(720);
	});
});

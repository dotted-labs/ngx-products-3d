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
import { Mesh, MeshStandardMaterial, Vector2 } from 'three';
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
	BADGE_BASE_COLOR,
	BADGE_CAMERA,
	BADGE_CARD_MODEL,
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
// `data` permite a los tests del tinte del metal simular el GLB YA resuelto (nodos clip/clamp +
// material 'metal' reales de three, que no necesitan WebGL para clonarse ni teñirse). Por defecto
// `undefined` = recurso sin resolver; se resetea en el beforeEach para no filtrarse entre tests.
const gltfMock = vi.hoisted(() => ({ urls: [] as string[], data: undefined as unknown }));
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
		return {
			value: () => gltfMock.data,
			scene: () => null,
			hasValue: () => gltfMock.data !== undefined,
			status: () => (gltfMock.data === undefined ? 'loading' : 'resolved'),
		};
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
	cardModelPosition: typeof BADGE_CARD_MODEL.groupPosition;
	gltf: { value: () => unknown };
	bandTexture: { value: () => unknown };
	gltfData: () => unknown;
	bandMap: () => unknown;
	materialOpts: () => BadgePhysicalMaterialOptions;
	renderTextureOptions: {
		width: number;
		height: number;
		frames: number;
		anisotropy: number;
		repeat: [number, number];
		offset: [number, number];
	};
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
	bandTextureUrl: 'assets/band.jpg',
	baseTextures: { gold: 'assets/gold.png' },
	defaultBaseTextureUrl: 'assets/default.png',
	fontUrl: 'assets/font.json',
};

const CONFIG: Products3dConfig = {
	cardModelUrl: '/assets/membresia.glb',
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

/** Forma del GLB de la tarjeta que consume la escena (nodos card/clip/clamp + materiales). */
interface TestGltf {
	nodes: { card: Mesh; clip: Mesh; clamp: Mesh };
	materials: { base: MeshStandardMaterial; metal: MeshStandardMaterial };
}

/**
 * GLB ya resuelto para los tests del tinte: clip y clamp COMPARTEN la misma instancia de `metal`,
 * igual que el GLB real. Es justo la instancia que el effect no debe mutar (la cachea el loader
 * entre recargas). Materiales y meshes de three no necesitan WebGL para clonarse ni teñirse.
 */
function makeGltfData(): TestGltf {
	const metal = new MeshStandardMaterial();
	const nodes = { card: new Mesh(), clip: new Mesh(), clamp: new Mesh() };
	nodes.clip.material = metal;
	nodes.clamp.material = metal;
	return { nodes, materials: { base: new MeshStandardMaterial(), metal } };
}

/** Escena con el GLB resuelto y los effects ya ejecutados (detectChanges los descarga). */
function createSceneWithGltf(
	data: TestGltf,
	theme: Products3dBadgeTheme,
): ComponentFixture<Products3dBadgeScene> {
	gltfMock.data = data;
	const fixture = createScene();
	fixture.componentRef.setInput('theme', theme);
	fixture.detectChanges();
	return fixture;
}

/** Material aplicado al nodo clip tras el effect de tinte. */
function clipMaterialOf(data: TestGltf): MeshStandardMaterial {
	return data.nodes.clip.material as MeshStandardMaterial;
}

describe('Products3dBadgeScene', () => {
	beforeEach(() => {
		// Por defecto el GLB queda SIN resolver (los tests del tinte lo sobrescriben): así el
		// estado del mock no se filtra de un test a otro.
		gltfMock.data = undefined;
	});

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

	it('positions the GLB visual group at the rigid body origin (BADGE_CARD_MODEL.groupPosition)', () => {
		const fixture = createScene();

		// El origen del GLB es el centro de la tarjeta = origen del body = centro del cuboid
		// collider → el grupo visual va sin offset (constante propia, sin números mágicos).
		expect(internalsOf(fixture).cardModelPosition).toBe(BADGE_CARD_MODEL.groupPosition);
		expect(BADGE_CARD_MODEL.groupPosition).toEqual([0, 0, 0]);
	});

	it('keeps the visual anchor and the spherical joint anchor as separate values', () => {
		const fixture = createScene();

		// Regresión de la feature 13: ambos conceptos compartían BADGE_PHYSICS.cardJointAnchor,
		// lo que ataba la posición del modelo al punto de agarre de la correa.
		expect(internalsOf(fixture).cardModelPosition).not.toBe(
			internalsOf(fixture).cardJointData.body2Anchor,
		);
		expect(BADGE_CARD_MODEL.groupPosition).not.toEqual(BADGE_PHYSICS.cardJointAnchor);
	});

	it('anchors the spherical joint above the card top edge (clip grab point of the GLB)', () => {
		// Derivado del bounding box del GLB: clipMesh POSITION Y[0.917, 1.286] (top del clip,
		// por donde el aro agarra la correa) y cardMesh Y[-1.125, 1.125] (= half-extent del
		// cuboid). El anchor cae por encima del borde superior de la tarjeta, nunca dentro.
		expect(BADGE_PHYSICS.cardJointAnchor).toEqual([0, 1.286, 0]);
		expect(BADGE_PHYSICS.cardJointAnchor[1]).toBeGreaterThan(
			BADGE_PHYSICS.cardColliderHalfExtents[1],
		);
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

		// Config-driven, cero números mágicos: width/height = resolución del FBO; frames continuo
		// (porqué documentado en BADGE_TEXTURE.frames); anisotropy y la transformada UV van en
		// las options porque son propiedades de la textura (fbo.texture), no del material.
		expect(internalsOf(fixture).renderTextureOptions).toEqual({
			width: BADGE_TEXTURE.width,
			height: BADGE_TEXTURE.height,
			frames: BADGE_TEXTURE.frames,
			anisotropy: BADGE_MAP_ANISOTROPY,
			repeat: BADGE_TEXTURE.mapRepeat,
			offset: BADGE_TEXTURE.mapOffset,
		});
	});

	it('requests a render texture FBO with the aspect ratio of the card front face', () => {
		const fixture = createScene();
		const { width, height } = internalsOf(fixture).renderTextureOptions;

		// El FBO que pide la ESCENA (no solo el de la config) tiene que llevar el ratio de la cara
		// frontal del GLB: un FBO cuadrado sobre una cara 32:45 estira el arte y los textos
		// (spec-03-F4v2, diagnóstico). Ancla independiente: el 32:45 del contrato del modelo.
		expect(width / height).toBeCloseTo(
			BADGE_PHYSICS.cardColliderHalfExtents[0] / BADGE_PHYSICS.cardColliderHalfExtents[1],
			10,
		);
		expect(width).not.toBe(height);
	});

	it('samples the card map with the V inverted and the U untouched', () => {
		const fixture = createScene();
		const { repeat, offset } = internalsOf(fixture).renderTextureOptions;

		// Invariante que corrige el choque de convenciones (ver BADGE_TEXTURE.mapRepeat): los UV
		// del GLB son glTF (v = 0 arriba) y la textura del render target es GL (v = 0 abajo), así
		// que la transformada aplicada debe ser exactamente v' = 1 - v.
		expect(offset[1] + 0 * repeat[1]).toBe(1);
		expect(offset[1] + 1 * repeat[1]).toBe(0);
		// La U se muestrea sin tocar: la cara +Z del GLB no está espejada en horizontal.
		expect(offset[0] + 0 * repeat[0]).toBe(0);
		expect(offset[0] + 1 * repeat[0]).toBe(1);
	});

	it('exposes the lanyard band material config from BADGE_BAND (no magic numbers)', () => {
		const fixture = createScene();

		expect(internalsOf(fixture).band).toBe(BADGE_BAND);
	});

	it('drives the band texture repeat from BADGE_BAND.repeat (no magic numbers)', () => {
		const fixture = createScene();

		// El template bindea [repeat]="band.repeat"; la tupla vive en config, no en el componente.
		expect(internalsOf(fixture).band.repeat).toBe(BADGE_BAND.repeat);
	});

	it('tiles the band texture preserving the aspect ratio of a 4:1 lanyard artwork', () => {
		// Invariante geométrica entre constantes independientes (derivación completa en
		// BADGE_BAND.repeat): con sizeAttenuation (default de meshline) el ancho de la correa en
		// unidades de mundo es lineWidth * tan(fov/2), NO lineWidth; el largo son los 3 rope
		// joints de la cadena. Una tesela debe medir `aspecto` veces el ancho para no estirarse.
		const bandWidth = BADGE_BAND.lineWidth * Math.tan((BADGE_CAMERA.fov * Math.PI) / 360);
		const bandLength = 3 * BADGE_PHYSICS.segmentLength;
		const textureAspect = 1024 / 256; // band.jpg del playground
		const tiles = bandLength / (textureAspect * bandWidth);

		expect(Math.abs(BADGE_BAND.repeat[0])).toBeCloseTo(tiles, 2);
		// Signo negativo = U invertida (orientación del arte); la V no se tesela a lo ancho.
		expect(BADGE_BAND.repeat[0]).toBeLessThan(0);
		expect(BADGE_BAND.repeat[1]).toBe(1);
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

	describe('metal tint (clip/clamp)', () => {
		it('tints clip and clamp with theme.colors.clip on a single shared clone', () => {
			const data = makeGltfData();

			createSceneWithGltf(data, { ...THEME, colors: { clip: '#ff0055' } });

			// Un solo clon para los dos nodos: el GLB los servía con la MISMA instancia de metal.
			expect(data.nodes.clip.material).toBe(data.nodes.clamp.material);
			expect(clipMaterialOf(data).color.getHexString()).toBe('ff0055');
		});

		it('clones the GLB metal material instead of mutating it', () => {
			const data = makeGltfData();
			const original = data.materials.metal;

			createSceneWithGltf(data, { ...THEME, colors: { clip: '#ff0055' } });

			// El GLB cachea `metal` entre recargas y lo comparte: teñirlo in situ filtraría el
			// color a otros usos y persistiría tras cambiar de tema.
			expect(data.nodes.clip.material).not.toBe(original);
			expect(original.color.getHexString()).toBe('ffffff');
		});

		it('falls back to theme.baseColor when theme.colors.clip is absent', () => {
			const data = makeGltfData();

			createSceneWithGltf(data, { ...THEME, baseColor: '#123456' });

			expect(clipMaterialOf(data).color.getHexString()).toBe('123456');
		});

		it('falls back to BADGE_BASE_COLOR when neither colors.clip nor baseColor are set', () => {
			const data = makeGltfData();

			createSceneWithGltf(data, THEME);

			// Con el default negro siempre hay color ⇒ el metal SIEMPRE se tiñe: la rama
			// "sin color → material original del GLB" ya no existe (spec-03-F4v2 R2).
			expect(clipMaterialOf(data).color.getHexString()).toBe(BADGE_BASE_COLOR.slice(1));
			expect(data.nodes.clip.material).not.toBe(data.materials.metal);
		});

		it('lets theme.colors.clip win over theme.baseColor', () => {
			const data = makeGltfData();

			createSceneWithGltf(data, {
				...THEME,
				baseColor: '#123456',
				colors: { clip: '#ff0055' },
			});

			expect(clipMaterialOf(data).color.getHexString()).toBe('ff0055');
		});

		it('retints on theme.colors.clip changes without recreating the scene, disposing the old clone', () => {
			const data = makeGltfData();
			const fixture = createSceneWithGltf(data, { ...THEME, colors: { clip: '#ff0055' } });
			const instance = fixture.componentInstance;
			const firstClone = clipMaterialOf(data);
			let disposals = 0;
			firstClone.addEventListener('dispose', () => {
				disposals += 1;
			});

			fixture.componentRef.setInput('theme', { ...THEME, colors: { clip: '#00ff00' } });
			fixture.detectChanges();

			expect(fixture.componentInstance).toBe(instance);
			expect(clipMaterialOf(data)).not.toBe(firstClone);
			expect(clipMaterialOf(data).color.getHexString()).toBe('00ff00');
			expect(data.nodes.clamp.material).toBe(data.nodes.clip.material);
			// onCleanup del effect: clonar en cada re-ejecución no acumula materiales en GPU.
			expect(disposals).toBe(1);
		});

		it('retints on theme.baseColor changes without recreating the scene', () => {
			const data = makeGltfData();
			const fixture = createSceneWithGltf(data, { ...THEME, baseColor: '#123456' });
			const instance = fixture.componentInstance;

			fixture.componentRef.setInput('theme', { ...THEME, baseColor: '#abcdef' });
			fixture.detectChanges();

			expect(fixture.componentInstance).toBe(instance);
			expect(clipMaterialOf(data).color.getHexString()).toBe('abcdef');
		});

		it('disposes the tinted clone when the scene is destroyed', () => {
			const data = makeGltfData();
			const fixture = createSceneWithGltf(data, { ...THEME, colors: { clip: '#ff0055' } });
			let disposals = 0;
			clipMaterialOf(data).addEventListener('dispose', () => {
				disposals += 1;
			});

			fixture.destroy();

			expect(disposals).toBe(1);
		});
	});
});

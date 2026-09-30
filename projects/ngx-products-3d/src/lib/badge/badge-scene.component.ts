import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	DestroyRef,
	DOCUMENT,
	effect,
	ElementRef,
	inject,
	input,
	output,
	PLATFORM_ID,
	type ResourceRef,
	signal,
	untracked,
	viewChild,
} from '@angular/core';
import { CatmullRomCurve3, Euler, Quaternion, RepeatWrapping, Vector2, Vector3 } from 'three';
import type { Camera, Material, Mesh, MeshStandardMaterial, Scene, WebGLRenderer } from 'three';
import { beforeRender, extend, injectStore, NgtArgs, type NgtThreeEvent } from 'angular-three';
import {
	NgtrBallCollider,
	NgtrCuboidCollider,
	NgtrPhysics,
	NgtrRigidBody,
	ropeJoint,
	sphericalJoint,
	type NgtrRigidBodyOptions,
	type NgtrRigidBodyType,
	type NgtrRopeJointParams,
	type NgtrSphericalJointParams,
} from 'angular-three-rapier';
import { gltfResource, textureResource } from 'angular-three-soba/loaders';
import { NgtsRenderTexture, type NgtsRenderTextureOptions } from 'angular-three-soba/staging';
import type { RigidBody } from '@dimforge/rapier3d-compat';
import { MeshLineGeometry } from 'meshline';
import { resourceValueOrUndefined } from '../resource-value';
import { PRODUCTS_3D_CONFIG } from '../tokens';
import type { BadgeMemberData, Products3dBadgeCamera, Products3dBadgeTheme } from '../types';
import { localPointToParent, sampleCurveByArcLength } from './badge-band';
import { BadgeBandMaterial } from './badge-band-material';
import { resolveBadgeCamera } from './badge-camera';
import { cursorFor } from './badge-cursor';
import { projectPointerToWorld, subtractInto } from './badge-drag';
import {
	badgeLoadSettled,
	badgeStartLayout,
	nextLoadPhase,
	pendingBadgeLoads,
	prefersReducedMotion,
	type BadgeLoadEvent,
	type BadgeLoadPhase,
	type BadgeLoadState,
} from './badge-loading';
import { mergeMaterialOptions, tintMetalMaterial } from './badge-material';
import { lerpTowards, spinCorrectedAngvelY } from './badge-stabilize';
import { resolveClipColor } from './badge-theme';
import { Products3dBadgeTexture } from './badge-texture.component';
import {
	bandRepeatFor,
	BADGE_BAND,
	BADGE_CARD_MODEL,
	BADGE_DRAG,
	BADGE_LOADING,
	BADGE_LOOP_PRIORITY,
	BADGE_MAP_ANISOTROPY,
	BADGE_MATERIAL_DEFAULTS,
	BADGE_PHYSICS,
	BADGE_TEXTURE,
} from './badge.config';

// Registra los elementos custom de la correa en el catálogo del renderer: <ngt-mesh-line-geometry>
// (meshline) y <ngt-badge-band-material> (MeshLineMaterial con el parche de extremos, ver
// BadgeBandMaterial). Idempotente a nivel de módulo.
extend({ MeshLineGeometry, BadgeBandMaterial });

/**
 * Contrato del GLB de la tarjeta: nodos `card`/`clip`/`clamp` y materiales `base`/`metal`
 * (contrato completo, incluido el origen del modelo, en el README de la lib).
 *
 * Tipo INTERNO (no API pública). No extiende `GLTF` de three-stdlib a propósito: ese tipo
 * NO es nombrable en los `.d.ts` emitidos por la lib (three-stdlib es dep transitiva de soba,
 * sin hoisting al node_modules raíz → `import from 'three-stdlib'` no resuelve y usar el tipo
 * resuelto de `gltfResource` dispara TS2742). Modelamos solo lo que consume el componente y
 * casteamos el `ResourceRef` al asignarlo.
 */
interface BadgeGLTF {
	nodes: { card: Mesh; clip: Mesh; clamp: Mesh };
	materials: { base: Material; metal: MeshStandardMaterial };
}

/**
 * Escena física del badge: cadena fixed→j1→j2→j3 (rope joints) de la que
 * cuelga la tarjeta (spherical joint). La geometría de la tarjeta se carga del GLB de
 * `config.cardModelUrl` (nodos card/clip/clamp) vía `gltfResource`, condicionada a recurso resuelto.
 *
 * Exportado también para consumidores con canvas propio (composición
 * con otros elementos 3D futuros, spec-03 Fase 5). En ese caso el `<ngtr-physics>` que la envuelve
 * debe llevar `updatePriority: BADGE_LOOP_PRIORITY.physicsStep`: la correa lee la pose ya
 * interpolada del frame y el paso físico tiene que ir antes que ella (ver `BADGE_LOOP_PRIORITY`). Si
 * su cámara no es la de por defecto (`BADGE_CAMERA`), pásale `fov` y distancia por el input `camera`:
 * la escena no mueve la cámara del canvas, pero deriva de ella la correa y la pose de salida.
 *
 * Arranque (hotfix badge-loading-drop): mientras cargan el GLB, la textura de la correa y el frente
 * (textura base + fuente), la tarjeta y la correa no se pintan y la cadena está congelada. Con todo
 * terminado (resuelto o en error) se precompilan los shaders y se suelta: la cadena cae desde fuera
 * del viewport por arriba (`badgeDropLayout`), o aparece ya en reposo con
 * `prefers-reduced-motion: reduce`. Al soltar se emite `ready`, una sola vez. Un tope
 * (`BADGE_LOADING.timeoutMs`) suelta con lo que haya. Solo ocurre al arrancar: cambios de
 * `theme`/`member` posteriores se aplican en sitio, sin volver a esconder ni congelar nada.
 */
@Component({
	selector: 'products-3d-badge-scene',
	template: `
		<ngt-object3D
			#fixedBody
			rigidBody="fixed"
			[options]="bodyOptions"
			[position]="layout().fixedPosition"
		/>
		<ngt-object3D
			#j1Body
			rigidBody="dynamic"
			[options]="bodyOptions"
			[position]="layout().j1Position"
		>
			<ngt-object3D [ballCollider]="segmentColliderArgs" />
		</ngt-object3D>
		<ngt-object3D
			#j2Body
			rigidBody="dynamic"
			[options]="bodyOptions"
			[position]="layout().j2Position"
		>
			<ngt-object3D [ballCollider]="segmentColliderArgs" />
		</ngt-object3D>
		<ngt-object3D
			#j3Body
			rigidBody="dynamic"
			[options]="bodyOptions"
			[position]="layout().j3Position"
		>
			<ngt-object3D [ballCollider]="segmentColliderArgs" />
		</ngt-object3D>
		<!--
			Tipo del card ESTÁTICO a propósito (no [rigidBody]="cardBodyType()"): NgtrRigidBody lee el
			input requerido 'type' vía untracked() dentro del computed 'bodyDesc' cuando se resuelve el
			WASM de Rapier; si el property binding aún no se ha escrito → NG0950 y el computed cachea el
			error de forma permanente (el body del card nunca se crea). El atributo estático se aplica en
			la creación de la vista, antes de cualquier effect. El switch dynamic↔kinematicPosition del
			drag (feature 6) va por la API del body crudo: cardBody.setBodyType(..., true).
		-->
		<!--
			[visible]="released()" en la tarjeta y en la correa: nada del badge se pinta hasta soltarlo
			(la caída ya parte fuera del frustum, pero la pose de reposo de reduced-motion no). three
			precompila también lo invisible: compile() recorre la escena con traverse(), no con
			traverseVisible() (este último solo lo usa para las luces).
		-->
		<ngt-object3D
			#cardBody
			rigidBody="dynamic"
			[options]="bodyOptions"
			[position]="layout().cardPosition"
			[visible]="released()"
			(pointerdown)="onPointerDown($event)"
			(pointerup)="onPointerUp($event)"
			(pointerover)="onPointerOver($event)"
			(pointerout)="onPointerOut($event)"
		>
			<ngt-object3D [cuboidCollider]="cardColliderArgs" />
			<!--
				Visual de la tarjeta = geometría del GLB. Se monta SOLO cuando el recurso
				resuelve (@if sobre gltfData(), gateado con hasValue() → NO lanza si el GLB entra en
				error; una URL de modelo rota degrada a "sin tarjeta", no blanquea la escena. Si el
				GLB falla se emite un warn dev, ver gltfErrorEffect) → sin flash de escena a medio
				cargar. El origen del GLB es el CENTRO de la tarjeta (contrato del modelo en el README
				de la lib), que coincide con el origen del rigid body y el centro del cuboid collider
				→ el grupo visual va sin offset (cardModelPosition, BADGE_CARD_MODEL). El anclaje
				físico NO es este: es el top del clip y solo lo consume el spherical joint
				(BADGE_PHYSICS.cardJointAnchor); el extremo VISUAL de la correa es otro punto más, la
				ranura del clamp (BADGE_CARD_MODEL.bandAttachPoint). La tarjeta se renderiza como
				mesh propio con meshPhysicalMaterial (clearcoat) en vez del material 'base' del GLB, y
				preserva position/quaternion/scale del nodo card (identidad en el modelo actual).
				clip/clamp siguen como primitive con su material 'metal' y su transform de nodo; el
				tinte del metal se aplica por código en un effect sobre un CLON del material (ver el
				effect de tinte del constructor), nunca mutando el del GLB.
			-->
			@if (gltfData(); as data) {
				<ngt-group [position]="cardModelPosition">
					<ngt-mesh
						[geometry]="data.nodes.card.geometry"
						[position]="data.nodes.card.position"
						[quaternion]="data.nodes.card.quaternion"
						[scale]="data.nodes.card.scale"
					>
						<!--
							SIN binding [color] a propósito: se queda en el blanco por defecto de three.
							El map de este material es la RenderTexture del frente y el fragment shader
							multiplica map × color, así que enchufar aquí el baseColor del tema (#111111
							por defecto) pintaría el frente entero casi de negro. El baseColor llega al
							frente por dentro de la escena de la RenderTexture, como quad de fondo opaco
							bajo el arte del tier (spec-03-F4v2 R2); en el metal de clip/clamp entra por
							el effect de tinte del constructor.
						-->
						<ngt-mesh-physical-material
							[clearcoat]="materialOpts().clearcoat"
							[clearcoatRoughness]="materialOpts().clearcoatRoughness"
							[roughness]="materialOpts().roughness"
							[metalness]="materialOpts().metalness"
							[iridescence]="materialOpts().iridescence"
							[iridescenceIOR]="materialOpts().iridescenceIOR"
						>
							<!--
								Frente dinámico de la tarjeta: NgtsRenderTexture se attachea como map del
								material (attach="map") y renderiza la escena secundaria
								(Products3dBadgeTexture: textura base del tier + textos del socio, con su
								propia cámara ortográfica makeDefault dentro del portal) a un FBO de
								BADGE_TEXTURE.width × height (ratio de la cara frontal, no cuadrado).
								anisotropy va en las options y NO como binding del material: es propiedad de
								la textura (soba la aplica como parameters sobre fbo.texture); el binding
								[mapAnisotropy] de la feature 3 era un no-op (el renderer solo "pierce"
								claves con punto). Reactividad member/theme: el contenido del template lee
								los inputs (signals) de esta escena y, con frames continuo (porqué en
								BADGE_TEXTURE.frames), cada cambio se pinta en el frame siguiente sin
								recrear el canvas.
							-->
							<ngts-render-texture attach="map" [options]="renderTextureOptions">
								<ng-template renderTextureContent>
									<products-3d-badge-texture
										[member]="member()"
										[theme]="theme()"
										(ready)="onFrontReady()"
									/>
								</ng-template>
							</ngts-render-texture>
						</ngt-mesh-physical-material>
					</ngt-mesh>
					<ngt-primitive *args="[data.nodes.clip]" />
					<ngt-primitive *args="[data.nodes.clamp]" />
				</ngt-group>
			}
		</ngt-object3D>
		<!--
			Correa (lanyard): curva Catmull-Rom recalculada por frame en beforeRender (updateBand), con
			la pose RENDERIZADA de los bodies (después del paso de Rapier, BADGE_LOOP_PRIORITY). Su
			extremo inferior es la ranura del clamp (BADGE_CARD_MODEL.bandAttachPoint) llevada a mundo
			con la pose de la tarjeta, no el centro de j3. Se muestrea por longitud de arco (UVs
			estables mientras la cadena se mueve). El material es BadgeBandMaterial, NO el
			MeshLineMaterial tal cual: mismos uniforms y bindings, pero su vertex shader detecta los
			extremos con tolerancia (BADGE_BAND.endCapTolerance). El de meshline 3.3.1 los detecta con
			== exacto entre dos proyecciones que en float32 no coinciden, y el extremo sobre el clamp se
			retorcía en cuña y parpadeaba. Es hermana de los bodies: comparte padre con sus
			Object3D, así que sus posiciones valen tal cual como puntos de la malla. El material se
			texturiza con la banda del tema (bandMap): computed no-lanzante sobre bandTexture (gateado
			con hasValue() → NO lanza si la textura entra en error o 404, a diferencia de value()).
			useMap es un flag numérico 0|1 de meshline (no boolean) y se gatea a bandMap(): mientras es
			undefined (loading o error), useMap=0 y meshline pinta el color plano (sin flash ni crash
			con map roto); al resolver, useMap=1 y el shader muestrea el map. Si la textura falla se
			emite un warn dev, ver bandTextureErrorEffect. repeat es un Vector2 en meshline; el renderer
			v4 acepta la tupla de bandRepeat() y hace repeat.set(...) con ella. El módulo de la X no es
			un número redondo: sale de la derivación de aspecto de bandRepeatFor, evaluada sobre el
			aspecto REAL de la textura ya cargada. transparent deja pasar el alfa del map (el shader ya
			lo multiplica dentro de diffuseColor): sin él, los píxeles a alfa 0 de un PNG con RGB (0,0,0)
			pintarían la correa de negro. RepeatWrapping se aplica en el effect del constructor.
		-->
		<ngt-mesh [visible]="released()">
			<ngt-mesh-line-geometry #bandGeometry />
			<ngt-badge-band-material
				[map]="bandMap()"
				[useMap]="bandMap() ? 1 : 0"
				[repeat]="bandRepeat()"
				[color]="bandColor()"
				[resolution]="resolution()"
				[lineWidth]="band.lineWidth"
				[depthTest]="band.depthTest"
				[transparent]="band.transparent"
			/>
		</ngt-mesh>
	`,
	imports: [
		NgtArgs,
		NgtrRigidBody,
		NgtrBallCollider,
		NgtrCuboidCollider,
		NgtsRenderTexture,
		Products3dBadgeTexture,
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeScene {
	readonly member = input.required<BadgeMemberData>();
	readonly theme = input.required<Products3dBadgeTheme>();
	readonly debug = input<boolean>(false);
	/**
	 * Cámara del canvas en el que se monta la escena (`fov` y distancia). La escena NO la aplica: solo
	 * deriva de ella el teselado de la correa y la pose de salida de la caída. `Products3dBadge` le pasa
	 * la suya; con un canvas propio, pásale la de tu canvas. Sin input: `BADGE_CAMERA_DEFAULTS`.
	 */
	readonly camera = input<Products3dBadgeCamera>();

	private readonly fixedBody = viewChild.required('fixedBody', { read: NgtrRigidBody });
	private readonly j1Body = viewChild.required('j1Body', { read: NgtrRigidBody });
	private readonly j2Body = viewChild.required('j2Body', { read: NgtrRigidBody });
	private readonly j3Body = viewChild.required('j3Body', { read: NgtrRigidBody });
	private readonly cardBody = viewChild.required('cardBody', { read: NgtrRigidBody });

	// nativeElement ES la instancia MeshLineGeometry (el renderer v4 auto-attachea
	// la BufferGeometry a mesh.geometry); ver docs/spikes/spike-notes-02.md §S2.
	private readonly bandGeometry = viewChild.required<ElementRef<MeshLineGeometry>>('bandGeometry');

	/**
	 * 'kinematicPosition' durante el drag (feature badge-drag); 'dynamic' en reposo.
	 * No se bindea al input rigidBody (race NG0950, ver comentario del template): la feature 6
	 * lo consumirá aplicando cardBody.setBodyType() sobre el body crudo de Rapier.
	 */
	protected readonly cardBodyType = signal<NgtrRigidBodyType>('dynamic');

	/** Arranque del badge: una sola vez, al soltar la física con todo cargado (o al vencer el tope) */
	readonly ready = output<void>();

	protected readonly band = BADGE_BAND;
	/**
	 * Posición del grupo visual del GLB dentro del card body (anclaje VISUAL). Es una constante
	 * DISTINTA del anclaje físico `BADGE_PHYSICS.cardJointAnchor` (body2Anchor del spherical
	 * joint, top del clip): el origen del GLB es el centro de la tarjeta = origen del body =
	 * centro del cuboid collider, así que el grupo va sin offset. Derivación en
	 * `BADGE_CARD_MODEL`.
	 */
	protected readonly cardModelPosition = BADGE_CARD_MODEL.groupPosition;
	/**
	 * Options del NgtsRenderTexture del frente de la tarjeta, todas desde config: tamaño del
	 * FBO (BADGE_TEXTURE.width/height, 1600×2250 = ratio 32:45 de la cara frontal; NO cuadrado,
	 * o el frente se estira), frames continuo (porqué frente a frames:1 en
	 * BADGE_TEXTURE.frames), anisotropy (propiedad de la TEXTURA — soba la aplica sobre
	 * fbo.texture —, no del material; ver BADGE_MAP_ANISOTROPY) y la transformada UV
	 * repeat/offset que invierte la V (convención glTF del GLB vs orientación GL de un render
	 * target; derivación en BADGE_TEXTURE.mapRepeat).
	 */
	protected readonly renderTextureOptions: Partial<NgtsRenderTextureOptions> = {
		width: BADGE_TEXTURE.width,
		height: BADGE_TEXTURE.height,
		frames: BADGE_TEXTURE.frames,
		anisotropy: BADGE_MAP_ANISOTROPY,
		repeat: BADGE_TEXTURE.mapRepeat,
		offset: BADGE_TEXTURE.mapOffset,
	};

	private readonly config = inject(PRODUCTS_3D_CONFIG);
	/**
	 * Geometría de la tarjeta cargada del GLB (nodos card/clip/clamp, materiales
	 * base/metal). `ResourceRef` de soba → consumir vía `.value()` (render condicionado).
	 * URL desde `PRODUCTS_3D_CONFIG`, nunca hardcodeada. Cast a `BadgeGLTF` para no arrastrar
	 * el tipo GLTF de three-stdlib (no nombrable en los `.d.ts` de la lib; ver `BadgeGLTF`).
	 */
	protected readonly gltf = gltfResource(() => this.config.cardModelUrl) as unknown as ResourceRef<
		BadgeGLTF | undefined
	>;
	/**
	 * Textura de la correa del tema. `ResourceRef` de soba → consumir vía `.value()`; el
	 * RepeatWrapping se aplica en un `effect` tras resolver (la firma no expone opción de wrap).
	 * URL desde el tema, nunca hardcodeada. El tipo resuelto es `Texture` de three (peer,
	 * nombrable) → sin cast, a diferencia del GLB (ver `BadgeGLTF`).
	 */
	protected readonly bandTexture = textureResource(() => this.theme().bandTextureUrl);

	/**
	 * Lectura SEGURA de los recursos async para el template y los effects: `hasValue()` como gate
	 * antes de `value()`. `Resource.value()` LANZA `ResourceValueError` en estado de error (URL
	 * 404, decode fallido); si eso ocurre en la detección de cambios, blanquea TODA la escena. Con
	 * estos computed, una textura o un GLB roto degradan a `undefined` (color plano / sin tarjeta)
	 * en vez de hard-crashear. El aviso dev de cada fallo lo emiten los effects de error del ctor.
	 */
	protected readonly gltfData = computed(() => resourceValueOrUndefined(this.gltf));
	protected readonly bandMap = computed(() => resourceValueOrUndefined(this.bandTexture));

	/**
	 * Cámara ACTIVA, resuelta: defaults, fallback con aviso dev y distancia acotada para no enseñar el
	 * anclaje de la correa. De ella derivan el teselado y la pose de salida.
	 */
	private readonly activeCamera = computed(() => resolveBadgeCamera(this.camera()));

	/**
	 * Teselado de la textura de la correa, derivado del aspecto REAL de la textura del tema y del `fov`
	 * de la cámara activa, que fija el ancho de la correa (`bandRepeatFor`, spec-04 R5). El aspecto
	 * solo se conoce tras cargar la imagen, así que es un `computed` sobre `bandMap()` y
	 * `activeCamera()`: se recalcula una vez por textura o por cambio de cámara, NO por frame (regla de
	 * cero allocations de `docs/architecture.md` §4 — en `beforeRender` no pinta nada). Mientras el
	 * recurso no resuelve (`useMap` = 0) o la imagen no expone dimensiones, la división da `NaN` y
	 * `bandRepeatFor` degrada al aspecto de referencia: nunca un `NaN` en el uniform.
	 */
	protected readonly bandRepeat = computed<[number, number]>(() => {
		const image = this.bandMap()?.image as { width?: number; height?: number } | undefined;

		return bandRepeatFor((image?.width ?? 0) / (image?.height ?? 0), this.activeCamera().fov);
	});

	private readonly store = injectStore();
	private readonly physics = inject(NgtrPhysics);
	private readonly destroyRef = inject(DestroyRef);

	// Guard SSR del cursor: solo se toca document en browser. El original se captura una
	// sola vez para restaurarlo al destruir (no asumir 'auto': el host podría tener otro).
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly originalCursor = this.isBrowser ? document.body.style.cursor : '';

	/**
	 * `prefers-reduced-motion: reduce`, leído UNA vez al montar: decide la pose de salida y no se
	 * reevalúa (la pose solo se aplica al crear los bodies). Guard SSR: en server no hay ventana.
	 */
	private readonly reducedMotion =
		this.isBrowser &&
		prefersReducedMotion(inject(DOCUMENT).defaultView, BADGE_LOADING.reducedMotionQuery);
	/**
	 * Pose de salida de los bodies: fuera del viewport por arriba (`badgeDropLayout`, caen al soltar,
	 * derivada del frustum de la cámara activa) o, con movimiento reducido, directamente la de reposo
	 * (`BADGE_LAYOUT`).
	 *
	 * Se evalúa UNA sola vez, en la primera lectura (el primer CD, con los inputs ya puestos): el
	 * `untracked` deja al computed sin dependencias, así que un cambio de cámara posterior NO la
	 * recalcula. Recalcularla movería el `[position]` de los bodies ya soltados, es decir, repetiría la
	 * caída; la regla del arranque es que solo ocurre una vez.
	 */
	protected readonly layout = computed(() =>
		untracked(() => badgeStartLayout(this.reducedMotion, this.activeCamera())),
	);

	/**
	 * Fase del arranque (`nextLoadPhase`): `loading` → `compiling` → `released`. Hasta `released` la
	 * cadena está congelada (bodies deshabilitados), tarjeta y correa no se pintan y no hay drag.
	 */
	private readonly phase = signal<BadgeLoadPhase>('loading');
	protected readonly released = computed(() => this.phase() === 'released');
	/** El frente de la tarjeta (`Products3dBadgeTexture`) ha terminado de cargar (su output `ready`) */
	private readonly frontReady = signal(false);
	private readonly loadState = computed<BadgeLoadState>(() => ({
		gltf: this.gltf.status(),
		bandTexture: this.bandTexture.status(),
		frontReady: this.frontReady(),
	}));
	/** Todos los recursos del arranque terminados, resueltos o en error (`badgeLoadSettled`) */
	private readonly loadSettled = computed(() => badgeLoadSettled(this.loadState()));
	private loadingTimer: ReturnType<typeof setTimeout> | undefined;
	private destroyed = false;

	// Estado del drag. `dragged` gobierna el path kinemático en beforeRender; los Vector3
	// se instancian una vez y se reutilizan por frame (cero allocations en el loop de drag).
	protected readonly dragged = signal(false);
	// Hover sobre la tarjeta; alimenta el cursor reactivo (grab) fuera del loop 3D.
	protected readonly hovered = signal(false);
	private readonly dragOffset = new Vector3();
	private readonly dragVec = new Vector3();
	private readonly dragDir = new Vector3();

	// Resolución de la MeshLineMaterial = tamaño del viewport, reactivo a resize.
	// Vector2 reutilizado: el material hace .copy(value), no guarda la referencia.
	private readonly resolutionVec = new Vector2();
	protected readonly resolution = computed(() => {
		const size = this.store.size();
		return this.resolutionVec.set(size.width, size.height);
	});

	// Opciones del meshPhysicalMaterial de la tarjeta: defaults del proyecto mergeados con el
	// override parcial de theme.material (campo a campo). Reactivo a theme(); merge inmutable.
	protected readonly materialOpts = computed(() =>
		mergeMaterialOptions(BADGE_MATERIAL_DEFAULTS, this.theme().material),
	);

	// Color de la correa: el del tema si está definido, si no el default de BADGE_BAND ('white').
	// Reactivo a theme(); alimenta [color] del meshPhysicalMaterial de la correa.
	protected readonly bandColor = computed(() => this.theme().colors?.band ?? BADGE_BAND.color);

	// Estado de la correa reutilizado (cero allocations por frame): 4 puntos de la
	// curva, en orden tarjeta→anclaje. curveType 'chordal' se fija una sola vez abajo.
	private readonly bandPoints = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
	private readonly curve = new CatmullRomCurve3(this.bandPoints);
	// Buffers del muestreo por longitud de arco (sampleCurveByArcLength): medición de la curva y
	// los puntos equiespaciados que recibe meshline. Instanciados una vez.
	private readonly bandSamples = Array.from(
		{ length: BADGE_PHYSICS.curveArcLengthDivisions + 1 },
		() => new Vector3(),
	);
	private readonly bandArcLengths = new Float64Array(BADGE_PHYSICS.curveArcLengthDivisions + 1);
	private readonly bandSpaced = Array.from(
		{ length: BADGE_PHYSICS.curvePoints + 1 },
		() => new Vector3(),
	);

	// Anti-jitter: posiciones suavizadas (lerp) de los segmentos intermedios que alimentan
	// la curva de la correa. Se instancian una vez y se inicializan con la pose renderizada en
	// el primer frame válido (arrancar en el origen daría un salto). Cero allocations por frame.
	private readonly j1Lerped = new Vector3();
	private readonly j2Lerped = new Vector3();
	private lerpInitialized = false;

	// Anti-giro: quaternion/euler reutilizados para extraer el yaw. El componente y del
	// quaternion NO es el ángulo de giro alrededor de Y; hay que pasar por Euler (orden 'YXZ'
	// para que `.y` sea el yaw). `reuseAngvel` evita crear el literal {x,y,z} de setAngvel por
	// frame (Rapier copia los componentes a un RawVector, no retiene la referencia).
	private readonly reuseQuat = new Quaternion();
	private readonly reuseEuler = new Euler(0, 0, 0, 'YXZ');
	private readonly reuseAngvel = { x: 0, y: 0, z: 0 };

	protected readonly bodyOptions: Partial<NgtrRigidBodyOptions> = {
		colliders: false,
		angularDamping: BADGE_PHYSICS.angularDamping,
		linearDamping: BADGE_PHYSICS.linearDamping,
	};

	protected readonly segmentColliderArgs: [number] = [BADGE_PHYSICS.segmentColliderRadius];
	protected readonly cardColliderArgs = BADGE_PHYSICS.cardColliderHalfExtents;

	private readonly segmentJointData: NgtrRopeJointParams = {
		body1Anchor: BADGE_PHYSICS.segmentJointAnchor,
		body2Anchor: BADGE_PHYSICS.segmentJointAnchor,
		length: BADGE_PHYSICS.segmentLength,
	};

	private readonly cardJointData: NgtrSphericalJointParams = {
		body1Anchor: BADGE_PHYSICS.segmentJointAnchor,
		body2Anchor: BADGE_PHYSICS.cardJointAnchor,
	};

	constructor() {
		// 'chordal' elimina los kinks de la Catmull-Rom sobre segmentos muy separados;
		// se fija una única vez (invariante de la curva), nunca por frame.
		this.curve.curveType = 'chordal';

		// Cursor reactivo (grabbing/grab/auto) por effect sobre las signals de estado, NO por
		// frame ni allocations en beforeRender. Guard SSR: solo toca document en browser. El
		// cursor original se restaura en el cleanup del effect (que corre antes de cada
		// re-ejecución y en destroy) y también en DestroyRef, para no dejar el body con
		// 'grab'/'grabbing' colgado si el componente muere a mitad de hover/drag.
		if (this.isBrowser) {
			effect((onCleanup) => {
				document.body.style.cursor = cursorFor(this.dragged(), this.hovered());
				onCleanup(() => {
					document.body.style.cursor = this.originalCursor;
				});
			});
			this.destroyRef.onDestroy(() => {
				document.body.style.cursor = this.originalCursor;
			});
		}

		// Tinte del metal del clip/clamp, reactivo a gltf.value() + theme(). El color lo resuelve
		// resolveClipColor(): theme.colors.clip (override específico) ?? theme.baseColor ?? el
		// default de config. Con el default (#111111) SIEMPRE hay color, así que el tinte se aplica
		// siempre y ya NO existe la rama "sin color → material original del GLB": era inalcanzable
		// (spec-03-F4v2 R2, nota de implementación).
		// Se CLONA el material 'metal' antes de teñir: el GLB comparte esa instancia entre clip y
		// clamp (y la cachea entre recargas), así que mutar el original filtraría el color a otros
		// usos y persistiría. onCleanup libera el clon anterior en cada re-ejecución (cambio de
		// theme o de GLB) y al destruir → clonar siempre no acumula materiales.
		effect((onCleanup) => {
			const data = this.gltfData();
			if (!data) {
				return;
			}
			const tinted = tintMetalMaterial(data.materials.metal, resolveClipColor(this.theme()));
			data.nodes.clip.material = tinted;
			data.nodes.clamp.material = tinted;
			onCleanup(() => tinted.dispose());
		});

		// RepeatWrapping de la textura de la correa, reactivo a bandTexture.value(). meshline no
		// expone opción de wrap en la firma del loader → se muta la textura tras resolver (patrón
		// del spike S3). NO va en beforeRender: es un one-shot por textura, no por frame.
		effect(() => {
			const tex = this.bandMap();
			if (!tex) {
				return;
			}
			tex.wrapS = RepeatWrapping;
			tex.wrapT = RepeatWrapping;
			tex.needsUpdate = true;
		});

		// Avisos dev (no silenciar): cuando un recurso async entra en 'error' se emite un warn con
		// prefijo [ngx-products-3d] (único console permitido en lib, ver conventions.md). Observa
		// status() (Signal, reactivo, NO lanza; a diferencia de value()). El fallback ya lo aplican
		// bandMap()/gltfData() (color plano / sin tarjeta); el warn solo deja rastro del porqué. NO
		// va en beforeRender: es un one-shot por transición a error, no por frame.
		effect(() => {
			if (this.bandTexture.status() !== 'error') {
				return;
			}
			if (ngDevMode) {
				console.warn(
					`[ngx-products-3d] badge: no se pudo cargar la textura de la correa (theme.bandTextureUrl): ${this.theme().bandTextureUrl}. Se usa color plano.`,
				);
			}
		});
		effect(() => {
			if (this.gltf.status() !== 'error') {
				return;
			}
			if (ngDevMode) {
				console.warn(
					`[ngx-products-3d] badge: no se pudo cargar el modelo de la tarjeta (config.cardModelUrl): ${this.config.cardModelUrl}. La escena se renderiza sin la tarjeta.`,
				);
			}
		});

		// Joints creados reactivamente cuando el mundo Rapier y ambos bodies existen;
		// cleanup automático (removeImpulseJoint) gestionado por angular-three-rapier.
		ropeJoint(
			() => this.fixedBody().rigidBody(),
			() => this.j1Body().rigidBody(),
			{ data: this.segmentJointData },
		);
		ropeJoint(
			() => this.j1Body().rigidBody(),
			() => this.j2Body().rigidBody(),
			{ data: this.segmentJointData },
		);
		ropeJoint(
			() => this.j2Body().rigidBody(),
			() => this.j3Body().rigidBody(),
			{ data: this.segmentJointData },
		);
		sphericalJoint(
			() => this.j3Body().rigidBody(),
			() => this.cardBody().rigidBody(),
			{ data: this.cardJointData },
		);

		// Tope de la espera del arranque: al vencer se suelta con lo que haya (warn dev). Un timeout de
		// un solo disparo, no un loop propio; se limpia al soltar y al destruir. Solo en browser.
		if (this.isBrowser) {
			this.loadingTimer = setTimeout(() => this.onLoadingTimeout(), BADGE_LOADING.timeoutMs);
		}
		this.destroyRef.onDestroy(() => {
			this.destroyed = true;
			clearTimeout(this.loadingTimer);
		});

		// Entrada a la física: ANTES del paso de Rapier (BADGE_LOOP_PRIORITY), para que el paso de este
		// mismo frame ya la consuma. Mientras el badge carga es el gate de arranque (congela los bodies
		// antes de cada paso); una vez suelto, drag + anti-giro.
		beforeRender(
			({ camera, pointer, gl, scene }) => {
				const j1 = this.j1Body().rigidBody();
				const j2 = this.j2Body().rigidBody();
				const j3 = this.j3Body().rigidBody();
				const card = this.cardBody().rigidBody();
				// Los rigid bodies no existen hasta que el WASM de Rapier resuelve.
				if (!j1 || !j2 || !j3 || !card) {
					return;
				}
				if (!this.released()) {
					this.holdUntilLoaded(card, j1, j2, j3, gl, scene, camera);
					return;
				}
				this.applyPointerInput(card, j1, j2, j3, camera, pointer);
			},
			{ priority: BADGE_LOOP_PRIORITY.input },
		);

		// Correa: DESPUÉS del paso de Rapier (BADGE_LOOP_PRIORITY), que ya ha escrito en cada Object3D
		// la pose INTERPOLADA que se va a pintar. Se lee esa pose (objectRef), NO la física cruda
		// (rigidBody().translation()): la cruda va hasta un paso por delante de lo pintado y avanza a
		// saltos, y el extremo de la correa temblaba respecto a la tarjeta.
		beforeRender(
			({ delta }) => {
				// Sin bodies (WASM sin resolver) la cadena aún no existe: no se dibuja la correa.
				if (
					!this.fixedBody().rigidBody() ||
					!this.j1Body().rigidBody() ||
					!this.j2Body().rigidBody() ||
					!this.cardBody().rigidBody()
				) {
					return;
				}
				this.updateBand(delta);
			},
			{ priority: BADGE_LOOP_PRIORITY.band },
		);
	}

	/**
	 * Inicia el drag: captura el puntero sobre el canvas, calcula el offset de agarre en
	 * coordenadas de mundo y conmuta la tarjeta a cuerpo kinemático (posicionable a mano).
	 */
	protected onPointerDown(event: NgtThreeEvent<PointerEvent>): void {
		const card = this.cardBody().rigidBody();
		const rigidBodyType = this.physics.rapier()?.RigidBodyType;
		// Sin drag hasta soltar el badge: la tarjeta aún no se ve y su body está deshabilitado.
		if (!card || !rigidBodyType || !this.released()) {
			return;
		}

		event.stopPropagation();
		(event.target as Element).setPointerCapture(event.pointerId);

		// Offset = punto de intersección (mundo) − origen del cuerpo de la tarjeta.
		subtractInto(event.point, card.translation(), this.dragOffset);

		card.setBodyType(rigidBodyType.KinematicPositionBased, true);
		this.cardBodyType.set('kinematicPosition');
		this.dragged.set(true);
	}

	/** Suelta el drag: libera la captura y devuelve la tarjeta a cuerpo dinámico (cae y oscila). */
	protected onPointerUp(event: NgtThreeEvent<PointerEvent>): void {
		// Durante la carga no hubo pointerdown que atender (ni captura que liberar).
		if (!this.released()) {
			return;
		}
		const card = this.cardBody().rigidBody();
		const rigidBodyType = this.physics.rapier()?.RigidBodyType;

		(event.target as Element).releasePointerCapture(event.pointerId);
		this.dragged.set(false);

		if (card && rigidBodyType) {
			card.setBodyType(rigidBodyType.Dynamic, true);
		}
		this.cardBodyType.set('dynamic');
	}

	/** Puntero entra en la tarjeta: activa el estado hover (cursor 'grab' salvo durante el drag). */
	protected onPointerOver(event: NgtThreeEvent<PointerEvent>): void {
		// Una tarjeta invisible (carga en curso) no ofrece cursor de agarre.
		if (!this.released()) {
			return;
		}
		event.stopPropagation();
		this.hovered.set(true);
	}

	/** Puntero sale de la tarjeta: desactiva el hover (cursor vuelve a 'auto' si no hay drag). */
	protected onPointerOut(event: NgtThreeEvent<PointerEvent>): void {
		event.stopPropagation();
		this.hovered.set(false);
	}

	/** El frente de la tarjeta terminó de cargar (output `ready` de `Products3dBadgeTexture`). */
	protected onFrontReady(): void {
		this.frontReady.set(true);
	}

	/**
	 * Gate de arranque, un frame cada vez y ANTES del paso de Rapier: congela la cadena y, cuando
	 * todos los recursos han terminado, lanza la precompilación de shaders (una sola vez). Congelar
	 * aquí y no en un effect es a propósito: el effect de NgtrRigidBody que termina de configurar cada
	 * body (`updateRigidBodyEffect`) corre cuando le toca, pero el paso físico solo corre en el loop,
	 * y este callback va siempre antes que él. `setEnabled` no lo toca ese effect (el tipo del body
	 * sí: por eso no se congela con `setBodyType`). Cero allocations: solo llamadas al WASM y
	 * lecturas de signals.
	 */
	private holdUntilLoaded(
		card: RigidBody,
		j1: RigidBody,
		j2: RigidBody,
		j3: RigidBody,
		gl: WebGLRenderer,
		scene: Scene,
		camera: Camera,
	): void {
		this.freeze(card);
		this.freeze(j1);
		this.freeze(j2);
		this.freeze(j3);
		if (this.phase() === 'loading' && this.loadSettled()) {
			this.advance('settled');
			this.precompile(gl, scene, camera);
		}
	}

	/**
	 * Compila los programas de todos los materiales de la escena (también los invisibles, ver el
	 * template) para que el primer frame de la caída no pague la compilación. `compileAsync` usa
	 * `KHR_parallel_shader_compile` si existe y resuelve cuando todos están listos (como pronto, en una
	 * microtarea tras este frame). La escena de la RenderTexture del frente es un portal aparte que no
	 * cuelga de `scene`: se renderiza a su FBO cada frame desde que monta, así que sus programas se
	 * compilan en ese render, siempre en un frame anterior a la suelta, con el badge aún oculto.
	 */
	private precompile(gl: WebGLRenderer, scene: Scene, camera: Camera): void {
		gl.compileAsync(scene, camera).then(
			() => this.advance('compiled'),
			(error: unknown) => {
				if (ngDevMode) {
					console.warn(
						`[ngx-products-3d] badge: falló la precompilación de shaders (${String(error)}). Se suelta igualmente.`,
					);
				}
				this.advance('compiled');
			},
		);
	}

	/** Aviso dev y suelta con lo que haya si el arranque no ha terminado al vencer el tope. */
	private onLoadingTimeout(): void {
		if (this.released()) {
			return;
		}
		if (ngDevMode) {
			const pending = pendingBadgeLoads(this.loadState());
			const waiting = pending.length > 0 ? pending.join(', ') : 'precompilación de shaders';
			console.warn(
				`[ngx-products-3d] badge: el arranque no terminó en ${BADGE_LOADING.timeoutMs} ms (pendiente: ${waiting}). Se suelta con lo que haya.`,
			);
		}
		this.advance('timeout');
	}

	/** Aplica una transición del arranque; al llegar a `released`, suelta (una sola vez). */
	private advance(event: BadgeLoadEvent): void {
		if (this.destroyed) {
			return;
		}
		const previous = this.phase();
		const next = nextLoadPhase(previous, event);
		if (next === previous) {
			return;
		}
		this.phase.set(next);
		if (next === 'released') {
			this.release();
		}
	}

	/**
	 * Suelta la cadena: rehabilita los bodies (vuelven a la simulación con la gravedad y los joints
	 * de siempre) y emite `ready`. Solo se llega aquí una vez: `released` es absorbente.
	 */
	private release(): void {
		clearTimeout(this.loadingTimer);
		this.thaw(this.j1Body().rigidBody());
		this.thaw(this.j2Body().rigidBody());
		this.thaw(this.j3Body().rigidBody());
		this.thaw(this.cardBody().rigidBody());
		this.ready.emit();
	}

	private freeze(body: RigidBody): void {
		if (body.isEnabled()) {
			body.setEnabled(false);
		}
	}

	private thaw(body: RigidBody | null): void {
		if (body && !body.isEnabled()) {
			body.setEnabled(true);
			body.wakeUp();
		}
	}

	/**
	 * Drag kinemático (tarjeta agarrada) o anti-giro (en reposo). Escribe en los bodies de Rapier y
	 * lo consume el paso físico de este mismo frame (va antes, ver `BADGE_LOOP_PRIORITY`).
	 */
	private applyPointerInput(
		card: RigidBody,
		j1: RigidBody,
		j2: RigidBody,
		j3: RigidBody,
		camera: Camera,
		pointer: Vector2,
	): void {
		if (this.dragged()) {
			// El puntero se desproyecta al plano de arrastre y la tarjeta (kinemática) se
			// posiciona ahí menos el offset de agarre. Se despiertan la tarjeta y los
			// segmentos para que la cadena reaccione. dragVec/dragDir reutilizados: sin new.
			projectPointerToWorld(
				pointer.x,
				pointer.y,
				BADGE_DRAG.unprojectDepth,
				camera,
				this.dragVec,
				this.dragDir,
			);
			card.wakeUp();
			j1.wakeUp();
			j2.wakeUp();
			j3.wakeUp();
			card.setNextKinematicTranslation(subtractInto(this.dragVec, this.dragOffset, this.dragVec));
			return;
		}

		// Anti-giro (solo en reposo, no durante el drag): amortigua el yaw para que la tarjeta
		// recupere la orientación frontal. rotY = ángulo de Euler en Y (el componente y del
		// quaternion no es el ángulo); Euler 'YXZ' → `.y` es el yaw.
		const ang = card.angvel();
		const rot = card.rotation();
		this.reuseQuat.set(rot.x, rot.y, rot.z, rot.w);
		this.reuseEuler.setFromQuaternion(this.reuseQuat);
		this.reuseAngvel.x = ang.x;
		this.reuseAngvel.y = spinCorrectedAngvelY(
			ang.y,
			this.reuseEuler.y,
			BADGE_PHYSICS.spinCorrectionFactor,
		);
		this.reuseAngvel.z = ang.z;
		card.setAngvel(this.reuseAngvel, true);
	}

	/**
	 * Recalcula la correa con la pose RENDERIZADA de los Object3D de los bodies (la que Rapier acaba
	 * de interpolar), en el sistema de su padre común, que es también el de la malla de la correa.
	 * Cero allocations: puntos de control, buffers de muestreo y lerped son campos reutilizados.
	 */
	private updateBand(delta: number): void {
		const card = this.cardBody().objectRef.nativeElement;
		const j1 = this.j1Body().objectRef.nativeElement.position;
		const j2 = this.j2Body().objectRef.nativeElement.position;
		const fixed = this.fixedBody().objectRef.nativeElement.position;

		// Anti-jitter: el primer frame válido inicializa los lerped con la pose renderizada;
		// después se suavizan hacia ella.
		if (!this.lerpInitialized) {
			this.j1Lerped.copy(j1);
			this.j2Lerped.copy(j2);
			this.lerpInitialized = true;
		}
		lerpTowards(
			j1,
			delta,
			BADGE_PHYSICS.minSpeed,
			BADGE_PHYSICS.maxSpeed,
			BADGE_PHYSICS.lerpClampMin,
			BADGE_PHYSICS.lerpClampMax,
			this.j1Lerped,
		);
		lerpTowards(
			j2,
			delta,
			BADGE_PHYSICS.minSpeed,
			BADGE_PHYSICS.maxSpeed,
			BADGE_PHYSICS.lerpClampMin,
			BADGE_PHYSICS.lerpClampMax,
			this.j2Lerped,
		);

		// Orden tarjeta→anclaje. El extremo de la tarjeta es un punto de la PROPIA tarjeta (centro
		// de la ranura del clamp) y no el centro de j3: el spherical joint no es rígido, y j3 se
		// separa del anclaje con el peso, la oscilación o el drag.
		localPointToParent(BADGE_CARD_MODEL.bandAttachPoint, card, this.bandPoints[0]);
		this.bandPoints[1].copy(this.j2Lerped);
		this.bandPoints[2].copy(this.j1Lerped);
		this.bandPoints[3].copy(fixed);

		this.bandGeometry().nativeElement.setPoints(
			sampleCurveByArcLength(this.curve, this.bandSamples, this.bandArcLengths, this.bandSpaced),
		);
	}
}

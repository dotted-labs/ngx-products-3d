import { isPlatformBrowser } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	DestroyRef,
	effect,
	ElementRef,
	inject,
	input,
	PLATFORM_ID,
	type ResourceRef,
	signal,
	viewChild,
} from '@angular/core';
import { CatmullRomCurve3, Euler, Quaternion, RepeatWrapping, Vector2, Vector3 } from 'three';
import type { Material, Mesh, MeshStandardMaterial } from 'three';
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
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import { resourceValueOrUndefined } from '../resource-value';
import { PRODUCTS_3D_CONFIG } from '../tokens';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { cursorFor } from './badge-cursor';
import { projectPointerToWorld, subtractInto } from './badge-drag';
import { mergeMaterialOptions, tintMetalMaterial } from './badge-material';
import { lerpTowards, spinCorrectedAngvelY } from './badge-stabilize';
import {
	BADGE_BAND,
	BADGE_DRAG,
	BADGE_LAYOUT,
	BADGE_MAP_ANISOTROPY,
	BADGE_MATERIAL_DEFAULTS,
	BADGE_PHYSICS,
} from './badge.config';

// Registra los elementos custom de meshline (<ngt-mesh-line-geometry>,
// <ngt-mesh-line-material>) en el catálogo del renderer. Idempotente a nivel de módulo.
extend({ MeshLineGeometry, MeshLineMaterial });

/**
 * Contrato del card.glb: nodos `card`/`clip`/`clamp` y materiales `base`/`metal`.
 *
 * Tipo INTERNO (no API pública). No extiende `GLTF` de three-stdlib a propósito: ese tipo
 * NO es nombrable en los `.d.ts` emitidos por la lib (three-stdlib es dep transitiva de soba,
 * sin hoisting al node_modules raíz → `import from 'three-stdlib'` no resuelve y usar el tipo
 * resuelto de `gltfResource` dispara TS2742). Modelamos solo lo que consume el componente y
 * casteamos el `ResourceRef` al asignarlo; el card.glb real cumple este contrato (ver spike S3).
 */
interface BadgeGLTF {
	nodes: { card: Mesh; clip: Mesh; clamp: Mesh };
	materials: { base: Material; metal: MeshStandardMaterial };
}

/**
 * Escena física del badge: cadena fixed→j1→j2→j3 (rope joints) de la que
 * cuelga la tarjeta (spherical joint). La geometría de la tarjeta se carga del
 * card.glb (nodos card/clip/clamp) vía `gltfResource`, condicionada a recurso resuelto.
 *
 * Exportado también para consumidores con canvas propio (composición
 * con otros elementos 3D futuros, spec-03 Fase 5).
 */
@Component({
	selector: 'products-3d-badge-scene',
	template: `
		<ngt-object3D
			#fixedBody
			rigidBody="fixed"
			[options]="bodyOptions"
			[position]="layout.fixedPosition"
		/>
		<ngt-object3D #j1Body rigidBody="dynamic" [options]="bodyOptions" [position]="layout.j1Position">
			<ngt-object3D [ballCollider]="segmentColliderArgs" />
		</ngt-object3D>
		<ngt-object3D #j2Body rigidBody="dynamic" [options]="bodyOptions" [position]="layout.j2Position">
			<ngt-object3D [ballCollider]="segmentColliderArgs" />
		</ngt-object3D>
		<ngt-object3D #j3Body rigidBody="dynamic" [options]="bodyOptions" [position]="layout.j3Position">
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
		<ngt-object3D
			#cardBody
			rigidBody="dynamic"
			[options]="bodyOptions"
			[position]="layout.cardPosition"
			(pointerdown)="onPointerDown($event)"
			(pointerup)="onPointerUp($event)"
			(pointerover)="onPointerOver($event)"
			(pointerout)="onPointerOut($event)"
		>
			<ngt-object3D [cuboidCollider]="cardColliderArgs" />
			<!--
				Visual de la tarjeta = geometría del card.glb. Se monta SOLO cuando el recurso
				resuelve (@if sobre gltfData(), gateado con hasValue() → NO lanza si el GLB entra en
				error; una URL de modelo rota degrada a "sin tarjeta", no blanquea la escena. Si el
				GLB falla se emite un warn dev, ver gltfErrorEffect) → sin flash de escena a medio
				cargar. El origen del
				GLB es el anclaje del clip; el grupo se sitúa en cardAnchor (= cardJointAnchor)
				para que el centro de la tarjeta coincida con el cuboid collider y el clip con el
				punto del spherical joint. La tarjeta se renderiza como mesh propio con
				meshPhysicalMaterial (clearcoat) en vez del material 'base' del GLB; se preserva la
				transformación local del nodo card (offset y=-1.45 del GLB) porque su geometría va
				centrada en el origen. clip/clamp siguen como primitive con su material 'metal'; el
				tinte opcional del metal se aplica por código en un effect (ver metalEffect). El
				[map] del frente (RenderTexture) llega en la feature 7.
			-->
			@if (gltfData(); as data) {
				<ngt-group [position]="cardAnchor">
					<ngt-mesh
						[geometry]="data.nodes.card.geometry"
						[position]="data.nodes.card.position"
						[quaternion]="data.nodes.card.quaternion"
						[scale]="data.nodes.card.scale"
					>
						<ngt-mesh-physical-material
							[mapAnisotropy]="mapAnisotropy"
							[clearcoat]="materialOpts().clearcoat"
							[clearcoatRoughness]="materialOpts().clearcoatRoughness"
							[roughness]="materialOpts().roughness"
							[metalness]="materialOpts().metalness"
							[iridescence]="materialOpts().iridescence"
							[iridescenceIOR]="materialOpts().iridescenceIOR"
						/>
					</ngt-mesh>
					<ngt-primitive *args="[data.nodes.clip]" />
					<ngt-primitive *args="[data.nodes.clamp]" />
				</ngt-group>
			}
		</ngt-object3D>
		<!--
			Correa (lanyard): curva Catmull-Rom recalculada por frame en beforeRender. El material se
			texturiza con la banda del tema (bandMap): computed no-lanzante sobre bandTexture (gateado
			con hasValue() → NO lanza si la textura entra en error o 404, a diferencia de value()).
			useMap es un flag numérico 0|1 de meshline (no boolean) y se gatea a bandMap(): mientras es
			undefined (loading o error), useMap=0 y meshline pinta el color plano (sin flash ni crash
			con map roto); al resolver, useMap=1 y el shader muestrea el map. Si la textura falla se
			emite un warn dev, ver bandTextureErrorEffect. repeat es un Vector2 en meshline; el renderer
			v4 acepta la tupla y hace repeat.set(-4, 1). RepeatWrapping se aplica en el effect del constructor.
		-->
		<ngt-mesh>
			<ngt-mesh-line-geometry #bandGeometry />
			<ngt-mesh-line-material
				[map]="bandMap()"
				[useMap]="bandMap() ? 1 : 0"
				[repeat]="band.repeat"
				[color]="bandColor()"
				[resolution]="resolution()"
				[lineWidth]="band.lineWidth"
				[depthTest]="band.depthTest"
			/>
		</ngt-mesh>
	`,
	imports: [NgtArgs, NgtrRigidBody, NgtrBallCollider, NgtrCuboidCollider],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeScene {
	readonly member = input.required<BadgeMemberData>();
	readonly theme = input.required<Products3dBadgeTheme>();
	readonly debug = input<boolean>(false);

	private readonly fixedBody = viewChild.required('fixedBody', { read: NgtrRigidBody });
	private readonly j1Body = viewChild.required('j1Body', { read: NgtrRigidBody });
	private readonly j2Body = viewChild.required('j2Body', { read: NgtrRigidBody });
	private readonly j3Body = viewChild.required('j3Body', { read: NgtrRigidBody });
	private readonly cardBody = viewChild.required('cardBody', { read: NgtrRigidBody });

	// nativeElement ES la instancia MeshLineGeometry (el renderer v4 auto-attachea
	// la BufferGeometry a mesh.geometry); ver docs/spike-notes.md §S2.
	private readonly bandGeometry = viewChild.required<ElementRef<MeshLineGeometry>>('bandGeometry');

	/**
	 * 'kinematicPosition' durante el drag (feature badge-drag); 'dynamic' en reposo.
	 * No se bindea al input rigidBody (race NG0950, ver comentario del template): la feature 6
	 * lo consumirá aplicando cardBody.setBodyType() sobre el body crudo de Rapier.
	 */
	protected readonly cardBodyType = signal<NgtrRigidBodyType>('dynamic');

	protected readonly layout = BADGE_LAYOUT;
	protected readonly band = BADGE_BAND;
	/**
	 * Posición del grupo visual del GLB dentro del card body. El GLB tiene su origen en el
	 * anclaje del clip; situarlo en `cardJointAnchor` alinea el centro de la tarjeta con el
	 * cuboid collider (origen del body) y el clip con el punto del spherical joint.
	 */
	protected readonly cardAnchor = BADGE_PHYSICS.cardJointAnchor;
	/**
	 * Filtrado anisotrópico del frente de la tarjeta. Se bindea al meshPhysicalMaterial ya; su
	 * efecto real llega con el `map` (RenderTexture) de la feature 7 (ver BADGE_MAP_ANISOTROPY).
	 */
	protected readonly mapAnisotropy = BADGE_MAP_ANISOTROPY;

	private readonly config = inject(PRODUCTS_3D_CONFIG);
	/**
	 * Geometría de la tarjeta cargada del card.glb (nodos card/clip/clamp, materiales
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

	private readonly store = injectStore();
	private readonly physics = inject(NgtrPhysics);
	private readonly destroyRef = inject(DestroyRef);

	// Guard SSR del cursor: solo se toca document en browser. El original se captura una
	// sola vez para restaurarlo al destruir (no asumir 'auto': el host podría tener otro).
	private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
	private readonly originalCursor = this.isBrowser ? document.body.style.cursor : '';

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

	// Anti-jitter: posiciones suavizadas (lerp) de los segmentos intermedios que alimentan
	// la curva de la correa. Se instancian una vez y se inicializan con la traslación real en
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

		// Tinte del metal del clip/clamp, reactivo a gltf.value() + theme(). Se CLONA el material
		// 'metal' antes de teñir: el GLB comparte esa instancia entre clip y clamp (y la cachea
		// entre recargas), así que mutar el original filtraría el color a otros usos y persistiría.
		// Sin color → material original (idempotente). onCleanup libera el clon anterior al cambiar
		// theme o al destruir → sin fugas.
		effect((onCleanup) => {
			const data = this.gltfData();
			if (!data) {
				return;
			}
			const clipColor = this.theme().colors?.clip;
			if (!clipColor) {
				data.nodes.clip.material = data.materials.metal;
				data.nodes.clamp.material = data.materials.metal;
				return;
			}
			const tinted = tintMetalMaterial(data.materials.metal, clipColor);
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

		beforeRender(({ camera, pointer, delta }) => {
			const fixed = this.fixedBody().rigidBody();
			const j1 = this.j1Body().rigidBody();
			const j2 = this.j2Body().rigidBody();
			const j3 = this.j3Body().rigidBody();
			// Los rigid bodies no existen hasta que el WASM de Rapier resuelve; sin ellos
			// no hay traslaciones que muestrear.
			if (!fixed || !j1 || !j2 || !j3) {
				return;
			}

			const card = this.cardBody().rigidBody();
			if (this.dragged() && card) {
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
			} else if (card) {
				// Anti-giro (solo en reposo, no durante el drag): amortigua el yaw para que la
				// tarjeta recupere la orientación frontal. rotY = ángulo de Euler en Y (el
				// componente y del quaternion no es el ángulo); Euler 'YXZ' → `.y` es el yaw.
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

			// Anti-jitter: el primer frame válido inicializa los lerped con la traslación real;
			// después se suavizan hacia los segmentos crudos. Alimentan siempre la curva.
			if (!this.lerpInitialized) {
				this.j1Lerped.copy(j1.translation());
				this.j2Lerped.copy(j2.translation());
				this.lerpInitialized = true;
			}
			lerpTowards(
				j1.translation(),
				delta,
				BADGE_PHYSICS.minSpeed,
				BADGE_PHYSICS.maxSpeed,
				BADGE_PHYSICS.lerpClampMin,
				BADGE_PHYSICS.lerpClampMax,
				this.j1Lerped,
			);
			lerpTowards(
				j2.translation(),
				delta,
				BADGE_PHYSICS.minSpeed,
				BADGE_PHYSICS.maxSpeed,
				BADGE_PHYSICS.lerpClampMin,
				BADGE_PHYSICS.lerpClampMax,
				this.j2Lerped,
			);

			// Orden tarjeta→anclaje; segmentos intermedios suavizados (anti-jitter).
			this.bandPoints[0].copy(j3.translation());
			this.bandPoints[1].copy(this.j2Lerped);
			this.bandPoints[2].copy(this.j1Lerped);
			this.bandPoints[3].copy(fixed.translation());

			this.bandGeometry().nativeElement.setPoints(this.curve.getPoints(BADGE_PHYSICS.curvePoints));
		});
	}

	/**
	 * Inicia el drag: captura el puntero sobre el canvas, calcula el offset de agarre en
	 * coordenadas de mundo y conmuta la tarjeta a cuerpo kinemático (posicionable a mano).
	 */
	protected onPointerDown(event: NgtThreeEvent<PointerEvent>): void {
		const card = this.cardBody().rigidBody();
		const rigidBodyType = this.physics.rapier()?.RigidBodyType;
		if (!card || !rigidBodyType) {
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
		event.stopPropagation();
		this.hovered.set(true);
	}

	/** Puntero sale de la tarjeta: desactiva el hover (cursor vuelve a 'auto' si no hay drag). */
	protected onPointerOut(event: NgtThreeEvent<PointerEvent>): void {
		event.stopPropagation();
		this.hovered.set(false);
	}
}

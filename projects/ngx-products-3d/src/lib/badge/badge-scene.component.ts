import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	ElementRef,
	inject,
	input,
	signal,
	viewChild,
} from '@angular/core';
import { CatmullRomCurve3, DoubleSide, Vector2, Vector3 } from 'three';
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
import { MeshLineGeometry, MeshLineMaterial } from 'meshline';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { projectPointerToWorld, subtractInto } from './badge-drag';
import {
	BADGE_BAND,
	BADGE_CARD_PLACEHOLDER,
	BADGE_DRAG,
	BADGE_LAYOUT,
	BADGE_PHYSICS,
} from './badge.config';

// Registra los elementos custom de meshline (<ngt-mesh-line-geometry>,
// <ngt-mesh-line-material>) en el catálogo del renderer. Idempotente a nivel de módulo.
extend({ MeshLineGeometry, MeshLineMaterial });

/**
 * Escena física del badge: cadena fixed→j1→j2→j3 (rope joints) de la que
 * cuelga la tarjeta (spherical joint). Correa y drag en features posteriores
 * de spec-02; tarjeta = plano placeholder hasta spec-03.
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
		>
			<ngt-object3D [cuboidCollider]="cardColliderArgs" />
			<ngt-mesh>
				<ngt-plane-geometry *args="cardPlaneArgs" />
				<ngt-mesh-basic-material
					[color]="placeholder.color"
					[transparent]="true"
					[opacity]="placeholder.opacity"
					[side]="doubleSide"
				/>
			</ngt-mesh>
		</ngt-object3D>
		<!-- Correa (lanyard): curva Catmull-Rom recalculada por frame en beforeRender -->
		<ngt-mesh>
			<ngt-mesh-line-geometry #bandGeometry />
			<ngt-mesh-line-material
				[color]="band.color"
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
	protected readonly placeholder = BADGE_CARD_PLACEHOLDER;
	protected readonly band = BADGE_BAND;
	protected readonly doubleSide = DoubleSide;

	private readonly store = injectStore();
	private readonly physics = inject(NgtrPhysics);

	// Estado del drag. `dragged` gobierna el path kinemático en beforeRender; los Vector3
	// se instancian una vez y se reutilizan por frame (cero allocations en el loop de drag).
	protected readonly dragged = signal(false);
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

	// Estado de la correa reutilizado (cero allocations por frame): 4 puntos de la
	// curva, en orden tarjeta→anclaje. curveType 'chordal' se fija una sola vez abajo.
	private readonly bandPoints = [new Vector3(), new Vector3(), new Vector3(), new Vector3()];
	private readonly curve = new CatmullRomCurve3(this.bandPoints);

	protected readonly bodyOptions: Partial<NgtrRigidBodyOptions> = {
		colliders: false,
		angularDamping: BADGE_PHYSICS.angularDamping,
		linearDamping: BADGE_PHYSICS.linearDamping,
	};

	protected readonly segmentColliderArgs: [number] = [BADGE_PHYSICS.segmentColliderRadius];
	protected readonly cardColliderArgs = BADGE_PHYSICS.cardColliderHalfExtents;
	protected readonly cardPlaneArgs = BADGE_CARD_PLACEHOLDER.planeSize;

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

		beforeRender(({ camera, pointer }) => {
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
			}

			// Orden tarjeta→anclaje; .copy() sobre los Vector3 ya instanciados (sin new).
			this.bandPoints[0].copy(j3.translation());
			this.bandPoints[1].copy(j2.translation());
			this.bandPoints[2].copy(j1.translation());
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
}

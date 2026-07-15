import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	effect,
	input,
	viewChildren,
} from '@angular/core';
import { SRGBColorSpace } from 'three';
import { getInstanceState, NgtArgs } from 'angular-three';
import { NgtsText3D } from 'angular-three-soba/abstractions';
import {
	NgtsPerspectiveCamera,
	type NgtsPerspectiveCameraOptions,
} from 'angular-three-soba/cameras';
import { textureResource } from 'angular-three-soba/loaders';
import { resourceValueOrUndefined } from '../resource-value';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { badgeTextFor, fitTextScale, resolveBaseTextureUrl } from './badge-texture';
import { BADGE_TEXT, BADGE_TEXT_LAYOUT, BADGE_TEXTURE } from './badge.config';

/**
 * Escena secundaria del frente de la tarjeta (renderizada a textura por el NgtsRenderTexture
 * que badge-scene attachea como map del material de la tarjeta): textura base por tier +
 * Text3D con los datos del socio. No crea canvas propio: se monta dentro del canvas anfitrión
 * (dentro del `<ng-template renderTextureContent>`). Cámara, plano y textos son data-driven
 * desde `BADGE_TEXTURE`/`BADGE_TEXT`/`BADGE_TEXT_LAYOUT`.
 */
@Component({
	selector: 'products-3d-badge-texture',
	template: `
		<!--
			Cámara propia de la escena de textura. Se usa <ngts-perspective-camera> (soba) y NO
			<ngt-perspective-camera> crudo: el renderer de angular-three v4 no tiene concepto de
			'makeDefault' en el elemento (verificado en node_modules); es la opción makeDefault
			de la cámara de soba la que registra esta cámara como default del store (el del
			portal del RenderTexture que monta este componente).
		-->
		<ngts-perspective-camera [options]="cameraOptions" />
		<!--
			Plano de fondo con la textura base del tier. Gate hasValue() vía baseMap() (computed
			no-lanzante): mientras carga o si la URL falla, no se monta el plano (sin flash de
			frente sin textura ni crash; el warn dev lo emite el effect de error del constructor).
			El colorSpace sRGB se muta en un effect tras resolver (la firma del loader no expone opción).
		-->
		@if (baseMap(); as map) {
			<ngt-mesh>
				<ngt-plane-geometry *args="planeArgs" />
				<ngt-mesh-basic-material [map]="map" />
			</ngt-mesh>
		}
		<!--
			Textos del socio, data-driven: un <ngts-text-3d> por slot de BADGE_TEXT_LAYOUT
			(reordenar/ajustar el array no toca este componente). Material basic (unlit) a
			propósito: la escena del RenderTexture no tiene luces y un material lit pintaría
			negro; el texto es gráfico plano sobre la tarjeta, no necesita sombreado. Mientras
			la fuente (theme.fontUrl) carga, NgtsText3D no crea geometría (mesh vacío, invisible).
		-->
		@for (entry of textSlots(); track entry.slot.field) {
			<ngts-text-3d [font]="theme().fontUrl" [text]="entry.text" [options]="entry.options">
				<ngt-mesh-basic-material [color]="textColor()" />
			</ngts-text-3d>
		}
	`,
	imports: [NgtArgs, NgtsPerspectiveCamera, NgtsText3D],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeTexture {
	readonly member = input.required<BadgeMemberData>();
	readonly theme = input.required<Products3dBadgeTheme>();

	private readonly textNodes = viewChildren(NgtsText3D);

	protected readonly cameraOptions: Partial<NgtsPerspectiveCameraOptions> = {
		makeDefault: true,
		position: BADGE_TEXTURE.cameraPosition,
	};
	protected readonly planeArgs = BADGE_TEXTURE.planeSize;

	/** Textura base por tier con fallback obligatorio (fn pura, testeada) */
	protected readonly baseTextureUrl = computed(() =>
		resolveBaseTextureUrl(this.theme(), this.member().tier),
	);

	/**
	 * Textura base del frente. `ResourceRef` de soba → gate a `hasValue()` vía `baseMap()`.
	 * El tipo resuelto es `Texture` de three (peer, nombrable) → sin cast (mismo criterio
	 * que la textura de la correa; ver gotcha three-stdlib en docs/spike-notes-03.md).
	 */
	protected readonly baseTexture = textureResource(() => this.baseTextureUrl());

	/** Lectura segura del recurso: undefined en loading/error (no lanza, ver resource-value.ts) */
	protected readonly baseMap = computed(() => resourceValueOrUndefined(this.baseTexture));

	/** Color del texto del tema, con fallback de config (nunca literal en el componente) */
	protected readonly textColor = computed(() => this.theme().colors?.text ?? BADGE_TEXT.color);

	/**
	 * Slots de texto listos para el template: layout de config + texto formateado del socio
	 * (fn pura badgeTextFor) + options de NgtsText3D. Reactivo solo a member().
	 */
	protected readonly textSlots = computed(() => {
		const member = this.member();
		return BADGE_TEXT_LAYOUT.map((slot) => ({
			slot,
			text: badgeTextFor(member, slot.field, BADGE_TEXT.memberNumberPrefix),
			options: {
				position: slot.position,
				rotation: slot.rotation,
				size: slot.size,
				height: slot.height,
			},
		}));
	});

	constructor() {
		// colorSpace sRGB de la textura base, mutado tras resolver (patrón del spike S3: la
		// firma del loader no expone la opción). One-shot por textura, no por frame.
		effect(() => {
			const map = this.baseMap();
			if (!map) {
				return;
			}
			map.colorSpace = SRGBColorSpace;
			map.needsUpdate = true;
		});

		// Aviso dev cuando la textura base entra en error (status() es reactivo y no lanza).
		// El fallback visual ya lo aplica el gate de baseMap() (plano sin montar).
		effect(() => {
			if (this.baseTexture.status() !== 'error') {
				return;
			}
			if (ngDevMode) {
				console.warn(
					`[ngx-products-3d] badge: no se pudo cargar la textura base del frente (tier '${this.member().tier}'): ${this.baseTextureUrl()}. El frente se renderiza sin fondo.`,
				);
			}
		});

		// Encaje de textos largos (nombre): NgtsResize NO existe en soba v4 (spike S3) → medición
		// manual del bounding box de la geometría y scale del mesh, clampado a <=1 (fn pura
		// fitTextScale, testeada). Reactivo al attach de la TextGeometry: NgtsText3D crea la
		// geometría cuando la fuente resuelve (y la recrea al cambiar member/theme), y ese attach
		// bumpea la signal nonObjects del instance state del mesh (mismo mecanismo interno que usa
		// NgtsCenter). Se mide el bbox LOCAL (no afectado por el scale aplicado → sin feedback).
		effect(() => {
			for (const text of this.textNodes()) {
				const mesh = text.meshRef().nativeElement;
				getInstanceState(mesh)?.nonObjects();
				const geometry = mesh.geometry;
				geometry.computeBoundingBox();
				const box = geometry.boundingBox;
				const width = box ? box.max.x - box.min.x : Number.NaN;
				mesh.scale.setScalar(fitTextScale(width, BADGE_TEXT.maxWidth));
			}
		});
	}
}

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	effect,
	input,
	untracked,
	viewChildren,
} from '@angular/core';
import { SRGBColorSpace, type Mesh } from 'three';
import { getInstanceState, NgtArgs } from 'angular-three';
import { NgtsText3D } from 'angular-three-soba/abstractions';
import {
	NgtsOrthographicCamera,
	type NgtsOrthographicCameraOptions,
} from 'angular-three-soba/cameras';
import { textureResource } from 'angular-three-soba/loaders';
import { resourceValueOrUndefined } from '../resource-value';
import type { BadgeMemberData, Products3dBadgeTheme } from '../types';
import { resolveBaseColor } from './badge-theme';
import {
	alignOffsetX,
	badgeTextFor,
	fitTextScale,
	isRatioWithinTolerance,
	resolveBaseTextureUrl,
	uvAnchorToRtPosition,
} from './badge-texture';
import { BADGE_FRONT_FACE, BADGE_TEXT, BADGE_TEXT_LAYOUT, BADGE_TEXTURE } from './badge.config';

/**
 * Escena secundaria del frente de la tarjeta (renderizada a textura por el NgtsRenderTexture
 * que badge-scene attachea como map del material de la tarjeta). Tres capas sobre el mismo rect de
 * la cara frontal, de atrás hacia delante: quad opaco con el `baseColor` del tema, arte del tier
 * (webp con alpha, que revela el color donde es transparente) y Text3D con los datos del socio.
 * No crea canvas propio: se monta dentro del canvas anfitrión (dentro del
 * `<ng-template renderTextureContent>`). Cámara, quads y textos son data-driven desde
 * `BADGE_TEXTURE`/`BADGE_TEXT`/`BADGE_TEXT_LAYOUT`.
 */
@Component({
	selector: 'products-3d-badge-texture',
	template: `
		<!--
			Cámara propia de la escena de textura. Se usa <ngts-orthographic-camera> (soba) y NO
			<ngt-orthographic-camera> crudo: el renderer de angular-three v4 no tiene concepto de
			'makeDefault' en el elemento (verificado en node_modules); es la opción makeDefault
			de la cámara de soba la que registra esta cámara como default del store (el del
			portal del RenderTexture que monta este componente). Ortográfica (no perspectiva)
			porque el frente es diseño 2D plano: sin distorsión de perspectiva en los textos y con
			depth lineal. El frustum y el porqué de 'manual' van en cameraOptions.
		-->
		<ngts-orthographic-camera [options]="cameraOptions" />
		<!--
			Quad de fondo OPACO con el baseColor del tema, del tamaño exacto de la cara frontal
			(BADGE_TEXTURE.frontPlaneSize = BADGE_FRONT_FACE): llena el FBO borde a borde y es la
			ÚNICA vía por la que baseColor llega al frente de la tarjeta. Enchufarlo en el [color]
			del meshPhysicalMaterial de la tarjeta pintaría el frente entero de negro, porque el
			fragment shader multiplica map × color y el map es esta misma RenderTexture
			(spec-03-F4v2 R2). Se monta SIEMPRE, sin gate: si el arte del tier no carga, el frente
			queda del color base, nunca en blanco. Material basic (unlit) porque la escena de la
			RenderTexture no tiene luces; el color es un binding, así que cambiar theme.baseColor lo
			repinta sin recrear nada.
		-->
		<ngt-mesh [position]="backdropPosition">
			<ngt-plane-geometry *args="frontPlaneArgs" />
			<ngt-mesh-basic-material [color]="baseColor()" />
		</ngt-mesh>
		<!--
			Arte del tier (webp con alpha) sobre el quad de baseColor, mismo rect y adelantado
			BADGE_TEXTURE.artPosition en z. transparent: true es lo que hace que el alpha del webp
			revele el color de debajo en vez de componer sobre negro. Gate hasValue() vía baseMap()
			(computed no-lanzante): mientras carga o si la URL falla, no se monta el plano (sin flash
			de frente sin textura ni crash; el warn dev lo emite el effect de error del constructor).
			El colorSpace sRGB se muta en un effect tras resolver (la firma del loader no expone opción).
		-->
		@if (baseMap(); as map) {
			<ngt-mesh [position]="artPosition">
				<ngt-plane-geometry *args="frontPlaneArgs" />
				<ngt-mesh-basic-material [map]="map" [transparent]="true" />
			</ngt-mesh>
		}
		<!--
			Textos del socio, data-driven: un <ngts-text-3d> por slot de BADGE_TEXT_LAYOUT
			(reordenar/ajustar el array no toca este componente). Material basic (unlit) a
			propósito: la escena del RenderTexture no tiene luces y un material lit pintaría
			negro; el texto es gráfico plano sobre la tarjeta, no necesita sombreado. Mientras
			la fuente (theme.fontUrl) carga, NgtsText3D no crea geometría (mesh vacío, invisible).
			El anclaje (anchor + align) y la reducción a maxWidth NO son bindings: necesitan el
			ancho medido de la geometría y los aplica fitTextMeshes sobre el mesh.
		-->
		@for (entry of textSlots(); track entry.slot.field) {
			<ngts-text-3d [font]="theme().fontUrl" [text]="entry.text" [options]="entry.options">
				<ngt-mesh-basic-material [color]="textColor()" />
			</ngts-text-3d>
		}
	`,
	imports: [NgtArgs, NgtsOrthographicCamera, NgtsText3D],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeTexture {
	readonly member = input.required<BadgeMemberData>();
	readonly theme = input.required<Products3dBadgeTheme>();

	private readonly textNodes = viewChildren(NgtsText3D);

	/**
	 * Options de la cámara de la escena de textura: ortográfica, default del store del portal y con
	 * el frustum EXPLÍCITO de la cara frontal (`BADGE_TEXTURE.cameraFrustum`, derivado de
	 * `BADGE_FRONT_FACE`) → lo que ve la cámara es exactamente el rect 32:45 que el UV del GLB
	 * mapea sobre el frente, sin estirado.
	 *
	 * El frustum explícito y `manual: true` cierran DOS rutas distintas, ninguna redundante
	 * (verificado en node_modules, spec-03-F4v2 «Corrección técnica» punto 2):
	 * - **Ruta activa hoy — la cierra el frustum explícito.** La cámara de soba solo aplica los
	 *   left/right/top/bottom recibidos; si faltaran, caerían a la mitad del `store.size`
	 *   (`angular-three-soba-cameras.mjs:257-264`), y el store del portal hereda el `size` del
	 *   CANVAS porque el NgtsRenderTexture no le pasa uno propio
	 *   (`angular-three-soba/fesm2022/angular-three-soba-staging.mjs:3315` +
	 *   `angular-three.mjs:3695`, `mergeState`) → frustum de ≈1900 unidades, tarjeta reducida a un
	 *   punto y deformándose al redimensionar la ventana.
	 * - **Ruta LATENTE — la blinda `manual: true`.** `updateCamera()` del core
	 *   (`angular-three/fesm2022/angular-three.mjs:601-615`) reescribe left/right/top/bottom con el
	 *   `size` del store salvo que `camera.manual` sea `true`. Con el cableado ACTUAL esa función
	 *   **no llega a ejecutarse** sobre la cámara de este portal —la llamada de `mergeState` es
	 *   condicional a que el portal traiga `size` (`angular-three.mjs:3676-3682`) y el effect que la
	 *   invoca vive en `storeFactory` (`angular-three.mjs:2806-2827`), que el store del portal no usa
	 *   (`angular-three.mjs:3769-3781`)—, pero basta que soba pase un `size` al portal para que se
	 *   active y devuelva la regresión. `manual` no es decorativo: tiene default `false`
	 *   (`angular-three-soba-cameras.mjs:204-209`) y sobrevive al `omit` de `parameters`
	 *   (`:236-245`), así que pasarlo aquí en `[options]` lo lleva de verdad a la instancia de three
	 *   (`angular-three.mjs:1049-1050`), que es de donde lo lee `updateCamera()`.
	 */
	protected readonly cameraOptions: Partial<NgtsOrthographicCameraOptions> = {
		makeDefault: true,
		manual: true,
		position: BADGE_TEXTURE.cameraPosition,
		...BADGE_TEXTURE.cameraFrustum,
	};
	/**
	 * Args del `<ngt-plane-geometry>` de las DOS capas del fondo (quad de `baseColor` y arte del
	 * tier): el mismo rect de la cara frontal para ambas, o el arte quedaría desalineado respecto al
	 * color de debajo. Es exactamente lo que encuadra `cameraFrustum` → llena el FBO sin bandas.
	 */
	protected readonly frontPlaneArgs = BADGE_TEXTURE.frontPlaneSize;
	/** z = 0: capa del fondo opaco, el plano que el frustum encuadra */
	protected readonly backdropPosition = BADGE_TEXTURE.backdropPosition;
	/** Arte del tier, adelantado en z sobre el fondo (config, no literal aquí) */
	protected readonly artPosition = BADGE_TEXTURE.artPosition;

	/** Textura base por tier con fallback obligatorio (fn pura, testeada) */
	protected readonly baseTextureUrl = computed(() =>
		resolveBaseTextureUrl(this.theme(), this.member().tier),
	);

	/**
	 * Textura base del frente. `ResourceRef` de soba → gate a `hasValue()` vía `baseMap()`.
	 * El tipo resuelto es `Texture` de three (peer, nombrable) → sin cast (mismo criterio
	 * que la textura de la correa; ver gotcha three-stdlib en docs/spikes/spike-notes-03.md).
	 */
	protected readonly baseTexture = textureResource(() => this.baseTextureUrl());

	/** Lectura segura del recurso: undefined en loading/error (no lanza, ver resource-value.ts) */
	protected readonly baseMap = computed(() => resourceValueOrUndefined(this.baseTexture));

	/**
	 * Color del quad de fondo del frente: `theme.baseColor` con fallback a `BADGE_BASE_COLOR`
	 * (fn pura `resolveBaseColor`, testeada). Computed sobre el input `theme` → cambiar el tema
	 * repinta el material por binding, sin recrear el canvas ni la escena de la RenderTexture.
	 */
	protected readonly baseColor = computed(() => resolveBaseColor(this.theme()));

	/** Color del texto del tema, con fallback de config (nunca literal en el componente) */
	protected readonly textColor = computed(() => this.theme().colors?.text ?? BADGE_TEXT.color);

	/**
	 * Slots de texto listos para el template: layout de config + texto formateado del socio
	 * (fn pura badgeTextFor) + options de NgtsText3D. Reactivo solo a member().
	 *
	 * Las options llevan SOLO la tipografía (`size` = tamaño de fuente, `height` = profundidad de
	 * extrusión del TextGeometry; sin `height` explícito soba aplicaría su default 0.2, veinte veces
	 * la extrusión del layout). La colocación —posición y escala— NO va aquí: depende del ancho medido
	 * del texto y la aplica `fitTextMeshes` sobre el mesh, que así es el ÚNICO escritor del
	 * `position`/`scale` (con las dos vías, el binding de options repondría el anchor sin el offset de
	 * alineado en cuanto cambiara el socio).
	 */
	protected readonly textSlots = computed(() => {
		const member = this.member();
		return BADGE_TEXT_LAYOUT.map((slot) => ({
			slot,
			text: badgeTextFor(member, slot.field, BADGE_TEXT.memberNumberPrefix),
			options: {
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

			// Validación del ratio del asset (spec-03-F4v2 R1): el arte cubre el rect de la cara
			// frontal, así que un ratio distinto del de esa cara sale estirado en esa misma
			// proporción. Solo avisa: NO se deja de renderizar (un frente estirado sigue siendo
			// mejor que ninguno, y el arreglo está en el asset, no en la lib).
			if (ngDevMode) {
				// `Texture.image` es `any` en three (HTMLImageElement, ImageBitmap, {data,width,height}…)
				// → narrow a lo único que se lee aquí. Mientras la imagen no expone tamaño, las
				// dimensiones no son medibles y la fn pura las trata como válidas (no avisa).
				const image = map.image as { width?: number; height?: number } | null | undefined;
				const width = image?.width ?? Number.NaN;
				const height = image?.height ?? Number.NaN;
				const { assetAspect, assetAspectTolerance } = BADGE_TEXTURE;
				if (!isRatioWithinTolerance(width, height, assetAspect, assetAspectTolerance)) {
					// La URL se lee SIN trackear: el aviso es one-shot por textura resuelta, y
					// trackearla suscribiría este effect a cambios de `member` (p. ej. el nombre del
					// socio) que no cargan textura nueva y repetirían el warn.
					const url = untracked(() => this.baseTextureUrl());
					console.warn(
						`[ngx-products-3d] badge: la textura base del frente no respeta el ratio de la cara de la tarjeta y se verá estirada. Esperado ${assetAspect.toFixed(4)} (±${assetAspectTolerance * 100}%), medido ${(width / height).toFixed(4)} (${width}×${height} px): ${url}. El frente se renderiza igualmente.`,
					);
				}
			}
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

		// Colocación de los textos (anclaje + encaje): NgtsResize NO existe en soba v4 (spike S3) y
		// NgtsText3D no tiene alineado → hace falta medir el bbox de la geometría ya creada, así que
		// esto vive en un effect y no en el template. Reactivo al attach de la TextGeometry:
		// NgtsText3D crea la geometría cuando la fuente resuelve (y la recrea al cambiar
		// member/theme), y ese attach bumpea la signal nonObjects del instance state del mesh (mismo
		// mecanismo interno que usa NgtsCenter); la lectura de esa signal va dentro de fitTextMeshes,
		// invocada de forma síncrona desde aquí, así que sigue trackeada.
		effect(() => {
			this.fitTextMeshes(this.textNodes().map((text) => text.meshRef().nativeElement));
		});
	}

	/**
	 * Ancla y encaja cada texto del frente sobre su slot de `BADGE_TEXT_LAYOUT`. Los `meshes` llegan
	 * en el orden del template (`@for` sobre `textSlots()`), que es el del layout: el pareado es por
	 * índice, con guarda por si el `viewChildren` va por delante del computed.
	 *
	 * Orden de las operaciones, que es lo que exige la spec (R3):
	 * 1. se mide el bbox LOCAL de la geometría (no lo afecta el `scale` ya aplicado → sin feedback);
	 * 2. se reduce con escala UNIFORME (`setScalar`, un único factor de `fitTextScale`): comprimir
	 *    solo en X deformaría la tipografía y está prohibido por la spec;
	 * 3. el offset de alineado se calcula sobre el ancho YA ESCALADO (`width * scale`), porque el mesh
	 *    se reduce alrededor de su origen y con el ancho crudo el texto se despegaría de su anchor.
	 */
	private fitTextMeshes(meshes: readonly Mesh[]): void {
		const slots = this.textSlots();
		meshes.forEach((mesh, index) => {
			const slot = slots[index]?.slot;
			if (!slot) {
				return;
			}
			getInstanceState(mesh)?.nonObjects();
			const geometry = mesh.geometry;
			geometry.computeBoundingBox();
			const box = geometry.boundingBox;
			const width = box ? box.max.x - box.min.x : Number.NaN;
			const scale = fitTextScale(width, slot.maxWidth);
			mesh.scale.setScalar(scale);
			const [anchorX, anchorY] = uvAnchorToRtPosition(slot.anchor, BADGE_FRONT_FACE);
			mesh.position.set(
				anchorX + alignOffsetX(width * scale, slot.align),
				anchorY,
				BADGE_TEXTURE.textLayerZ,
			);
		});
	}
}

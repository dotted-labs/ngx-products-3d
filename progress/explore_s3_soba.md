# Explore S3 — angular-three-soba v4.2.3 / three 0.182 — contratos de API

> Verificado contra `angular-three-soba@4.2.3`, `angular-three` (peer), `three-stdlib@2.36.1`.
> Los tipos van empaquetados por subpath en `node_modules/angular-three-soba/types/angular-three-soba-<subpath>.d.ts`.

## 1. loaders (`types/angular-three-soba-loaders.d.ts`)

### `gltfResource` — loaders.d.ts:326-350
```ts
declare function gltfResource<
  TGLTF extends GLTF | GLTF[] | Record<string, GLTF> = GLTF,
  TUrl  extends string | string[] | Record<string, string> = GLTFUrl<TGLTF>
>(input: () => TUrl, opts?: {
  useDraco?: boolean | string;   // default true
  useMeshOpt?: boolean;          // default true
  injector?: Injector;
  extensions?: (loader: GLTFLoader) => void;
  onLoad?: (data: GLTFObjectMap<TGLTF, TUrl>) => void;
}): ResourceRef<GLTFObjectMap<TGLTF, TUrl> | undefined> & {
  scene: Signal<GLTFObjectSceneMap<TGLTF, TUrl> | null>;
};
// namespace: gltfResource.preload(url, opts?), gltfResource.setDecoderPath(path)
```
- Devuelve un **`ResourceRef`** de Angular (+ signal extra `.scene`). Consumir vía **`.value()`** (undefined hasta cargar). También `.status()`, `.error()`, `.isLoading()`.
- `GLTFObjectMap` (single-url) = `GLTF & NgtObjectMap`. `NgtObjectMap` (angular-three.d.ts:1020): `{ nodes: Record<string,Object3D>, materials: Record<string,Material>, meshes: Record<string,Mesh>, [k]:any }`.
- Gate en template: `@if (gltf.value(); as data) { ... }` o `@if (gltf.scene(); as scene) { <ngt-primitive *args="[scene]" /> }`.
- Tipado: `gltfResource<BadgeGLTF>(() => url)` con `TGLTF extends GLTF` de nodos/materiales tipados.
- Draco: `useDraco` default true → `gltfResource.setDecoderPath(...)` si se usa. Alias deprecated: `injectGLTF`.

### `textureResource` — loaders.d.ts:584-592
```ts
declare function textureResource<TUrl extends string[]|string|Record<string,string>>(
  input: () => TUrl,
  opts?: { onLoad?: (r: NgtLoaderResults<TUrl, Texture>) => void; injector?: Injector },
): ResourceRef<NgtLoaderResults<TUrl, Texture> | undefined>;
// namespace: textureResource.preload(url)
```
- `ResourceRef`; consumir vía **`.value()`**. single string → `Texture`.
- **No hay opción** para wrapS/wrapT/colorSpace: mutar la textura resuelta en un `effect`:
```ts
effect(() => {
  const tex = texture.value();
  if (!tex) return;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
});
```
- También existe `fontResource` (loaders.d.ts:152) → `ResourceRef<Font|undefined>`; `NgtsFontInput = string | FontData`.

## 2. NgtsRenderTexture (`types/angular-three-soba-staging.d.ts`)

- **Export TUPLA**, no un componente suelto — staging.d.ts:2169:
  `declare const NgtsRenderTexture: readonly [NgtsRenderTextureImpl, NgtsRenderTextureContent];`
  Importar `NgtsRenderTexture` en `imports` (spread de componente + directiva de contenido).
- Componente `NgtsRenderTextureImpl` — selector **`ngts-render-texture`** (staging.d.ts:2130). Inputs: `attach` (NgtAttachable, atributo) y `options`.
- Contenido = **directiva estructural** `NgtsRenderTextureContent`, selector **`ng-template[renderTextureContent]`** (staging.d.ts:2093). **NO hay `cameraContent`**: la cámara va DENTRO del template de contenido.
- `attach="map"` → ataca el FBO como `.map` del material (también `envMap`/`alphaMap`).
- `NgtsRenderTextureOptions` (staging.d.ts:2009): `width?`, `height?`, `samples`(8), `stencilBuffer`(false), `depthBuffer`(true), `generateMipmaps`(false), `renderPriority`(0), `eventPriority`(0), **`frames`(default Infinity; `frames:1` = render estático único ✔)**, `compute?`, + props de `ngt-texture`.

**Uso canónico (JSDoc staging.d.ts:2113):**
```html
<ngt-mesh-physical-material>
  <ngts-render-texture attach="map" [options]="{ frames: 1, width: 2000, height: 2000 }">
    <ng-template renderTextureContent>
      <!-- cámara + escena secundaria aquí -->
    </ng-template>
  </ngts-render-texture>
</ngt-mesh-physical-material>
```

## 3. NgtsText3D (`types/angular-three-soba-abstractions.d.ts`)

- Clase `NgtsText3D` (abstractions.d.ts:1415). Selector **`ngts-text-3d,ngts-text-3D`**.
- Inputs: `font` (**required**, `NgtsFontInput = string|FontData`, URL al typeface.json como atributo), `text` (**required**), `options`.
- `NgtsText3DOptions extends Omit<TextGeometryParameters,'font'>` (abstractions.d.ts:1370): + `bevelSegments`(4), `smooth?`. Heredados: `size?`, `height?`, `curveSegments?`, `bevelEnabled?`, `bevelThickness?`, `bevelSize?`, `lineHeight?`, `letterSpacing?`.
- Material por content projection (`["*"]`): `<ngt-mesh-standard-material>` dentro.
- **Medición bbox (para nombre largo)**: sin evento directo. `meshRef: Signal<ElementRef<Mesh>>` (abstractions.d.ts:1432) →
```ts
const mesh = text3d.meshRef().nativeElement;
mesh.geometry.computeBoundingBox();
const w = mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).x;
```
  En un `effect`/`afterNextRender` gateado a que la fuente esté cargada (la geometría es async).

## 4. NgtsEnvironment + NgtsLightformer (`types/angular-three-soba-staging.d.ts`)

### NgtsEnvironment — staging.d.ts:1446
- Selector **`ngts-environment`**. Input `options`; output `envSet`. Content projection `["content"]` (portal).
- `NgtsEnvironmentOptions` (staging.d.ts:1233): `frames?`(1), `resolution?`(256), `background?: boolean|'only'`(false), **`blur?` DEPRECATED → usar `backgroundBlurriness?`(0)**, `backgroundIntensity?`(1), `environmentIntensity?`(1), `backgroundRotation?`/`environmentRotation?`, `map?`, `preset?`, `scene?`, `ground?`.
- `preset?: NgtsEnvironmentPresets` (apartment/city/dawn/forest/lobby/night/park/studio/sunset/warehouse) → **resuelve HDRs desde CDN externo (githack), requiere red**. Para reflejos con lightformers propios NO se usa preset: los lightformers se proyectan como hijos del environment (sin red).

### NgtsLightformer — staging.d.ts:1585
- Selector **`ngts-lightformer`**. Input `options`.
- `NgtsLightformerOptions` (staging.d.ts:1541): `map?`, `toneMapped`(false), `color`('white'), `form: 'circle'|'ring'|'rect'`('rect'), `scale: number|[n,n]|[n,n,n]`(1), `intensity`(1), `target?`. `position`/`rotation` vía el spread `NgtThreeElement<Mesh>` dentro de `options` (`scale` va aparte).

## 5. NgtsRoundedBox (`types/angular-three-soba-abstractions.d.ts`)

- Clase `NgtsRoundedBox` (abstractions.d.ts:1140). Selector **`ngts-rounded-box`**. Input `options`; material por `["*"]`.
- `NgtsRoundedBoxOptions extends Partial<ngt-mesh>` (abstractions.d.ts:1076): `width`(1), `height`(1), `depth`(1), `radius`(0.05), `smoothness`(4), `bevelSegments`(4), `steps`(1), `creaseAngle`(0.4). Expone `meshRef`, `geometryRef`.

## 6. Escalado de nombre largo — Resize vs Center vs manual

- **`NgtsResize` NO existe en soba v4.2.3** (grep en todo `types/` → 0 matches). No planificar con él.
- **`NgtsCenter` existe** — en **staging** (staging.d.ts:653). Selector **`ngts-center`**. Output **`centered: OutputEmitterRef<NgtsCenterState>`** con `{ width, height, depth, boundingBox, boundingSphere, center, ... }` → centra Y da medidas para fit.
- **Patrón manual recomendado** (sin Resize):
```ts
const w = mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).x;
const scale = w > 0 ? Math.min(1, maxWidth / w) : 1;
mesh.scale.setScalar(scale);
```

## Decisiones / recomendaciones

1. **RenderTexture**: importar la tupla `NgtsRenderTexture`; contenido en `<ng-template renderTextureContent>`; `attach="map"`; **`[options]="{ frames: 1, width, height }"` para render estático** (el frente no anima) → invalidar al cambiar member/theme.
2. **gltf/texture**: son `ResourceRef` → gate a `.value()`; mutar wrap/colorSpace de la textura en `effect` tras resolver.
3. **Text3D**: medir bbox vía `meshRef().nativeElement.geometry.computeBoundingBox()` en effect gateado a fuente cargada; escalar a `maxWidth`.
4. **Resize**: no existe → patrón manual o `ngts-center` (evento `centered` con `width`).
5. **RoundedBox**: `ngts-rounded-box` + material proyectado = fallback procedural sólido de la tarjeta.
6. **Environment/Lightformer**: usar `backgroundBlurriness` (no `blur`); reflejos con lightformers como hijos (sin preset → sin CDN/red). `form/color/intensity/scale/position` por lightformer.

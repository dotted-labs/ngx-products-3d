# Spike notes — spec-03 Fase 0 (S3)

> Salida consolidada del spike S3. Detalle línea a línea en `progress/explore_s3_soba.md`
> (APIs soba) y `progress/explore_s3_glb.md` (contrato GLB).
>
> Verificado el 2026-07-10 sobre: `angular-three-soba@4.2.3`, `angular-three@4.2.3`,
> `three@0.182.0`, `three-stdlib@2.36.1`.

## Resumen ejecutivo (decisiones que desbloquean las features 2+)

| Tema | Decisión |
|---|---|
| **GLB (`card.glb`)** | ⚠️→✅ El asset original era un placeholder de texto de 116 B. **RESUELTO**: se generó un `card.glb` real con three.js `GLTFExporter` (222 KB, sin Draco) que **cumple el contrato** (nodos `card`/`clip`/`clamp`, materiales `base`→card / `metal`→clip+clamp, origen en el anclaje del clip, tarjeta 1.6×2.25×0.02 en y=-1.45). → **feature 2 va con GLB REAL** (no procedural). Ver `progress/asset_card_glb.md`. Sustituible por el modelo de Blender de autor sin tocar código cuando llegue. |
| **RenderTexture** | `NgtsRenderTexture` es una **tupla** `[componente, directiva]`; contenido en `<ng-template renderTextureContent>`; `attach="map"`; **`frames: 1` = render estático** ✔ (invalidar al cambiar member/theme). |
| **gltf/texture loaders** | Son `ResourceRef` de Angular → gate a **`.value()`**; wrap/colorSpace se mutan en `effect` tras resolver (no hay opción). |
| **Text3D** | `ngts-text-3d`, inputs `font`(URL typeface, required) + `text`(required); medición de bbox manual vía `meshRef().nativeElement.geometry.computeBoundingBox()`. |
| **Nombre largo (Resize)** | **`NgtsResize` NO existe** en soba v4 → patrón manual `computeBoundingBox()`+`scale`, o `ngts-center` (evento `centered` con `width`). |
| **Environment/Lightformer** | `ngts-environment` (usar **`backgroundBlurriness`**, NO `blur` deprecated) con `ngts-lightformer` hijos; sin preset → **sin CDN/red**. |

## S3.1 — APIs soba v4 (firmas exactas → `progress/explore_s3_soba.md`)

Todas las APIs que spec-03 necesita EXISTEN en soba v4.2.3, en estos subpaths:
- `angular-three-soba/loaders`: `gltfResource`, `textureResource`, `fontResource`.
- `angular-three-soba/staging`: `NgtsRenderTexture` (tupla), `NgtsEnvironment`, `NgtsLightformer`, `NgtsCenter`.
- `angular-three-soba/abstractions`: `NgtsText3D`, `NgtsRoundedBox`.

Puntos que corrigen supuestos de la spec/feature_list:
- **`NgtsRenderTexture` se importa como tupla** (spread de componente + directiva de contenido); la directiva es `renderTextureContent` sobre un `<ng-template>`; **no hay `cameraContent`** (la cámara va dentro del template). `attach="map"` (atributo).
- **`frames: 1`** confirmado para render estático (la spec lo daba como condicional "si soba permite" → SÍ permite). Feature 7 debe usarlo + invalidar en cambios de member/theme.
- **`blur` de Environment está deprecated** → feature 5 usa **`backgroundBlurriness`** (la spec decía `blur=0.75`). Los reflejos vienen de los `ngts-lightformer` hijos, sin `preset` (evita dependencia de red a CDN de HDRs).
- **`NgtsResize` no existe** → feature 6 (ajuste de nombre largo) usa medición manual de bbox o `ngts-center`.
- loaders devuelven `ResourceRef` (`.value()`), no un signal simple; wrap/colorSpace de texturas se aplican en `effect` post-resolución.

## S3.2 — Contrato del GLB (→ `progress/explore_s3_glb.md`)

`projects/products-3d-playground/public/assets/card.glb` **no es un GLB**: fichero de texto de 116 bytes
(`"Placeholder GLB for playground demo. Replace with card model matching the GLB contract
(nodes: card, clip, clamp)."`). Magic `Plac` en vez de `glTF`. Sin nodos/meshes/materiales/Draco.
No existe ningún modelo 3D real en el repo.

**ACTUALIZACIÓN (2026-07-10, tras el spike):** el placeholder se sustituyó por un **GLB real
generado con three.js** (`GLTFExporter`, binary) que cumple el contrato — validado de forma
independiente por el leader: magic `glTF`, `nodes: [card, clip, clamp]`, `materials: [base, metal]`,
asignación card→base / clip→metal / clamp→metal, sin Draco, 222 KB. Detalle en
`progress/asset_card_glb.md`. **Por tanto feature 2 usa el GLB real vía `gltfResource<BadgeGLTF>`,
NO geometría procedural.** El texto siguiente (decisión C procedural) queda como plan de contingencia
histórico por si se quisiera prescindir del asset.

~~**Decisión (C) — geometría procedural provisional**~~ (contingencia, ya no activa — la spec lo permitía:
"procedural eliminado o marcado provisional si Blender pendiente"):
- **Tarjeta (`card`)**: `NgtsRoundedBox` con proporción ≈ 16:22.5 (base collider `[0.8,1.125]` × escala grupo ~2.25),
  `MeshPhysicalMaterial` con `BADGE_MATERIAL_DEFAULTS` → hace de material `base`, recibe la RenderTexture en Fase 4.
- **Clip/clamp**: torus con material metálico compartido (`metal`), metalness alto/roughness bajo, tinte opcional `theme.colors.clip`.
- **Origen**: grupo situado para que el anclaje coincida con `BADGE_PHYSICS.cardJointAnchor` sin offsets mágicos.
- Mantener tipo `BadgeGLTF` (nodos `card/clip/clamp`, materiales `base/metal`) y estructura → swap trivial al llegar el GLB real.
- **Seguimiento (fuera del spike)**: cuando Blender entregue, re-inspeccionar con GLTFLoader/parseo del chunk JSON, validar nombres exactos y documentar Draco.

## ⚠️ Gotcha de tipado con loaders de soba bajo pnpm (three-stdlib no hoisteado) — descubierto en feature 2

`gltfResource<TGLTF>` (y análogamente `textureResource`) referencian tipos de **`three-stdlib`**
(`GLTF`, `Font`, etc.) en sus firmas (`angular-three-soba/types/...-loaders.d.ts:7`). Bajo **pnpm**,
`three-stdlib` es dep transitiva de soba y **NO está hoisteada** al `node_modules` raíz:
- `import type { GLTF } from 'three-stdlib'` → **TS2307** (no resuelve).
- Pasar `gltfResource<BadgeGLTF extends GLTF>` o derivar el tipo del recurso arrastra el nombre
  `GLTF` (de three-stdlib) a los `.d.ts` emitidos por la lib → **TS2742** ("inferred type cannot
  be named without a reference to three-stdlib"), que **ng-packagr trata como error** → rompe `pnpm build`.

**Patrón correcto (usado en feature 2, reutilizar en 3/6/7):** definir un contrato PROPIO con tipos
de `three` (peer, nombrable) y castear el `ResourceRef`:
```ts
interface BadgeGLTF {
  nodes: { card: Mesh; clip: Object3D; clamp: Object3D };
  materials: { base: Material; metal: Material };
}
protected readonly gltf = gltfResource(() => this.config.cardModelUrl) as unknown as
  ResourceRef<BadgeGLTF | undefined>;
```
- Cast seguro: en runtime el objeto ES un `ResourceRef` y `.value()` = `GLTF & NgtObjectMap`
  (estructuralmente tiene `nodes`/`materials`); el `card.glb` real cumple el contrato.
- Sin `any`. Contrato **interno** (no exportado) → no publica tipos three-stdlib no nombrables.
- Para `textureResource` en features 4/6: mismo patrón si el tipo filtra; si solo se consume
  `.value()` como `Texture` (de `three`), suele bastar sin cast.

## Impacto en el feature_list

- **Feature 2** (`badge-gltf-loading`): rama procedural del propio enunciado; mantiene `gltfResource`/`BadgeGLTF` cableado (aunque provisional apunte a geometría procedural) para el swap. Marcar geometría como provisional en código.
- **Feature 5** (`badge-lighting`): `backgroundBlurriness` en vez de `blur`; lightformers sin preset.
- **Feature 6** (`badge-texture-scene`): ajuste de nombre largo por bbox manual / `ngts-center` (no Resize).
- **Feature 7** (`badge-rendertexture-map`): tupla `NgtsRenderTexture` + `<ng-template renderTextureContent>` + `attach="map"` + `frames:1`.

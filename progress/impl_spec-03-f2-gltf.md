# Impl — spec-03 feature 2 `badge-gltf-loading`

Estado: implementado, verificación N1+N2 verde. Pendiente review + smoke N3.

## Alcance

Sustituir el plano placeholder blanco (spec-02) de la tarjeta por la geometría real del
`card.glb`, cargada con `gltfResource`, condicionada a recurso resuelto. Física (cuboid
collider + cadena rope/spherical joints) INTACTA. Sin material físico (feature 3), textura
de banda (4), lighting (5) ni RenderTexture (7).

## Archivos tocados

- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` — tipo `BadgeGLTF`,
  carga del GLB, render condicionado, `cardAnchor`.
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` — provider de
  `PRODUCTS_3D_CONFIG`, `vi.mock` de `angular-three-soba/loaders`, ajuste/añadido de tests.

No se tocó `badge.config.ts` (ver nota sobre `BADGE_CARD_PLACEHOLDER`), ni el playground, ni
`types.ts`/`tokens.ts`.

## Cómo tipé `BadgeGLTF` (y la discrepancia con el spike)

La firma real es `gltfResource<TGLTF extends GLTF | GLTF[] | Record<string,GLTF>>(input)`
(soba/loaders.d.ts:326) → `ResourceRef<GLTFObjectMap<TGLTF,TUrl> | undefined>` con
`GLTFObjectMap<GLTF,string> = GLTF & NgtObjectMap` y
`NgtObjectMap = { nodes: Record<string,Object3D>; materials: Record<string,Material>; meshes: Record<string,Mesh>; [k]:any }`
(angular-three.d.ts:1020). El `GLTF` es el de **three-stdlib** (loaders.d.ts:7).

**Discrepancia bloqueante spec↔API real (gana la API):** el spike proponía
`gltfResource<BadgeGLTF>(() => url)` con `BadgeGLTF extends GLTF`. Bajo pnpm, `three-stdlib`
es dep transitiva de soba y NO está hoisteada al `node_modules` raíz:
`require.resolve('three-stdlib')` falla desde la raíz y desde `src/lib/badge`. Consecuencias:
- `import type { GLTF } from 'three-stdlib'` → TS2307 (no resuelve).
- Derivar el tipo del propio `gltfResource` (o pasar `<BadgeGLTF extends GLTF>`) arrastra el
  nombre `GLTF` de three-stdlib a los `.d.ts` emitidos por la lib → **TS2742** ("inferred
  type cannot be named without a reference to three-stdlib"), que ng-packagr trata como error.
  Verificado: el primer intento (tipo derivado) rompió `pnpm build` con TS2742 + inferencia
  `TGLTF = never`.

**Solución adoptada** (interna, no API pública, en el propio componente):

```ts
interface BadgeGLTF {
	nodes: { card: Mesh; clip: Object3D; clamp: Object3D };
	materials: { base: Material; metal: Material };
}

protected readonly gltf = gltfResource(() => this.config.cardModelUrl) as unknown as ResourceRef<
	BadgeGLTF | undefined
>;
```

- `BadgeGLTF` es un contrato propio (no extiende `GLTF`), solo modela lo que consume el
  componente. `Mesh/Object3D/Material` vienen de `three` (peer, nombrable).
- Se llama `gltfResource(...)` sin genérico (default `GLTF`) y se castea el `ResourceRef` a
  `ResourceRef<BadgeGLTF | undefined>` (de `@angular/core`, nombrable). El cast es seguro: en
  runtime el objeto ES un `ResourceRef` y `.value()` devuelve `GLTF & NgtObjectMap`, que
  estructuralmente tiene `nodes.card/clip/clamp` + `materials.base/metal` (el card.glb real
  cumple el contrato, validado en el spike S3).
- `data.nodes.card` queda tipado como `Mesh` sin `any` y compatible con
  `noPropertyAccessFromIndexSignature` (props explícitas, no vía index signature).

Coloqué `BadgeGLTF` **interno al componente** (no en `types.ts` ni exportado): es un detalle
de implementación del render, no un contrato público (el contrato del GLB para autores del
modelo se documentará en el README, feature 10). Justificación: exponerlo obligaría a la lib
a publicar tipos three-stdlib no nombrables.

> Recomendación para actualizar el spike/spec: el patrón `gltfResource<BadgeGLTF extends GLTF>`
> no es viable en esta topología pnpm sin declarar `three-stdlib` como peer. Documentar el
> patrón cast a `ResourceRef<ContratoPropio | undefined>` para features 3 y 7.

## Patrón de render condicionado (sin flash)

Dentro del `<ngt-object3D #cardBody>` (mismo body físico de spec-02), tras el
`<ngt-object3D [cuboidCollider]>`:

```html
@if (gltf.value(); as data) {
	<ngt-group [position]="cardAnchor">
		<ngt-primitive *args="[data.nodes.card]" />
		<ngt-primitive *args="[data.nodes.clip]" />
		<ngt-primitive *args="[data.nodes.clamp]" />
	</ngt-group>
}
```

- El `@if` sobre `gltf.value()` garantiza que nada de la tarjeta se monta hasta que el recurso
  resuelve → sin flash de escena sin cargar (criterio de aceptación).
- `<ngt-primitive *args="[obj]">` inserta directamente los `Object3D` del GLB, conservando sus
  materiales del propio modelo (`base` en card, `metal` en clip/clamp) — suficiente para esta
  feature (geometría visible); el `meshPhysicalMaterial`/tinte llegan en feature 3. Se eligió
  primitivas por-nodo (no `data.scene`) para que features 3/7 puedan targetear `card` aparte.
- `NgtArgs` (`*args`) ya estaba en `imports`; `<ngt-group>`/`<ngt-primitive>` van por
  `CUSTOM_ELEMENTS_SCHEMA` (ya presente).

## Física intacta + origen sin números mágicos

Los bodies (`fixed/j1/j2/j3/cardBody`), colliders, rope/spherical joints y todo `beforeRender`
NO se tocaron. La geometría visual cuelga DENTRO de `cardBody`, como el placeholder anterior.

El card.glb tiene su origen en el anclaje del clip y la tarjeta centrada en y=-1.45 (spike). El
grupo del GLB se posiciona en `cardAnchor = BADGE_PHYSICS.cardJointAnchor` (`[0, 1.45, 0]`):
- clip (y=0 en el GLB) → y=1.45 en el body = punto del spherical joint (`cardJointData.body2Anchor`).
- centro de la tarjeta (y=-1.45 en el GLB) → y=0 en el body = origen del cuboid collider.

Es decir, el offset del grupo es exactamente el anchor ya existente en config: **cero
constantes nuevas**. Añadí `protected readonly cardAnchor = BADGE_PHYSICS.cardJointAnchor;`
(reusa la constante, no la duplica).

`cardModelUrl` se lee de `inject(PRODUCTS_3D_CONFIG)` → `gltfResource(() => this.config.cardModelUrl)`.
Cero URLs hardcodeadas.

## Limpieza del placeholder

Eliminados del componente: mesh `<ngt-plane-geometry>` + `<ngt-mesh-basic-material>`, campos
`placeholder`, `cardPlaneArgs`, `doubleSide`, e imports `DoubleSide` y `BADGE_CARD_PLACEHOLDER`.
La constante `BADGE_CARD_PLACEHOLDER` se **mantiene** en `badge.config.ts` porque está
re-exportada por `public-api.ts` (API pública); eliminarla sería un cambio breaking fuera de
alcance. Queda sin consumidores internos.

## Neutralización de `gltfResource` en tests (jsdom, sin WebGL)

`gltfResource` usa el `resource()` de Angular con un loader que hace `GLTFLoader.load(url)` →
fetch. En jsdom no debe cargar el GLB. Se neutraliza con `vi.mock` del módulo completo:

```ts
const gltfMock = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock('angular-three-soba/loaders', () => ({
	gltfResource: (input: () => string) => {
		gltfMock.urls.push(input());
		return { value: () => undefined, scene: () => null };
	},
}));
```

- `vi.hoisted` expone `gltfMock` dentro de la factory izada (regla de vitest).
- `value()` = `undefined` simula "recurso sin resolver" → el `@if` no monta nada.
- Se captura la URL que el componente deriva del config para verificar que NO está hardcodeada.
- `PRODUCTS_3D_CONFIG` se provee en el `TestBed` (`{ cardModelUrl: '/assets/card.glb' }`).
- `vi` está disponible como global (`vitest/globals` en `tsconfig.spec.json`).
- El template se sigue sobreescribiendo a `''` (no se testea render 3D), como ya hacía el spec.

## Tests añadidos/ajustados (`badge-scene.component.spec.ts`)

- `SceneInternals`: fuera `placeholder`/`cardPlaneArgs`; dentro `cardAnchor`, `gltf`.
- Ajustado `takes body positions and card placeholder values...` → `takes body positions from
  badge.config` (solo `layout`; los asserts de placeholder ya no aplican).
- Nuevo `positions the GLB visual group at the clip anchor (BADGE_PHYSICS.cardJointAnchor)`:
  `cardAnchor === BADGE_PHYSICS.cardJointAnchor === cardJointData.body2Anchor`.
- Nuevo `loads the card GLB from PRODUCTS_3D_CONFIG.cardModelUrl (no hardcoded URL)`: la URL
  pasada a `gltfResource` proviene del token de config; `gltf.value()` es `undefined` (gate).

## Verificación (N1 + N2)

- `pnpm build` → OK (FESM + DTS, sin TS2742/errores). 5.4s.
- `pnpm ng lint ngx-products-3d` → "All files pass linting."
- `pnpm ng test ngx-products-3d` → **38 passed (38)**, 5 test files, todos verdes (antes 36;
  +2 netos por los tests nuevos).
- `pnpm ng build products-3d-playground` → OK (integración, sin deep imports rotos). 26.7s.

## Checklist N3 pendiente (smoke visual/físico — no ejecutable por el implementer)

En `pnpm start:playground`:
- [ ] La tarjeta muestra la geometría del GLB (tarjeta + clip + clamp), no el plano blanco.
- [ ] La tarjeta cuelga de la cadena y el clip queda en el punto de unión con la correa
      (sin offset/salto de 1.45 respecto al collider).
- [ ] No hay flash de escena a medio cargar antes de que resuelva el GLB.
- [ ] Física intacta: drag sigue el puntero, al soltar cae y oscila, cadena reacciona
      (regresión spec-02).
- [ ] Sin errores de carga del GLB en consola (`/assets/card.glb` 200).

## Notas para features siguientes

- Feature 3 (material físico): sustituir `<ngt-primitive *args="[data.nodes.card]">` por
  `<ngt-mesh [geometry]="data.nodes.card.geometry">` con `<ngt-mesh-physical-material>`; para
  clip/clamp teñir clonando `data.materials.metal`.
- El patrón de tipado (`ResourceRef<ContratoPropio | undefined>` + cast) debe reutilizarse en
  features 3/6/7 con `textureResource` para evitar el mismo TS2742.

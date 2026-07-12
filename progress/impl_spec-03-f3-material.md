# Impl spec-03 F3 — `badge-physical-material` (pendiente review)

Feature 3 (id 3, `in_progress`). Material físico de la tarjeta (clearcoat) + metal del clip/clamp.
Depende de feature 2 (GLB cargado). Sin scope creep (nada de band texture/lighting/RenderTexture).

## Archivos tocados

- **NUEVO** `projects/ngx-products-3d/src/lib/badge/badge-material.ts` — lógica pura.
- **NUEVO** `projects/ngx-products-3d/src/lib/badge/badge-material.spec.ts` — tests N1.
- `projects/ngx-products-3d/src/lib/badge/badge.config.ts` — nueva const `BADGE_MAP_ANISOTROPY`.
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` — material físico de la
  tarjeta, effect de tinte del metal, `materialOpts` computed, `mapAnisotropy` field, tipos.
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` — mock/tests de
  `materialOpts()`.

## Lógica pura (`badge-material.ts`)

- `mergeMaterialOptions(defaults, override?)`: merge inmutable campo a campo con `?? default`.
  Devuelve objeto nuevo (no muta `defaults`). Usa `??` (no `||`) → un override explícito de `0`
  (p.ej. `clearcoat: 0`) se respeta como valor, no cae a default (test dedicado).
- `tintMetalMaterial(metal, color)`: `metal.clone()` + `clone.color.set(color)`; devuelve el clon,
  no muta el original. Tipado `MeshStandardMaterial` (de `three`, nombrable → sin TS2742).

## Material físico de la tarjeta (card)

- Sustituido `<ngt-primitive *args="[data.nodes.card]">` por
  `<ngt-mesh [geometry]="data.nodes.card.geometry"> <ngt-mesh-physical-material .../> </ngt-mesh>`.
  El material `base` del GLB se descarta a propósito (lo reemplaza el physical material; el `map`
  del frente llega en la feature 7).
- **Transformación preservada**: el nodo `card` del GLB tiene su offset en el *node transform*
  (`position.set(0, -1.45, 0)`), no en la geometría (RoundedBoxGeometry va centrada en el origen —
  verificado en el generador del asset, `progress/asset_card_glb.md`). Un `<ngt-mesh>` fresco parte
  en el origen del grupo, así que bindeo `[position]`/`[quaternion]`/`[scale]` del nodo card para
  no desalinear la tarjeta respecto al cuboid collider. (El `<ngt-primitive>` anterior lo preservaba
  gratis por envolver el propio objeto.) `[quaternion]`/`[scale]` son identidad hoy pero se bindean
  por robustez ante un futuro GLB de Blender con TRS.
- `materialOpts()` = `computed(() => mergeMaterialOptions(BADGE_MATERIAL_DEFAULTS, this.theme().material))`.
  Reactivo a `theme()`; el template bindea clearcoat/clearcoatRoughness/roughness/metalness/
  iridescence/iridescenceIOR desde él. Memoizado (llamadas repetidas en template = mismo objeto).

## Metal del clip/clamp + tinte (mecanismo reactivo)

- clip/clamp siguen como `<ngt-primitive *args>`. El material se aplica **por código en un effect**
  gateado a `gltf.value()` + `theme()`:
  - sin `theme.colors.clip` → `data.materials.metal` original (idempotente).
  - con color → `tintMetalMaterial(metal, color)` (clon teñido) asignado a `clip.material` y
    `clamp.material`.
- **Por qué clonar**: el GLB comparte la misma instancia `metal` entre clip y clamp y la cachea entre
  recargas; mutar el original `.color` filtraría el tinte a otros usos y persistiría. El clon se
  asigna directamente al `.material` del objeto THREE que el primitive ya renderiza (mismo ref → el
  renderer lo recoge el frame siguiente; no hace falta re-attach ni binding en template).
- **Sin fugas**: `onCleanup(() => tinted.dispose())` libera el clon anterior al cambiar `theme` o al
  destruir. Un solo clon vivo a la vez.

## `mapAnisotropy` (dónde vive el 16) — discrepancia spec ↔ API real documentada

- El `16` vive en `BADGE_MAP_ANISOTROPY` (const nueva en `badge.config.ts`, con JSDoc). Fuera de
  `BADGE_MATERIAL_DEFAULTS` a propósito: la anisotropía es propiedad de la **textura** (`map`), no de
  `MeshPhysicalMaterial`, y `BADGE_MATERIAL_DEFAULTS` refleja exactamente `BadgePhysicalMaterialOptions`.
- Bindeo `[mapAnisotropy]="mapAnisotropy"` en el material (como pide la spec, sin número mágico suelto).
  **Caveat verificado en `node_modules`**: angular-three v4 (`applyProps`/`resolveInstanceKey`,
  `angular-three.mjs`) solo hace *pierced props* con notación de punto (`map.anisotropy`), no
  camelCase. Con `mapAnisotropy` (camelCase) escribe un `material.mapAnisotropy` inocuo que three
  ignora, y con `map.anisotropy` **crashea** porque `material.map` es `null` en esta feature (no hay
  map hasta la feature 7). Por eso hoy es un no-op inofensivo. **Acción para feature 7**: cuando monte
  la RenderTexture como `map`, debe aplicar `BADGE_MAP_ANISOTROPY` a la textura real (p.ej.
  `map.anisotropy` sobre el objeto textura, o en el effect post-resolución), no confiar en este binding.

## Tipos

- `BadgeGLTF`: `clip`/`clamp` pasan de `Object3D` a `Mesh` (son meshes con material `metal`; permite
  asignar `.material` sin cast). `materials.metal` pasa de `Material` a `MeshStandardMaterial`
  (permite `.clone()` + `.color.set()` tipados). Ambos tipos de `three` → nombrables, sin TS2742
  (build verde lo confirma). `Object3D` ya no se importa.

## Tests añadidos (N1)

- `badge-material.spec.ts`:
  - `mergeMaterialOptions`: (a) sin override = defaults verbatim; (b) override parcial (`roughness`)
    cambia solo ese campo; (c) override total reemplaza todo; (d) override explícito de `0`; (e) no
    muta `defaults` y devuelve objeto nuevo.
  - `tintMetalMaterial`: clona (ref distinta), tiñe el clon a `0xff0000`, deja el original en
    `0xcccccc`.
- `badge-scene.component.spec.ts` (mantiene los previos verdes): `materialOpts()` = defaults cuando
  `theme.material` ausente; override parcial de `theme.material` gana sobre defaults. Añadida entrada
  `materialOpts` a `SceneInternals`. El mock de `gltfResource` sigue con `value() => undefined`, así
  que el effect de tinte del metal hace early-return (no toca nodos) → sin cambios de shape del mock.

## Verificación (N1 + N2) — los cuatro verdes

- `pnpm ng test ngx-products-3d` → **46 passed** (6 test files). (Antes 38; +6 material, +2 componente.)
- `pnpm ng lint ngx-products-3d` → All files pass linting.
- `pnpm build` → Built @dotted-labs/ngx-products-3d (sin TS2742, FESM/DTS OK).
- `pnpm ng build products-3d-playground` → Application bundle generation complete.

## Checklist N3 (smoke visual en playground — NO ejecutable por el implementer)

- [ ] La tarjeta muestra material físico con clearcoat (barrido de reflejo especular sobre el frente).
- [ ] `theme.material` (override parcial, p.ej. `roughness` alto/bajo) cambia el acabado en vivo.
- [ ] `theme.colors.clip` tiñe clip **y** clamp; sin `clip` → gris metálico original del GLB.
- [ ] La tarjeta queda alineada con la cadena (offset y=-1.45 preservado; no flota ni se hunde).
- [ ] Física intacta (cuelga, drag, oscila) — feature 2 sin regresión.
- [ ] (feature 7) recordar aplicar `BADGE_MAP_ANISOTROPY` a la textura real del `map`.

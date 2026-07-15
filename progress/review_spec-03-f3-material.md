# Review — spec-03 F3 `badge-physical-material`

**Veredicto:** APROBADO

Revisado el trabajo del implementer contra los criterios de aceptación (feature id 3),
`docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, `docs/spike-notes-03.md`
y el informe `progress/impl_spec-03-f3-material.md`. Cuatro gates verdes, cero scope creep.

## Verificación ejecutable (Nivel 2) — los cuatro verdes

- `pnpm build` → OK. `Built @dotted-labs/ngx-products-3d` (FESM2022 + DTS, sin TS2742). 3.7 s.
- `pnpm ng lint ngx-products-3d` → `All files pass linting.`
- `pnpm ng test ngx-products-3d` → **46 passed (6 files)**. Coincide con el informe (38→46).
- `pnpm ng build products-3d-playground` → `Application bundle generation complete.` (integración
  de la API pública OK; sin deep imports que rompan boundaries).

### Checks de dist
- `dist/ngx-products-3d/fesm2022/dotted-labs-ngx-products-3d.mjs` presente.
- `package.json`: `sideEffects: false`; peers correctos (angular-three*, three, rapier, meshline,
  ngxtension); única dependency `tslib`. Sin deps fantasma.
- `three-stdlib` NO filtra a tipos: sus únicas apariciones en dist son comentarios JSDoc
  (`types/*.d.ts` líneas 174-176, 243), no `import`/tipos emitidos. Patrón `BadgeGLTF` interno
  funciona como documenta el spike.

## Criterios de aceptación (spec)

- CA1 (tarjeta material físico clearcoat; defaults BADGE_MATERIAL_DEFAULTS mergeados con
  theme.material, override parcial verificable): [x]
  `<ngt-mesh [geometry]="data.nodes.card.geometry">` + `<ngt-mesh-physical-material>` con
  clearcoat/clearcoatRoughness/roughness/metalness/iridescence/iridescenceIOR desde
  `materialOpts()` (computed = `mergeMaterialOptions(BADGE_MATERIAL_DEFAULTS, theme().material)`),
  reactivo a `theme()`. Tests de componente cubren defaults y override parcial (roughness 0.9).

- CA2 (theme.colors.clip tiñe metal sin mutar el material cacheado del GLB — clon): [x]
  Effect (badge-scene.component.ts:308-323) gateado a `gltf.value()` + `theme()`.
  `tintMetalMaterial` CLONA `data.materials.metal` antes de teñir (badge-material.ts:24-26).
  Sin color → material original (idempotente). `onCleanup(() => tinted.dispose())` → un solo clon
  vivo, sin fugas, original compartido intacto. Test tint verifica clon != original y original
  en 0xcccccc tras teñir.

- CA3 (materialOpts() y merge fn pura con test N1: defaults, override parcial, override total): [x]
  `mergeMaterialOptions` inmutable, campo a campo con `??` (respeta override `0`). Tests:
  defaults verbatim, override parcial, override total, override 0 explícito, no muta defaults
  (5 casos) + `materialOpts()` del componente (2 casos).

- CA4/5/6 (build/lint/test verdes): [x] Ver Nivel 2 arriba.

## Checklist de revisión detallada

1. Material físico de la tarjeta: [x] template + binding + computed reactivo correctos.
2. Preservación del transform: [x] `<ngt-group [position]="cardAnchor(=[0,1.45,0])">` con
   `<ngt-mesh>` bindeando `[position]/[quaternion]/[scale]` del nodo card (y=-1.45). Sin doble
   offset: group +1.45 + node -1.45 → tarjeta en 0 (centro del cuboid collider). Cuadra con el
   contrato del GLB (spike/asset). quaternion/scale identidad hoy, bindeados por robustez.
3. Metal clip/clamp + tinte: [x] clona, no muta original, dispose en cleanup.
4. `mapAnisotropy` no-op: [x] ACEPTADO. `[mapAnisotropy]="mapAnisotropy(=16)"` cumple la spec
   literalmente ("mapAnisotropy 16") sin dejar número mágico suelto; el implementer documenta y
   verifica en node_modules que angular-three v4 solo pierce con notación de punto, y que
   `map.anisotropy` crashearía porque `material.map` es null hasta feature 7. No-op inofensivo,
   documentado, con acción de seguimiento explícita para feature 7. Desviación spec↔API real
   documentada correctamente (architecture.md §7). No es motivo de rechazo. SEÑALADO: feature 7
   debe aplicar BADGE_MAP_ANISOTROPY a la textura real y retirar/re-evaluar este binding.
5. Fn pura mergeMaterialOptions: [x] inmutable, `??`, respeta 0, gana campo a campo.
6. Sin scope creep: [x] cero band texture (f4), cero lighting (f5), cero RenderTexture/map (f7).
   El `map` NO se monta aquí. Física intacta (beforeRender/joints/colliders sin tocar).
7. Tipos: [x] BadgeGLTF amplía clip/clamp a `Mesh`, metal a `MeshStandardMaterial` (tipos de
   `three`, nombrables). Object3D ya no se importa. Sin three-stdlib en tipos, sin TS2742, sin `any`.
8. Config: [x] `BADGE_MAP_ANISOTROPY` nuevo con JSDoc; defaults desde `BADGE_MATERIAL_DEFAULTS`.
   Cero números mágicos en el componente.
9. Prettier/imports/orden/zoneless/sin console.log-TODO: [x] lint verde; imports ordenados
   (Angular → three/angular-three* → libs → propios); miembros nuevos ubicados coherentemente
   (materialOpts junto a computed, mapAnisotropy junto a config protected).
10. Tests N1: [x] 46 verdes; badge-material.spec.ts + materialOpts del componente con valores
    concretos.

## Docs

- architecture.md: [x] config data-driven, cero allocations por frame (effect no está en
  beforeRender; sin `new` en el loop), SSR-safe, peers/boundaries OK, no producto→producto,
  errores no aplican aquí, discrepancia API documentada (§7).
- conventions.md: [x] nombres, `as const`, `import type`, orden, OnPush/signals, sin `any`.
- verification.md N1: [x] camino feliz + fallback (override 0, sin theme.material, clone vs original).
- verification.md N2: [x] build/lint/test/playground verdes + checks de dist.
- verification.md N3: [x] (con matiz) checklist N3 ANOTADA en el informe (sección "Checklist N3",
  5 ítems visuales + nota de seguimiento f7). Los ítems están sin marcar porque el smoke visual
  (clearcoat, tinte clip+clamp, alineación, física) NO es ejecutable por el implementer en jsdom
  sin WebGL. Por instrucción explícita del leader (course-correction: "no rechaces por ello, pero
  confirma checklist N3 anotada") NO se rechaza; la ejecución visual queda pendiente en playground
  a cargo del leader/humano antes del cierre definitivo de la feature.

## Archivos declarados vs git

Declarados en el informe (todos verificados): `badge-material.ts` (nuevo), `badge-material.spec.ts`
(nuevo), `badge.config.ts`, `badge-scene.component.ts`, `badge-scene.component.spec.ts`.
Cambios adicionales en el árbol (NO son código de producción de f3, no bloquean): `card.glb`
(binario de feature 2, ya revisado en review_spec-03-f2-gltf.md), `feature_list.json`,
`progress/*` (docs). Ningún archivo de `src/` no declarado tocado por esta feature.

## Cambios requeridos

Ninguno. APROBADO.

## Seguimiento (no bloqueante, para feature 7)

- Aplicar `BADGE_MAP_ANISOTROPY` a la textura real (`map.anisotropy`) al montar la RenderTexture;
  re-evaluar/retirar el binding `[mapAnisotropy]` camelCase (hoy no-op documentado).
- Ejecutar la checklist N3 en playground (clearcoat visible, override live de theme.material,
  tinte clip+clamp vs gris original, alineación tarjeta y=-1.45, física sin regresión).

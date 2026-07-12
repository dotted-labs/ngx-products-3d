# Review — spec-03 F2 `badge-gltf-loading`

**Veredicto:** APROBADO

## Criterios de aceptación (feature_list.json id 2)
- CA1 (geometría del GLB colgando de la cadena; física intacta): [x]
  → `@if (gltf.value(); as data)` monta `<ngt-group [position]="cardAnchor">` con
  primitivas card/clip/clamp dentro de `#cardBody`. Diff confirma que bodies,
  colliders, rope/spherical joints y `beforeRender` NO se tocaron. Smoke visual
  N3 (que la tarjeta cuelga y el clip cae en la unión) queda pendiente de
  ejecución manual — ver nota N3 abajo.
- CA2 (BadgeGLTF tipado; render condicionado a .value(), sin flash): [x]
  → `interface BadgeGLTF { nodes: {card,clip,clamp}; materials: {base,metal} }`;
  el `@if` gatea el montaje hasta que el recurso resuelve.
- CA3 (cardModelUrl desde PRODUCTS_3D_CONFIG; cero URLs hardcodeadas): [x]
  → `gltfResource(() => this.config.cardModelUrl)` con
  `config = inject(PRODUCTS_3D_CONFIG)`. Test dedicado captura la URL derivada.
- CA4 (pnpm build sin errores): [x] — Built @dotted-labs/ngx-products-3d, sin TS2742.
- CA5 (lint sin errores): [x] — "All files pass linting."
- CA6 (test >0 y todos verdes): [x] — 38 passed (38), 5 test files.

## Verificación ejecutable (N2)
- `pnpm build` → OK, FESM+DTS, sin TS2742 (el error que rompía el build ya no aparece). 3.4s.
- `pnpm ng lint ngx-products-3d` → "All files pass linting."
- `pnpm ng test ngx-products-3d` → 38 passed (38).
- `pnpm ng build products-3d-playground` → OK, sin deep imports rotos. 11.1s.
- Dist: `fesm2022/dotted-labs-ngx-products-3d.mjs` presente; `sideEffects: false`;
  `angular-three-soba` ya declarado como peer (la nueva import NO introduce dep
  fantasma); `three-stdlib` correctamente ausente de peers/deps (el objetivo de
  `BadgeGLTF` es no arrastrarlo).

## Validación de la discrepancia spec↔API (obligatorio)
Verificado en `node_modules/angular-three-soba/types/angular-three-soba-loaders.d.ts`:
- L7: `import { Font, GLTF, GLTFLoader } from 'three-stdlib'` → el `GLTF` es de three-stdlib.
- L326-337: `gltfResource<TGLTF extends GLTF ... = GLTF>(...) : ResourceRef<GLTFObjectMap<TGLTF,TUrl> | undefined>`.
- `three-stdlib` NO existe en `node_modules/` raíz (no hoisteado bajo pnpm).
Conclusión: derivar el tipo o usar `<BadgeGLTF extends GLTF>` filtraría el nombre
`GLTF` de three-stdlib a los `.d.ts` emitidos → TS2742. La solución adoptada
(`interface BadgeGLTF` propia con tipos de `three` + `as unknown as
ResourceRef<BadgeGLTF | undefined>`) es correcta y estructuralmente sólida:
`GLTFObjectMap<GLTF,string> = GLTF & NgtObjectMap` expone `nodes`/`materials`, y
el card.glb real cumple el contrato (spike S3). Sin `any`. `BadgeGLTF` interno
(no exportado en public-api.ts) = justificación válida (no publica tipos no
nombrables). Desviación documentada en el informe. ACEPTADA.

## Docs
- architecture.md: [x]
  → Config data-driven: `cardAnchor` reusa `BADGE_PHYSICS.cardJointAnchor`, cero
  números mágicos nuevos. Cero allocations por frame: `beforeRender` intacto, sin
  `new` añadido. Lib ligera: GLB por URL de config, no empaquetado. Boundaries:
  playground compila por import público. Física/textura separadas: sin material
  físico ni RenderTexture (features 3/7).
- conventions.md: [x]
  → Prohibido `any`: cumplido (`unknown` + narrow vía cast). Imports ordenados
  (Angular → three → angular-three* → libs → propios); `import type` para tipos
  puros (`Material/Mesh/Object3D`, `ResourceRef`). Recursos consumidos vía
  `.value()` con render condicionado. JSDoc en `BadgeGLTF` y en `gltf`. OnPush,
  zoneless-safe, sin console.log/TODO. Comentario de workaround justificado
  (discrepancia API documentada) — permitido por convención.
- verification.md N1: [x]
  → Tests de valor concreto: URL derivada del token (`toContain CONFIG.cardModelUrl`),
  anchor (`toBe BADGE_PHYSICS.cardJointAnchor` y `=== cardJointData.body2Anchor`),
  gate `value()` undefined. No `toBeTruthy`. `vi.mock` neutraliza solo el loader;
  el resto de la lógica de escena sigue testeada (no oculta regresiones). 36→38.
- verification.md N2: [x] — cuatro comandos verdes (arriba).
- verification.md N3: [x] (checklist presente) — ver nota.

## Nota N3 (smoke visual/físico)
El informe SÍ incluye la checklist N3 (informe líneas 162-171: geometría GLB
visible, clip en la unión, sin flash, física intacta, GLB 200 en consola), como
exige verification.md. Las casillas quedan sin marcar porque el smoke en
`pnpm start:playground` no es ejecutable por el implementer/revisor en este
entorno (sin navegador/WebGL). Conforme a la instrucción de la tarea, NO se
rechaza por ello. **Pendiente antes del cierre definitivo:** el leader/usuario
debe ejecutar el smoke y marcar la checklist. No es cerrable `done` sin ese paso.

## Observaciones menores (NO bloqueantes)
- `BADGE_CARD_PLACEHOLDER` queda en `badge.config.ts` sin consumidores internos
  pero re-exportado por `public-api.ts` (`export * from './lib/badge/badge.config'`).
  Mantenerlo para no romper API pública es la decisión correcta en esta fase; su
  retirada, si procede, va en la fase de API final (feature 10/11), no aquí.

## Cambios requeridos
Ninguno. Feature aprobada. Único paso pendiente para cierre: ejecutar el smoke N3
en playground y anotar la checklist marcada.

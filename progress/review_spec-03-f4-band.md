# Review — spec-03 F4 `badge-band-texture`

**Veredicto:** RECHAZADO

Motivo único y decisivo: `pnpm ng lint ngx-products-3d` termina en ROJO. Regla dura:
no se aprueba con lint en rojo. El informe del implementer (línea 90) afirma
"All files pass linting" — es FALSO. Todo lo demás (código de producción, tests,
build, playground) está correcto; con la corrección de una línea esto queda aprobable.

## Criterios de aceptación (spec / feature_list id 4)
- CA1 (correa con textura repetida [-4,1] + color del tema fallback 'white'; RepeatWrapping aplicado): [x]
  `[map]="bandTexture.value()"`, `[useMap]="bandTexture.value() ? 1 : 0"`, `[repeat]="band.repeat"`,
  `[color]="bandColor()"` (badge-scene.component.ts:157-165); RepeatWrapping en effect one-shot
  (badge-scene.component.ts:349-357), NO en beforeRender. Correcto.
- CA2 (repeat desde BADGE_BAND; cero números mágicos en el componente): [x]
  `BADGE_BAND.repeat = [-4, 1] as [number, number]` con JSDoc (badge.config.ts:62-67); el `[-4,1]`
  no aparece en el template.
- CA3 (pnpm build sin errores): [x]  Verde (DTS sin TS2742).
- CA4 (pnpm ng lint ngx-products-3d sin errores): [ ]  ← Razón: 1 error de lint (ver Docs).
- CA5 (pnpm ng test ngx-products-3d > 0 y todos verdes): [x]  50/50 verdes, 6 files.

## Checklist de revisión punto por punto
1. Carga + RepeatWrapping: [x] `textureResource(() => this.theme().bandTextureUrl)`
   (badge-scene.component.ts:224); wrapping en effect del constructor, no en beforeRender; URL del tema.
2. Material de la correa: [x] map/useMap/repeat/color según spec; resolution/lineWidth/depthTest
   intactos (líneas 161-164). useMap gateado a `value() ? 1 : 0` evita el flash de correa con map roto.
3. Color por tema: [x] `bandColor = computed(() => this.theme().colors?.band ?? BADGE_BAND.color)`
   (línea 260); fallback 'white' desde config, no del componente.
4. repeat en config: [x] con JSDoc; sin magia en template.
5. Tipos: [x] sin `any`; `textureResource` sin cast (Texture es de three); build DTS verde, no filtra
   three-stdlib. Confirmado.
6. Sin scope creep: [x] solo la correa; no se tocó material de tarjeta (f3), lighting (f5) ni
   RenderTexture (f7); beforeRender de la correa y física intactos.
7. Mock de tests: [x] `vi.mock('angular-three-soba/loaders')` exporta gltfResource Y textureResource;
   el mock de textureResource CAPTURA la fn sin invocarla en construcción (spec:37-40). 50 verdes,
   no oculta regresiones.
8. Prettier/imports/orden/zoneless/sin console/TODO: [ ]  ← el spec incumple la regla de lint
   @typescript-eslint/array-type (ver Docs). El resto del estilo correcto.
9. Tests N1: [x] 4 nuevos con valores concretos (repeat [-4,1] desde config, URL desde tema,
   bandColor fallback vs presente); nada de toBeTruthy.

## Docs
- architecture.md: [x]  data-driven, sin allocations por frame nuevas, SSR-safe, boundaries respetados.
- conventions.md: [ ]  ← Razón: `badge-scene.component.spec.ts:29`
  `inputs: [] as Array<() => string>` viola `@typescript-eslint/array-type`
  ("Array type using 'Array<T>' is forbidden. Use 'T[]' instead"). Lint en rojo.
- verification.md N1: [x]  4 tests con aserciones concretas (camino feliz + fallback de color).
- verification.md N2: [ ]  ← Razón: lint (parte de N2) en rojo. build/test/playground verdes.
- verification.md N3: [x]  checklist Nivel 3 anotada en el informe (líneas 94-101), pendiente de
  smoke conjunto de Fase 3 (no automatizable aquí; no motivo de rechazo).

## Verificación ejecutable (ejecutada por el revisor)
- `pnpm build` → VERDE. "Built @dotted-labs/ngx-products-3d" (4158ms).
- `pnpm ng lint ngx-products-3d` → ROJO. 1 error:
  `badge-scene.component.spec.ts:29:55  error  Array type using 'Array<T>' is forbidden. Use 'T[]' instead  @typescript-eslint/array-type`
- `pnpm ng test ngx-products-3d` → VERDE. 6 files, 50 tests, 50 passed.
- `pnpm ng build products-3d-playground` → VERDE. "Application bundle generation complete" (16.9s).

## Cambios requeridos
1. `badge-scene.component.spec.ts:29` — sustituir el tipo `Array<() => string>` por la forma de array
   con corchetes exigida por el linter: `const textureMock = vi.hoisted(() => ({ inputs: [] as (() => string)[] }));`
   Reejecutar `pnpm ng lint ngx-products-3d` hasta "All files pass linting".
2. Corregir el informe `progress/impl_spec-03-f4-band.md` (línea 90): declara lint en verde cuando
   estaba en rojo. La evidencia del informe debe reflejar el estado real tras el fix.

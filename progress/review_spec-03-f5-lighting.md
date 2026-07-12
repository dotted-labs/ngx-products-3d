# Review — spec-03 F5 `badge-lighting`

**Veredicto:** APROBADO

## Archivos declarados vs git
Informe declara 3 archivos: `badge.config.ts`, `badge.component.ts`, `badge.component.spec.ts`.
`git status` muestra además `badge-scene.component.ts`, `badge-scene.component.spec.ts`,
`badge-material.ts`, `card.glb`, etc. — pero corresponden a features 2/3/4 (ya revisadas:
`review_spec-03-f2/f3/f4.md`), trabajo previo sin commitear en la misma rama, NO scope creep de F5.
Los 3 archivos de F5 coinciden con el informe. Sin archivo tocado no declarado dentro del alcance F5.

## Criterios de aceptación (spec / feature_list id 5)
- CA1 (reflejos de environment sobre el clearcoat; 4 lightformers montados): [x]
  Estructuralmente: `@for` sobre 4 entradas de `BADGE_LIGHTFORMERS` dentro de `<ng-template>` del
  `<ngts-environment>`. El brillo/barrido visual es N3 (smoke conjunto de Fase 3, anotado pendiente).
- CA2 (todos los parámetros desde BADGE_LIGHTING; cero números mágicos; Math.PI documentado): [x]
  `ambientIntensity`, `environmentOptions`, `lightformers` = `BADGE_LIGHTING.*`. Template sin
  literales de intensidad/posición/rotación. `Math.PI` justificado (r155+) en config y componente.
- CA3 (pnpm build sin errores): [x]  `✔ Built @dotted-labs/ngx-products-3d` EXIT=0
- CA4 (pnpm ng lint sin errores): [x]  `All files pass linting.` EXIT=0
- CA5 (pnpm ng test > 0 tests, todos verdes): [x]  `Test Files 6 passed (6) · Tests 54 passed (54)` EXIT=0

## Checklist de la tarea (punto por punto)
1. Luces en el wrapper, dentro de `canvasContent`, hermanas de `<ngtr-physics>`: [x]
   `badge.component.ts:42-49` (ambient + environment) preceden a `<ngtr-physics>` en :50.
2. Lightformers dentro de `<ng-template>` hijo del environment (evita red): [x]
   `:44-48`. Verificado en `node_modules/.../fesm2022/angular-three-soba-staging.mjs:2321,2331-2338`:
   `content = contentChild(TemplateRef)` → con contenido enruta a `ngts-environment-portal`
   (sin `preset`/`map`/`ground`), NO a `environment-cube`. Claim del informe correcto y documentado.
3. `backgroundBlurriness: 0.75`, `background: false`, sin `preset` ni `blur`: [x]
   `badge.config.ts:177-180`. `blur` está `@deprecated` en `angular-three-soba-staging.d.ts:1263`;
   `backgroundBlurriness?: number` en :1270. Test asserta ausencia de `blur`/`preset`.
4. 4 lightformers data-driven, `@for`, intensidades ~2..10: [x]  `BADGE_LIGHTFORMERS` 4 entradas,
   intensidades 2/3/3/10.
5. Cero números mágicos en el componente; `Math.PI` documentado: [x]
6. Tipos sin `any`; `BadgeLightformerOptions` exportada; `scale` tupla mutable justificada: [x]
   Verificado en `.d.ts:1565`: `scale: number | [number,number,number] | [number,number]` (mutable),
   por lo que un `as const` recursivo rompería la asignación al input. `BADGE_LIGHTING` sigue
   `as const` a nivel objeto; el campo referencia el array tipado. Build DTS OK (sin TS4029).
7. `NgtsEnvironment`/`NgtsLightformer` en `imports`; `CUSTOM_ELEMENTS_SCHEMA` para
   `<ngt-ambient-light>`: [x]  `:64-65`. Build/lint verdes → no rompe nada.
8. Sin scope creep (solo iluminación en el wrapper; física/scene/material/debug intactos): [x]
   `physicsOptions` y passthrough de `debug` sin cambios; scene passthrough intacto.
9. Fix de test solo-entorno (`vi.hoisted` stub de `getContext('2d')`, otros contextId intactos): [x]
   `badge.component.spec.ts:7-52`. No toca producción. Suite del wrapper CARGA (chunk
   `spec-lib-badge-badge.component.js`), 6 files / 54 tests (no 0), no oculta regresión.
10. Prettier / imports ordenados / orden de miembros / zoneless / sin console.log/TODO: [x]
    Lint verde; grep sin `console.`/`TODO`/`FIXME` en los 3 archivos. Orden imports correcto.
11. Tests N1 con valores concretos (no `toBeTruthy`): [x]  4 tests: `ambientIntensity === Math.PI`,
    `background===false`/`backgroundBlurriness===0.75`/sin blur/preset, `length===4` + forma,
    rango `min 2 / max 10`.

## Docs
- architecture.md (config data-driven, SSR-safe, boundaries, sin deps fantasma): [x]
  Guard SSR heredado del wrapper (`isBrowser`); playground sin deep imports; dist peers limpios
  (soba como peer; las 4 optional peers de soba NO se cuelan en el package.json de la lib).
- conventions.md (nombres, `as const`, `type`/`interface`, sin `any`, orden componente): [x]
- verification.md N1 (camino feliz + valores concretos): [x]
- verification.md N2 (build+lint+playground+dist): [x]
- verification.md N3 (checklist anotada): [x] anotada como pendiente (smoke conjunto de Fase 3);
  por instrucción de la tarea no se rechaza por el smoke visual conjunto, solo se exige anotada.
- spike-notes-03 §4 (backgroundBlurriness, sin preset): [x] respetado. Desviación del `<ng-template>`
  envolvente documentada en el informe y verificada en node_modules.

## Verificación ejecutable (salida literal)
- `pnpm build` → `✔ Built @dotted-labs/ngx-products-3d` — BUILD_EXIT=0
- `pnpm ng lint ngx-products-3d` → `All files pass linting.` — LINT_EXIT=0
- `pnpm ng test ngx-products-3d` → `Test Files 6 passed (6)` · `Tests 54 passed (54)` — TEST_EXIT=0
- `pnpm ng build products-3d-playground` → `Application bundle generation complete.` — PLAYGROUND_EXIT=0
- dist/ngx-products-3d/fesm2022 → `dotted-labs-ngx-products-3d.mjs` presente
- dist package.json → `sideEffects:false`, `angular-three-soba: ^4.0.0` como peer, sin deps fantasma

## Notas
- N3 visual (reflejos sobre clearcoat, 4 barridos, sin red) queda para el smoke conjunto de Fase 3;
  el implementer debe cerrar esa checklist antes de dar por cerrada la Fase 3.

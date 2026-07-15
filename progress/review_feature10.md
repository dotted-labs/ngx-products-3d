# Review — feature 10 `readme-docs` (spec-03, fase 5)

- **Fecha**: 2026-07-15
- **Informe revisado**: `progress/impl_feature10.md`
- **Perímetro declarado y real**: solo `projects/ngx-products-3d/README.md` (+ progress). Confirmado.

**Veredicto:** APROBADO

## Criterios de aceptación (feature_list.json id 10)

- CA1 (README con instalación, peers, quickstart @defer + provideNgtRenderer, ambos provide*, tabla de tema completa, contrato GLB y nota de peso/defer): [x]
  - Instalación (README.md:13-18) + tabla de peers (:20-34).
  - Nota de peso/defer con contrato de consumo en 3 pasos (:36-51).
  - Quickstart: providers en ruta lazy con `provideNgtRenderer()` + `provideProducts3d()` + `provideProducts3dBadgeTheme()` (:53-101) y componente con `@defer (on viewport)` + `@placeholder` (:103-128).
  - Tabla del tema completa (:176-199), contrato GLB (:229-250).
  - Extras dentro del alcance de "documentar la lib": scheduler de CD (el JSDoc de `Products3dBadge` remite al README para ese requisito), requisitos de assets, sección avanzada de `Products3dBadgeScene`, gotcha del tema. No hay ampliación de alcance de código: cero código nuevo.
- CA2 (ejemplos compilan contra la API pública real, sin deep imports): [x]
  - Verificación INDEPENDIENTE: extraje los 4 snippets TS del README a un directorio temporal y los compilé con tsc strict como consumidor externo, mapeando `@dotted-labs/ngx-products-3d` a `dist/ngx-products-3d/types/*.d.ts` y resolviendo el resto contra node_modules reales: **compilan sin errores** (stubs añadidos: solo el import cruzado ruta-componente y `ApplicationConfig`, que el snippet 3 omite por brevedad).
  - 15/15 símbolos de la lib presentes en `dist/ngx-products-3d/types/dotted-labs-ngx-products-3d.d.ts` (grep independiente).
  - Cero deep imports: todo desde `@dotted-labs/ngx-products-3d`; externos desde `angular-three/dom`, `angular-three-rapier`, `@angular/core`, `@angular/router`.
- CA3 (comandos verdes): [x] re-ejecutado por el reviewer:
  - `pnpm build` OK (y `dist/ngx-products-3d/README.md` byte-idéntico al fuente, 332 líneas; cmp OK).
  - `pnpm ng lint ngx-products-3d` OK (All files pass linting).
  - `pnpm ng test ngx-products-3d` OK: 76/76 (9 files).
  - Extra N2 de verification.md: `pnpm ng build products-3d-playground` OK; `fesm2022/` presente; peers de `dist/package.json` sin deps fantasma (solo `tslib` como dep).

## Verificación símbolo a símbolo (muestreo amplio, contrastado con código real)

| Afirmación del README | Fuente real | Estado |
| --- | --- | --- |
| Tabla de peers (9 entradas, rangos) | projects/ngx-products-3d/package.json:23-33 | OK, literal y completa |
| "la lib solo depende de tslib" | package.json:34-36 + dist | OK |
| `npm i -D @types/three` | root package.json:62 usa el mismo patrón | OK |
| Selector `products-3d-badge` / clase `Products3dBadge` | badge.component.ts:36,75 | OK |
| Inputs wrapper: `member` required, `theme` optional, `debug` default false | badge.component.ts:77-83 | OK |
| `debug` del wrapper = debug de física | badge.component.ts:99-104 (passthrough a NgtrPhysics.options) | OK |
| Resolución `input ?? token ?? Error` y gotcha del theme que PISA al provider, sin merge | badge.component.ts:109-117 | OK |
| Validación runtime defaultBaseTextureUrl/fontUrl (ausente O vacío) con Error prefijo [ngx-products-3d] | badge-theme.ts:9-19 + badge.component.ts:111-114 | OK |
| Tabla Products3dBadgeTheme: TODOS los campos | types.ts:19-34 (bandTextureUrl, baseTextures, defaultBaseTextureUrl, fontUrl, colors.band/text/clip, material) | OK campo a campo, ninguno omitido |
| Defaults colors.band=white / colors.text=black | BADGE_BAND.color (badge.config.ts:57), BADGE_TEXT.color (:146) | OK |
| Correa: RepeatWrapping + teselado 4x a lo largo; fallo = color plano + warn dev | badge-scene.component.ts:399-423 + BADGE_BAND.repeat [-4,1] | OK |
| Clip: la lib CLONA el material antes de teñir | badge-material.ts:20-27 (metal.clone()) + effect badge-scene.component.ts:379-394 | OK |
| Merge campo a campo de material con defaults | mergeMaterialOptions (badge-material.ts:5-17) | OK |
| Tabla BADGE_MATERIAL_DEFAULTS (6 valores) | badge.config.ts:150-157 | OK, literal |
| GLB roto = escena sin tarjeta + warn dev; textura 404 degrada | badge-scene.component.ts:130,273-274,424-433 | OK |
| member en vivo sin recrear canvas; prefijo # en memberNumber; nombres largos escalados | badge-texture.component.ts (memberNumberPrefix), BADGE_TEXT.maxWidth | OK |
| RenderTexture interna 2000x2000 | BADGE_TEXTURE.size (badge.config.ts:79) | OK |
| Inputs escena: member/theme required, debug reservado | badge-scene.component.ts:206-208; el template de la escena NO consume debug(); documentación honesta con la vía real (options de ngtr-physics) | OK |
| Validación temprana vive en el wrapper, no en la escena | resolvedTheme solo en badge.component.ts | OK |
| provideNgtRenderer devuelve EnvironmentProviders (no cabe en providers de componente) | uso idéntico en badge-demo.routes.ts; providers de la lib también makeEnvironmentProviders (providers.ts) | OK |
| Tokens PRODUCTS_3D_CONFIG / PRODUCTS_3D_BADGE_THEME exportados | tokens.ts + public-api.ts | OK |
| Snippet avanzado: BADGE_CAMERA como camera, BADGE_PHYSICS.gravity/timeStep + interpolate true | mismo patrón que badge.component.ts:90,99-104 | OK |

## Contrato GLB vs spike + código

- Nodos card/clip/clamp, materiales base(card) / metal(clip+clamp): OK — docs/spike-notes-03.md (resumen y S3.2) + interfaz BadgeGLTF (badge-scene.component.ts:66-69).
- Sustitución del material base por MeshPhysicalMaterial propio con la RenderTexture como map; metal tal cual o clonado+teñido: OK — template de la escena (:130-168) y effect del tinte.
- Origen = anclaje del clip; grupo visual en cardJointAnchor: OK — badge-scene.component.ts:230-234 + BADGE_PHYSICS.cardJointAnchor [0, 1.45, 0].
- Dimensiones 1.6 x 2.25 x 0.02, centro en y=-1.45, collider fijo [0.8, 1.125, 0.01]: OK — spike-notes-03 (resumen ejecutivo) + BADGE_PHYSICS.cardColliderHalfExtents. La advertencia de desalineación física-visual al cambiar proporciones es correcta y valiosa.
- Draco: VERIFICADO en node_modules/angular-three-soba/fesm2022/angular-three-soba-loaders.mjs:328-448 — gltfResource tiene useDraco = true por defecto, decoder desde gstatic.com (draco 1.5.5) y gltfResource.setDecoderPath(path) existe (línea 446). Asset de referencia sin comprimir (~222 KB) coincide con spike-notes-03.

## Docs

- architecture.md: [x] — sin cambios de código; el README refuerza el modelo (peers, defer, SSR, data-driven, sin deep imports).
- conventions.md: [x] — nombres y selectores citados correctos; conventions.md no fija idioma de README.
- verification.md N1: [x] — no aplica lógica nueva (feature solo docs); suite existente 76/76.
- verification.md N2: [x] — re-ejecutado completo por el reviewer (ver CA3).
- verification.md N3: [x] — no aplica (sin cambios visuales/físicos); correcto que el informe no traiga checklist.

## Perímetro / git

- git diff de projects/ngx-products-3d/src/: LIMPIO (cero cambios de código de la lib).
- Cambios de playground en el working tree (badge-demo.*, assets *-ember*.png) = feature 9, ya aprobada (progress/review_feature9.md); fuera de esta review, no atribuibles a la feature 10.
- feature_list.json: diff = id 9 pending a done e id 10 pending a in_progress (bookkeeping del leader, consistente con lo declarado por el implementer: él no lo tocó).

## Observaciones no bloqueantes

1. **Idioma (español)**: decisión defendible — conventions.md no fija idioma y todo el repo (README raíz, docs/, comentarios) está en español. PERO la lib se publica en npm con publishConfig.access public; la convención de facto en npm público es inglés. Recomiendo decidirlo explícitamente en la feature 11 (publicación) y, si se traduce, hacerlo allí.
2. Los assets de ejemplo del README (/assets/3d/*.png, font.json) son rutas ilustrativas de la app consumidora (correcto); enlaza facetype.js para convertir la fuente. Coherente con que los temas de producción necesitarán assets propios más potentes.
3. tsc no valida los templates de los snippets (limitación inherente); selectores, inputs y estructura (canvasContent, ng-template de physics, attach de RenderTexture) verificados a mano contra el código fuente: todos correctos.

## Cambios requeridos

Ninguno.

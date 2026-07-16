# Informe impl — feature 10 `readme-docs` (spec-03, fase 5)

- **Fecha**: 2026-07-15
- **Estado**: implementado, pendiente review (no marco `done`)

## Archivos tocados

| Archivo | Cambio |
| --- | --- |
| `projects/ngx-products-3d/README.md` | Reescrito por completo (era un stub de 3 líneas que apuntaba al README raíz). Es el README que ng-packagr empaqueta en `dist/ngx-products-3d/README.md` (verificado tras build: 332 líneas idénticas en dist). |
| `progress/current.md` | Anotación de sesión implementer (plan + criterios) y log. |
| `progress/impl_feature10.md` | Este informe. |

**README raíz del repo**: NO tocado. Tiene su propia documentación (en español) y no apunta al
README de la lib, así que no hacía falta ni el "enlace trivial" permitido. Queda una duplicación
parcial raíz↔lib (instalación/quickstart); si molesta, decisión del líder (fuera de mi perímetro).

**Sin cambios de código**: ni lib, ni playground, ni tests, ni `feature_list.json`.

## Decisiones

1. **Idioma: español.** `conventions.md` no fija idioma de README; el README raíz del repo, todos
   los `docs/` y los comentarios de código están en español. Prima la homogeneidad del repo sobre
   la convención "npm público = inglés". Reversible en la feature 11 si el líder decide publicar
   en inglés.
2. **Contrato GLB desde spike + código, no desde la spec.** Dimensiones (1.6×2.25×0.02, centro en
   y=−1.45, origen = anclaje del clip) tomadas de `docs/spike-notes-03.md` y contrastadas con
   `BADGE_PHYSICS.cardColliderHalfExtents [0.8, 1.125, 0.01]` / `cardJointAnchor [0, 1.45, 0]` en
   `badge.config.ts`. Se advierte que el collider es fijo (cambiar proporciones del GLB desalinea
   física y visual).
3. **Draco documentado con la API real**: `gltfResource` de soba soporta Draco por defecto
   (decoder desde `gstatic.com` en runtime; `gltfResource.setDecoderPath()` para self-host) —
   verificado en `node_modules/angular-three-soba/fesm2022/angular-three-soba-loaders.mjs:329-447`
   y `types/angular-three-soba-loaders.d.ts:326-328`. El asset de referencia va sin comprimir
   (~222 KB, spike-notes-03).
4. **Sección de scheduler de CD** incluida (no estaba en el acceptance literal pero el JSDoc de
   `Products3dBadge` dice "Ver README" para ese requisito): `provideZonelessChangeDetection()`
   (patrón real de `products-3d-playground/src/app/app.config.ts`) o zone.js.
5. **`debug` de `Products3dBadgeScene`**: el input existe pero el template de la escena no lo
   consume (el debug real va en las options de `NgtrPhysics`, que en canvas propio configura el
   consumidor). Documentado honesto como "reservado" con la vía real para activar el debug.
6. **Quickstart calcado del patrón que YA funciona** en el playground: providers
   (`provideNgtRenderer` + `provideProducts3d` + `provideProducts3dBadgeTheme`) en la RUTA lazy
   (son `EnvironmentProviders`, no caben en providers de componente) y componente con
   `@defer (on viewport)` + `@placeholder`.
7. **Gotcha del tema** (`[theme]` PISA al provider sin merge) documentado en la tabla de inputs,
   con la cadena de resolución real (`input ?? token ?? Error`) de `resolvedTheme` en
   `badge.component.ts:109-117`.

## Verificación símbolo-a-símbolo de los ejemplos

Todos los símbolos de la lib usados en el README existen en el d.ts empaquetado
(`dist/ngx-products-3d/types/dotted-labs-ngx-products-3d.d.ts`, comprobado con grep tras build):
`Products3dBadge`, `Products3dBadgeScene`, `Products3dBadgeTexture`, `provideProducts3d`,
`provideProducts3dBadgeTheme`, `BADGE_CAMERA`, `BADGE_PHYSICS`, `BADGE_LIGHTING`,
`BADGE_MATERIAL_DEFAULTS`, `BadgeMemberData`, `Products3dBadgeTheme`,
`BadgePhysicalMaterialOptions`, `Products3dConfig`, `PRODUCTS_3D_CONFIG`,
`PRODUCTS_3D_BADGE_THEME` — 15/15 OK. Cero deep imports (todo desde
`@dotted-labs/ngx-products-3d`).

Símbolos externos verificados contra uso real / node_modules:

- `provideNgtRenderer` ← `angular-three/dom` (igual que `badge-demo.routes.ts:2`).
- `NgtCanvas` (`<ngt-canvas [camera]>` + `<ng-template canvasContent>`) y `NgtrPhysics`
  (`[options]`) ← mismos imports/patrón que `badge.component.ts:11-12,39-62`.
- `provideZonelessChangeDetection` ← `@angular/core` (patrón de `app.config.ts` del playground).
- `gltfResource.setDecoderPath` ← soba loaders (fesm línea 446).
- Selectores: `products-3d-badge` (badge.component.ts:36), `products-3d-badge-scene`
  (badge-scene.component.ts:80).
- Inputs documentados = inputs reales: wrapper `member` (required) / `theme` (optional) /
  `debug` (default false) — badge.component.ts:77-83; escena `member`/`theme` (required),
  `debug` — badge-scene.component.ts:206-208.
- Tabla de tema = `Products3dBadgeTheme` en `types.ts:19-34` campo a campo; defaults de
  `colors.band`/`colors.text` desde `BADGE_BAND.color` ('white') y `BADGE_TEXT.color` ('black');
  defaults de material desde `BADGE_MATERIAL_DEFAULTS` (badge.config.ts:150-157); tinte de clip
  con clon (badge-scene.component.ts:379-394).
- Validación runtime (`defaultBaseTextureUrl`/`fontUrl` obligatorios → Error con prefijo
  `[ngx-products-3d]`; también con string vacío) = `assertValidBadgeTheme` (badge-theme.ts) +
  error 'no theme' (badge.component.ts:111-114).
- Peers de la tabla = `projects/ngx-products-3d/package.json:23-33` literal (los 9, con sus
  rangos exactos, incluida `ngxtension >=5.0.0` que el acceptance no listaba pero el
  package.json sí declara).
- RenderTexture 2000×2000 = `BADGE_TEXTURE.size` (badge.config.ts:79).

## Acceptance

| Criterio | Estado |
| --- | --- |
| README con instalación, peers, quickstart @defer + provideNgtRenderer, ambos provide*, tabla de tema, contrato GLB y nota de peso/defer | ✅ (todas las secciones presentes; además: requisitos de assets, `Products3dBadgeScene` con ejemplo de canvas propio, nota de scheduler de CD, gotcha theme-input-pisa-provider) |
| Ejemplos de código compilan contra la API pública real (sin deep imports) | ✅ verificación símbolo-a-símbolo arriba (15/15 en el d.ts de dist; snippets calcados de consumo real del playground/lib) |
| `pnpm build` sin errores | ✅ (y README copiado a `dist/ngx-products-3d/README.md`, 332 líneas) |
| `pnpm ng lint ngx-products-3d` sin errores | ✅ "All files pass linting." |
| `pnpm ng test ngx-products-3d` > 0 tests y todos verdes | ✅ 76/76 (9 files) |

## Verificación manual pendiente

Ninguna (feature solo de documentación; N3 no aplica). Para el reviewer: releer README contra
`public-api.ts` y `docs/spike-notes-03.md`, y validar la decisión de idioma (punto 1).

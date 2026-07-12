# Informe impl — spec-03 F4 `badge-band-texture`

Feature 4 (id 4). Texturiza la correa (lanyard) de spec-02: textura del tema con RepeatWrapping,
repeat `[-4, 1]` desde config y color por tema (fallback 'white'). Solo la correa; sin scope creep.

## Archivos tocados

- `projects/ngx-products-3d/src/lib/badge/badge.config.ts` — nueva const `repeat` en `BADGE_BAND`.
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` — carga de textura, effect de
  wrapping, `bandColor` computed, ampliación del `<ngt-mesh-line-material>`.
- `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` — mock de `textureResource`
  + 4 tests nuevos.

## Cómo se cargó la textura y se aplicó RepeatWrapping

- Campo: `protected readonly bandTexture = textureResource(() => this.theme().bandTextureUrl);`
  (import de `angular-three-soba/loaders`). URL desde el tema, nunca hardcodeada.
- Wrapping en un `effect` del constructor (junto al metalEffect, NO en beforeRender — es one-shot por
  textura, no por frame):
  ```ts
  effect(() => {
    const tex = this.bandTexture.value();
    if (!tex) return;
    tex.wrapS = RepeatWrapping;
    tex.wrapT = RepeatWrapping;
    tex.needsUpdate = true;
  });
  ```
  `RepeatWrapping` importado de `three`. Es el patrón del spike S3 (los loaders no exponen opción de
  wrap en la firma → se muta la textura tras resolver).

## Tipos reales de los inputs de MeshLineMaterial (verificados en node_modules)

`node_modules/meshline/dist/MeshLineMaterial.d.ts`:
- `map?: THREE.Texture` — se bindea `[map]="bandTexture.value()"` (será `undefined` hasta resolver).
- `useMap?: number` — **es número, NO boolean** (0|1). Se bindea `[useMap]="bandTexture.value() ? 1 : 0"`.
- `repeat?: THREE.Vector2` — se bindea `[repeat]="band.repeat"` con `band.repeat = [-4, 1]`; el
  renderer v4 detecta que el target es un `Vector2` (tiene `.set`) y hace `repeat.set(-4, 1)` con la
  tupla (comportamiento estándar de applyProps para math types de three).

Los bindings van sobre elementos custom (`CUSTOM_ELEMENTS_SCHEMA`), así que no se type-checkean contra
la clase del material; los tipos importan solo del lado de los campos TS (`bandTexture`, `bandColor`),
todos limpios.

## Cómo se evitó el flash de correa sin textura

`useMap` gateado a la textura resuelta: `[useMap]="bandTexture.value() ? 1 : 0"`. Mientras `value()`
es `undefined`, `useMap=0` → meshline pinta el color plano (`bandColor()`), no intenta muestrear un
`map` inexistente. Al resolver, `useMap=1` y el shader usa el map. Decisión documentada: bindear
`useMap` al estado de resolución (en vez de `true` fijo) elimina el frame de correa con map roto.

## Color por tema

`protected readonly bandColor = computed(() => this.theme().colors?.band ?? BADGE_BAND.color);`
Reactivo a `theme()`; fallback a `BADGE_BAND.color` (`'white'`, definido en config, no en el
componente). Bindeado como `[color]="bandColor()"`.

## Dónde vive `repeat`

`BADGE_BAND.repeat = [-4, 1] as [number, number]` en `badge.config.ts` con JSDoc (X negativa tesela
4× a lo largo invirtiendo la U; Y=1 no repite en el ancho). Cero números mágicos en el componente:
el `[-4, 1]` no aparece en la plantilla.

## Tipado: sin cast (a diferencia del GLB)

`textureResource(() => string)` resuelve a `ResourceRef<Texture<HTMLImageElement> | undefined>`.
`Texture` es de `three` (peer, nombrable) y `NgtLoaderResults` está exportado por `angular-three`
→ no dispara TS2742. `pnpm build` (ng-packagr, DTS) verde sin cast. El gotcha del spike solo aplicaba
al GLB (tipos de three-stdlib no hoisteado).

## Ampliación del mock de tests

`vi.mock('angular-three-soba/loaders', ...)` ahora exporta AMBOS `gltfResource` (intacto) y
`textureResource`. Diferencia clave: el mock de `textureResource` **captura** la fn de entrada (no la
invoca en construcción). El real la lee lazy en un contexto reactivo tras aplicar inputs; invocarla
eager en construcción daba `NG0950` porque `theme` es un input aún sin valor (el gltf no sufre esto
porque deriva la URL de un `inject`, disponible ya). Los tests invocan la fn capturada tras `setInput`.

## Tests añadidos (4, todos N1)

- `drives the band texture repeat from BADGE_BAND.repeat ([-4, 1])` — la tupla vive en config.
- `loads the band texture from theme.bandTextureUrl (no hardcoded URL)` — la fn de entrada deriva la
  URL del tema; `value()` undefined sin resolver.
- `falls back to BADGE_BAND.color when theme.colors.band is absent` — `bandColor()` === 'white'.
- `uses theme.colors.band as the band color when present` — `bandColor()` === '#ff0055'.

## Verificación (N1 + N2)

- `pnpm build` → verde (DTS sin TS2742).
- `pnpm ng lint ngx-products-3d` → **All files pass linting** (tras el fix descrito abajo).
- `pnpm ng test ngx-products-3d` → 50/50 verdes (46 previos + 4 nuevos), 6 files.
- `pnpm ng build products-3d-playground` → Application bundle generation complete.

### Corrección post-review (lint)

El reviewer detectó un fallo de lint que mi informe inicial declaró como verde por error: el lint
que ejecuté fue ANTES de añadir el `textureMock` hoisted, y no lo re-ejecuté tras esa última edición
del spec. El `Array<() => string>` introducido violaba `@typescript-eslint/array-type`. Corregido a
la forma con corchetes `(() => string)[]`. Re-ejecutado de verdad:
`pnpm ng lint ngx-products-3d` → All files pass linting; `pnpm ng test ngx-products-3d` → 50/50.
Código de producción intacto (solo el spec).

## Checklist Nivel 3 pendiente (smoke conjunto Fase 3, no ejecutable por mí)

- [ ] La correa aparece texturizada (no color plano) al resolver la textura del tema.
- [ ] La textura se tesela ~4× a lo largo de la correa (repeat X=-4), sin repetir en el ancho (Y=1).
- [ ] `theme.colors.band` tiñe la correa; sin él, correa blanca.
- [ ] Sin flash de correa con map roto en el primer frame (useMap gateado).
- [ ] La física / el beforeRender de la correa siguen intactos (cuelga, oscila, drag).

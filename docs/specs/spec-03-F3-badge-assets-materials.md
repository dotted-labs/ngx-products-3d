# spec-03-F3: Badge — assets GLB + materiales

> Fase extraída de spec-03 para ejecución aislada en el harness. Prerequisitos: spec-01 (arquitectura) implementada, spec-02 (física + escena placeholder) implementada. Assets de spec-05 (`membresia.glb`, `band.jpg`) producidos y verificados.

## Objetivo

Sustituir los placeholders visuales de spec-02 (plano blanco de la tarjeta, correa blanca) por los assets reales: modelo GLB de la acreditación (tarjeta + aro + hebilla) y correa texturizada. Materiales físicos con tinte por tema. Sin tocar física ni gesto (ya implementados en spec-02); sin RenderTexture todavía (spec-03 F4).

## Inputs disponibles

- `membresia.glb` (44 KB) — verificado. Nodos `card`, `clip`, `clamp`; materiales `base`, `metal`; 0 anims/skins. Colocar en assets de la app playground (`apps/products-3d-playground/public/assets/`) y referenciar por URL de tema/config
- `band.jpg` (1024×256) — correa espiga tileable en X, neutra/tintable. Mismo directorio de assets
- Ambos assets se sirven por URL desde la app consumidora, NUNCA se empaquetan en la lib (regla architecture.md §5)

## Contrato de coordenadas del GLB

> ⚠️ **CORREGIDO 2026-07-31 (feature 14).** Los números que traía esta sección "de spec-05,
> verificado" eran **falsos en los dos ejes**: decían conjunto `Y[-1.12, 1.29]`, `Z[-0.12, 0.14]`
> y "agarre = top del conjunto ≈ 1.29". **Causa raíz** (reproducida exactamente por el reviewer):
> se midieron aplicando solo la `translation` del nodo `clamp` e **ignorando su `rotation` y su
> `scale`**. No es un error de medida, es una medida hecha con las transformaciones a medio
> aplicar. Los valores de abajo están verificados de forma independiente por implementer y
> reviewer decodificando los accessors del GLB.

- Tarjeta (`card`, nodo en **identidad**): X[-0.8, 0.8] × Y[-1.125, 1.125] × Z[-0.01, 0.01]
- `clip` (nodo en identidad): Y[0.917, **1.286**] cruzando la ranura
- `clamp`: lleva `rotation` + `scale` + `translation` propias; **hay que aplicarlas todas**
- **Conjunto real: Y[-1.125, 1.5642], Z[±0.09]** — el top del conjunto es la **hebilla** (1.5642),
  NO el top del clip (1.286)
- **Origen del GLB = centro de la tarjeta (0,0,0)**, que coincide exactamente con el centro del
  cuboid collider (`cardColliderHalfExtents` `[0.8, 1.125, 0.01]`)
- Punto de agarre de la correa: **decisión abierta**, pendiente de la N3 del usuario. Hoy ancla en
  el top del `clip` (`cardJointAnchor` `[0, 1.286, 0]`); el top real del conjunto es `1.5642`
- **Offset de anclaje**: el rigid body de la tarjeta (spec-02) se posiciona de modo que el spherical joint agarre en Y ≈ 1.29 del GLB. En spec-02 el `cardJointAnchor` era `[0, 1.45, 0]`; ajustar a la geometría real del GLB (Y ≈ 1.29) o aplicar el offset en el `<ngt-primitive>`/grupo que contiene el modelo. Verificar signo en runtime según orientación de rapier

## Tareas

### T1 — Cargar el GLB

En `badge-scene.component.ts` (donde spec-02 dejó el plano placeholder):

```ts
import { gltfResource } from 'angular-three-soba/loaders';

protected readonly gltf = gltfResource<BadgeGLTF>(() => this.config.cardModelUrl);
```

- `config.cardModelUrl` viene de `PRODUCTS_3D_CONFIG` (token spec-01). El playground lo provee vía `provideProducts3d({ cardModelUrl: '/assets/membresia.glb' })`
- Tipar `BadgeGLTF`: nodos `card`/`clip`/`clamp` (Mesh), materiales `base`/`metal`
- Render condicionado a `gltf.value()` resuelto (patrón resource v4). Mientras carga, mantener el placeholder o nada
- Verificar API exacta de `gltfResource` en `node_modules/angular-three-soba` — nombre y forma del retorno pueden diferir del boceto

### T2 — Enganchar geometría GLB al rigid body de la tarjeta

- El cuerpo rígido `card` de spec-02 (collider cuboid `[0.8, 1.125, 0.01]`) ahora renderiza la geometría `card` del GLB en lugar del plano
- `clip` y `clamp` son hijos visuales de la tarjeta (se mueven con ella, no tienen física propia) — añadirlos como meshes dentro del mismo grupo del rigid body
- Ajustar posición del grupo para que el anclaje físico caiga en Y ≈ 1.29 del modelo (ver contrato arriba). Documentar el offset final aplicado en el informe

### T3 — Material de la tarjeta (`base`)

```ts
// meshPhysicalMaterial sobre la geometría card
```

- `meshPhysicalMaterial` con defaults `BADGE_MATERIAL_DEFAULTS` (spec-01 config: clearcoat 1, clearcoatRoughness 0.15, roughness 0.3, metalness 0.5, iridescence 0) mergeados con `theme.material` vía computed
- `map` queda pendiente para F4 (RenderTexture). En F3 la tarjeta puede mostrar color plano `theme.baseColor`... — NOTA: el badge no tiene `baseColor` en su tema (a diferencia del pack). En F3 la tarjeta va con material físico blanco/gris; el frente lo pinta la RenderTexture en F4. No inventar campos de tema
- Clonar el material del GLB antes de mutar (loader cachea)

### T4 — Material de clip/clamp (`metal`)

- `meshPhysicalMaterial` o `meshStandardMaterial`: metalness 0.9, roughness 0.3, color negro
- `theme.colors?.clip` (si existe en el tema del badge — verificar `Products3dBadgeTheme` de spec-01; si no está, no añadirlo aquí, va fuera de scope) tiñe el metal
- clip y clamp comparten material `metal` → una instancia clonada

### T5 — Correa texturizada

Sustituir el `meshLineMaterial` blanco de spec-02:

```ts
protected readonly bandTexture = textureResource(() => this.theme().bandTextureUrl);
// al resolver: texture.wrapS = texture.wrapT = THREE.RepeatWrapping
```

```html
<ngt-mesh-line-material
  [color]="theme().colors?.band ?? 'white'"
  [map]="bandTexture.value()"
  [useMap]="true"
  [repeat]="BADGE_BAND.repeat"
  [resolution]="resolution()"
  [lineWidth]="1"
  [depthTest]="false"
/>
```

- `theme.bandTextureUrl` = `/assets/band.jpg` (nuevo campo — verificar que existe en `Products3dBadgeTheme` de spec-01; el tema del badge en spec-01 tenía `bandTextureUrl` ✓)
- Textura neutra → `colors.band` la tinta

### T6 — Iluminación

En `badge.component.ts` (dentro del canvas, fuera de Physics), si no la puso spec-02:

- `<ngt-ambient-light [intensity]="Math.PI" />`
- `NgtsEnvironment` + 3-4 `NgtsLightformer` (constantes `BADGE_LIGHTING` en `badge.config.ts` — crear si no existe). Foil/metal sin environment = plano
- Valores de intensidad/posición ajustables en playground

### T7 — Playground

- Colocar `membresia.glb` y `band.jpg` en `public/assets/`
- `provideProducts3d({ cardModelUrl: '/assets/membresia.glb' })` en la ruta demo
- Tema demo con `bandTextureUrl: '/assets/band.jpg'`
- Verificar visualmente: tarjeta con relieve real, aro metálico cruzando la ranura, hebilla, correa con textura espiga

## Criterios de aceptación

- [ ] GLB carga vía `gltfResource`; nodos `card`/`clip`/`clamp` renderizados
- [ ] Geometría enganchada al rigid body correcto; badge cuelga y arrastra igual que spec-02 (física intacta)
- [ ] Offset de anclaje aplicado y documentado; sin jitter nuevo ni desalineación tarjeta↔correa
- [ ] Material `base` físico con defaults + override `theme.material`
- [ ] Material `metal` en clip/clamp
- [ ] Correa con `band.jpg`, `RepeatWrapping`, repeat derivado (**`[-3.383, 1]`**, no `[-4,1]`: el
      ancho real de la correa es `lineWidth · tan(fov/2)` = 0.2217 uds por el `sizeAttenuation` de
      meshline, no `lineWidth` = 1), tintable por `colors.band`
- [ ] Environment presente → reflejos sobre metal
- [ ] Assets servidos por URL, NO empaquetados en la lib
- [ ] Materiales GLB clonados antes de mutar
- [ ] N1: tests de lógica pura (merge de material, resolución de tema/URLs). N3: checklist visual en playground (relieve, metal, correa, física intacta) en el informe
- [ ] `nx build/lint/test ngx-products-3d` + `nx build products-3d-playground` verdes

## No hacer

- No RenderTexture ni Text3D (spec-03 F4)
- No añadir campos al tema que no estén ya en `Products3dBadgeTheme` (spec-01)
- No tocar la lógica de física, joints, drag ni estabilización (spec-02)
- No empaquetar assets en la lib
- No modificar el GLB (viene cerrado de spec-05)

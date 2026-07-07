# spec-03: Badge — assets, materiales, textura dinámica y API final (Fases 3–5)

## Contexto

Sustituye placeholders de spec-02 por visuales finales: modelo GLB propio (Blender), correa texturizada, material físico de la tarjeta, textura dinámica con datos del socio (RenderTexture + Text3D), theming por equipo y API pública definitiva. Prerequisitos: spec-01 y spec-02 completados.

## Fase 3 — Assets y materiales

### Contrato del modelo GLB (para el pipeline Blender)

Modelo propio — no reutilizar assets de terceros. Requisitos de exportación:

- **Nodos nombrados**: `card` (mesh de la tarjeta), `clip` (gancho metálico), `clamp` (pinza que muerde la tarjeta)
- **Materiales nombrados**: `base` (asignado a `card`, recibirá la RenderTexture), `metal` (clip + clamp)
- Origen del conjunto en el punto de anclaje del clip → coincide con `BADGE_PHYSICS.cardJointAnchor` sin offsets mágicos
- Dimensiones tarjeta ≈ proporción 16:22.5 (mismo ratio que collider `[0.8, 1.125]` × escala del grupo, ~2.25 en el tutorial de referencia)
- Transforms aplicados, Y-up, unidades métricas
- Compresión Draco opcional; si se usa, documentar decoder en README (soba loader la soporta)

Mientras Blender no entregue: geometría procedural provisional — `RoundedBox` (soba) para tarjeta + torus para clip. Misma estructura de componente, swap trivial al llegar GLB.

### Carga

```ts
import { gltfResource, textureResource } from 'angular-three-soba/loaders';

// en badge-scene.component.ts
protected gltf = gltfResource<BadgeGLTF>(() => this.config.cardModelUrl);
protected bandTexture = textureResource(() => this.theme().bandTextureUrl);
```

Tipar `BadgeGLTF` con nodos/materiales del contrato. Render condicionado a recursos resueltos (patrón resource de v4: `.value()`).

### Materiales

Tarjeta (`card`):

```html
<ngt-mesh [geometry]="cardGeometry()">
	<ngt-mesh-physical-material
		[map]="..." <!-- Fase 4: RenderTexture -->
		[mapAnisotropy]="16"
		[clearcoat]="materialOpts().clearcoat"
		[clearcoatRoughness]="materialOpts().clearcoatRoughness"
		[roughness]="materialOpts().roughness"
		[metalness]="materialOpts().metalness"
		[iridescence]="materialOpts().iridescence"
		[iridescenceIOR]="materialOpts().iridescenceIOR"
	/>
</ngt-mesh>
```

Defaults en `badge.config.ts` (`BADGE_MATERIAL_DEFAULTS`: clearcoat 1, clearcoatRoughness 0.15, roughness 0.3, metalness 0.5, iridescence 0, iridescenceIOR 1) mergeados con `theme.material` vía computed.

Clip/clamp: geometrías + materiales del GLB tal cual; `theme.colors.clip` opcional tiñe el material metal (clonar material antes de mutar — GLB cachea).

### Correa texturizada

Sustituir material blanco de spec-02:

```ts
// al resolver bandTexture:
texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
```

```html
<ngt-mesh-line-material
	[color]="theme().colors?.band ?? 'white'"
	[map]="bandTexture.value()"
	[useMap]="true"
	[repeat]="[-4, 1]"
	[resolution]="resolution()"
	[lineWidth]="1"
	[depthTest]="false"
/>
```

### Iluminación

En `badge.component.ts` (dentro del canvas, fuera de Physics):

- `<ngt-ambient-light [intensity]="Math.PI" />`
- `NgtsEnvironment` (soba, `background=false, blur=0.75`) con 4 `NgtsLightformer` (intensidades 2-10, posiciones laterales/superior, `rotation` para barridos de reflejo sobre el clearcoat). Valores exactos → `BADGE_LIGHTING` en `badge.config.ts`; ajuste fino visual en playground.

### Hito Fase 3

Tarjeta con GLB (o procedural provisional), clip metálico, correa texturizada repetida, reflejos de environment sobre clearcoat. Física intacta.

## Fase 4 — Textura dinámica del socio

### RenderTexture como `map`

`badge-texture.component.ts`: contenido de la escena secundaria renderizada a textura. Uso con soba:

```html
<ngt-mesh-physical-material ...>
	<ngts-render-texture [options]="{ width: BADGE_TEXTURE.size, height: BADGE_TEXTURE.size, attach: 'map' }">
		<products-3d-badge-texture *renderTextureContent [member]="member()" [theme]="theme()" />
	</ngts-render-texture>
</ngt-mesh-physical-material>
```

(Nombres de directiva/opciones exactos: verificar `NgtsRenderTexture` en angular-three-soba v4; el patrón `*renderTextureContent` + `cameraContent` aparece en docs.)

### Escena secundaria

Dentro de `badge-texture.component.ts`:

1. Cámara propia: `PerspectiveCamera` manual (`makeDefault` dentro de la RenderTexture), posición `[0, 0, 5]`
2. Fondo: plano con textura base seleccionada por tier:

```ts
protected baseTextureUrl = computed(() => {
	const theme = this.theme();
	return theme.baseTextures[this.member().tier] ?? theme.defaultBaseTextureUrl;
});
protected baseTexture = textureResource(this.baseTextureUrl);
```

3. Textos 3D (`NgtsText3D` + `theme().fontUrl`), color `theme().colors?.text ?? 'black'`:
   - `member().name` — principal
   - `member().memberNumber` — secundario (prefijo configurable, ej. `#0042`)
   - `member().tier` — etiqueta (uppercase)

Posiciones/rotaciones/tamaños de cada texto → `BADGE_TEXT_LAYOUT` en `badge.config.ts` (array de slots `{ field, position, rotation, size, height }`). Layout data-driven → retoque sin tocar componente.

4. Ajuste de nombre largo: medir bounding box del texto y escalar a ancho máximo (equivalente de `Resize`/`Center` de drei — verificar disponibilidad en soba v4; si no existe, computar con `geometry.computeBoundingBox()` y aplicar `scale`).

### Consideraciones

- Un solo badge por página → una RenderTexture 2000×2000, coste asumible. Si el playground monta varios simultáneos, bajar `size` vía input opcional.
- `colorSpace` de texturas base = sRGB.
- La RenderTexture re-renderiza por frame por defecto; si soba permite `frames: 1` (render estático), usarlo — el contenido del frente no cambia salvo inputs → invalidar al cambiar `member`/`theme`.

### Hito Fase 4

Tarjeta muestra nombre, número y tier del socio sobre textura base del tier, todo desde inputs. Cambiar `member` en playground actualiza la tarjeta.

## Fase 5 — API pública final + theming + docs

### API

```html
<products-3d-badge
	[member]="member"
	[theme]="theme"       <!-- opcional si hay provideProducts3dBadgeTheme -->
	[debug]="false"
/>
```

- `Products3dBadge` = todo-en-uno (canvas incluido), caso 99%
- Exportar también `Products3dBadgeScene` para consumidores con canvas propio (composición con otros elementos 3D futuros)
- Validación de tema: si falta `defaultBaseTextureUrl` o `fontUrl` → error descriptivo en dev mode

### Playground completo

- Form: name, memberNumber, select tier
- Selector de 2+ temas de ejemplo (assets demo en `apps/products-3d-playground/public/`)
- Toggle debug física
- Verificación visual de fallback de tier desconocido → `defaultBaseTextureUrl`

### README

- Instalación + peers
- Quickstart con `@defer (on viewport)` + `@placeholder` (contrato SSR de spec-01 T6)
- `provideProducts3d({ cardModelUrl })` + `provideProducts3dBadgeTheme(...)`
- Tabla completa de `Products3dBadgeTheme`
- Contrato GLB (para equipos que quieran regenerar el modelo)
- Nota de peso: Rapier WASM + Three, por qué defer obligatorio

### Publicación (Fase 6, cierre)

- Verificar `sideEffects: false`, rangos peer reales
- `pnpm nx build ngx-products-3d` → `npm publish dist/...` (mismo pipeline que `ngx-supabase-auth`)
- Smoke test: instalar paquete publicado en app externa mínima, render OK

## Criterios de aceptación

- [ ] GLB propio cargado con contrato de nodos; procedural eliminado (o marcado provisional si Blender pendiente)
- [ ] Correa texturizada con repeat, color por tema
- [ ] Material físico con defaults + override de tema
- [ ] RenderTexture: name + memberNumber + tier, textura base por tier con fallback
- [ ] Layout de textos data-driven en config
- [ ] Cambios de `member`/`theme` reactivos sin recrear canvas
- [ ] Playground: form + selector de temas + debug toggle
- [ ] README completo con contrato SSR
- [ ] Paquete publicado y consumido en smoke test

## No hacer

- No editor de temas para usuario final (theming = responsabilidad de dev)
- No múltiples geometrías de tarjeta por tema (geometría única)
- No optimizaciones prematuras multi-badge (un badge por vista es el caso de uso)

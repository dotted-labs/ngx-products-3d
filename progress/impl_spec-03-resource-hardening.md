# Impl — spec-03 resource hardening (bugfix robustez)

Acceso NO-lanzante a los recursos async del badge (textura de correa + GLB) para que una URL
rota/loading no blanquee la escena por `ResourceValueError` en la detección de cambios.

## API no-lanzante usada (firma real en node_modules)

`@angular/core` v21.2.17 — `node_modules/@angular/core/types/_api-chunk.d.ts`:

```ts
interface Resource<T> {
  readonly value: Signal<T>;                 // LANZA ResourceValueError en estado 'error'
  readonly status: Signal<ResourceStatus>;   // NO lanza (reactivo)
  readonly error: Signal<Error | undefined>;
  hasValue(this: ...): this is Resource<...>; // overload
  hasValue(): boolean;                        // NO lanza (reactivo)
}
interface ResourceRef<T> extends WritableResource<T> { ... destroy(): void }
type ResourceStatus = 'idle' | 'error' | 'loading' | 'reloading' | 'resolved' | 'local';
```

Gate elegido: `hasValue()` (docstring del core: "Whether this resource has a valid current value.
This function is reactive."). `value()` explícitamente "throws an error if the resource is in an
error state". `status()` se usa solo para el aviso dev. `ngDevMode` está declarado como global
(`declare global { const ngDevMode: null | NgDevModePerfCounters }` en
`types/_event_dispatcher-chunk.d.ts`), así que `if (ngDevMode)` compila sin declararlo.

## Qué toqué

### 1. Helper puro reutilizable (nuevo)
- `projects/ngx-products-3d/src/lib/resource-value.ts`: `resourceValueOrUndefined(res)` +
  interfaz mínima `ReadableResource<T>` (`hasValue(): boolean`, `value(): T`). Devuelve `value()`
  solo si `hasValue()`, si no `undefined`. Cero deps de Angular → testeable sin TestBed.
- `projects/ngx-products-3d/src/lib/resource-value.spec.ts`: 3 tests (hasValue true → value;
  hasValue false → undefined y NO invoca value(); value() que lanza → no propaga el throw).

### 2. `badge-scene.component.ts`
- Import de `resourceValueOrUndefined`.
- Nuevos computed seguros (junto a las decls de recurso):
  `gltfData = computed(() => resourceValueOrUndefined(this.gltf))` y
  `bandMap = computed(() => resourceValueOrUndefined(this.bandTexture))`.
- **Band**: template pasa de `[map]="bandTexture.value()"` / `[useMap]="bandTexture.value() ? 1 : 0"`
  a `[map]="bandMap()"` / `[useMap]="bandMap() ? 1 : 0"`. Textura en error/loading → `bandMap()`
  undefined → `useMap=0` → correa con color plano (`bandColor()`), sin crash. Encaja con el gating
  de `useMap` de la feature 4 (ahora además no lanza).
- **GLB**: template pasa de `@if (gltf.value(); as data)` a `@if (gltfData(); as data)`. GLB en
  error → sin tarjeta (clip/clamp incluidos), escena viva.
- **Effects existentes endurecidos** (también leían `value()` directo → riesgo de throw dentro del
  effect): el de RepeatWrapping ahora lee `bandMap()`; el de tinte del metal ahora lee `gltfData()`.
- **Avisos dev nuevos (no silencian)**: dos effects que observan `bandTexture.status()` y
  `gltf.status()`; si `=== 'error'` y `ngDevMode`, emiten `console.warn('[ngx-products-3d] ...')`
  con la URL. Único `console` permitido (conventions.md §Manejo de errores). NO van en
  `beforeRender` (one-shot por transición a error).
- Comentarios del template (band + GLB) actualizados para reflejar el gate no-lanzante.

Sin `any`. Sin deps nuevas. Física/material/lighting/drag/estabilización/cursor intactos. Nada de
RenderTexture ni playground tocados.

### 3. Test del componente `badge-scene.component.spec.ts`
- Mock de `angular-three-soba/loaders` ampliado: `gltfResource`/`textureResource` ahora exponen
  `hasValue: () => false` y `status: () => 'loading'` además de `value: () => undefined` (los
  computed nuevos y los effects de warn los consumen). Sigue simulando "sin resolver" → no monta
  render en jsdom y los warns no disparan.
- `SceneInternals` amplía `gltfData` y `bandMap`.
- 2 tests nuevos: `gltfData()` y `bandMap()` undefined vía el accessor seguro con recurso sin
  resolver.

## Verificación (salida literal)

`pnpm build`:
```
✔ Built @dotted-labs/ngx-products-3d
Build at: 2026-07-12T20:29:24.050Z - Time: 5474ms
```

`pnpm ng lint ngx-products-3d`:
```
Linting "ngx-products-3d"...
All files pass linting.
```

`pnpm ng test ngx-products-3d`:
```
 Test Files  7 passed (7)
      Tests  59 passed (59)
```
(54 previos + 3 resource-value + 2 badge-scene = 59.)

`pnpm ng build products-3d-playground`:
```
Application bundle generation complete. [13.184 seconds]
Output location: C:\Projects\dixper\ngx-products-3d\dist\products-3d-playground
```

## Re-smoke pendiente (N3, requiere navegador — a cargo del usuario)
- Con una `bandTextureUrl` ROTA/404: el badge se ve (correa con color plano, tarjeta y física OK),
  NO canvas en blanco; aparece el `console.warn [ngx-products-3d] ... textura de la correa ...`.
- Con `cardModelUrl` roto: escena viva sin tarjeta + warn `... modelo de la tarjeta ...`.
- Con los assets reales (tarea de tooling en paralelo): correa texturizada (repeat ~4×) y tarjeta
  GLB normales, sin warns.

## Discrepancias con la spec
Ninguna. El API real de `ResourceRef` (`hasValue()`/`status()`/`value()`/`error()`) coincide con lo
descrito en el brief.

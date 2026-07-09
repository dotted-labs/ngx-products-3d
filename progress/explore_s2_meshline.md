# Spike S2 — meshline + angular-three v4 (exploración estática)

Fecha: 2026-07-07 · Paquetes inspeccionados: `meshline@3.3.1`, `three@0.182.0`, `angular-three@4.2.3`

## Veredicto

**Viable estáticamente: SÍ.** No se encontró ningún bloqueo:

- `MeshLineGeometry extends THREE.BufferGeometry` y `MeshLineMaterial extends THREE.ShaderMaterial` → el renderer de angular-three v4 los auto-attachea a `mesh.geometry` / `mesh.material` sin config extra.
- `extend({ MeshLineGeometry, MeshLineMaterial })` registra las claves PascalCase; el renderer convierte `ngt-mesh-line-geometry` → `MeshLineGeometry` con `kebabToPascal`, que coincide exactamente.
- meshline no usa ninguna API de three eliminada en 0.182; incluye un guard de versión para `colorspace_fragment` (r154+).

**Pendiente de confirmación runtime:**

1. Render visual correcto del shader (miter joins, `sizeAttenuation`) — solo verificable con la app corriendo.
2. Que el binding `[resolution]` reciba el tamaño real del canvas (leerlo del store `size` de angular-three); con el default `Vector2(1,1)` la línea se ve mal cuando `sizeAttenuation === 0`.
3. Coste real de `setPoints()` por frame (asigna arrays JS + `Float32Array` nuevos en cada llamada incluso en el camino de reuso — ver Fallback/perf).

## Firmas (copiadas de los .d.ts)

### `node_modules/meshline/dist/MeshLineGeometry.d.ts`

```ts
export type PointsRepresentation =
  | THREE.BufferGeometry
  | Float32Array
  | THREE.Vector3[]
  | THREE.Vector2[]
  | THREE.Vector3Tuple[]
  | THREE.Vector2Tuple[]
  | number[];

export type WidthCallback = (p: number) => any;

export declare class MeshLineGeometry extends THREE.BufferGeometry {
    type: string;
    isMeshLine: boolean;
    widthCallback: WidthCallback | null;
    points: Float32Array | number[];           // setter → llama a setPoints(value, this.widthCallback)
    constructor();                              // sin argumentos
    setMatrixWorld(matrixWorld: THREE.Matrix4): void;
    setPoints(points: PointsRepresentation, wcb?: WidthCallback): void;
    /** Fast method to advance the line by one position. The oldest position is removed. */
    advance({ x, y, z }: THREE.Vector3): void;
}
```

- `setPoints` acepta `Vector3[]`, `Float32Array`, `number[]` plano, tuplas y hasta un `BufferGeometry` (usa su atributo `position`). Segundo parámetro opcional: callback de anchura `(p: number) => number` con `p ∈ [0,1]` a lo largo de la línea.
- `advance(v3)` es el camino rápido para trails de longitud fija: hace memcpy sobre los `Float32Array` existentes y solo marca `needsUpdate` (cero allocations). **Recomendado para actualización por frame** en vez de `setPoints`.
- Índice interno `Uint16Array` → máx. 65 535 vértices ≈ 32 700 puntos por línea (sobrado para trails).

### `node_modules/meshline/dist/MeshLineMaterial.d.ts`

```ts
export interface MeshLineMaterialParameters {
    lineWidth?: number;
    map?: THREE.Texture;
    useMap?: number;
    alphaMap?: THREE.Texture;
    useAlphaMap?: number;
    color?: string | THREE.Color | number;
    gradient?: string[] | THREE.Color[] | number[];
    opacity?: number;
    resolution: THREE.Vector2;      // <- único campo NO opcional en el tipo
    sizeAttenuation?: number;       // number (0|1), no boolean
    dashArray?: number;
    dashOffset?: number;
    dashRatio?: number;
    useDash?: number;
    useGradient?: number;
    visibility?: number;
    alphaTest?: number;
    repeat?: THREE.Vector2;
}

export declare class MeshLineMaterial extends THREE.ShaderMaterial implements MeshLineMaterialParameters {
    constructor(parameters: MeshLineMaterialParameters);
    copy(source: MeshLineMaterial): this;
    // + propiedades get/set que mapean 1:1 a uniforms (dist/index.js:379-543)
}
```

Notas del código compilado (`dist/index.js`):

- Todas las props son accessors instancia→uniform, así que el `applyProps` del renderer de angular-three funciona con bindings normales (`[lineWidth]`, `[color]`, `[resolution]`...). `resolution` y `repeat` hacen `.copy(value)` (hay que pasar un `Vector2`).
- Aunque el tipo marca `resolution` como requerido, el uniform tiene default `Vector2(1,1)` y `Material.setValues(undefined)` es no-op en three r182 (`src/materials/Material.js:555-557`) → el renderer puede hacer `new MeshLineMaterial()` sin args sin romper; el tipo solo afecta si se instancia manualmente en TS.
- `depthTest`, `transparent`, `depthWrite`, etc. no están en el interface pero se heredan de `THREE.Material` y funcionan como bindings normales.
- `raycast` se exporta aparte (`dist/raycast.d.ts`): hay que asignarlo manualmente (`mesh.raycast = raycast`) solo si se necesitan pointer-events sobre la línea.

## Compatibilidad three

- Instalado: `three@0.182.0` (`node_modules/three/package.json`). peerDependency de meshline: `three >= 0.137` → **satisfecha**.
- Riesgos concretos encontrados: **ninguno**. Auditadas las APIs que usa `dist/index.js`:
  - `BufferAttribute.copyArray` → sigue existiendo (`three/src/core/BufferAttribute.js:245`).
  - `setAttribute` / `setIndex` / `computeBoundingSphere` / `computeBoundingBox` → vigentes.
  - `THREE.UniformsLib.fog` → vigente.
  - Guard de versión propio (`dist/index.js:294-295`): con `REVISION = 182` usa `#include <colorspace_fragment>` (correcto en r182; `encodings_fragment` solo se usaría en <r154).
  - `raycaster.params.Line.threshold` → vigente.
  - No usa `setDrawRange`, `onBeforeCompile`, `Geometry` legacy ni nada renombrado/eliminado.
- Detalle menor sin impacto: en el camino de reuso de `process()` el atributo `counters` no se re-copia (solo en creación), pero `counters` solo depende del nº de puntos, que en ese camino es constante.

## Integración angular-three v4

Fuentes: `node_modules/angular-three/types/angular-three.d.ts` y `node_modules/angular-three/fesm2022/angular-three.mjs`.

- **extend** (`types/angular-three.d.ts:1414`): `declare function extend(objects: object): () => void;` — registra en un catálogo global (`NGT_CATALOGUE`) y devuelve función de cleanup. Se llama a nivel de módulo o en el constructor del componente: `extend({ MeshLineGeometry, MeshLineMaterial })`.
- **Mapeo de nombres** (`fesm2022/angular-three.mjs:2163-2174`): para un elemento `ngt-*`, el renderer hace `kebabToPascal(name.slice(4))` (`mjs:1810`) y busca esa clave en el catálogo; si no está, cae al namespace `THREE`. `ngt-mesh-line-geometry` → `MeshLineGeometry` ✔ y `ngt-mesh-line-material` → `MeshLineMaterial` ✔ (coincidencia exacta con las claves de `extend`).
- **Attach automático** (`mjs:2181-2186`): tras `new threeTarget(...args)`, si la instancia tiene `isBufferGeometry` → `attach = ['geometry']`; si `isMaterial` → `attach = ['material']`. Ambos flags se heredan de `BufferGeometry`/`ShaderMaterial`, así que el attach al `<ngt-mesh>` padre es automático, sin `attach` explícito.
- **CUSTOM_ELEMENTS_SCHEMA**: sí, obligatorio en cada componente que use elementos `ngt-*` (`schemas: [CUSTOM_ELEMENTS_SCHEMA]`, marcado como "required" en `node_modules/angular-three/README.md:46`).
- **Constructor args**: `MeshLineGeometry`/`MeshLineMaterial` no los necesitan (constructores sin args obligatorios); si hicieran falta existe la estructural `*args` (`NgtArgs`, `types/angular-three.d.ts:59`).
- **Acceso a la instancia**: template ref sobre el elemento + `viewChild` de `ElementRef`; el `nativeElement` del renderer node ES la instancia de three (patrón documentado en los propios docs del paquete: `this.meshRef.nativeElement`, `types/angular-three.d.ts:1926`, y `resolveRef` `:2221-2231`):

  ```html
  <ngt-mesh>
    <ngt-mesh-line-geometry #line />
    <ngt-mesh-line-material [lineWidth]="0.05" color="#ff0000" [resolution]="resolution" [sizeAttenuation]="1" />
  </ngt-mesh>
  ```

  ```ts
  private lineRef = viewChild.required<ElementRef<MeshLineGeometry>>('line');
  ```

- **Por frame** (`types/angular-three.d.ts:1857-1865`):

  ```ts
  declare function beforeRender(cb: (state: NgtRenderState) => void, { priority, injector }?: {
      priority?: number | (() => number);
      injector?: Injector;
  }): () => void;   // devuelve cleanup
  declare const injectBeforeRender: typeof beforeRender; // @deprecated, se elimina en v5
  ```

  En v4 el nombre canónico es `beforeRender` (`injectBeforeRender` sigue existiendo como alias deprecated). Debe llamarse en contexto de inyección (constructor/field initializer). Dentro del callback: `this.lineRef().nativeElement.setPoints(points)` o, mejor para trails de longitud fija, `.advance(nuevaPosicion)`. `NgtRenderState` incluye `delta`, `clock`, `camera`, `gl`, `size`, etc. — `size` sirve para alimentar el binding `[resolution]`.

## Fallback TubeGeometry

`THREE.TubeGeometry` (vigente en r182) sería el plan B: geometría 3D real con grosor en unidades de mundo, iluminable con materiales estándar y raycast nativo. Contras decisivos para un trail animado: es inmutable — actualizar la curva implica `new TubeGeometry(...)` + `dispose()` de la anterior **cada frame** (allocations de todos los buffers + re-upload completo a GPU + presión de GC), con un coste por frame muy superior al `advance()`/`setPoints()` de meshline que reutiliza atributos; además genera muchos más vértices (tubularSegments × radialSegments × 2) y no ofrece anchura en píxeles de pantalla ni dashes. Solo compensaría si se necesitara un tubo volumétrico iluminado y la línea se actualizara con poca frecuencia.

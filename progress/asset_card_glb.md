# Asset: card.glb (spec-03 — Contrato del modelo GLB)

## Resultado

Sustituido el placeholder de texto (116 bytes) por un GLB binario real en
`projects/products-3d-playground/public/assets/card.glb` (**222 820 bytes**).

## Cómo se generó (reproducible)

three.js `0.182.0` ya está en `node_modules`. Script generador (ESM) en el
scratchpad:

`.../scratchpad/gen-card-glb.mjs`

Como el scratchpad está fuera del repo, el bare specifier `three` no resuelve
desde ahí. Se ejecuta copiando el script a la raíz del repo (donde
`node_modules` sí resuelve) y borrándolo después:

```powershell
Copy-Item <scratchpad>\gen-card-glb.mjs C:\Projects\dixper\ngx-products-3d\.gen-card-glb.mjs
node C:\Projects\dixper\ngx-products-3d\.gen-card-glb.mjs
Remove-Item C:\Projects\dixper\ngx-products-3d\.gen-card-glb.mjs
```

El script acepta un arg opcional con la ruta de salida; por defecto escribe en
`projects/products-3d-playground/public/assets/card.glb`.

### Fricción encontrada y cómo se resolvió

1. **`three/package.json` no exportado** — no se puede leer la versión con
   `require('three/package.json')`; se leyó el `package.json` directo del
   directorio del módulo.
2. **Resolución de módulos desde el scratchpad** — el bare specifier `three`
   no resuelve fuera del árbol del repo. Solución: ejecutar una copia del
   script desde la raíz del repo (temporal, se borra al terminar). El script
   canónico queda en el scratchpad.
3. **`FileReader is not defined`** — `GLTFExporter.parse(..., { binary: true })`
   usa `new FileReader().readAsArrayBuffer(blob)` para armar el chunk BIN.
   Node 22 tiene `Blob` global pero no `FileReader`. Se añadió un polyfill
   mínimo (~8 líneas) que delega en `blob.arrayBuffer()` y dispara
   `onloadend`. Sin texturas no hace falta ningún polyfill de DOM/canvas.

## Geometría / posiciones finales

Origen del GLB (0,0,0) = anclaje del clip (arriba); la tarjeta cuelga debajo.
Números anclados a `badge.config.ts` (planeSize 1.6×2.25, half-extents Z 0.01 →
grosor 0.02, cardJointAnchor y=1.45).

| Nodo   | Geometría                                   | Tamaño            | Centro          | Material |
|--------|---------------------------------------------|-------------------|-----------------|----------|
| `card` | `RoundedBoxGeometry` (segments 6, radio 0.08) | 1.6 × 2.25 × 0.02 | (0, -1.45, 0)   | `base`   |
| `clip` | `TorusGeometry` (R 0.12, tubo 0.03) en plano XY | —               | (0, 0, 0)       | `metal`  |
| `clamp`| `BoxGeometry`                               | 0.5 × 0.18 × 0.06 | (0, -0.28, 0)   | `metal`  |

Borde superior de la tarjeta en y = -1.45 + 1.125 = **-0.325**; clip en ~0,
clamp en ~-0.28 → clip → clamp → borde alineados sin huecos.

### Materiales

- `base`: `MeshStandardMaterial` gris claro (`0xdddddd`), metalness 0.1,
  roughness 0.5. Se sobreescribirá en runtime con `MeshPhysicalMaterial` +
  RenderTexture (Fase 4); lo importante es el nombre y que esté en `card`.
- `metal`: `MeshStandardMaterial` gris (`0xcccccc`), metalness 0.9,
  roughness 0.25. Compartido por `clip` y `clamp`.

## Validación (script `.../scratchpad/validate-card-glb.mjs`)

Re-parsea el chunk JSON del propio `.glb` sin asumir nada:

```
magic       : "glTF" OK
glb version : 2
total size  : 222820 (file: 222820)
size > 1KB  : OK
json chunk  : JSON OK
nodes       : [ 'card', 'clip', 'clamp' ]
materials   : [ 'base', 'metal' ]
nodes card/clip/clamp   : OK
materials base/metal    : OK
  mesh "card"  -> material "base"
  mesh "clip"  -> material "metal"
  mesh "clamp" -> material "metal"
RESULT      : ALL OK
```

Nota: `meshes[].name` en el JSON del GLB sale `undefined` porque GLTFExporter
pone el nombre en los **nodos** (`nodes[].name`), que es lo que consume el
runtime (`object.name` al cargar con GLTFLoader) y lo que exige el contrato.
Los tres nodos y los dos materiales existen con nombre EXACTO y la asignación
material↔mesh es la correcta (card→base, clip→metal, clamp→metal).

## Notas

- No se tocó `dist/products-3d-playground/browser/assets/card.glb` (lo regenera
  el build).
- Scripts (`gen-card-glb.mjs`, `validate-card-glb.mjs`) quedan en el
  scratchpad, no versionados.

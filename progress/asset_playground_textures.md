# Assets reales para el playground de badge

Reemplazo de los placeholders de texto por assets binarios reales, decodables en
navegador, para que `textureResource`/`THREE.TextureLoader` y `NgtsText3D`
carguen sin error.

## 1. Texturas (PNG generados sin dependencias)

Generadas a mano con `zlib.deflateSync` de Node (firma PNG + IHDR + IDAT + IEND),
color type 2 (RGB, 8 bits). Colocadas en
`projects/products-3d-playground/public/assets/`:

| Archivo            | Dimensiones | Contenido                                                        |
|--------------------|-------------|------------------------------------------------------------------|
| `band.png`         | 512x64      | Gradiente horizontal violeta→azul (marca) `#7c3aed`→`#2463eb`     |
| `base-default.png` | 256x256     | Gris neutro sólido `#94949c`                                      |
| `base-gold.png`    | 256x256     | Gradiente vertical dorado `#d4af37`→`#a8802040`(oscurece abajo)   |
| `base-silver.png`  | 256x256     | Gradiente vertical plateado `#d0d0d8`→`#a8acb4`                   |

Los 4 placeholders `.jpg` (que eran texto plano, no JPEG) fueron **eliminados**.

### Script reproducible
`scratchpad/gen_assets.js` (no versionado). Se ejecuta desde la raíz del repo:
```
node <scratchpad>/gen_assets.js
```
Implementa `crc32`, `chunk(type,data)` y `makePNG(w,h,fn)` con `fn(x,y,w,h)->[r,g,b]`
para colores sólidos o gradientes. Escribe los PNG, copia el font.json y borra los .jpg.

## 2. font.json (typeface real de three)

Copiado desde:
`node_modules/three/examples/fonts/helvetiker_regular.typeface.json`
→ `projects/products-3d-playground/public/assets/font.json`

Es un typeface válido: `familyName=Helvetiker`, **208 glyphs** (antes `{}` vacío).

## 3. Cambio de URLs del tema

`projects/products-3d-playground/src/app/badge-demo/badge-demo.routes.ts`
(`provideProducts3dBadgeTheme`), `.jpg` → `.png`:
- `bandTextureUrl: '/assets/band.png'`
- `baseTextures.gold: '/assets/base-gold.png'`
- `baseTextures.silver: '/assets/base-silver.png'`
- `defaultBaseTextureUrl: '/assets/base-default.png'`

`fontUrl` se mantiene en `/assets/font.json` (mismo nombre, contenido real).
No se tocó nada más del playground.

## 4. Validación

### PNGs (magic bytes + dimensiones leídas del IHDR)
```
band.png:        size=885B  sig=[89 50 4e 47 0d 0a 1a 0a] dims=512x64
base-default.png:size=759B  sig=[89 50 4e 47 0d 0a 1a 0a] dims=256x256
base-gold.png:   size=1044B sig=[89 50 4e 47 0d 0a 1a 0a] dims=256x256
base-silver.png: size=945B  sig=[89 50 4e 47 0d 0a 1a 0a] dims=256x256
```
Firma PNG correcta, todos >100 B.

### font.json
```
JSON.parse OK — glyphs count = 208, familyName = Helvetiker
```

### Build del playground
`pnpm ng build products-3d-playground` → **Application bundle generation complete**
(21 s, exit 0). Assets copiados al bundle:
```
dist/.../browser/assets/band.png (885), base-default.png (759),
base-gold.png (1044), base-silver.png (945),
font.json (63182 B, glyphs=208, Helvetiker)
```

# Explore S3 — Inspección GLB vs contrato spec-03

**Fecha:** 2026-07-10 · **Modo:** READ-ONLY · **Archivo objetivo:** `projects/products-3d-playground/public/assets/card.glb`

## TL;DR

El `card.glb` **NO es un modelo GLB**. Es un fichero de texto de **116 bytes** que actúa de
placeholder. No contiene contenedor glTF binario alguno: sus primeros bytes son el texto
`Placeholder GLB ...` en lugar del magic obligatorio `glTF` (`0x676C5446`). Por tanto **no hay
nodos, meshes, materiales ni extensiones que inspeccionar**. El contrato de spec-03 no puede
cumplirse con este asset.

**Recomendación: (C) — geometría procedural provisional** (`RoundedBox` de soba + `torus` para
clip/clamp), tal como ya prevé la propia spec ("Mientras Blender no entregue…"). El swap a GLB real
queda pendiente de que el pipeline Blender entregue el modelo.

## Cómo se inspeccionó (reproducible)

No hizo falta Node/GLTFLoader: el fichero es texto plano, se ve directamente con un hexdump.

```bash
f="projects/products-3d-playground/public/assets/card.glb"
xxd "$f" | head -40      # muestra el contenido completo (116 bytes)
```

Salida real (contenido íntegro del fichero):

```
00000000: 506c 6163 6568 6f6c 6465 7220 474c 4220  Placeholder GLB
00000010: 666f 7220 706c 6179 6772 6f75 6e64 2064  for playground d
00000020: 656f 2e20 5265 706c 6163 6520 7769 74... emo. Replace wit
00000050: 6e74 7261 6374 2028 6e6f 6465 733a 2063  ntract (nodes: c
00000060: 6172 642c 2063 6c69 702c 2063 6c61 6d70  ard, clip, clamp
00000070: 292e 0d0a                                ).
```

Texto legible completo:
> "Placeholder GLB for playground demo. Replace with card model matching the GLB contract
> (nodes: card, clip, clamp)."

Validación del magic: un `.glb` válido debe empezar por `glTF` (`67 6C 54 46`). Aquí empieza por
`Plac` (`50 6C 61 63`) → **no es GLB**.

### Búsqueda de un GLB real en el repo

```bash
# Glob **/*.glb  y  **/*.gltf
```

- `projects/products-3d-playground/public/assets/card.glb` → placeholder (116 B).
- `dist/products-3d-playground/browser/assets/card.glb` → copia de build del mismo placeholder.
- `**/*.gltf` → ninguno.

No existe ningún modelo 3D real en el repositorio.

## Nodos / meshes / materiales reales

| Tipo         | Nombres encontrados |
|--------------|---------------------|
| Nodos        | (ninguno — no es un GLB) |
| Meshes       | (ninguno) |
| Materiales   | (ninguno) |
| extensionsUsed / extensionsRequired | (ninguno) |

**Draco:** No aplica (no hay contenedor glTF). N/A.

## Cumplimiento del contrato — punto por punto

| Requisito del contrato (spec-03 §"Contrato del modelo GLB") | Estado |
|---|---|
| Nodo `card` (mesh de la tarjeta) | ❌ Ausente |
| Nodo `clip` (gancho metálico) | ❌ Ausente |
| Nodo `clamp` (pinza) | ❌ Ausente |
| Material `base` (asignado a `card`, recibe RenderTexture) | ❌ Ausente |
| Material `metal` (clip + clamp) | ❌ Ausente |
| Origen del conjunto en anclaje del clip (`BADGE_PHYSICS.cardJointAnchor`) | ❌ No verificable |
| Dimensiones tarjeta ≈ ratio 16:22.5 | ❌ No verificable |
| Transforms aplicados, Y-up, unidades métricas | ❌ No verificable |
| Compresión Draco (documentar si se usa) | N/A — no hay geometría |

**Discrepancias:** todas. El asset es un placeholder de texto, no un modelo. No hay mapeo de nombres
posible porque no hay nodos/materiales de ningún tipo.

## Recomendación

**(C) Geometría procedural provisional.** No hay GLB usable (ni tal cual ni con mapeo de nombres).
Implementar la estructura de componente con:

- **Tarjeta (`card`):** `RoundedBox` de `angular-three-soba` con proporción ≈ 16:22.5
  (p. ej. base collider `[0.8, 1.125]` × escala del grupo ~2.25), material `MeshPhysicalMaterial`
  con los `BADGE_MATERIAL_DEFAULTS` de la spec (clearcoat 1, clearcoatRoughness 0.15, roughness 0.3,
  metalness 0.5). Este material hará de "`base`" y recibirá la RenderTexture en Fase 4.
- **Clip / clamp:** `torus` (u otra primitiva) con un material metálico compartido que haga de
  "`metal`" (metalness alto, roughness bajo), tiñe opcional vía `theme.colors.clip`.
- **Origen:** situar el grupo de modo que el punto de anclaje coincida con
  `BADGE_PHYSICS.cardJointAnchor` sin offsets mágicos, replicando la intención del contrato.

Mantener la **misma estructura de componente y el tipo `BadgeGLTF`** (nodos `card/clip/clamp`,
materiales `base/metal`) para que el swap a GLB real sea trivial cuando Blender entregue.
Marcar el asset/procedural como **provisional** en el código (criterio de aceptación de la spec lo
permite: "procedural eliminado (o marcado provisional si Blender pendiente)").

**Acción de seguimiento (fuera de este spike):** cuando llegue el GLB real de Blender, re-ejecutar
esta inspección (ahora sí con GLTFLoader/parseo del chunk JSON) para validar nombres exactos de
nodos/materiales y documentar si usa `KHR_draco_mesh_compression`.

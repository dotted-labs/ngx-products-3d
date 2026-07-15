# Informe impl — feature 7 `badge-rendertexture-map` (spec-03, Fase 4)

- **Fecha**: 2026-07-13
- **Estado**: implementado, verificación automática verde. Pendiente review (no marcado `done`).
- **Perímetro**: diff adicional sobre el working tree con la feature 6 sin commitear (intencional,
  no se ha hecho commit).

## Archivos tocados (delta de esta feature)

| Archivo | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts` | Monta `NgtsRenderTexture` (tupla) como `map` del `<ngt-mesh-physical-material>` de la tarjeta: `attach="map"` + `<ng-template renderTextureContent>` envolviendo `<products-3d-badge-texture [member]="member()" [theme]="theme()" />`. Nuevo campo `renderTextureOptions` (todo desde config). Eliminados el campo `mapAnisotropy` y su binding `[mapAnisotropy]` del material (era un no-op, ver decisión 3). Imports += `NgtsRenderTexture`, `NgtsRenderTextureOptions` (type), `Products3dBadgeTexture`, `BADGE_TEXTURE`. |
| `projects/ngx-products-3d/src/lib/badge/badge.config.ts` | `BADGE_TEXTURE` += `frames: Infinity` con JSDoc que documenta la decisión y su coste (ver decisión 2). JSDoc de `BADGE_MAP_ANISOTROPY` actualizado al cableado real (options del RenderTexture → `fbo.texture`). |
| `projects/ngx-products-3d/src/lib/badge/badge-scene.component.spec.ts` | +1 test: `renderTextureOptions` derivado de `BADGE_TEXTURE`/`BADGE_MAP_ANISOTROPY` (config-driven, cero números mágicos). Stub `vi.hoisted` del contexto 2D de canvas (réplica exacta del patrón ya aceptado en `badge.component.spec.ts`, ver decisión 5). |
| `projects/ngx-products-3d/src/lib/badge/badge-texture.component.ts` | Solo minors de la review de feature 6 + doc-drift: import >100 chars partido (minor 1 de `review_feature6.md`); JSDoc/comentarios "cuando la feature 7 monte…" actualizados a presente. Sin cambios de lógica. |
| `progress/current.md`, `progress/impl_feature7.md` | Protocolo. |

Sin dependencias nuevas, sin cambios de peers, **sin tocar el playground** (ya pasaba
`[member]` al badge — `badge-demo.component.ts:13` — no hizo falta ajuste mínimo).

## Decisiones

### 1. Firma de NgtsRenderTexture (verificada en node_modules, coincide con el spike)

- Tupla `[NgtsRenderTextureImpl, NgtsRenderTextureContent]`:
  `node_modules/angular-three-soba/types/angular-three-soba-staging.d.ts:2169`. Se añade la
  const `NgtsRenderTexture` directamente al array `imports` (Angular acepta arrays anidados;
  es el patrón del propio JSDoc de soba).
- Directiva de contenido: selector `ng-template[renderTextureContent]` (`…staging.d.ts:2106`).
  No existe `cameraContent`: la cámara va dentro del template — la pone
  `Products3dBadgeTexture` con su `ngts-perspective-camera` `makeDefault` (feature 6), que
  registra la cámara en el store DEL PORTAL (`store.update({ camera })`,
  `angular-three-soba/fesm2022/angular-three-soba-cameras.mjs:420`), sin tocar la cámara
  principal.
- `attach`: input propio del componente con default `'map'` (`…staging.d.ts:2132`,
  fesm `:3238`); se fija explícito `attach="map"` como pide la spec.
- Options (`NgtsRenderTextureOptions`, `…staging.d.ts:2009-2061`): `width`, `height`,
  `samples` (8), `stencilBuffer`, `depthBuffer`, `generateMipmaps`, `renderPriority`,
  `eventPriority`, `frames` (default `Infinity`), `compute`, y por extensión de
  `Partial<Omit<NgtThreeElements['ngt-texture'], 'attach'>>` cualquier propiedad de `Texture`
  (p. ej. `anisotropy`).

### 2. Render estático vs continuo: `frames: Infinity` (coste por-frame, documentado)

`frames: 1` existe (el spike lo confirmó) **pero es incompatible con la reactividad**, con
evidencia en la implementación real:

- `NgtsRenderTextureContainer` (`angular-three-soba/fesm2022/angular-three-soba-staging.mjs:3132-3159`)
  renderiza al FBO mientras `count < frames * frames`; `count` es una variable de cierre del
  `effect` y **solo se resetea cuando el effect se re-ejecuta**. Ese effect trackea únicamente
  `renderPriority()` y `store()` (el signal-state del portal).
- El montaje async del contenido (plano cuando resuelve `textureResource`, TextGeometry cuando
  resuelve la fuente) va por el `hierarchyStore` de cada instancia, NO actualiza el store del
  portal; los cambios de `member`/`theme` tampoco. Con `frames: 1` el único frame se pintaría
  antes de que existan fondo y textos → **frente en blanco congelado**, y cambiar member/theme
  no re-renderizaría jamás.
- No hay API pública de invalidación del contador: `invalidate()` del store solo alimenta el
  frameloop `demand` (nuestro canvas usa el default `always`) y no toca `count`. Los únicos
  triggers serían hacks sobre internals (togglear `renderPriority` — que además con >0 puede
  apagar el auto-render del loop principal — o forzar `store.update`), ambos frágiles ante
  cualquier patch de soba. Descartados.

**Mecanismo mínimo que funciona**: `frames: Infinity` (el default de soba) = re-render continuo.
La reactividad sale gratis: el contenido del template lee los inputs (signals) de la escena;
cualquier cambio de member/theme (o resolución async de recursos) muta la escena virtual y el
siguiente frame del loop la vuelca al FBO. **Coste documentado** (JSDoc de
`BADGE_TEXTURE.frames`): un render extra por frame de una escena mínima (1 plano + 3 textos) a
un FBO 2000×2000 con MSAA 8 (default). Es exactamente lo que hace el ejemplo lanyard de
referencia de drei (RenderTexture sin `frames`). La acceptance permite esta ruta si se
documenta; hecho en config + comentario de template + este informe. **La spec/feature_list
daban `frames: 1` como preferente — discrepancia con la API real documentada aquí para
actualizar la spec.**

### 3. `mapAnisotropy` (BADGE_MAP_ANISOTROPY): movido a las options del RenderTexture

El binding `[mapAnisotropy]` sobre `<ngt-mesh-physical-material>` (feature 3) **era un no-op**:
el renderer de angular-three solo hace "pierce" de claves con punto
(`resolveInstanceKey`, `node_modules/angular-three/fesm2022/angular-three.mjs:928-946`;
`mapAnisotropy` no se parte y `MeshPhysicalMaterial` no tiene esa propiedad — la notación
camelCase de R3F `map-anisotropy` no existe en angular-three v4). Cableado real:
`NgtsRenderTexture` pasa las options restantes (tras omitir las de FBO/loop,
fesm `:3241-3252`) como `[parameters]` del `<ngt-primitive *args="[fbo.texture]">`
(fesm `:3331`) → `anisotropy: BADGE_MAP_ANISOTROPY` en `renderTextureOptions` se aplica
**sobre la textura real** (`fbo.texture.anisotropy = 16`). Binding del material eliminado y
JSDoc de config corregido. (Discrepancia con el enunciado de la feature 3 documentada para la
spec; el criterio "propiedad de la textura, no del material" del brief queda cumplido.)

### 4. Cableado member/theme

`member` y `theme` ya llegaban a `Products3dBadgeScene` como `input.required` (los pasa
`Products3dBadge` — `badge.component.ts:58` — con `resolvedTheme()`); `member` estaba declarado
sin uso desde spec-02. Dentro del template del RenderTexture se leen directamente:
`<products-3d-badge-texture [member]="member()" [theme]="theme()" />`. El playground ya
alimentaba `[member]`/`[theme]` con signals → reactividad en vivo sin recrear canvas, sin
tocar el playground. `Products3dBadgeTexture` gatea internamente su textura base/fuente (no se
duplican gates fuera).

### 5. Stub de canvas 2D en badge-scene.component.spec.ts

Al importar ahora `badge-scene.component.ts` → `angular-three-soba/staging` (y
`badge-texture.component.ts`), la suite arrastra en tiempo de carga módulos que crean un
`<canvas>` y piden `getContext('2d')` (lottie de three vía staging); jsdom devuelve `null` y la
suite entera moría al importar (0 tests). Se replicó **exactamente** el stub `vi.hoisted` ya
aceptado en review para `badge.component.spec.ts` (mismo problema, mismo patrón). Sugerencia
para el leader (fuera de mi perímetro): extraerlo a un `setupFiles` compartido de vitest en una
tarea de housekeeping, para no tener 2 copias.

### 6. Minors de la review de feature 6 (mandato "arreglar de paso en feature 7")

- Minor 1 (import >100 chars en `badge-texture.component.ts:13`): partido en multilínea. ✔
- Minor 2 (referencia a "baseTextureErrorEffect"): ya no existía en el working tree (el texto
  actual dice "el effect de error del constructor"); nada que hacer. ✔
- Minor 3 (CRLF preexistente en `badge.config.ts`): no tocado — normalizar EOLs de un archivo
  entero excede el perímetro de esta feature y ensuciaría el diff.

## Criterios de aceptación (feature_list.json id 7)

- [x] Tarjeta con textura dinámica (nombre + número + tier sobre textura base del tier) como
  `map` del material físico — montaje implementado; confirmación visual en N3 (abajo).
- [x] Cambiar member/theme actualiza la tarjeta sin recrear el canvas — inputs signal +
  frames continuo (ver decisión 2); el canvas no se recrea (nada re-monta `<ngt-canvas>`).
- [x] `size` desde `BADGE_TEXTURE`; render estático descartado con evidencia y coste por-frame
  documentado (ruta permitida por la acceptance).
- [x] `pnpm build` ✅ (3.2s) · `pnpm ng lint ngx-products-3d` ✅ (All files pass) ·
  `pnpm ng test ngx-products-3d` ✅ **69/69** (68 previos + 1 nuevo, 8 files).
- [x] Extra N2: `pnpm ng build products-3d-playground` ✅ (9.7s).

## Verificación manual pendiente (N3 — OBLIGATORIA en review según review_feature6.md)

No ejecutada por este implementer (sin navegador en esta sesión). Checklist de Fase 4 para el
reviewer/usuario en playground (`pnpm ng serve products-3d-playground`):

1. El frente de la tarjeta muestra la textura base `gold` + "Sergio" / "#0042" / "GOLD".
2. Cambiar el signal `member` (devtools o editar el componente demo) actualiza el frente en
   vivo sin recrear el canvas; tier desconocido → textura default visible.
3. Nombre largo se encaja al ancho máximo; colorSpace sRGB correcto (sin lavado).
4. 60 fps estables con drag (coste del FBO 2000² por frame asumido).
5. Ajuste fino visual de `BADGE_TEXT_LAYOUT`/`planeSize` si hiciera falta → feature 9.

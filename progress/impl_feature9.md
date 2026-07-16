# Informe impl — feature 9 `playground-complete` (spec-03, fase 5)

- **Fecha**: 2026-07-15
- **Perímetro respetado**: SOLO `projects/products-3d-playground/` (código + assets).
  La lib `projects/ngx-products-3d/` NO se tocó. CERO dependencias nuevas. Tweakpane no usado.
  Los cambios sin commitear de features 6/7/8 quedan intactos.

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `projects/products-3d-playground/src/app/badge-demo/badge-demo.component.ts` | Form (name/memberNumber/tier), selector de temas, tier inicial corregido, toggle debug conservado |
| `projects/products-3d-playground/src/app/badge-demo/badge-demo.routes.ts` | Solo comentario anti-divergencia (el provider theme debe = tema `violet` de `DEMO_THEMES`) |
| `projects/products-3d-playground/public/assets/band-ember.png` | NUEVO — 512×64, tema ember |
| `projects/products-3d-playground/public/assets/base-ember-gold.png` | NUEVO — 256×256 |
| `projects/products-3d-playground/public/assets/base-ember-silver.png` | NUEVO — 256×256 |
| `projects/products-3d-playground/public/assets/base-ember-default.png` | NUEVO — 256×256 |

## Decisiones (con evidencia)

1. **Form con bindings nativos, NO ReactiveForms.** `[value]` + `(input)`/`(change)` +
   `member.update(m => ({ ...m, campo }))`. Es el patrón mínimo consistente con
   conventions (signals + OnPush, playground = demo) y evita importar `@angular/forms`
   sin necesidad. Los controles viven FUERA del `@defer`, en un `<div class="controls">`
   (no `<form>`: evita submit implícito con Enter → recarga de página). Nada del canvas
   depende de nodos que se re-monten: solo cambian signals (`[member]`, `[theme]`,
   `[debug]` sobre el mismo `<products-3d-badge>`).
2. **Tier inicial corregido**: `'silverFUnc'` (typo deliberado de sesiones previas para
   probar fallback) → `'gold'` (valor del select). El fallback ahora se prueba con la
   opción explícita `bronze (desconocido → default)` del select, que NO existe en
   `baseTextures` de ningún tema demo → `defaultBaseTextureUrl` (fn pura
   `resolveBaseTextureUrl`, ya testeada en la lib).
3. **Selector de temas**: `DEMO_THEMES: Record<DemoThemeKey, Products3dBadgeTheme>`
   (const a nivel de módulo del componente demo — la regla "constantes en
   badge.config.ts" aplica a la lib; el playground es app demo) + signal `themeKey` +
   `theme = computed(() => DEMO_THEMES[themeKey()])`. Cambiar el select solo muta la
   signal; el binding `[theme]` es reactivo (feature 7) y no recrea el canvas.
4. **Gotcha resolvedTheme conservado y documentado en ambos lados**: el input `[theme]`
   PISA por completo al tema del provider (`theme() ?? themeFromToken`, sin merge,
   `badge.component.ts:109-115`). El tema `violet` de `DEMO_THEMES` es IDÉNTICO
   byte-a-byte al del `provideProducts3dBadgeTheme` de las rutas; comentario
   anti-divergencia añadido en `badge-demo.component.ts` (sobre `DEMO_THEMES`) y en
   `badge-demo.routes.ts` (sobre el provider).
5. **Tema 2 "Ember (cobre)"** con assets propios y `colors` distintos para que el cambio
   sea evidente en TODO el badge, no solo en la textura del frente:
   - `bandTextureUrl: '/assets/band-ember.png'` — gradiente **periódico** (coseno) rojo
     `#7f1d1d` → naranja `#f97316`: sin costura al tilear con `repeat [-4,1]`; rayas
     diagonales de periodo 64 (divide 512 → tilean) y bisel oscuro en bordes.
   - Bases 256×256 con gradiente vertical + brillo radial + cepillado horizontal fino:
     `base-ember-gold.png` (ámbar), `base-ember-silver.png` (platino cálido),
     `base-ember-default.png` (piedra cálida con rescoldo naranja inferior — fallback
     visualmente inconfundible frente al gris `base-default.png` del tema violeta).
   - `colors: { band: '#ffe3c2', clip: '#b45309', text: '#2a1205' }` → tinte de correa,
     clip cobrizo (clonado por la lib, feature 3) y texto marrón oscuro (legible sobre
     las 3 bases ember, todas medias/claras).
6. **Generación de assets dep-free, mismo patrón histórico**
   (`progress/asset_playground_textures.md`): script Node con `zlib.deflateSync`
   (firma PNG + IHDR + IDAT + IEND, color type 2 RGB 8-bit, CRC32 manual), ejecutado
   desde el scratchpad y **no versionado en el repo** (idéntico a como se hizo la vez
   anterior: `scratchpad/gen_assets.js` tampoco se versionó). PNGs binarios reales
   validados (firma `89504e470d0a1a0a` + dims del IHDR + inspección visual):
   ```
   band-ember.png:         43304B  512x64
   base-ember-gold.png:    28099B  256x256
   base-ember-silver.png:  11616B  256x256
   base-ember-default.png: 20581B  256x256
   ```
7. **Toggle de debug física**: conservado tal cual (checkbox → `debug.set`), solo
   reubicado dentro de `.controls` con el resto de controles.
8. **Sin tests nuevos**: el playground no tiene target de test y toda la lógica
   ejercitada (fallback de tier, resolución de tema, reactividad del map) ya está
   cubierta por fns puras testeadas en la lib (76 specs). Los criterios de esta feature
   son de integración visual → N3.

## Criterios de aceptación

| Criterio | Estado |
|---|---|
| Form (name/memberNumber/tier) actualiza la tarjeta reactivamente sin recrear canvas | ✅ implementado (solo `member.update` sobre signal; canvas fuera del flujo de re-montaje) — confirmación visual en N3 |
| Selector de >=2 temas cambia texturas/colores en vivo | ✅ implementado (violet + ember, assets y colors propios) — confirmación visual en N3 |
| Tier desconocido en el form muestra la textura default | ✅ implementado (opción `bronze` en select; fallback fn pura ya testeada) — confirmación visual en N3 |
| Toggle de debug física sigue funcionando | ✅ conservado sin cambios funcionales |
| `pnpm ng build products-3d-playground` sin errores | ✅ (9.4 s, bundle completo, assets copiados) |
| `pnpm build` sin errores | ✅ (3.6 s) |
| `pnpm ng lint ngx-products-3d` sin errores | ✅ "All files pass linting" |
| `pnpm ng test ngx-products-3d` > 0 y todos verdes | ✅ 76/76 (9 files) — ninguno roto |

## Checklist N3 (verificación visual del usuario — `pnpm start:playground`)

- [ ] Escribir en "Nombre" (p.ej. borrar y teclear un nombre largo) → el texto de la
      tarjeta cambia letra a letra SIN parpadeo/recreación del canvas (la tarjeta sigue
      colgando y oscilando; un nombre largo se encaja al ancho máximo).
- [ ] Cambiar "Nº socio" → el número (`#…`) del frente se actualiza en vivo.
- [ ] Tier `gold` → base dorada; `silver` → base plateada; `bronze (desconocido →
      default)` → base default (gris en violeta / piedra con rescoldo en ember). Con
      tier `bronze` NO debe aparecer warn de textura en consola (es fallback, no error).
- [ ] Cambiar Tema a "Ember (cobre)" → en vivo: correa roja/naranja con rayas (tinte
      cálido), clip cobrizo, texto marrón oscuro, base del frente acorde al tier. Volver
      a "Violeta (marca)" restaura el aspecto original. Sin recrear canvas ni perder la
      física (la tarjeta no se re-cuelga desde cero).
- [ ] Toggle "debug física" sigue mostrando/ocultando los colliders wireframe.
- [ ] Drag de la tarjeta sigue funcionando igual tras usar el form (sin regresión).

## Pendiente

- Review del líder + N3 del usuario. No he tocado `feature_list.json`.
- Nota (memoria del usuario): para producción se querrán assets de temas de mucha más
  calidad que estos PNGs procedurales — fuera del scope de esta feature.

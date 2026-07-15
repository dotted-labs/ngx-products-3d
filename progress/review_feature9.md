# Review — feature 9 `playground-complete` (spec-03, fase 5)

- **Fecha**: 2026-07-15
- **Reviewer**: agente reviewer
- **Informe revisado**: `progress/impl_feature9.md`

**Veredicto: APROBADO** (condicionado únicamente al N3 visual del usuario, que por definición no puede ejecutar el reviewer).

## Perímetro y boundaries

- [x] Lib NO tocada: `git diff --stat projects/ngx-products-3d` vacío. Los archivos de lib de las features 6/7/8 ya están commiteados (176ac42, 0fc5ac7, fb4a962).
- [x] Cero dependencias nuevas: ningún `package.json` ni lockfile modificado. Tweakpane no aparece.
- [x] Sin deep imports: `badge-demo.component.ts` importa solo de `@dotted-labs/ngx-products-3d` (architecture.md §Boundaries).
- [x] Archivos tocados = exactamente los declarados en el informe (component, routes-solo-comentario, 4 PNGs). Los diffs en `feature_list.json` (status in_progress), `progress/current.md` y `progress/history.md` son del leader, fuera de esta review.

## Criterios de aceptación (feature_list.json id 9)

- CA1 — Form actualiza reactivamente sin recrear canvas: [x] (implementación; confirmación final en N3)
  - Controles FUERA del `@defer`, en `.controls`; `<products-3d-badge>` es el único nodo dentro del `@defer (on viewport)` sin `@if`/`@for` envolvente ni `[attr]` que fuerce recreación.
  - Los handlers solo mutan signals (`member.update` con spread inmutable, `themeKey.set`, `debug.set`); ningún camino re-monta el componente.
  - Verificado en lib: `[member]`/`[theme]`/`[debug]` son `input()` signals consumidos por computeds (badge.component.ts:109-117), reactividad real de feature 7.
- CA2 — Selector de >=2 temas cambia texturas/colores en vivo: [x] (violet + ember; `theme = computed(() => DEMO_THEMES[themeKey()])`; ember con `bandTextureUrl`, 3 `baseTextures`/default y `colors` band/clip/text propios → cambio visible en correa, clip y texto, no solo en el frente)
- CA3 — Tier desconocido muestra textura default: [x] (opción `bronze` en el select; NO existe en `baseTextures` de violet ni ember → `defaultBaseTextureUrl` vía `resolveBaseTextureUrl`, fn pura ya testeada en la lib). Typo inicial `'silverFUnc'` corregido a `'gold'` (visible en diff).
- CA4 — Toggle debug física sigue funcionando: [x] (checkbox → `debug.set`, sin cambio funcional, solo reubicado en `.controls`)
- CA5 — `pnpm ng build products-3d-playground`: [x] verde (9.15 s, re-ejecutado por el reviewer)
- CA6 — `pnpm build`: [x] verde (2.86 s, re-ejecutado)
- CA7 — `pnpm ng lint ngx-products-3d`: [x] "All files pass linting" (re-ejecutado)
- CA8 — `pnpm ng test ngx-products-3d`: [x] 76/76 en 9 archivos (re-ejecutado)

## Verificaciones específicas del brief

- [x] **Gotcha [theme] pisa provider**: confirmado en `badge.component.ts:109-110` (`this.theme() ?? this.themeFromToken`, sin merge). El tema `violet` de `DEMO_THEMES` es idéntico campo a campo al del `provideProducts3dBadgeTheme` de `badge-demo.routes.ts` (mismas 4 URLs, sin colors en ninguno). Comentario anti-divergencia presente en AMBOS archivos.
- [x] **PNGs binarios reales**: firma `89 50 4E 47 0D 0A 1A 0A` verificada en los 4; IHDR: band-ember 512x64 (0x200×0x40), las 3 bases 256x256 (0x100×0x100). Tamaños 11-43 KB (no placeholders de texto).
- [x] **Tema ember coherente**: los 4 assets referenciados existen en `public/assets/`; `colors` con band/clip/text válidos (hex CSS); `fontUrl` reutiliza `/assets/font.json` existente.
- [x] **Conventions**: OnPush, signals (`signal`/`computed`), `protected readonly`, tabs, orden de miembros correcto, sin `console.log`, comentarios solo de porqué (gotcha, fallback de bronze, controles fuera del defer). `DEMO_THEMES` a nivel de módulo es aceptable: la regla de config en `badge.config.ts` aplica a la lib, no a la app demo.
- [x] **Checklist N3 propuesta** (impl_feature9.md) cubre CA1-CA4 + regresión de drag: adecuada.

## Observaciones menores (no bloqueantes)

1. `<select [value]="...">` sin ControlValueAccessor: el binding inicial puede aplicarse antes de que existan las `<option>`. Aquí funciona porque los valores iniciales (`gold`, `violet`) son la primera opción de cada select; si algún día el valor inicial deja de ser la primera opción, revisar. Punto extra a mirar en N3: que ambos selects muestran la opción correcta al cargar.
2. `height: 97vh` con indentación de espacios en styles (línea 87) es pre-existente, fuera del perímetro de esta feature.

## Cierre

N2 completo verde re-ejecutado por el reviewer. Falta solo la checklist N3 del usuario (`pnpm start:playground`) antes de marcar `done`.

# Informe impl — Feature 8 `badge-theme-validation` (spec-03, Fase 5)

- **Fecha**: 2026-07-14
- **Estado**: implementado, pendiente review (no marcado `done`)
- **Perímetro**: solo feature 8. Diff adicional sobre el working tree con features 6/7 sin
  commitear (no tocadas).

## Archivos tocados

| Archivo | Cambio |
|---|---|
| `projects/ngx-products-3d/src/lib/badge/badge-theme.ts` | **Nuevo.** Fn pura `assertValidBadgeTheme(theme)`: valida `defaultBaseTextureUrl` y `fontUrl`, lanza `Error` accionable con prefijo `[ngx-products-3d]`, devuelve el tema intacto si es válido. Patrón idéntico a los helpers existentes (`badge-material.ts`, `badge-texture.ts`). |
| `projects/ngx-products-3d/src/lib/badge/badge-theme.spec.ts` | **Nuevo.** 5 tests N1 de la fn pura. |
| `projects/ngx-products-3d/src/lib/badge/badge.component.ts` | `resolvedTheme` ahora hace `return assertValidBadgeTheme(theme)`. El error existente de `'no theme'` se CONSERVA byte a byte antes de la validación. Comentario de *por qué* la validación es temprana. |
| `projects/ngx-products-3d/src/lib/badge/badge.component.spec.ts` | +2 tests de integración: tema inválido por input `[theme]` y por token → `resolvedTheme()` lanza el error prefijado. |

## Decisiones (con evidencia)

1. **Dónde lanza el error y por qué cumple "temprano, no en mitad del render".**
   La validación vive dentro del computed `resolvedTheme` (badge.component.ts). Ese computed
   se evalúa en el **primer ciclo de CD** del wrapper, al resolver el binding
   `[theme]="resolvedTheme()"` hacia `products-3d-badge-scene` — es decir, ANTES de que se
   carguen recursos (GLB/texturas/WASM) y antes de que arranque el loop `beforeRender`.
   Un computed que lanza durante CD sube al `ErrorHandler` de Angular y la escena no se
   monta: fallo ruidoso e inmediato, nunca render roto ni fallo a mitad de frame. Esto es
   exactamente el principio 8 de `docs/architecture.md` ("Errores explícitos y tempranos…
   Nunca fallar en silencio ni renderizar roto") y la regla de `docs/conventions.md`
   ("Validar temprano: en resolución de tema/config, no en mitad del render"). No se
   duplicó la validación en `badge-scene`/`badge-texture`: reciben el tema YA validado del
   único punto de resolución.
2. **Error duro siempre (no gated por `ngDevMode`).** El título de la feature dice "dev
   mode" pero su descripción y las conventions lo aclaran: "los errores de config duros van
   SIEMPRE; ngDevMode solo para warnings". No hay warning nuevo que emitir aquí → cero usos
   nuevos de `ngDevMode`.
3. **Un solo Error que lista TODOS los campos faltantes** (criterio "valora ambos a la
   vez"): mejor DX que fallar campo a campo — el consumidor arregla el tema en una pasada.
   Mensaje: `[ngx-products-3d] badge: al tema le falta defaultBaseTextureUrl y fontUrl.
   Añade esas URLs al tema que registras con provideProducts3dBadgeTheme() o pasas por el
   input [theme]` (qué falta + cómo arreglarlo, ambas vías de aporte de tema).
4. **String vacío cuenta como faltante** (`!theme[field]`): una URL vacía no puede cargar
   asset y fallaría después en silencio dentro de `textureResource`/Text3D. Documentado en
   el JSDoc y testeado.
5. **La fn valida el TEMA RESUELTO, venga de input o de token** (gotcha de
   impl_feature7_fix1.md: `[theme]` pisa al provider sin merge). Cubierto con los 2 tests
   de integración (una fuente cada uno).
6. **`badge-theme.ts` NO se exporta en `public-api.ts`**: los helpers hermanos
   (`badge-material.ts`, `badge-texture.ts`, `badge-drag.ts`…) tampoco lo están; son
   internos del producto. Mantengo la superficie pública sin cambios.
7. **Discrepancia documental**: el brief pedía leer `docs/specs/spec-03*.md`, pero
   `docs/specs/` no existe en el repo (verificado con glob). Fuente de verdad usada:
   `feature_list.json` (id 8) + `docs/architecture.md` (principio 8) +
   `docs/conventions.md` (Manejo de errores) + `docs/verification.md`. Ninguna contradicción
   entre ellas.

## Criterios de aceptación

- [x] Tema sin `defaultBaseTextureUrl` → Error con prefijo `[ngx-products-3d]` y mensaje
      accionable (campo + `provideProducts3dBadgeTheme()`/`[theme]`). Tests: badge-theme.spec
      + badge.component.spec (input).
- [x] Tema sin `fontUrl` → Error con prefijo y mensaje accionable. Tests: badge-theme.spec
      + badge.component.spec (token).
- [x] Validación es fn pura con tests N1: camino feliz (misma referencia devuelta), cada
      campo faltante por separado, ambos a la vez (un solo error listando ambos), URL vacía.
- [x] Error existente de `'no theme'` conservado (test previo sigue verde sin cambios).
- [x] Verificación (todo verde, 2026-07-14):
  - `pnpm build` ✅
  - `pnpm ng lint ngx-products-3d` ✅ ("All files pass linting")
  - `pnpm ng test ngx-products-3d` ✅ — **76 tests / 9 files, todos verdes** (69 previos + 7
    nuevos; ninguno roto)
  - `pnpm ng build products-3d-playground` ✅ (N2 extra; el playground tiene tema válido y
    no se ve afectado)

## Verificación manual pendiente (N3)

No aplica checklist visual: la feature no cambia nada renderizado con tema válido (el
playground actual sigue idéntico, build verde). Smoke opcional para el reviewer: arrancar
`pnpm start:playground` y comprobar que el badge sigue montando; opcionalmente quitar
`fontUrl` del tema del playground y ver el Error prefijado en consola en el primer CD.

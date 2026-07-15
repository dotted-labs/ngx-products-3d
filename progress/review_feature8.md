# Review — Feature 8 `badge-theme-validation` (spec-03, Fase 5)

- **Fecha**: 2026-07-15
- **Reviewer**: agente reviewer
- **Informe revisado**: `progress/impl_feature8.md`

**Veredicto: APROBADO**

## Criterios de aceptación (feature_list.json id 8)

- [x] **CA1 — Tema sin `defaultBaseTextureUrl` → Error prefijado y accionable.**
  `badge-theme.ts:12-16` lanza `[ngx-products-3d] badge: al tema le falta defaultBaseTextureUrl. Añade esa URL al tema que registras con provideProducts3dBadgeTheme() o pasas por el input [theme]`. Indica qué falta y las dos vías de arreglo. Testeado en `badge-theme.spec.ts:31-37` (mensaje exacto) y en integración vía input `[theme]` en `badge.component.spec.ts:166-172`.
- [x] **CA2 — Tema sin `fontUrl` → Error prefijado y accionable.**
  Misma fn; testeado en `badge-theme.spec.ts:39-45` (mensaje exacto) y en integración vía token en `badge.component.spec.ts:174-180`. Las dos fuentes de tema (input y token) quedan cubiertas — relevante porque `[theme]` pisa al provider sin merge.
- [x] **CA3 — Validación es fn pura con tests N1 (camino feliz + ambos faltantes).**
  `assertValidBadgeTheme` (`badge-theme.ts:9-19`) es pura: sin estado, sin side effects, devuelve la misma referencia. 5 tests N1 en `badge-theme.spec.ts`: camino feliz con identidad de referencia (`toBe`, línea 28), cada campo por separado, **ambos a la vez en un único Error que lista los dos** (líneas 47-55) y string vacío como faltante (líneas 57-61). Los specs comprueban mensajes concretos, no `toBeTruthy` (cumple anti-patrones de `verification.md`).
- [x] **CA4 (implícito en descripción) — Error existente de 'no theme' conservado.**
  `badge.component.ts:111-115` intacto byte a byte (verificado en `git diff`); su test previo (`badge.component.spec.ts:150-156`) sigue sin cambios y verde.
- [x] **CA5 (implícito) — Validación temprana, no en mitad del render.**
  Vive en el computed `resolvedTheme` (`badge.component.ts:109-117`), evaluado en el primer CD al resolver el binding `[theme]` de la escena — antes de recursos y de `beforeRender`. Cumple `architecture.md` §8 y `conventions.md` "Validar temprano". Sin validación duplicada en `badge-scene`/`badge-texture` (grep verificado: solo consumen el tema ya validado).
- [x] **CA6 — build + lint + test verdes.** Re-ejecutado por el reviewer (2026-07-15):
  - `pnpm build` ✅
  - `pnpm ng lint ngx-products-3d` ✅ ("All files pass linting")
  - `pnpm ng test ngx-products-3d` ✅ — 76/76 tests, 9 files
  - `pnpm ng build products-3d-playground` ✅ (integración vía API pública)

## Docs

- **architecture.md**: [x] — Principio 8 cumplido (error explícito y temprano). Helper interno dentro de `src/lib/badge/` (autocontenido), sin dependencias nuevas, sin estado global, sin `console.log`, sin cambios en superficie pública (`public-api.ts` intacto — consistente con los helpers hermanos `badge-material.ts`/`badge-texture.ts`, no exportados).
- **conventions.md**: [x] — Archivo `kebab-case` con spec al lado; fn `camelCase`; prefijo de error correcto; JSDoc de una línea en el export; `import type` para tipos; tabs; sin `any` en código de producción (los casts `as unknown as` viven solo en specs y están justificados con comentario de *por qué*); comentarios solo de *por qué* (validación temprana, cast runtime-inválido). Decisión correcta de NO usar `ngDevMode`: la descripción de la feature y `conventions.md` establecen que los errores duros de config van siempre; `ngDevMode` es solo para warnings.
- **verification.md N1**: [x] — camino feliz + errores, mensajes concretos.
- **verification.md N2**: [x] — re-ejecutado completo, todo verde.
- **verification.md N3**: [x] N/A justificado — feature sin cambio visual con tema válido (N3 es obligatorio solo en fases visuales/físicas); el informe lo documenta y propone smoke opcional.

## Perímetro

`git diff` contrastado con el informe: los 4 archivos declarados coinciden con el perímetro de la feature 8 (`badge-theme.ts` y `badge-theme.spec.ts` nuevos; en `badge.component.ts` solo import + comentario + `return assertValidBadgeTheme(theme)`; en `badge.component.spec.ts` solo el describe nuevo con 2 tests). Resto del working tree = features 6/7 ya aprobadas, fuera de esta review. Sin ampliación de alcance.

## Observaciones no bloqueantes

1. `REQUIRED_THEME_URL_FIELDS` (`badge-theme.ts:3`) no lleva prefijo `BADGE_`, a diferencia de `BADGE_LIGHTFORMERS` (también constante local, `badge.config.ts:193`). La tabla de `conventions.md` exige prefijo solo para "constantes config" data-driven, que esta no es (es la lista de campos obligatorios de la validación), así que no bloquea; renombrar a `BADGE_REQUIRED_THEME_URL_FIELDS` daría homogeneidad total si se toca el archivo en el futuro.
2. El mensaje de error usa `missing.join(' y ')`: correcto con 2 campos posibles; si algún día se añade un tercer campo obligatorio la concatenación quedaría rara ("a y b y c"). Irrelevante hoy.

## Conclusión

Feature 8 lista para marcar `done` por el leader.

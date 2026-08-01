# Sesión actual

- **Fecha**: —
- **Spec**: — (`docs/specs/active/` vacía: no hay trabajo en curso)
- **Fase**: —
- **Rol**: —

## Estado

Sin spec activa. La última sesión cerró **spec-03-F3** (assets GLB reales + materiales) y la
archivó en `docs/specs/spec-03-F3-badge-assets-materials.md`. Resumen completo en
`progress/history.md`.

Un agente que llegue aquí y no encuentre spec en `docs/specs/active/` **para y pregunta**: no saca
trabajo del archivo ni lo inventa.

## Backlog conocido para la próxima spec

- **Encuadre del frente de la tarjeta** (preexistente desde 0.2.1, excluido del alcance de
  spec-03-F3 por su «No hacer»): el portal de la RenderTexture hereda el `size` del canvas mientras
  el FBO es cuadrado → el frente se deforma con el aspecto de la **ventana** (×1.41 a ×2.95) y con
  ventana ancha el plano base 5×5 deja franjas oscuras a los lados. Recomendación del reviewer:
  derivar el aspecto del bbox del GLB en vez de clavar 1.6/2.25, ~2 % de overscan en `planeSize` y
  evaluar un FBO no cuadrado. Detalle en `progress/impl_feature14.md` (P2).
- **`BADGE_BAND.repeat` derivado del fov**: hoy es `-3.383` precalculado a mano desde
  `BADGE_CAMERA.fov`; si alguien cambia el fov queda obsoleto en silencio. Hacerlo **función pura
  evaluada al cargar el módulo (NO `computed()`**: no hay estado reactivo y rompería la config
  data-driven), con el aspecto de la textura como **parámetro** (el 4:1 es del asset del
  consumidor, no de la lib). No urge: el test de invariante rompe si cambia el fov.
- **Pequeños ajustes visuales** detectados por el usuario durante la N3 del 2026-08-01, pendientes
  de concretar.
- Propuestas P3/P4/P5 del implementer en `progress/impl_feature14.md`, sin aplicar.

## Estado de publicación

`0.3.0` **preparada pero NO publicada**: bump en `projects/ngx-products-3d/package.json`,
`CHANGELOG.md` creado en la raíz y aviso de migración en el README publicado. La publicación la
dispara **CI** (`.github/workflows/release-publish.yml`) al detectar el bump **en un push a
`main`**; hoy el bump vive en la rama `feature/blender-assets` y nada se ha publicado todavía.

## Log

(sesión nueva: vacío)

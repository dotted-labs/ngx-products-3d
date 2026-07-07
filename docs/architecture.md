# Arquitectura — Qué significa "hacer un buen trabajo"

> Este documento define el estándar de calidad de `ngx-products-3d`.
> Los agentes revisores evalúan código contra este archivo y contra los
> criterios de aceptación de la spec activa. Si no está aquí ni en la
> spec, no es un requisito.

## Principios

1. **Capas claras.** La lib expone un único entry point público
   (`@dotted-labs/ngx-products-3d`) vía `src/public-api.ts`: contratos
   compartidos (tipos, tokens, providers) y productos 3D.
   - Contratos compartidos en `src/lib/` (`types.ts`, `tokens.ts`,
     `providers.ts`).
   - Cada producto 3D autocontenido en su carpeta (`src/lib/badge/`):
     componentes, config, lógica de escena.
   Dependencia permitida: producto → contratos compartidos. Nunca
   producto → producto. Nuevo producto 3D = nueva carpeta en `src/lib/`,
   no crecimiento de `badge/`.

2. **Config data-driven.** Toda constante de física, cámara, material,
   iluminación y layout de textos vive en `badge.config.ts` (o el config
   del producto correspondiente). Un componente con número mágico está mal
   aunque funcione.

3. **Reactividad Angular moderna.** Signals (`input()`, `computed`,
   `effect`), `ChangeDetectionStrategy.OnPush`, zoneless-safe. Prohibido
   Zone.js, `@Input()` decorador, `ngOnChanges`.

4. **Cero allocations por frame.** Código dentro de `beforeRender`:
   vectores/curvas/arrays instanciados una vez como campos de clase y
   reutilizados. `new` dentro del game loop = rechazo.

5. **Lib ligera, assets externos.** GLB, texturas y fuentes NUNCA se
   empaquetan. La app consumidora provee URLs vía tema/config. Peer
   dependencies para todo lo 3D (`angular-three*`, `three`, rapier,
   meshline); solo `tslib` como dependency.

6. **SSR-safe por contrato.** Canvas y física solo en browser: guard
   `isPlatformBrowser` interno + consumo documentado con
   `@defer (on viewport)`. Tocar `document`/`window` sin guard = rechazo.
   `provideNgtRenderer()` a nivel de componente/ruta, jamás root.

7. **API real gana a spec.** Snippets de spec = boceto. Ante discrepancia
   con `angular-three@4` en `node_modules`, la API real manda y la
   desviación se documenta en el informe de impl.

8. **Errores explícitos y tempranos.** Config/tema inválido (falta
   `defaultBaseTextureUrl`, falta `fontUrl`, sin tema resoluble) lanza
   `Error` descriptivo con prefijo `[ngx-products-3d]` en dev. Nunca
   fallar en silencio ni renderizar roto.

## Flujo de datos

```
app consumidora
   │  provideProducts3d({ cardModelUrl })
   │  provideProducts3dBadgeTheme(theme)      ← nivel ruta, no root
   │
   └─→ <products-3d-badge [member] [theme]>        (badge.component)
          │  resuelve tema: input ?? token ?? Error
          │  guard SSR + canvas + Physics + Environment
          │
          └─→ <products-3d-badge-scene>            (badge-scene.component)
                 │  rigid bodies + joints + correa + drag
                 │  constantes ← badge.config.ts
                 │
                 └─→ <products-3d-badge-texture>   (badge-texture.component)
                        RenderTexture: base por tier + Text3D (member)
```

## Boundaries de la librería

- Playground (`products-3d-playground`) consume la lib SOLO por import
  path público (`@dotted-labs/ngx-products-3d`). Deep imports a
  `src/lib/**` prohibidos.
- La lib no importa nada de `projects/products-3d-playground/` ni de
  otras apps del workspace. Publicable = autocontenida.

## Qué NO hacer

- No añadir dependencias ni peers nuevos sin que la spec lo pida
  (estado `blocked` + discusión).
- No mezclar lógica de física con lógica de textura: escena y
  RenderTexture son componentes separados con inputs claros.
- No suscripciones RxJS donde un signal basta. Nada de `subscribe()`
  manual sin `takeUntilDestroyed`.
- No `setInterval`/`requestAnimationFrame` propios: el loop es
  `beforeRender` de angular-three.
- No estado global ni singletons de escena: todo estado vive en el
  componente, instancias múltiples del badge deben poder coexistir.
- No `console.log` en código de lib. Errores → `throw`; avisos dev →
  `ngDevMode` guard.
- No tests que dependan de WebGL real: lógica pura (fallback de tier,
  merge de material, resolución de tema, clamps del lerp) se testea
  aislada; lo visual se verifica manual en playground y se anota en
  el informe.
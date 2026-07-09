# Review — spec-02 F1, feature 3 `badge-canvas-wrapper`

**Veredicto:** CHANGES_REQUESTED

Fuentes: `specs/spec-02-badge-physics.md` (Canvas wrapper + criterios + "No hacer"), `feature_list.json` (id 3), `docs/architecture.md`, `docs/conventions.md`, `docs/verification.md`, `docs/spike-notes.md`, `progress/impl_spec-02-f1-canvas.md`. Verificación Nivel 2 re-ejecutada por el reviewer el 2026-07-07.

La implementación es de buena calidad y la decisión técnica central (renderer a nivel de ruta) es correcta y está bien fundamentada. El rechazo se debe a dos huecos concretos: un criterio de aceptación runtime sin verificar (checklist Nivel 3 anotada pero con el ítem verificable sin marcar) y el README de la lib contradiciendo la implementación (documentación de consumo rota, referenciada además desde el JSDoc del componente).

## Criterios de aceptación (feature 3, `feature_list.json`)

- CA1 (Canvas y escena montan en browser — playground): [ ]  <- Razón: la única evidencia es el test jsdom (`badge.component.spec.ts:162-174`), que stubea `ResizeObserver` y nunca crea contexto WebGL. El ítem 1 de la checklist Nivel 3 del informe (`impl_spec-02-f1-canvas.md:57`) está sin marcar y SÍ es verificable ya: el canvas monta, crea el `WebGLRenderer` y carga el WASM de Rapier aunque la escena sea un stub vacío. La justificación "no hay nada que renderizar" (línea 61) solo excusa los ítems 2-3 (debug de colliders y encuadre de cámara, que sí dependen de la feature 4). `verification.md` Nivel 3: sin checklist verificada = fase no verificada.
- CA2 (Server no toca document/canvas — guard SSR): [x] — `badge.component.ts:29,62` (`@if (isBrowser)` + `isPlatformBrowser(inject(PLATFORM_ID))`); test `badge.component.spec.ts:122-134` comprueba host sin hijos, sin `ngt-canvas` y `document.querySelector` de canvas devolviendo null con PLATFORM_ID `server`.
- CA3 (Input debug llega a NgtrPhysics y activa el debug de física): [~] — passthrough verificado: default false y propagación a `physicsOptions()` (`badge.component.ts:57,70`; tests `spec.ts:96-109`). La parte "activa el debug de física" (render visual) es inverificable hasta la feature 4 (debug dibuja wireframes de colliders; mundo vacío = nada que dibujar). Deferral razonable, pero debe quedar encadenado explícitamente a la verificación N3 de la feature 4 antes de dar CA3 por cerrado.
- CA4 (Zoneless-safe): [x] — solo signals/`computed`, `OnPush` (`badge.component.ts:47,66-71`); sin Zone.js, sin `ngOnChanges`, sin suscripciones. Playground sin `provideZoneChangeDetection` (`app.config.ts`).
- CA5 (`pnpm build`): [x] — verde (reviewer, 2.3s, "Built @dotted-labs/ngx-products-3d").
- CA6 (`pnpm ng lint ngx-products-3d`): [x] — "All files pass linting".
- CA7 (`pnpm ng test ngx-products-3d` con > 0 tests, todos verdes): [x] — 1 file, 9 passed (vitest 4.1.10). Los 4 tests previos de `resolvedTheme` intactos (`spec.ts:65-93`); 5 nuevos (debug default/passthrough, options desde `BADGE_PHYSICS`, server, browser mount).
- Extra Nivel 2: `pnpm ng build products-3d-playground` [x] — inicial 236.25 kB (three/rapier en chunks lazy). Dist: `fesm2022/dotted-labs-ngx-products-3d.mjs` presente; `package.json` de dist con peers correctos y solo `tslib` como dependency.

## Punto clave — Discrepancia spec/API: `provideNgtRenderer()` en ruta

**La decisión del implementer es CORRECTA.** Verificado en node_modules:

- `provideNgtRenderer(options?): EnvironmentProviders` — `node_modules/angular-three/types/angular-three-dom.d.ts:152`; implementación con `makeEnvironmentProviders` en `fesm2022/angular-three-dom.mjs:372-381`.
- `@Component.providers` está tipado `Provider[]`: `EnvironmentProviders` no compila ahí (y en runtime sería NG0207). No hay alternativa viable dentro del componente: aunque se inlinearan los providers internos (`{ provide: RendererFactory2, useFactory }`) como `Provider[]` a nivel de componente, Ivy resuelve `RendererFactory2` del environment injector al crear el árbol de componentes; un provider de node injector no tiene efecto sobre el renderer. La propia doc del paquete (JSDoc en `.d.ts:137-150` y `dom/README.md:15-24`) lo sitúa en providers de aplicación/entorno.
- `architecture.md` §6 lo permite explícitamente ("a nivel de componente/ruta, jamás root") -> la ruta lazy del playground (`badge-demo.routes.ts:12`) cumple, y además saca three/rapier del bundle inicial (budget: de 3.25 MB a 236 kB). Desviación documentada en informe (§Decisiones 1) y en JSDoc del componente (`badge.component.ts:21-24`) -> cumple `architecture.md` §7.

**PERO la documentación para consumidores está rota** (ver fix 2): `README.md:65` dice literalmente que `provideNgtRenderer()` "lo aporta la lib a nivel de componente; no lo declares en root" — falso tras este cambio. Un consumidor que siga el README no registrará el renderer y el canvas no funcionará. El JSDoc del componente termina en "Ver README", apuntando a un doc que dice lo contrario. El quickstart (`README.md:20-38`) tampoco incluye `provideNgtRenderer()` en los providers de la ruta de ejemplo.

## Alcance y "No hacer" (spec-02)

- `badge-scene.component.ts` sigue siendo stub sin tocar (sin diff vs HEAD) — nada de features 4-8. [x]
- Sin GLB, sin texturas, sin RenderTexture. [x]
- Sin API pública nueva más allá de `debug` (ya existía en el stub; `public-api.ts` sin cambios). [x]
- Sin dependencias/peers nuevos (`projects/ngx-products-3d/package.json` sin diff). [x]
- Playground consume solo `@dotted-labs/ngx-products-3d` (el import de `angular-three/dom` en `badge-demo.routes.ts` es uso legítimo de peer por el consumidor, no deep import a `src/lib`). [x]
- Archivos tocados vs informe: los 5 declarados coinciden con `git status`. También aparecen modificados `feature_list.json`, `progress/current.md` y `progress/history.md` — bookkeeping del leader (backlog spec-02 + log de sesión), no código del implementer; feature 3 en `in_progress`, no `done`. OK.

## Docs

- architecture.md: [x] — capas, config data-driven (camera/gravity/timeStep desde `badge.config.ts`; `interpolate: true` es literal dictado por spec, no número mágico), SSR guard, peers intactos, boundaries respetados. §6/§7 cumplidos en código; incumplido solo en README (ver fix 2).
- conventions.md: [x] — orden de clase (inputs, injects, estado, computed), `protected`/`readonly`, standalone con imports explícitos, error con prefijo `[ngx-products-3d]` conservado, comentarios solo de porqués (guard SSR, workaround EnvironmentProviders), JSDoc en exports. Nota sobre `CUSTOM_ELEMENTS_SCHEMA` ausente: CORRECTO. `conventions.md` §Angular Three lo exige solo para elementos custom de `extend()`; aquí todos los nodos del template son componentes/directivas Angular reales (`NgtCanvas`, `NgtrPhysics`, `Products3dBadgeScene`) y el template compila estricto sin schema (build verde lo prueba). Añadirlo enmascararía errores de template. La checklist de la tarea decía "presente", pero conventions.md manda.
- verification.md N1: [x] — 9 tests, camino feliz + error (tema ausente) + SSR + passthrough.
- verification.md N2: [x] — re-ejecutado por el reviewer: build, lint, test (9/9), build playground, checks de dist. Todo verde.
- verification.md N3: [ ]  <- Razón: checklist anotada (`impl_spec-02-f1-canvas.md:55-61`) pero con los tres ítems sin marcar. El ítem 1 (canvas monta con contexto WebGL sin errores en consola vía `pnpm start:playground`) no depende de la feature 4 y quedó sin ejecutar. Checklist sin verificar = fase no verificada.

## API real angular-three@4 (informe, sección "API real verificada")

Contrastado en node_modules — todo exacto:

- `NgtCanvas` (array `[NgtCanvasImpl, NgtCanvasContent]`), selector `ngt-canvas`, input `camera` de tipo `InputSignal<NgtCamera | NgtCameraParameters | undefined>`, contenido `ng-template[canvasContent]` (`angular-three/types/angular-three-dom.d.ts`). OK
- `NgtrPhysics`, selector `ngtr-physics`, único input `options` (`InputSignalWithTransform` con `Partial<NgtrPhysicsOptions>`), contenido `ng-template` (contentChild); `gravity: Vector3Tuple`, `timeStep: number | "vary"`, `interpolate: boolean`, `debug: boolean` (`angular-three-rapier/types/angular-three-rapier.d.ts:1701-1770` y líneas 25/100/113/142). OK

## Cambios requeridos

1. **Ejecutar y marcar el ítem 1 de la checklist Nivel 3** en `progress/impl_spec-02-f1-canvas.md:57`: `pnpm start:playground` -> el `@defer (on viewport)` monta `products-3d-badge` y aparece el canvas con contexto WebGL sin errores en consola. Es la evidencia de CA1 y no depende de la feature 4. Los ítems 2-3 pueden quedar explícitamente encadenados a la N3 de la feature 4 (anotarlo así en la entrada de la feature o en `progress/current.md`, para que CA3 "activa el debug" no se pierda al cerrar).
2. **Corregir `README.md:65`** (fuera de `src/`, puede hacerlo implementer o leader): sustituir la regla "provideNgtRenderer() lo aporta la lib a nivel de componente; no lo declares en root" por el contrato real — el consumidor registra `provideNgtRenderer()` (de `angular-three/dom`) en los providers de la **ruta** que consume el badge (idealmente lazy), nunca en root. Añadirlo también al ejemplo del quickstart (`README.md:25`, bloque de providers de `badgeRoute`), que hoy omite el renderer y produciría un canvas roto. El JSDoc de `badge.component.ts:21-24` dice "Ver README": la referencia debe ser consistente.
3. (Sin cambio de código; dejar constancia) La desviación spec/API de `provideNgtRenderer()` es correcta y queda validada por este review; recoger la sugerencia del informe (sección "Sugerencia para el leader") de actualizar spec-02 "Canvas wrapper" y la descripción de la feature 3 en `feature_list.json` ("providers de ruta del consumidor", no "providers del componente").

---

# Re-review (ronda 2) — 2026-07-08

**Veredicto final:** APPROVED

Alcance: exclusivamente los 3 cambios requeridos en la ronda 1 + confirmación de que Nivel 2 sigue verde. Sin cambios de código en la lib desde la ronda 1 (`git diff HEAD --stat -- projects/` idéntico: mismos 3 archivos, mismas líneas; solo se tocaron `README.md`, `specs/spec-02-badge-physics.md`, `feature_list.json` y `progress/*`).

## Fix 1 — CA1 / N3 ítem 1 (canvas monta en browser): [x]

- Evidencia runtime anotada en `progress/current.md:46` (sección "Fixes post-review + verificación runtime (leader)", 2026-07-08): `pnpm start:playground` + Chrome headless (playwright-core) -> canvas 1248x512 montado dentro de `ngt-canvas`, contexto **webgl2**, **0 errores de consola**. Único warning: init WASM de rapier3d-compat ("using deprecated parameters for the initialization function"), interno de la dependencia, no accionable. Evidencia concreta y suficiente para CA1.
- `impl_spec-02-f1-canvas.md:57-59`: ítem 1 delegado explícitamente al leader (con la evidencia anterior); ítems 2-3 encadenados explícitamente a la verificación N3 de la feature 4, incluida la nota de no dar CA3 ("activa el debug") por cerrado hasta entonces. Cumple lo pedido. Nota menor sin efecto en el veredicto: el checkbox del ítem 1 en el informe del implementer sigue como `[ ]`; la cadena de evidencia queda cerrada vía la referencia a `current.md`.

## Fix 2 — README: [x]

- `README.md:21,27` (quickstart): añadidos `import { provideNgtRenderer } from 'angular-three/dom'` y `provideNgtRenderer()` en el bloque de providers de `badgeRoute`. El ejemplo ya no produce un canvas roto.
- `README.md:67` (regla 2): reescrita con el contrato real — lo registra la app consumidora en los providers de la **ruta** (idealmente lazy), nunca en root; devuelve `EnvironmentProviders` y no cabe en providers de componente.
- Consistencia con JSDoc: `badge.component.ts:21-24` (sin cambios, correcto desde ronda 1) enuncia exactamente el mismo contrato; su "Ver README" ahora apunta a un README coherente. Verificado contra `angular-three/types/angular-three-dom.d.ts:152` (sigue siendo `EnvironmentProviders`).

## Fix 3 — Spec y feature_list: [x]

- `specs/spec-02-badge-physics.md:171` (sección Canvas wrapper): bullet actualizado — `provideNgtRenderer()` devuelve `EnvironmentProviders`, NO cabe en providers del componente, lo registra el consumidor en providers de la ruta, nunca root, documentado en README y validado en review. Refleja el contrato real.
- `feature_list.json` (feature 3, description): actualizada con el mismo contrato ("lo registra el consumidor en los providers de la ruta que monta el badge, no cabe en providers de componente (validado en review)"). Acceptance intacta; feature sigue en `in_progress` (correcto: el cierre a `done` corresponde tras este veredicto).

## Nivel 2 re-ejecutado por el reviewer (2026-07-08)

```
pnpm build                   -> OK (2.6s)
pnpm ng lint ngx-products-3d -> All files pass linting
pnpm ng test ngx-products-3d -> 1 file, 9/9 tests passed
```

## Conclusión

Los tres cambios requeridos están aplicados y verificados con evidencia. CA1 queda cubierto por la verificación runtime del leader; CA2/CA4-CA7 ya estaban en verde en la ronda 1; CA3 verificado en su parte automatizable (passthrough) y con su parte visual explícitamente encadenada a la N3 de la feature 4. La feature 3 `badge-canvas-wrapper` puede marcarse `done`.

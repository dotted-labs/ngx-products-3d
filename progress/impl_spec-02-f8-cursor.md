# Informe impl — spec-02 F8 `badge-cursor-polish`

## Alcance
Última feature del backlog spec-02. Cursor reactivo (grabbing/grab/auto) sobre la
tarjeta, repaso de números mágicos y confirmación del toggle de debug del playground.

## Archivos tocados

- **NUEVO** `projects/ngx-products-3d/src/lib/badge/badge-cursor.ts`
  - `export type BadgeCursor = 'grabbing' | 'grab' | 'auto';`
  - `export function cursorFor(dragged, hovered): BadgeCursor` — pura, prioridad drag > hover > reposo. JSDoc de una línea. No se exporta en `public-api.ts` (interna, como `badge-drag.ts`/`badge-stabilize.ts`).
- **NUEVO** `projects/ngx-products-3d/src/lib/badge/badge-cursor.spec.ts`
  - 3 estados + prioridad, con valores concretos (`.toBe(...)`, sin `toBeTruthy`).
- **MOD** `projects/ngx-products-3d/src/lib/badge/badge-scene.component.ts`
  - Imports: `isPlatformBrowser` (@angular/common); `DestroyRef`, `effect`, `PLATFORM_ID` (@angular/core); `cursorFor` (propio). Orden Angular→three→angular-three*→propios respetado.
  - Injects: `destroyRef`, `isBrowser` (`isPlatformBrowser(inject(PLATFORM_ID))`), `originalCursor`.
  - Estado: `hovered = signal(false)` junto a `dragged`.
  - Template `#cardBody`: añadidos `(pointerover)="onPointerOver($event)"` y `(pointerout)="onPointerOut($event)"`.
  - Handlers `onPointerOver`/`onPointerOut`: `event.stopPropagation()` + `hovered.set(true|false)`. Tipo `NgtThreeEvent<PointerEvent>` (ya importado).
  - Effect en constructor (fuera del loop 3D, reactivo a signals, sin allocations por frame).

## Decisión de restauración del cursor

- **Qué se guarda**: el valor original de `document.body.style.cursor` capturado UNA vez al
  construir (`private readonly originalCursor = this.isBrowser ? document.body.style.cursor : ''`).
  Se restaura ese valor, NO `'auto'`, para respetar un cursor de host distinto.
- **Effect**: `document.body.style.cursor = cursorFor(this.dragged(), this.hovered())`.
  - `onCleanup(() => document.body.style.cursor = originalCursor)`: corre antes de cada
    re-ejecución (restaura y el effect vuelve a escribir el valor nuevo) y en destroy (última
    ejecución del cleanup deja el body en el cursor original).
  - `destroyRef.onDestroy(() => ...)`: red de seguridad adicional (belt-and-suspenders) por si
    el effect nunca llegó a ejecutarse o se destruye a mitad de hover/drag.
- **Guard SSR**: todo el bloque (captura + effect + onDestroy) está dentro de `if (this.isBrowser)`.
  La escena solo monta en browser por el guard del wrapper, pero se guarda el acceso a `document`
  por convención (comentado en el código).

## Repaso de números mágicos (auditoría explícita de la feature)

- `badge.component.ts`: `camera = BADGE_CAMERA`; `physicsOptions` usa `BADGE_PHYSICS.gravity`,
  `BADGE_PHYSICS.timeStep`, `interpolate: true` (flag de comportamiento, no constante tunable),
  `debug: this.debug()` (input). **Sin números mágicos.**
- `badge-scene.component.ts`: layout/damping/anchors/lengths/radios/curvePoints/lerp clamps/
  spinCorrectionFactor todos desde `BADGE_LAYOUT`/`BADGE_PHYSICS`; profundidad de unproject desde
  `BADGE_DRAG.unprojectDepth`; band desde `BADGE_BAND`; placeholder desde `BADGE_CARD_PLACEHOLDER`.
  Únicos literales numéricos: identidades de inicialización (`new Euler(0,0,0,'YXZ')`,
  `reuseAngvel = {x:0,y:0,z:0}`) e índices de array de `bandPoints[0..3]` — no son constantes
  físicas/de layout. **Sin hallazgos; nada que externalizar.**

## Toggle de debug del playground

Confirmado: `projects/products-3d-playground/src/app/badge-demo/badge-demo.component.ts` YA
expone `<input type="checkbox" [checked]="debug()" (change)="debug.set(!debug())">` bindeado a
`[debug]` del `<products-3d-badge>`. CA "toggle de debug física accesible" YA cubierto.
**NO se añadió Tweakpane** (no instalado; spec lo marca opcional / nunca dependencia de la lib;
añadir dependencia está fuera de alcance). Sin cambios en el playground.

## Tests añadidos

- `badge-cursor.spec.ts`: `(true,false)→'grabbing'`, `(true,true)→'grabbing'` (prioridad drag),
  `(false,true)→'grab'`, `(false,false)→'auto'`. Valores concretos.

## Verificación (N1 + N2)

- `pnpm build` → OK (Built @dotted-labs/ngx-products-3d, 2939ms).
- `pnpm ng lint ngx-products-3d` → OK (All files pass linting).
- `pnpm ng test ngx-products-3d` → OK (5 files, **36 tests passing**; 33 previos + 3 nuevos).

## Checklist Nivel 3 pendiente (manual en playground, no ejecutable por el implementer)

- [ ] Cursor `grab` al hacer hover sobre la tarjeta.
- [ ] Cursor `grabbing` durante el drag (prioridad sobre hover).
- [ ] Cursor `auto` (o cursor original del host) al salir/soltar en reposo.
- [ ] Cursor restaurado al valor original tras destruir el componente a mitad de hover/drag
      (navegar fuera o desmontar el `@defer`).
- [ ] 60fps estables en playground desktop; zoneless-safe (sin Zone).

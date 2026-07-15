# Impl — spec-03 feature 5 `badge-lighting`

Estado: **listo para review**. `pnpm build`, `pnpm ng lint`, `pnpm ng test` (54 tests) y
`pnpm ng build products-3d-playground` VERDES.

## Nota: peer deps opcionales de soba (resuelto por el líder)

La feature exige `NgtsEnvironment` + `NgtsLightformer` (`angular-three-soba/staging`). Importar
ese barrel arrastra transitivamente 4 peer deps **opcionales** de soba que inicialmente NO estaban
instaladas y bloquearon test + playground:

| Paquete | Rango peer (soba 4.2.3) | Instalado |
|---|---|---|
| `@monogrid/gainmap-js` | `^3.0.0` | 3.4.0 |
| `@pmndrs/vanilla` | `^1.24.0` | 1.25.0 |
| `troika-three-text` | `>=0.47.0 <0.53.0` | 0.52.4 |
| `three-mesh-bvh` | `>=0.5.0 <0.10.0` | 0.9.11 |

El líder (con autorización del usuario) las instaló como devDependencies → `pnpm build`,
`pnpm ng lint` y `pnpm ng build products-3d-playground` pasaron. Discrepancia a reflejar en la
spec/spike-notes-03 §4: **usar el entry `angular-three-soba/staging` requiere estas 4 optional
peers instaladas** (el spike solo verificó que las APIs existen).

### Fricción de test resuelta (solo entorno de test, sin tocar producción)
Con las peers instaladas, importar el componente arrastra `troika-three-text` / `@monogrid/
gainmap-js`, que **en tiempo de carga de módulo** crean un `<canvas>` y piden `getContext('2d')`.
jsdom devuelve `null` → `ctx.fillStyle = ...` → `TypeError: Cannot set properties of null` y la
suite del wrapper fallaba al importar (0 tests). Se neutraliza en el propio spec con un stub del
contexto 2D vía `vi.hoisted(...)` (corre ANTES de los imports estáticos): sobrescribe
`HTMLCanvasElement.prototype.getContext` para devolver, ante `'2d'`, un contexto inerte (Proxy
que acepta cualquier set de prop —`fillStyle`, etc.— y devuelve noops para los métodos, con
`measureText`/`getImageData`/`createImageData` mínimos). Otros `contextId` (webgl…) conservan el
comportamiento original. Es la opción menos invasiva (no acopla el test a la estructura interna de
soba). Reemplaza al `vi.mock('@monogrid/gainmap-js')` provisional del bloqueo anterior.

## Trabajo realizado

### Archivos tocados
- `projects/ngx-products-3d/src/lib/badge/badge.config.ts` — nueva `BADGE_LIGHTING` (+ interface
  `BadgeLightformerOptions` exportada).
- `projects/ngx-products-3d/src/lib/badge/badge.component.ts` — luces en el wrapper.
- `projects/ngx-products-3d/src/lib/badge/badge.component.spec.ts` — 4 tests nuevos + stub soba.

### `BADGE_LIGHTING` (badge.config.ts)
```
ambientIntensity: Math.PI          // three r155+ escala lineal: ambient=1 queda apagado
environment: { background: false, backgroundBlurriness: 0.75 }   // NO blur (deprecado), sin preset
lightformers: BadgeLightformerOptions[4]
```
Los 4 lightformers (estilo estudio del lanyard de drei), cada objeto ES el `[options]` de
`<ngts-lightformer>` (incluye `position`/`rotation`, que soba spreadea al mesh vía
`NgtThreeElement<Mesh>`):
1. rect superior tenue: intensity 2, scale [100,0.1,1], pos [0,-1,5], rot [0,0,π/3]
2. rect lateral: intensity 3, scale [100,0.1,1], pos [-1,-1,1], rot [0,0,π/3]
3. rect lateral/superior: intensity 3, scale [100,0.1,1], pos [1,1,1], rot [0,0,π/3]
4. acento frontal: intensity 10, scale [100,10,1], pos [-10,0,14], rot [0,π/2,π/3]

Rango de intensidad 2..10 (relleno→acento). Valores de arranque plausibles; ajuste fino = N3.

**Decisión de tipado (por qué NO todo `as const`)**: `NgtsLightformerOptions.scale` es
`number | [n,n,n] | [n,n]` MUTABLE; un `readonly` (que introduce `as const` recursivo sobre los
tuples) no es asignable a ese input de soba. Por eso `lightformers` es un array tipado explícito
`BadgeLightformerOptions[]` (tuples mutables), referenciado desde `BADGE_LIGHTING` (que sí es
`as const` a nivel objeto; el campo referenciado conserva su tipo mutable). Patrón análogo al
cast de tuplas ya usado en `BADGE_PHYSICS`.

**`BadgeLightformerOptions` exportada**: necesario para que los `.d.ts` de la lib puedan nombrar
el tipo del campo público `lightformers` del wrapper (si no → `TS4029`, rompe `pnpm build`). No
se re-exporta en el índice público de la lib.

### Ubicación de las luces (badge.component.ts)
Dentro de `<ng-template canvasContent>`, como **hermano de `<ngtr-physics>`** (las luces y el
environment NO son cuerpos físicos → fuera de la física, dentro del canvas):
```
<ngt-ambient-light [intensity]="ambientIntensity" />
<ngts-environment [options]="environmentOptions">
  <ng-template>
    @for (lightformer of lightformers; track $index) {
      <ngts-lightformer [options]="lightformer" />
    }
  </ng-template>
</ngts-environment>
<ngtr-physics ...>...</ngtr-physics>
```

**Detalle clave verificado en node_modules (`staging.mjs`)**: `NgtsEnvironment` proyecta su
contenido vía `contentChild(TemplateRef)` → si hay template, renderiza los lightformers en una
escena virtual (portal, sin red). **Sin el `<ng-template>` envolvente caería al `environment-cube`
por defecto, que carga ficheros HDR (red).** Por eso los lightformers van dentro de un
`<ng-template>`, no como hijos directos. (La spec/spike no explicitaban este envoltorio.)

Campos protegidos añadidos: `ambientIntensity`, `environmentOptions`, `lightformers` (todos
desde `BADGE_LIGHTING`; cero números mágicos en el componente).

### Imports añadidos
- `NgtsEnvironment, NgtsLightformer` de `angular-three-soba/staging` → array `imports` del
  `@Component` (son componentes Angular, no elementos custom).
- `CUSTOM_ELEMENTS_SCHEMA` → añadido a `schemas` del wrapper para `<ngt-ambient-light>` (elemento
  three del renderer; el wrapper antes no lo tenía porque solo montaba componentes Angular).

### Neutralización de soba en el spec
Stub del contexto 2D del canvas vía `vi.hoisted` (ver "Fricción de test resuelta" arriba). No se
mockea troika ni soba: se ataca solo el `getContext('2d') === null` de jsdom, causa raíz del fallo
de import.

### Tests añadidos (4, en `describe('lighting')`)
- `ambientIntensity === Math.PI` (componente y config).
- `environmentOptions`: `background === false`, `backgroundBlurriness === 0.75`, sin `blur` ni
  `preset` en `BADGE_LIGHTING.environment`; identidad con la config.
- `lightformers`: longitud 4, cada uno con `intensity`(number)/`color`(string)/`form`∈{circle,ring,
  rect}/`scale`,`position`,`rotation` de longitud 3; identidad con la config.
- intensidades cubren rango 2..10 (min 2, max 10).

## Verificación (salida literal)

- `pnpm build`: **VERDE**. `✔ Built @dotted-labs/ngx-products-3d`.
- `pnpm ng lint ngx-products-3d`: **VERDE**. `All files pass linting.` (EXIT=0). Ejecutado de
  verdad (no repetir el error de la feature 4).
- `pnpm ng test ngx-products-3d`: **VERDE**. `Test Files 6 passed (6) · Tests 54 passed (54)`
  (EXIT=0). = 50 previos + 4 de lighting; la suite del wrapper vuelve a cargar y contar.
- `pnpm ng build products-3d-playground`: **VERDE** (verificado por el líder tras instalar las 4
  optional peers).

## Checklist Nivel 3 (pendiente — smoke conjunto de Fase 3)
- [ ] Reflejos de environment visibles sobre el clearcoat de la tarjeta (4 lightformers montados).
- [ ] Barridos de reflejo con las rotaciones/posiciones elegidas; ajuste fino de intensidades.
- [ ] Sin peticiones de red (sin preset/CDN de HDRs) al montar el environment.

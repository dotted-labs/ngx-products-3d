# Verificación — Cómo demostrar que el trabajo funciona

> Regla de oro: **el agente no dice "funciona", lo demuestra**.
> Toda fase termina con evidencia ejecutable o anotada, no con afirmaciones.

## Niveles de verificación

### Nivel 1 — Tests unitarios (obligatorio)

Toda lógica pura pública de la lib tiene al menos un spec que:

1. Cubre camino feliz.
2. Cubre al menos un camino de error/fallback si la fn puede fallar
   (tier desconocido → `defaultBaseTextureUrl`, tema ausente → `Error`
   con prefijo `[ngx-products-3d]`).

Comando:
```bash
pnpm ng test ngx-products-3d
```

Alcance: resolución de tema, fallback de tier, merge de material,
clamps de lerp, validación de providers. Nada que requiera WebGL.

### Nivel 2 — Build + integración (obligatorio)

Toda fase se verifica compilando lib y consumidor real:

```bash
pnpm build
pnpm ng lint ngx-products-3d
pnpm ng build products-3d-playground
```

Checks sobre dist tras build de lib:

```bash
# entry point presente
ls dist/ngx-products-3d/fesm2022
# peers correctos, sin deps fantasma
cat dist/ngx-products-3d/package.json
```

Playground importando `@dotted-labs/ngx-products-3d` y compilando = test de
integración de la API pública. Deep import compila → boundaries rotos →
fallo aunque build verde.

### Nivel 3 — Smoke test manual en playground (obligatorio en fases visuales/físicas)

Criterios no automatizables se verifican a mano y se ANOTAN en
`progress/impl_<spec>-<fase>.md` con checklist explícita:

```bash
pnpm start:playground
```

Checklist por fase (ejemplos):

- spec-02 F1: badge cuelga, drag sigue puntero, cadena reacciona, al
  soltar cae y oscila.
- spec-02 F2: drag agresivo sin jitter, tarjeta recupera orientación
  frontal, cursor grab/grabbing/auto, 60fps en devtools performance,
  sin GC spikes por frame (profiler: cero allocations en `beforeRender`).
- spec-03 F4: cambiar `member` en form → tarjeta actualiza sin recrear
  canvas; tier desconocido → textura default visible.

Sin checklist anotada en informe = fase no verificada.

## Anti-patrones (no hacer)

- ❌ "He añadido el componente, debería funcionar." → falta evidencia.
- ❌ Spec que solo verifica que componente se crea (`toBeTruthy`). →
  tiene que comprobar resultado concreto (URL resuelta, error lanzado,
  valor mergeado).
- ❌ Mockear `angular-three`/rapier para testear escena entera. → lógica
  pura se extrae y testea aislada; escena se verifica en Nivel 3.
- ❌ Marcar fase `done` con `build`/`lint`/`test` en rojo.
- ❌ Saltarse Nivel 3 en fases con criterios visuales alegando "los tests
  pasan".

## Verificación final antes de cerrar

```bash
pnpm build && pnpm ng lint ngx-products-3d && pnpm ng test ngx-products-3d
```

Todo verde + informe con checklist Nivel 3 (si aplica) = fase cerrable.
Algo rojo → **no** marques `done`. Anota bloqueo en `progress/current.md`
con estado `blocked` y termina sesión.

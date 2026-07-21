# Informe implementer — Feature 11 `publish-package` (spec-03, fase 6)

- **Fecha**: 2026-07-19
- **Alcance**: TODO lo previo a publicar. La publicación real en npm NO se ha
  ejecutado (requiere GO explícito del usuario). No se ha ejecutado `npm publish`
  sin `--dry-run`, ni `npm login`, ni ningún comando que publique.

## 1. Qué he tocado

### `projects/ngx-products-3d/package.json`

```diff
- "version": "0.1.1",
+ "version": "0.2.0",

- "url": "https://github.com/dotted-labs/ngx-products-3d"
+ "url": "git+https://github.com/dotted-labs/ngx-products-3d.git"

- "@dimforge/rapier3d-compat": ">=0.14.0",
- "three": ">=0.174.0",
- "meshline": "^3.0.0",
+ "@dimforge/rapier3d-compat": ">=0.14.0 <0.20.0",
+ "three": ">=0.174.0 <0.183.0",
+ "meshline": "^3.1.0",
```

### `projects/ngx-products-3d/README.md`

Tabla de peers actualizada con los 3 rangos nuevos (mismo diff que arriba).
El README es de la feature 10 (ya cerrada); el toque es mínimo y solo para no
dejar la doc inconsistente con el package.json. Sin otros cambios.

### `docs/smoke-test-external.md` (nuevo)

Procedimiento completo del smoke test externo (tarball local vía `npm pack`,
sin publicar) + resultado de la ejecución real (ver §4).

### Sin tocar

`feature_list.json`, código de `src/`, specs, playground, deps del workspace.

## 2. Decisiones y justificación

1. **`sideEffects: false`** — ya estaba presente (verificado, sin cambio).
2. **Cruce de peers contra imports reales** (`grep from '...'` en
   `projects/ngx-products-3d/src/`, excluyendo specs y comentarios). Imports
   runtime reales: `@angular/common`, `@angular/core`, `angular-three`(+`/dom`),
   `angular-three-rapier`, `angular-three-soba/{abstractions,cameras,loaders,staging}`,
   `meshline`, `three`. `three-stdlib` solo aparece en comentarios (no es import).
   → Los 9 peers declarados son correctos; no falta ni sobra ninguno.
   `@dimforge/rapier3d-compat` y `ngxtension` no se importan directamente pero
   son peers requeridos de `angular-three-rapier`/`angular-three` que el
   consumidor debe instalar → se mantienen declarados (y así lo documenta el README).
3. **Rangos ajustados**:
   - `three >=0.174.0 <0.183.0`: el rango abierto prometía compatibilidad con
     three 0.183+ que `angular-three@4.2.3` no soporta (su peer es
     `>=0.157.0 <0.183.0`). Instalado: 0.182.0 ✓.
   - `@dimforge/rapier3d-compat >=0.14.0 <0.20.0`: alineado con el peer de
     `angular-three-rapier@4.2.3` (`>=0.14.0 <0.20.0`). Instalado: 0.19.3 ✓.
   - `meshline ^3.1.0`: alineado con el peer (opcional) de soba (`^3.1.0`);
     evita combinaciones instalables con warning. Instalado: 3.3.1 ✓.
   - Resto sin cambio: `@angular/* ^21.0.0` (instalado 21.1.x ✓, dentro del
     `>=20 <22` de angular-three), `angular-three*` `^4.0.0` (instalado 4.2.3 ✓),
     `ngxtension >=5.0.0` (instalado 7.2.0 ✓, angular-three pide `>=3.0.0`).
4. **`peerDependenciesMeta`**: no aplica — ningún peer de la lib es opcional
   (todos son necesarios en runtime para el badge). No se añadió.
5. **Versión 0.2.0**: `npm view @dotted-labs/ngx-products-3d versions` →
   `["0.1.0","0.1.1"]`. La 0.1.1 YA está publicada, así que publicar exigía
   bump. Minor (0.1.1→0.2.0) porque spec-03 añade funcionalidad (GLB,
   materiales, textura dinámica, theming) sin romper API pre-1.0.
6. **`repository.url` con `git+...git`**: formato normalizado npm, mismo que
   usa el pipeline de referencia (`npm view @dotted-labs/ngx-supabase-auth
   repository` → `git+https://github.com/dotted-labs/ngx-supabase-auth.git`).
7. **Metadatos**: name/description/license MIT/keywords/author/homepage/bugs/
   `publishConfig.access: public` ya estaban y coinciden en estilo con
   ngx-supabase-auth. Nada inventado.

## 3. Dry-run del publish

`pnpm build` limpio → `cd dist/ngx-products-3d && npm publish --dry-run`:

```
npm notice 📦  @dotted-labs/ngx-products-3d@0.2.0
npm notice Tarball Contents
npm notice 14.1kB README.md
npm notice 67.6kB fesm2022/dotted-labs-ngx-products-3d.mjs
npm notice 89.3kB fesm2022/dotted-labs-ngx-products-3d.mjs.map
npm notice 1.4kB package.json
npm notice 24.0kB types/dotted-labs-ngx-products-3d.d.ts
npm notice package size: 52.4 kB / unpacked 196.4 kB / total files: 5
npm notice Publishing to https://registry.npmjs.org/ with tag latest and public access (dry-run)
+ @dotted-labs/ngx-products-3d@0.2.0
```

Auditoría del tarball: ✅ `fesm2022/` + sourcemap, ✅ `types/*.d.ts`,
✅ README, ✅ `package.json` de dist correcto (module/typings/exports con
`types`+`default`, `type: module`, `sideEffects: false`, peers nuevos,
solo dep `tslib`). ❌ Sin basura: cero specs, cero `src/` sin compilar,
cero configs. Sin warnings del dry-run.

## 4. Smoke test externo (ejecutado)

Ejecutado de verdad en un directorio temporal fuera del repo, siguiendo
exactamente `docs/smoke-test-external.md`:

1. `npm pack` desde `dist/ngx-products-3d` → `dotted-labs-ngx-products-3d-0.2.0.tgz`.
2. `npx @angular/cli@21 new smoke-app --minimal --zoneless ...` (app externa real).
3. `npm install <tarball> + peers` (incl. los 4 peers opcionales de soba que
   npm no auto-instala pero soba importa estáticamente: `@monogrid/gainmap-js`,
   `@pmndrs/vanilla`, `three-mesh-bvh`, `troika-three-text` — gotcha
   documentado en el doc). 0 conflictos, 0 vulnerabilidades.
4. Ruta lazy + `provideNgtRenderer()` + `provideProducts3d` +
   `provideProducts3dBadgeTheme` + `<products-3d-badge>` en `@defer`, assets
   demo copiados del playground.
5. `npx ng build` → **verde**. Initial total 244.59 kB raw; TODO lo 3D en
   chunks lazy (2.24 MB + 1.03 MB + chunk `rapier` + `badge-routes` +
   `dotted-labs-ngx-products-3d`). La API pública del tarball compila en un
   consumidor externo real y el contrato lazy/@defer se cumple.

**Pendiente manual (Nivel 3)**: checklist visual en navegador
(`npx ng serve` + WebGL) — no automatizable en esta sesión; checklist exacta
en `docs/smoke-test-external.md` §6b. Riesgo residual bajo: el render ya está
verificado a mano en playground (features 9/10) y el empaquetado queda
cubierto por el build externo verde.

## 5. Verificación final

- `pnpm build` → ✅ (Built @dotted-labs/ngx-products-3d)
- `pnpm ng lint ngx-products-3d` → ✅ All files pass linting
- `pnpm ng test ngx-products-3d` → ✅ 9 files, 76/76 tests verdes

## 6. Criterios de aceptación

| Criterio | Estado |
| --- | --- |
| `sideEffects: false` + rangos peer correctos (verificado) | ✅ |
| `npm publish --dry-run` limpio (fesm2022 + tipos + package.json) | ✅ |
| Smoke test documentado (app externa mínima consume el paquete) | ✅ doc + ejecutado hasta build externo; render en navegador pendiente manual |
| Publicación real solo tras autorización explícita | ✅ NO ejecutada (fuera de alcance de esta sesión) |
| build / lint / test verdes | ✅ 76/76 |

## 7. Dudas / notas para el leader

- El GO del usuario para `npm publish` publicará **0.2.0** (0.1.1 ya existe
  en el registry; publicarla de nuevo fallaría con EPUBLISHCONFLICT).
- Comando de publicación (cuando haya GO): `cd dist/ngx-products-3d && npm publish`
  (el `publishConfig.access: public` ya va en el package.json, mismo pipeline
  que ngx-supabase-auth).
- Sin tests nuevos: esta feature no añade lógica de lib testeable (solo
  manifest + docs); la evidencia es el dry-run + build externo (Nivel 2).
- No hay bloqueos.

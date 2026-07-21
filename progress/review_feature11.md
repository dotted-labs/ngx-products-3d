# Review — spec-03 F6 (feature 11 `publish-package`)

**Veredicto:** APPROVED

Alcance revisado: TODO lo previo a publicar. La publicación real en npm
(`npm publish` sin `--dry-run`) queda EXCLUIDA de esta sesión y requiere GO
explícito del usuario. Verificado que el implementer NO la ejecutó.

## Criterios de aceptación (spec)
- CA1 (`sideEffects: false` + rangos peer correctos, verificado): [x]
  - `sideEffects: false` presente en package.json de la lib (línea 6) y propagado
    al package.json de dist. Verificado.
  - Rangos cruzados contra versiones instaladas y peers reales (node_modules):
    - `three >=0.174.0 <0.183.0` → subconjunto del peer de angular-three@4.2.3
      (`>=0.157.0 <0.183.0`); cierra el techo que el rango abierto anterior
      prometía indebidamente. Instalado 0.182.0. Coherente.
    - `@dimforge/rapier3d-compat >=0.14.0 <0.20.0` → idéntico al peer de
      angular-three-rapier@4.2.3. Instalado 0.19.3. Coherente.
    - `meshline ^3.1.0` → idéntico al peer (opcional) de soba@4.2.3.
      Instalado 3.3.1. Coherente.
    - Resto sin cambio y dentro de rango: `@angular/* ^21.0.0` (21.1.x),
      `angular-three* ^4.0.0` (4.2.3), `ngxtension >=5.0.0` (7.2.0).
  - Cruce peers↔imports reales de src/ (excluyendo specs/comentarios):
    imports runtime = `@angular/common`, `@angular/core`, `angular-three`(+`/dom`),
    `angular-three-rapier`, `angular-three-soba/{abstractions,cameras,loaders,staging}`,
    `meshline`, `three`. Confirmado que `three-stdlib` aparece SOLO en un
    comentario JSDoc (badge-scene.component.ts:62), no es import → correcto no
    declararlo como direct peer. Los 9 peers declarados son correctos.
- CA2 (`npm publish --dry-run` limpio: fesm2022 + tipos + package.json correctos): [x]
  - Ejecutado por mí (`pnpm build` + `cd dist/ngx-products-3d && npm publish --dry-run`).
    Tarball: 5 archivos, 52.4 kB / 196.4 kB unpacked. Contenido:
    README.md, fesm2022/*.mjs + .mjs.map, types/*.d.ts, package.json.
    SIN specs, SIN src/ sin compilar, SIN configs. Sin warnings.
  - package.json de dist correcto: `module`/`typings`/`exports` (con `types`+`default`),
    `type: module`, `sideEffects: false`, 9 peers nuevos, única dep runtime `tslib`.
- CA3 (smoke test documentado: app externa mínima consume el paquete y renderiza): [x] (con observación)
  - `docs/smoke-test-external.md` documenta procedimiento reproducible: `npm pack`,
    app Angular 21 externa (`ng new --minimal --zoneless`), install del tarball +
    peers (incl. los 4 opcionales de soba que npm no auto-instala, gotcha documentado),
    cableado real (ruta lazy + `provideNgtRenderer` + ambos `provide*` + `<products-3d-badge>`
    en `@defer`/`@placeholder`), y verificación en 2 sub-pasos (6a build automatizable,
    6b render manual en navegador con checklist).
  - Ejecutado hasta build externo VERDE con el tarball 0.2.0: contrato lazy/@defer
    confirmado (initial 244.59 kB raw; todo lo 3D en chunks lazy). Esto cubre el
    riesgo real de empaquetado (imports rotos, peers mal declarados, tarball incompleto).
  - Observación (no bloqueante): la checklist visual en navegador (6b) queda
    `[ ]` sin marcar — requiere WebGL, no automatizable por el agente. No es una
    fase visual/física nueva: la geometría/física/textura del badge ya se verificó
    N3 a mano en playground en las features 9 y 10 (mismo código de componentes).
    Ver "Acción residual antes del GO de publicación".
- CA4 (publicación real solo tras autorización explícita): [x]
  - NO ejecutada. Correcto, fuera de alcance de esta sesión.
- CA5 (build / lint / test verdes): [x]
  - Ejecutado por mí: `pnpm build` OK; `pnpm ng lint ngx-products-3d` "All files pass linting";
    `pnpm ng test ngx-products-3d` 9 files / 76/76 tests verdes.

## Docs
- architecture.md: [x]  — solo cambios de manifest/docs; boundaries intactos;
  el smoke test consume la API pública por package name (sin deep imports).
- conventions.md: [x]  — sin cambios de código de src/.
- verification.md N1: [x]  — sin lógica pura nueva (feature de manifest+docs);
  suite existente 76/76 verde.
- verification.md N2: [x]  — build + lint + build/consumo externo verdes; checks
  de dist (fesm2022 presente, peers sin deps fantasma) verificados.
- verification.md N3: [x] (con salvedad)  — no es fase de implementación visual;
  N3 del render del badge cubierto en features 9/10. Checklist de smoke visual
  presente y anotada en docs/smoke-test-external.md §6b, pendiente de ejecución
  manual en el GO de publicación.

## Coherencia README ↔ package.json
- Tabla de peers de README.md (líneas 26-34) idéntica a `peerDependencies` del
  package.json (mismos 9 peers, mismos rangos). Diff de README mínimo: solo los
  3 rangos ajustados. Coherente.

## Versión 0.2.0
- Justificada: `0.1.1` ya publicada en el registry (bump obligatorio para publicar).
  Minor porque spec-03 añade funcionalidad sin romper API pre-1.0. Correcto.

## Archivos tocados (declarados vs git status)
- `projects/ngx-products-3d/package.json` (version, repository.url normalizada,
  3 rangos peer) — declarado, contrastado con `git diff`. OK.
- `projects/ngx-products-3d/README.md` (tabla peers) — declarado. OK.
- `docs/smoke-test-external.md` (nuevo) — declarado. OK.
- `progress/impl_feature11.md`, `progress/current.md`, `feature_list.json`
  (status in_progress) — orquestación/progreso, no código. OK.
- Sin archivos tocados fuera de lo declarado. Sin cambios en src/ ni specs.

## Cambios requeridos
Ninguno bloqueante.

## Acción residual antes del GO de publicación (no bloqueante para esta review)
1. Ejecutar la checklist visual manual de `docs/smoke-test-external.md` §6b
   (`ng serve` en la app externa, WebGL) y marcar los `[ ]` antes de `npm publish`
   real. Cierra el último criterio "renderiza el badge" con evidencia directa del
   paquete empaquetado (hoy cubierto por equivalencia con el render N3 de F9/F10 +
   build externo verde).
2. Publicar con `cd dist/ngx-products-3d && npm publish` SOLO tras GO explícito
   del usuario (publicará 0.2.0; 0.1.1 ya existe → republicarla daría EPUBLISHCONFLICT).

# Smoke test externo — `@dotted-labs/ngx-products-3d`

> Procedimiento para verificar que el paquete empaquetado (tarball de `npm pack`)
> funciona en una app Angular externa mínima, SIN necesidad de publicar en npm.
> Es el smoke test de cierre de spec-03 (feature 11, fase 6).

## Requisitos

- Node + npm (npm ≥ 7 para auto-instalación de peers requeridos).
- Angular CLI 21 (vía `npx`, no hace falta instalación global).
- Los assets demo del playground de este repo
  (`projects/products-3d-playground/public/assets/`).

## 1. Generar el tarball

Desde la raíz del repo:

```bash
pnpm build
cd dist/ngx-products-3d
npm pack --pack-destination <dir-externo>
# → <dir-externo>/dotted-labs-ngx-products-3d-<version>.tgz
```

## 2. Crear la app externa mínima

En un directorio FUERA del repo:

```bash
npx -y @angular/cli@21 new smoke-app --minimal --skip-git --style=css \
  --ssr=false --zoneless --skip-tests --defaults --package-manager=npm
cd smoke-app
```

Nota CD: Angular 21 con `--zoneless` ya cumple el requisito de scheduler de
signals del README (sin zone.js). En apps con zone.js, añadir
`provideZoneChangeDetection()`.

## 3. Instalar el tarball y los peers

```bash
npm install ../dotted-labs-ngx-products-3d-<version>.tgz \
  angular-three@^4.2.3 angular-three-soba@^4.2.3 angular-three-rapier@^4.2.3 \
  three@^0.182.0 @dimforge/rapier3d-compat@^0.19.3 meshline@^3.3.1 ngxtension@^7.2.0 \
  @monogrid/gainmap-js @pmndrs/vanilla three-mesh-bvh@^0.9.11 troika-three-text
npm install -D @types/three@^0.182.0
```

Por qué los 4 últimos: son peers **opcionales** de `angular-three-soba`
(`peerDependenciesMeta`), así que npm NO los auto-instala, pero los entry
points de soba que usa el badge los importan estáticamente
(`staging` → `@monogrid/gainmap-js` y `@pmndrs/vanilla`;
`abstractions` → `troika-three-text`; `shaders` → `three-mesh-bvh`) y el
bundler falla si faltan. `three-stdlib` es peer requerido de soba y npm sí lo
auto-instala.

## 4. Copiar los assets

```bash
mkdir -p public/assets
cp <repo>/projects/products-3d-playground/public/assets/{card.glb,band.png,base-gold.png,base-silver.png,base-default.png,font.json} public/assets/
```

## 5. Cablear la app (3 archivos)

`src/app/app.routes.ts` — ruta lazy (obligatorio: mantiene three/Rapier fuera
del bundle inicial):

```ts
import { Routes } from '@angular/router';

export const routes: Routes = [
	{
		path: '',
		loadChildren: () => import('./badge/badge.routes').then((m) => m.badgeRoutes),
	},
];
```

`src/app/badge/badge.routes.ts` — providers a nivel de ruta:

```ts
import type { Routes } from '@angular/router';
import { provideNgtRenderer } from 'angular-three/dom';
import { provideProducts3d, provideProducts3dBadgeTheme } from '@dotted-labs/ngx-products-3d';
import { BadgePage } from './badge.page';

export const badgeRoutes: Routes = [
	{
		path: '',
		providers: [
			provideNgtRenderer(),
			provideProducts3d({ cardModelUrl: '/assets/card.glb' }),
			provideProducts3dBadgeTheme({
				bandTextureUrl: '/assets/band.png',
				baseTextures: {
					gold: '/assets/base-gold.png',
					silver: '/assets/base-silver.png',
				},
				defaultBaseTextureUrl: '/assets/base-default.png',
				fontUrl: '/assets/font.json',
			}),
		],
		component: BadgePage,
	},
];
```

`src/app/badge/badge.page.ts` — consumo con `@defer` + `@placeholder`:

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Products3dBadge, type BadgeMemberData } from '@dotted-labs/ngx-products-3d';

@Component({
	selector: 'app-badge-page',
	imports: [Products3dBadge],
	template: `
		<div style="width: 100vw; height: 90vh;">
			@defer (on viewport) {
				<products-3d-badge [member]="member()" [debug]="false" />
			} @placeholder {
				<p>Cargando badge…</p>
			}
		</div>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BadgePage {
	protected readonly member = signal<BadgeMemberData>({
		name: 'Smoke Test',
		memberNumber: '0001',
		tier: 'gold',
	});
}
```

## 6. Verificar

### 6a. Build (automatizable)

```bash
npx ng build
```

Esperado: build verde y en el reporte de chunks los 3D quedan en chunks
**lazy** (badge-routes + chunks de three/rapier/soba, ~3 MB raw), con el
bundle inicial pequeño (~245 kB raw). Si `@dotted-labs/ngx-products-3d`
aparece en los "Initial chunk files", el contrato lazy/@defer está roto.

### 6b. Render (manual, navegador)

```bash
npx ng serve
# abrir http://localhost:4200
```

Checklist visual:

- [ ] El placeholder aparece primero; al entrar en viewport se monta el canvas.
- [ ] El badge cuelga de la correa texturizada y oscila (física Rapier activa).
- [ ] El frente muestra la textura gold + «Smoke Test», «#0001» y «GOLD».
- [ ] Arrastrar la tarjeta con el puntero funciona (cursor grab/grabbing).
- [ ] Consola sin errores (`404` de assets, `[ngx-products-3d]`, etc.).

## Resultado de la última ejecución (2026-07-19, feature 11)

Ejecutado en un directorio temporal fuera del repo, con el tarball
`dotted-labs-ngx-products-3d-0.2.0.tgz`:

- Pasos 1–5: OK sin desviaciones (`npm install` resolvió los peers sin
  conflictos; `found 0 vulnerabilities`).
- Paso 6a `npx ng build`: **verde**. Initial total 244.59 kB raw; todo lo 3D
  en chunks lazy (2.24 MB + 1.03 MB raw + chunk `rapier` + chunk
  `badge-routes` + chunk `dotted-labs-ngx-products-3d`). Contrato
  lazy/@defer confirmado.
- Paso 6b (checklist visual en navegador): **pendiente de ejecución manual**
  — requiere navegador con WebGL, no automatizable en la sesión del agente.
  Es el mismo render ya verificado a mano en el playground (features 9/10);
  el riesgo residual del empaquetado (imports rotos, peers mal declarados,
  tarball incompleto) queda cubierto por el build externo verde del paso 6a.

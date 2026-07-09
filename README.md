# @dotted-labs/ngx-products-3d

Productos 3D interactivos para Angular, construidos sobre [Angular Three v4](https://angularthree.org).

Primer producto: **badge** — acreditación 3D de socio colgada de una correa (lanyard) con física Rapier, arrastrable con el puntero.

## Instalación

```bash
npm install @dotted-labs/ngx-products-3d angular-three@^4 angular-three-soba@^4 angular-three-rapier@^4 three @dimforge/rapier3d-compat meshline ngxtension
npm install -D @types/three
```

Requisitos: Angular ≥21, three ≥0.174.

## Quickstart

### 1. Providers (ruta que consume el badge, NUNCA root)

```ts
import { provideNgtRenderer } from 'angular-three/dom';
import { provideProducts3d, provideProducts3dBadgeTheme } from '@dotted-labs/ngx-products-3d';

export const badgeRoute: Route = {
	path: 'membership',
	providers: [
		provideNgtRenderer(),
		provideProducts3d({ cardModelUrl: '/assets/3d/card.glb' }),
		provideProducts3dBadgeTheme({
			bandTextureUrl: '/assets/3d/band.jpg',
			baseTextures: {
				gold: '/assets/3d/base-gold.jpg',
				silver: '/assets/3d/base-silver.jpg',
			},
			defaultBaseTextureUrl: '/assets/3d/base-default.jpg',
			fontUrl: '/assets/3d/font.json',
		}),
	],
	loadComponent: () => import('./membership.component'),
};
```

### 2. Consumo — contrato SSR/hydration (obligatorio)

Canvas nunca en server. Rapier WASM + Three ≈ 1.5MB → fuera del bundle inicial. Consumir SIEMPRE con `@defer`:

```html
@defer (on viewport) {
	<products-3d-badge [member]="member()" />
} @placeholder {
	<img src="/assets/badge-static.webp" alt="Tarjeta de socio" />
}
```

```ts
import {
	Products3dBadge,
	type BadgeMemberData,
} from '@dotted-labs/ngx-products-3d';

member = signal<BadgeMemberData>({ name: 'Sergio', memberNumber: '0042', tier: 'gold' });
```

Reglas:

1. `@defer (on viewport)` u `on interaction` + `@placeholder` con imagen estática → LCP barato.
2. `provideNgtRenderer()` (import de `angular-three/dom`) lo registra la app consumidora en los providers de la **ruta** que consume el badge (idealmente lazy, como en el quickstart), nunca en root: devuelve `EnvironmentProviders` y Angular no lo admite en providers de componente, así que la lib no puede aportarlo.
3. Preload opcional de assets pesados: `<link rel="preload" as="fetch" href="/assets/3d/card.glb" crossorigin>`.
4. El componente incluye guard `isPlatformBrowser` como cinturón — no sustituye a `@defer`.

## API

### `<products-3d-badge>`

| Input | Tipo | Requerido | Descripción |
|---|---|---|---|
| `member` | `BadgeMemberData` | sí | Datos renderizados en la tarjeta |
| `theme` | `Products3dBadgeTheme` | no | Fallback: token `PRODUCTS_3D_BADGE_THEME` |
| `debug` | `boolean` | no | Debug de física |

### `Products3dBadgeTheme`

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `bandTextureUrl` | `string` | sí | Textura de la correa (RepeatWrapping aplicado por la lib) |
| `baseTextures` | `Record<string, string>` | sí | Textura base del frente por tier |
| `defaultBaseTextureUrl` | `string` | sí | Fallback si el tier no existe en `baseTextures` |
| `fontUrl` | `string` | sí | Typeface JSON (three) para los textos 3D |
| `colors.band` | `string` | no | Tinte de la correa |
| `colors.text` | `string` | no | Color de los textos |
| `colors.clip` | `string` | no | Tinte del clip metálico |
| `material` | `Partial<BadgePhysicalMaterialOptions>` | no | Override del meshPhysicalMaterial de la tarjeta |

Assets NO empaquetados: la app consumidora provee todas las URLs → temas ilimitados por equipo.

## Contrato del modelo GLB

Geometría única para todos los temas. Requisitos:

- Nodos nombrados: `card`, `clip`, `clamp`
- Materiales nombrados: `base` (card, recibe textura dinámica), `metal` (clip + clamp)
- Origen en el punto de anclaje del clip
- Transforms aplicados, Y-up, unidades métricas

## Desarrollo

```bash
git clone https://github.com/dotted-labs/ngx-products-3d.git
cd ngx-products-3d
pnpm install
pnpm start                 # playground
pnpm run build:lib         # dist/ngx-products-3d
```

## Licencia

MIT — see [LICENSE](LICENSE).

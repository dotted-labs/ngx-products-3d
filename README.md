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
		provideProducts3d({ cardModelUrl: '/assets/3d/membresia.glb' }),
		provideProducts3dBadgeTheme({
			bandTextureUrl: '/assets/3d/band.png',
			// Arte del frente por tier: ratio 32:45 con alfa
			baseTextures: {
				gold: '/assets/3d/front-gold.webp',
				silver: '/assets/3d/front-silver.webp',
			},
			defaultBaseTextureUrl: '/assets/3d/front-default.webp',
			// Typeface JSON de three, .otf o .ttf (autodetección por extensión)
			fontUrl: '/assets/3d/font.otf',
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
3. Preload opcional de assets pesados: `<link rel="preload" as="fetch" href="/assets/3d/membresia.glb" crossorigin>`.
4. El componente incluye guard `isPlatformBrowser` como cinturón — no sustituye a `@defer`.

## API

### `<products-3d-badge>`

| Input | Tipo | Requerido | Descripción |
|---|---|---|---|
| `member` | `BadgeMemberData` | sí | Datos renderizados en la tarjeta |
| `theme` | `Products3dBadgeTheme` | no | Fallback: token `PRODUCTS_3D_BADGE_THEME` |
| `debug` | `boolean` | no | Debug de física |
| `camera` | `Products3dBadgeCamera` | no | `{ fov?, distance? }`: `fov` vertical en grados (default 25) y distancia de la cámara al badge (default 13). Menos distancia = tarjeta más grande en el mismo contenedor. Valores inválidos → default + aviso dev; si la cámara dejaría ver el anclaje de la correa, la lib acorta `distance` (≈ 16.9 máx. con 25°). Cambiable en caliente, sin repetir la caída |

El badge cuelga **centrado** en su contenedor (desde 0.3.2; antes, desplazado a la derecha). Detalle
de la cámara, rangos razonables y efecto del `fov` sobre la correa en
[`projects/ngx-products-3d/README.md`](projects/ngx-products-3d/README.md#cámara-tarjeta-más-grande-sin-agrandar-el-contenedor).

| Output | Tipo | Descripción |
|---|---|---|
| `ready` | `void` | Una sola vez, cuando el badge se soltó: con todo cargado o al vencer el tope de carga (con `prefers-reduced-motion` aparece en reposo, sin caída) |

### `Products3dBadgeTheme`

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `bandTextureUrl` | `string` | sí | Textura de la correa: horizontal, tileable en X, alfa recomendada. El teselado lo deriva la lib del aspecto real (`bandRepeatFor`) |
| `baseTextures` | `Record<string, string>` | sí | Arte del frente por tier (ratio 32:45 con alfa) |
| `defaultBaseTextureUrl` | `string` | sí | Fallback si el tier no existe en `baseTextures` |
| `fontUrl` | `string` | sí | Fuente de los textos 3D: typeface JSON de three, `.otf` o `.ttf` (autodetección por extensión) |
| `baseColor` | `string` | no | Color base del modelo (fondo del frente y tinte de clip/clamp). Default `'#111111'` (`BADGE_BASE_COLOR`) |
| `colors.band` | `string` | no | Tinte de la correa |
| `colors.text` | `string` | no | Color de los textos |
| `colors.clip` | `string` | no | Tinte del clip metálico |
| `material` | `Partial<BadgePhysicalMaterialOptions>` | no | Override del meshPhysicalMaterial de la tarjeta |

Assets NO empaquetados: la app consumidora provee todas las URLs → temas ilimitados por equipo.

## Contrato del modelo GLB

Geometría única para todos los temas. Requisitos:

- Nodos nombrados: `card`, `clip`, `clamp`
- Materiales nombrados: `base` (card, recibe textura dinámica), `metal` (clip + clamp)
- Origen en el **centro de la tarjeta** (nodo `card` con transformación identidad); coincide con
  el centro del collider físico
- Enganche de la correa en dos puntos: anclaje físico = borde superior del `clip`, **y ≈ 1.286**
  (`BADGE_PHYSICS.cardJointAnchor`); extremo visual = centro de la ranura superior del `clamp`,
  **y ≈ 1.479** (`BADGE_CARD_MODEL.bandAttachPoint`)
- Transforms aplicados, Y-up, unidades métricas
- El contrato completo (dimensiones, UVs, Draco) está en
  [`projects/ngx-products-3d/README.md`](projects/ngx-products-3d/README.md#contrato-del-modelo-glb)

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

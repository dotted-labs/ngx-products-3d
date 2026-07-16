# @dotted-labs/ngx-products-3d

Productos 3D interactivos para Angular, construidos sobre [Angular Three v4](https://angularthree.org).

Primer producto: **badge** — acreditación 3D de socio colgada de una correa (lanyard) con física
Rapier, arrastrable con el puntero. El frente de la tarjeta se genera en runtime (textura base por
tier + nombre/número/tier del socio en Text3D) y todo el aspecto se controla por tema.

- Angular ≥ 21, standalone, signals, zoneless-safe, `OnPush`.
- SSR-safe: el canvas solo monta en browser (guard interno) y el consumo documentado es `@defer`.
- La lib no empaqueta ningún asset: GLB, texturas y fuente los aporta la app consumidora por URL.

## Instalación

```bash
npm install @dotted-labs/ngx-products-3d angular-three angular-three-soba angular-three-rapier three @dimforge/rapier3d-compat meshline ngxtension
npm install -D @types/three
```

### Peer dependencies

Todo lo 3D son `peerDependencies` (la lib solo depende de `tslib`):

| Peer | Rango |
| --- | --- |
| `@angular/common` | `^21.0.0` |
| `@angular/core` | `^21.0.0` |
| `angular-three` | `^4.0.0` |
| `angular-three-soba` | `^4.0.0` |
| `angular-three-rapier` | `^4.0.0` |
| `@dimforge/rapier3d-compat` | `>=0.14.0` |
| `three` | `>=0.174.0` |
| `meshline` | `^3.0.0` |
| `ngxtension` | `>=5.0.0` |

## Peso: por qué `@defer` es obligatorio

El badge arrastra **three.js + el WASM de Rapier** (física) además de soba y meshline: en torno a
1.5 MB extra que NO deben entrar en el bundle inicial ni ejecutarse en el server. El contrato de
consumo es:

1. **Ruta lazy** (`loadChildren`/`loadComponent`) con `provideNgtRenderer()` en los `providers` de
   esa ruta — devuelve `EnvironmentProviders`, Angular no lo admite en providers de componente,
   así que la lib no puede aportarlo.
2. **`@defer (on viewport)` + `@placeholder`** alrededor de `<products-3d-badge>`: el placeholder
   estático (imagen) se sirve en SSR/LCP y el canvas 3D solo se hidrata al entrar en viewport.
3. El componente incluye un guard `isPlatformBrowser` como cinturón de seguridad — no sustituye
   a `@defer`, solo evita que un render en server reviente.

Preload opcional del modelo:
`<link rel="preload" as="fetch" href="/assets/3d/card.glb" crossorigin>`.

## Quickstart

### 1. Providers en la ruta lazy

```ts
// membership.routes.ts
import type { Routes } from '@angular/router';
import { provideNgtRenderer } from 'angular-three/dom';
import { provideProducts3d, provideProducts3dBadgeTheme } from '@dotted-labs/ngx-products-3d';
import { MembershipComponent } from './membership.component';

export const membershipRoutes: Routes = [
	{
		path: '',
		providers: [
			provideNgtRenderer(),
			provideProducts3d({ cardModelUrl: '/assets/3d/card.glb' }),
			provideProducts3dBadgeTheme({
				bandTextureUrl: '/assets/3d/band.png',
				baseTextures: {
					gold: '/assets/3d/base-gold.png',
					silver: '/assets/3d/base-silver.png',
				},
				defaultBaseTextureUrl: '/assets/3d/base-default.png',
				fontUrl: '/assets/3d/font.json',
				colors: {
					band: '#ffe3c2',
					clip: '#b45309',
					text: '#2a1205',
				},
				material: {
					roughness: 0.25,
				},
			}),
		],
		component: MembershipComponent,
	},
];
```

```ts
// app.routes.ts
export const appRoutes: Routes = [
	{
		path: 'membership',
		loadChildren: () => import('./membership/membership.routes').then((m) => m.membershipRoutes),
	},
];
```

### 2. Componente consumidor con `@defer`

```ts
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { Products3dBadge, type BadgeMemberData } from '@dotted-labs/ngx-products-3d';

@Component({
	selector: 'app-membership',
	imports: [Products3dBadge],
	template: `
		@defer (on viewport) {
			<products-3d-badge [member]="member()" [debug]="false" />
		} @placeholder {
			<img src="/assets/badge-static.webp" alt="Tarjeta de socio" />
		}
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembershipComponent {
	protected readonly member = signal<BadgeMemberData>({
		name: 'Sergio',
		memberNumber: '0042',
		tier: 'gold',
	});
}
```

`member` es un signal: mutarlo (form, API…) actualiza el frente de la tarjeta en vivo, sin
recrear el canvas.

### 3. Scheduler de detección de cambios (imprescindible)

El badge carga geometría, texturas y el WASM de Rapier de forma asíncrona y todo su contenido
visible vive detrás de `@if` de recursos. La app consumidora DEBE tener un scheduler de CD que
reaccione a signals:

```ts
// app.config.ts — apps zoneless (sin zone.js)
import { provideZonelessChangeDetection } from '@angular/core';

export const appConfig: ApplicationConfig = {
	providers: [provideZonelessChangeDetection() /* … */],
};
```

En apps con zone.js, `provideZoneChangeDetection()` + zone.js cumple el mismo papel. Sin
scheduler, la escena no se pinta hasta que un evento del DOM fuerza un ciclo de CD.

## API

### `<products-3d-badge>` (`Products3dBadge`)

Wrapper todo-en-uno: canvas + iluminación (ambient + environment con lightformers) + mundo
físico + escena del badge.

| Input | Tipo | Requerido | Default | Descripción |
| --- | --- | --- | --- | --- |
| `member` | `BadgeMemberData` | sí | — | Datos del socio renderizados en la tarjeta |
| `theme` | `Products3dBadgeTheme` | no | token del provider | Tema visual. Ver gotcha abajo |
| `debug` | `boolean` | no | `false` | Wireframes de colliders/joints de la física |

> **Gotcha del tema**: el input `[theme]` **PISA por completo** al tema registrado con
> `provideProducts3dBadgeTheme()` — no hay merge campo a campo entre ambos. Si pasas `[theme]`,
> pasa el tema COMPLETO. La resolución es: `input ?? token ?? Error`.

### `BadgeMemberData`

| Campo | Tipo | Descripción |
| --- | --- | --- |
| `name` | `string` | Nombre completo mostrado en la tarjeta (texto principal; los nombres largos se escalan para no desbordar) |
| `memberNumber` | `string` | Número de socio (se pinta con prefijo `#`) |
| `tier` | `string` | Tier de membresía. Clave abierta: selecciona la textura base en `theme.baseTextures`; se pinta en mayúsculas como etiqueta |

### `Products3dBadgeTheme`

| Campo | Tipo | Requerido | Default | Para qué sirve |
| --- | --- | --- | --- | --- |
| `bandTextureUrl` | `string` | sí | — | Textura de la correa (lanyard). La lib aplica `RepeatWrapping` y la tesela 4 veces a lo largo. Si la carga falla: color plano + warn en dev |
| `baseTextures` | `Record<string, string>` | sí | — | Textura base del frente de la tarjeta por tier (key = `BadgeMemberData.tier`) |
| `defaultBaseTextureUrl` | `string` | sí (**validado en runtime**) | — | Fallback obligatorio cuando el tier del socio no existe en `baseTextures` |
| `fontUrl` | `string` | sí (**validado en runtime**) | — | Typeface JSON de three para los textos 3D del frente |
| `colors` | `object` | no | `{}` | Tintes opcionales |
| `colors.band` | `string` | no | `'white'` | Tinte de la correa (se multiplica con la textura) |
| `colors.text` | `string` | no | `'black'` | Color de los textos del socio |
| `colors.clip` | `string` | no | sin tinte | Tinte del metal del clip/clamp. La lib CLONA el material del GLB antes de teñir (el original nunca se muta) |
| `material` | `Partial<BadgePhysicalMaterialOptions>` | no | defaults de la lib | Override parcial del `MeshPhysicalMaterial` de la tarjeta; se mergea campo a campo con los defaults |

Defaults del material de la tarjeta (`BadgePhysicalMaterialOptions`, exportados como
`BADGE_MATERIAL_DEFAULTS`):

| Campo | Default |
| --- | --- |
| `clearcoat` | `1` |
| `clearcoatRoughness` | `0.15` |
| `roughness` | `0.3` |
| `metalness` | `0.5` |
| `iridescence` | `0` |
| `iridescenceIOR` | `1` |

**Validación temprana**: si no hay tema resoluble (ni input ni provider), o al tema resuelto le
falta (o tiene vacío) `defaultBaseTextureUrl` o `fontUrl`, la lib lanza un
`Error('[ngx-products-3d] badge: …')` accionable en el primer ciclo de CD — nunca falla en
silencio ni a mitad de render. El resto de fallos de carga (textura 404, GLB roto) degradan con
un `console.warn` solo-dev: correa en color plano, escena sin tarjeta o frente sin fondo.

### `provideProducts3d(config)` — `Products3dConfig`

| Campo | Tipo | Requerido | Descripción |
| --- | --- | --- | --- |
| `cardModelUrl` | `string` | sí | URL del GLB de la tarjeta (geometría única para todos los temas; ver contrato abajo) |

También se exportan los tokens `PRODUCTS_3D_CONFIG` y `PRODUCTS_3D_BADGE_THEME` por si prefieres
proveerlos a mano.

## Requisitos de los assets del tema

La lib **no empaqueta ningún asset**; los del playground del repo son solo demo. La app
consumidora aporta los suyos:

- **Texturas** (`bandTextureUrl`, `baseTextures`, `defaultBaseTextureUrl`): cualquier formato de
  imagen que cargue `TextureLoader` de three (PNG, JPG, WebP…). Para el frente se recomienda una
  imagen cuadrada (la RenderTexture interna es 2000×2000) con espacio libre donde caen los textos.
- **Fuente** (`fontUrl`): typeface **JSON** de three (formato de `FontLoader`), NO `.ttf`/`.woff`.
  Convierte tu fuente con [facetype.js](https://gero3.github.io/facetype.js/).
- **Modelo** (`cardModelUrl`): GLB que cumpla el contrato siguiente.

## Contrato del modelo GLB

Para regenerar `card.glb` (Blender, exportador glTF, etc.) sin tocar código, el modelo debe
cumplir exactamente:

- **Nodos** (nombres exactos): `card` (mesh de la tarjeta), `clip` (gancho) y `clamp` (pinza).
- **Materiales** (nombres exactos): `base` asignado a `card`, `metal` asignado a `clip` y
  `clamp`. En render la lib **sustituye** `base` por su propio `MeshPhysicalMaterial` (clearcoat +
  textura dinámica del socio como `map`); `metal` se usa tal cual, o clonado y teñido si el tema
  define `colors.clip`.
- **Origen**: el origen del conjunto es el **punto de anclaje del clip** (donde engancha la
  correa). La lib posiciona el grupo visual en ese punto para que coincida con el joint físico.
- **Escala/dimensiones**: unidades métricas, Y-up, transforms aplicados. La tarjeta mide
  **1.6 × 2.25 × 0.02** unidades de mundo y su centro queda en **y = −1.45** respecto al origen
  (el anclaje del clip). El collider físico de la tarjeta es fijo en la lib (half-extents
  `[0.8, 1.125, 0.01]`): si cambias las proporciones del modelo, el visual y la física dejarán
  de coincidir.
- **Draco**: el asset de referencia va **sin comprimir** (~222 KB). El loader (soba
  `gltfResource`) soporta Draco por defecto, pero el decoder se descarga en runtime desde el CDN
  de Google (`gstatic.com`); si publicas un GLB comprimido y quieres self-hosting del decoder,
  llama a `gltfResource.setDecoderPath('/draco/')` (de `angular-three-soba/loaders`) antes de
  montar el badge.

## Avanzado: canvas propio con `Products3dBadgeScene`

Si quieres componer el badge con otros elementos 3D, la lib exporta la escena física
(`<products-3d-badge-scene>`) para montarla en tu propio `<ngt-canvas>`. Necesitas:

- `provideNgtRenderer()` en la ruta y `provideProducts3d({ cardModelUrl })` (la escena inyecta
  `PRODUCTS_3D_CONFIG`).
- Envolverla en `<ngtr-physics>` (la escena crea rigid bodies y joints Rapier).
- Pasar un tema COMPLETO y válido por `[theme]` (la validación temprana vive en el wrapper
  `Products3dBadge`, no en la escena).
- Tu propia iluminación: el ambient + environment con lightformers pertenecen al wrapper.
- Montarla solo en browser (`@defer`, igual que el wrapper).

| Input de `Products3dBadgeScene` | Tipo | Requerido |
| --- | --- | --- |
| `member` | `BadgeMemberData` | sí |
| `theme` | `Products3dBadgeTheme` | sí |
| `debug` | `boolean` | no — reservado; en canvas propio el debug de física se activa en las `[options]` de `<ngtr-physics>` |

```ts
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { NgtCanvas } from 'angular-three/dom';
import { NgtrPhysics } from 'angular-three-rapier';
import {
	BADGE_CAMERA,
	BADGE_PHYSICS,
	Products3dBadgeScene,
	type BadgeMemberData,
	type Products3dBadgeTheme,
} from '@dotted-labs/ngx-products-3d';

@Component({
	selector: 'app-custom-badge-canvas',
	template: `
		<ngt-canvas [camera]="camera">
			<ng-template canvasContent>
				<ngt-ambient-light [intensity]="ambientIntensity" />
				<ngtr-physics [options]="physicsOptions">
					<ng-template>
						<products-3d-badge-scene [member]="member()" [theme]="theme" />
					</ng-template>
				</ngtr-physics>
			</ng-template>
		</ngt-canvas>
	`,
	imports: [NgtCanvas, NgtrPhysics, Products3dBadgeScene],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomBadgeCanvasComponent {
	protected readonly camera = BADGE_CAMERA;
	protected readonly ambientIntensity = Math.PI;
	protected readonly physicsOptions = {
		gravity: BADGE_PHYSICS.gravity,
		timeStep: BADGE_PHYSICS.timeStep,
		interpolate: true,
	};

	protected readonly member = signal<BadgeMemberData>({
		name: 'Sergio',
		memberNumber: '0042',
		tier: 'gold',
	});

	protected readonly theme: Products3dBadgeTheme = {
		bandTextureUrl: '/assets/3d/band.png',
		baseTextures: { gold: '/assets/3d/base-gold.png' },
		defaultBaseTextureUrl: '/assets/3d/base-default.png',
		fontUrl: '/assets/3d/font.json',
	};
}
```

Las constantes de configuración del badge (`BADGE_CAMERA`, `BADGE_PHYSICS`, `BADGE_LIGHTING`,
`BADGE_MATERIAL_DEFAULTS`, …) son parte de la API pública y sirven como valores de referencia
para composiciones propias. También se exporta `Products3dBadgeTexture` (la escena del frente que
se renderiza a textura), pensada para uso interno/avanzado dentro de un `NgtsRenderTexture`.

## Licencia

MIT

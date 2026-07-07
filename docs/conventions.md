# Convenciones de código

> Homogeneidad extrema. La IA predice mejor cuando el repositorio se parece
> a sí mismo en todas partes.

## Estilo TypeScript

- **Versión:** TypeScript del workspace (Angular 21). `strict: true` obligatorio.
- **Formato:** Prettier del monorepo. Tabs, líneas máx 100 caracteres,
  comillas simples, trailing commas.
- **Imports:** orden: Angular → three/angular-three* → librerías → propios
  (`ngx-products-3d` primero, relativos después). `import type` para
  tipos puros.
- **`type` sobre `interface`** solo para uniones/utilidades; contratos
  públicos (`Products3dBadgeTheme`, `BadgeMemberData`) = `interface`.
- **`as const`** para configs (`BADGE_PHYSICS`, `BADGE_CAMERA`). Tuplas
  tipadas explícitas: `[0, 0, 13] as [number, number, number]`.
- Prohibido `any`. Duda de tipo → `unknown` + narrow.

## Nombres

| Tipo | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case` + sufijo | `badge-scene.component.ts` |
| Clases componente | `PascalCase`, prefijo `Products3d`, sin sufijo `Component` en clases de lib | `Products3dBadgeScene` |
| Selectores lib | `products-3d-*` | `products-3d-badge` |
| Selectores playground | `app-*` | `app-badge-demo` |
| Signals/computed/fns | `camelCase` | `resolvedTheme`, `baseTextureUrl` |
| Constantes config | `UPPER_SNAKE` prefijo producto | `BADGE_PHYSICS` |
| Tokens | `UPPER_SNAKE` prefijo lib | `PRODUCTS_3D_CONFIG` |
| Provider fns | `provide` + PascalCase | `provideProducts3dBadgeTheme` |
| Privados | sin `_`, usar `private readonly` | `private readonly vec` |

## Estructura de componente

Orden fijo dentro de clase:

```ts
@Component({
	selector: 'products-3d-badge-scene',
	template: `...`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Products3dBadgeScene {
	// 1. inputs
	readonly member = input.required<BadgeMemberData>();

	// 2. injects
	private readonly config = inject(PRODUCTS_3D_CONFIG);

	// 3. estado (signals + campos reutilizables de frame)
	protected readonly hovered = signal(false);
	private readonly vec = new Vector3();

	// 4. computed
	protected readonly materialOpts = computed(() => ...);

	// 5. constructor (effects, beforeRender)
	// 6. métodos (handlers primero, helpers después)
}
```

Reglas:

- Standalone siempre. `imports` explícitos en decorador, sin módulos.
- Template inline si <40 líneas; si no, `templateUrl`.
- `protected` para lo que usa template; `private` resto; `readonly` por defecto.
- Un componente por archivo. Archivo = nombre de componente.

## Angular Three

- Loop: SOLO `beforeRender`. Campos de frame (`Vector3`, curvas) instanciados
  una vez fuera del callback.
- Elementos custom (`extend()`) → `CUSTOM_ELEMENTS_SCHEMA` en ese componente,
  nunca global.
- Recursos (`gltfResource`, `textureResource`) → render condicionado a
  `.value()` resuelto.
- Referencias a rigid bodies vía `viewChild` signal queries, no `@ViewChild`.

## Tests

- Un spec por archivo: `<nombre>.spec.ts` junto al fuente.
- Solo lógica pura testeable sin WebGL: resolución de tema, fallback de
  tier, merge de material, clamps de lerp, validaciones de providers.
- `TestBed` mínimo; preferir fns puras extraídas a testear componentes 3D.
- Nombres descriptivos: `it('falls back to defaultBaseTextureUrl when tier unknown')`.
- Verificación visual (fps, jitter, cursor) NO va en specs → informe de impl.

## Manejo de errores

- Errores de config/tema: `throw new Error('[ngx-products-3d] <contexto>: <qué falta y cómo arreglarlo>')`.
- Validar temprano: en resolución de tema/config, no en mitad del render.
- Avisos solo dev: `if (ngDevMode) console.warn('[ngx-products-3d] ...')`.
  Único `console` permitido en lib.
- Nunca capturar y silenciar. Sin fallback silencioso salvo los definidos
  por spec (`defaultBaseTextureUrl`).

## Comentarios

Por defecto **no** se escriben. Permitidos solo cuando explican un *por qué*
no obvio: workaround de API (discrepancia spec↔`node_modules` documentada),
invariante de física (por qué `chordal`, por qué clamp 0.1–1), guard SSR.
JSDoc de una línea en todo export público del entry point primario y de
`badge/src/index.ts`. Los nombres hacen el resto.
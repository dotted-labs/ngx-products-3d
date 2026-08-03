# spec-03-F4 v2: Badge — diseño frontal de la card

> Revisión de la fase F4 (RenderTexture) tras la primera integración visual. Prerequisitos: spec-01/02 y spec-03-F3 implementadas (GLB + materiales + correa ya en pantalla). Corrige tres defectos observados: fondo que no ajusta a la card, textos estirados, y falta de control del color global del modelo.

> ⚠️ **REVISADA 2026-08-01 (leader, antes de implementar).** El borrador original contenía cuatro
> afirmaciones falsas sobre el código actual y tres huecos que habrían hundido la implementación.
> Están corregidos en el cuerpo de esta spec; el análisis con referencias a fichero:línea está en
> `progress/review_spec-03-F4v2.md`. Lo que cambió respecto al borrador:
>
> 1. **La RenderTexture YA es el `map`** de la tarjeta desde spec-03 F4, y la tarjeta **no usa el
>    material `base` del GLB** (usa `meshPhysicalMaterial` propio con clearcoat). El punto que pedía
>    «RT como map del material base» se ha eliminado: aplicarlo habría perdido el clearcoat.
> 2. **`baseColor` no puede ser el `color` del material de la tarjeta** (three multiplica
>    `map × color` → negro por defecto ⇒ frente negro). Entra por la escena RT. Ver R2.
> 3. **La cámara ortográfica necesita `manual: true`** (blinda `updateCamera()` del core) **y**
>    frustum explícito (evita el fallback al tamaño del canvas de la cámara de soba). Ver la
>    sección técnica; sin esto la fase no funciona.
> 4. **El diagnóstico del estirado estaba incompleto** (no era solo la RT cuadrada). Ver abajo.

## Diagnóstico de la captura actual

Hay **tres** relaciones de aspecto encadenadas entre la escena RT y la cara frontal de la tarjeta, y
hoy **ninguna de las tres coincide**:

1. **Frustum de la cámara de la escena RT** — es una `NgtsPerspectiveCamera` cuyo `aspect` lo fija
   **la propia cámara de soba** en un effect reactivo al tamaño
   (`angular-three-soba-cameras.mjs:427-437`: `camera.aspect = store.size.width() /
   store.size.height()`), contra el `size` del store del **portal**; y como el portal del
   `NgtsRenderTexture` **no pasa `size` propio** (`angular-three-soba-staging.mjs:3315`), ese
   store hereda el `size` del **canvas** (`angular-three.mjs:3695`, `mergeState`). Ésta es la
   causa dominante y la razón de que el frente se deforme **al redimensionar la ventana** (defecto
   que la 0.3.0 dejó anotado como conocido, no corregido).
2. **FBO** — cuadrado, `2000 × 2000`.
3. **Cara frontal de `card`** — el UV 0-1 cubre `1.6 × 2.25` (ratio **32:45 ≈ 0.711**), derivado del
   accessor del GLB: `u = (x + 0.8)/1.6`, `v = (1.125 − y)/2.25`.

De ahí los tres síntomas observados:

1. **Textos deformados** ("Sergio" estirado): composición de (1) × (2) × (3), variable con la ventana
2. **Fondo opaco rectangular**: el asset de fondo era un rectángulo sin alpha → banda blanca que no respeta la forma/tamaño de la card
3. **Textos arriba-izquierda**: el layout no ancla abajo-derecha ni respeta proporción

## Requisitos (cerrados con Sergio)

### R1 — Fondo: webp con transparencia, medidas exactas

El fondo del frontal es un **fichero `.webp` con canal alpha**. La transparencia deja ver el
`baseColor` que pinta el quad de fondo de la escena RT (**no** el material del modelo: ver R2) → el
arte se ajusta a la card sin necesidad de recortar la silueta a mano.

**Medidas obligatorias del asset:**

| Propiedad | Valor |
|---|---|
| Ratio | **32:45** (= 1.6 : 2.25, la cara frontal de `membresia.glb`) |
| Resolución recomendada | **1600 × 2250 px** (1 unidad mundo = 1000 px) |
| Resolución mínima | 800 × 1125 px |
| Formato | WebP con alpha, sRGB |
| Cobertura | La imagen completa cubre la cara frontal, sin márgenes de seguridad añadidos por la lib |
| Orientación | **El borde superior de la imagen es el borde superior de la tarjeta** (orientación natural: se ve en el visor de imágenes tal como se verá en la card) |

> **Por qué «borde superior» y no coordenadas UV** (corrección): hay dos convenciones de V opuestas
> en juego —los UV del GLB siguen glTF (`v = 0` es el borde **superior** de la tarjeta) y la textura
> de un render target va en orientación GL (`v = 0` abajo)—, y la lib ya las concilia invirtiendo la
> V (`BADGE_TEXTURE.mapRepeat = [1, −1]`, `mapOffset = [0, 1]`, spec-03-F3 feature 14). Hablar de
> «el px (0,0) es la esquina inferior-izquierda» era ambiguo y producía el arte del revés.
>
> **Esa inversión de V se mantiene.** Si al reescribir la escena RT alguien la borra «porque ya no
> hace falta», el frente del socio vuelve a salir espejado en vertical: es una regresión conocida.

Un asset con otro ratio se estira: la lib **valida el ratio al cargar** y avisa en dev
(`ngDevMode` warn) si se desvía >1%.

El tema mantiene el mapeo por tier de spec-01 (`baseTextures: Record<tier, url>` +
`defaultBaseTextureUrl`), ahora con este formato.

### R2 — Color base global del modelo

Nuevo campo de tema:

```ts
export interface Products3dBadgeTheme {
	/** Color del modelo. Default '#000000'. Ver más abajo cómo llega a cada parte */
	baseColor?: string;
	// ... resto igual (bandTextureUrl, baseTextures, defaultBaseTextureUrl, fontUrl, colors, material)
}
```

- Default **negro** (`#000000`)
- **Frente de la tarjeta**: `baseColor` es el color de un **quad de fondo opaco dentro de la escena
  RT**, detrás del plano del webp. Las zonas transparentes del webp lo revelan.
- **clip/clamp**: tinte del material `metal` del GLB — `theme.colors.clip ?? baseColor`. El override
  específico gana al global. Se reutiliza `tintMetalMaterial()` (clona antes de teñir).
- **El `color` del `meshPhysicalMaterial` de la tarjeta se queda en blanco.** No es negociable
  mientras el `map` sea la RenderTexture: three multiplica `map × color` en el fragment shader, así
  que un `baseColor` negro pintaría el frente entero de negro.
- **Canto y dorso de la tarjeta: fuera de alcance** (decisión de Sergio, 2026-08-01). Comparten
  material y `map` con el frente, así que muestran lo que caiga en sus UV. Se observa en la N3 y, si
  canta, se aborda en una spec aparte — corregirlo exigiría tocar el GLB, que esta spec prohíbe.

Nota de implementación: con `baseColor` default `#000000`, el effect de tinte del metal de
`badge-scene.component.ts` deja de tener rama «sin color → material original del GLB» (siempre habrá
color ⇒ siempre clona). Es aceptable —el `onCleanup` ya libera el clon— pero debe quedar
documentado en el código.

### R3 — Textos abajo-derecha, sin estirar

- `name` y `memberNumber` anclados **abajo-derecha** del frontal, alineados a la derecha
- `tier` encima de ellos o donde defina el layout — todo en `BADGE_TEXT_LAYOUT` (config), con
  sistema de anclaje:

```ts
export interface BadgeTextSlot {
	field: 'name' | 'memberNumber' | 'tier';
	/**
	 * Anclaje normalizado (0-1) sobre la cara frontal, en el sistema de la ESCENA RT:
	 * origen abajo-izquierda, [1,1] = arriba-derecha. NO son los UV del GLB (ahí v=0 es
	 * el borde superior). ej. abajo-dcha = [0.92, 0.10]
	 */
	anchor: [number, number];
	align: 'left' | 'right' | 'center';
	/** Altura del texto en unidades de mundo de la escena RT (la cara mide 1.6 × 2.25) */
	size: number;
	/** Profundidad de extrusión del TextGeometry (se conserva de la forma anterior) */
	height: number;
	/** Ancho máximo, mismas unidades que `size`, antes de reducir con escala uniforme */
	maxWidth: number;
}

export const BADGE_TEXT_LAYOUT: BadgeTextSlot[] = [
	{ field: 'name',         anchor: [0.92, 0.16], align: 'right', size: 0.09, height: 0.01, maxWidth: 0.65 },
	{ field: 'memberNumber', anchor: [0.92, 0.08], align: 'right', size: 0.06, height: 0.01, maxWidth: 0.4 },
	{ field: 'tier',         anchor: [0.92, 0.24], align: 'right', size: 0.05, height: 0.01, maxWidth: 0.4 },
];
```

- **Prohibido escalado no uniforme**: nombre largo → se reduce con escala **uniforme** hasta caber
  en `maxWidth` (medir bounding box del Text3D y aplicar `scale` igual en X/Y). Nunca comprimir solo
  en X
- **`align` no existe en `NgtsText3D`** (es `TextGeometry`, sin alineado): se implementa midiendo el
  bbox y desplazando en X. El desplazamiento se calcula sobre el ancho **ya escalado** por
  `fitTextScale`, no sobre el crudo
- Valores del layout ajustables en playground; los de arriba son punto de partida

## Corrección técnica de la RenderTexture

Raíz del estirado — hay que alinear las **tres** relaciones de aspecto del diagnóstico:

1. **Dimensiones de la RT = ratio de la card**: `BADGE_TEXTURE` pasa de `size: 2000` a:

```ts
export const BADGE_TEXTURE = {
	width: 1600,
	height: 2250,   // ratio 32:45 exacto
} as const;
```

2. **Cámara de la escena RT**: **ortográfica** encuadrando exactamente el rect 32:45 (mejor que
   perspectiva para diseño 2D plano — sin distorsión de perspectiva en los textos), con frustum
   explícito `left −0.8 / right 0.8 / top 1.125 / bottom −1.125`.

   **Obligatorios el frustum explícito Y `manual: true`: cada uno cierra una ruta distinta.** Lo que
   hoy acopla el encuadre al tamaño de la ventana es el **fallback de la propia cámara de soba**: si
   no se le pasan, `left/right/top/bottom` caen a la mitad del `store.size`
   (`angular-three-soba-cameras.mjs:257-264`), y el store del portal hereda el `size` del canvas
   porque el `NgtsRenderTexture` no le pasa uno propio (`angular-three-soba-staging.mjs:3315` +
   `angular-three.mjs:3695`) → frustum de ~1900 unidades y la tarjeta reducida a un punto. Eso lo
   cierra el **frustum explícito**. `manual: true` cierra la **segunda** ruta, hoy latente pero
   cargada: `updateCamera()` del core (`angular-three.mjs:601-615`) reescribe `left/right/top/bottom`
   con el `size` del store salvo que `camera.manual` sea `true`; con el cableado actual esa función
   **no llega a ejecutarse** sobre la cámara del portal —la llamada de `mergeState` es condicional a
   que el portal traiga `size` (`angular-three.mjs:3676-3682`) y el effect que la invoca vive en
   `storeFactory` (`angular-three.mjs:2806-2827`), que el store del portal no usa
   (`angular-three.mjs:3769-3781`)—, pero basta que soba pase un `size` al portal para que se active
   y devuelva la regresión. `manual` sobrevive al `omit` de `parameters` de la cámara de soba
   (`angular-three-soba-cameras.mjs:236-245`), así que basta pasarlo en `[options]`: el renderer lo
   asigna sobre la instancia de three (`angular-three.mjs:1049-1050`), que es de donde lo lee
   `updateCamera()`.

3. **Medidas derivadas, no duplicadas**: el rect `1.6 × 2.25` sale de
   `BADGE_PHYSICS.cardColliderHalfExtents` (`[0.8, 1.125, 0.01]`), que ya es el contrato del GLB.
   Nada de literales nuevos: una constante derivada en `badge.config.ts` y todo (frustum, quads,
   conversión de anclajes) cuelga de ella.
4. **Escena RT**: quad de fondo opaco con `baseColor` + plano con el webp del tier encima
   (`transparent: true`, alpha respetado) + textos según `BADGE_TEXT_LAYOUT`. Materiales `basic`
   (unlit): la escena RT no tiene luces. Separación en z pequeña y explícita desde config; con
   cámara ortográfica el depth es lineal, así que no hay z-fighting.
5. `colorSpace` sRGB en las texturas (ya se hace para la base; mantener).
6. **Se conserva** `BADGE_TEXTURE.mapRepeat` / `mapOffset` (inversión de la V, ver R1).

## Tareas

1. **T1** — Tema: añadir `baseColor` (default negro) + resolución del color de clip/clamp
   (`colors.clip ?? baseColor`) como fn pura. Tests N1: default aplicado, override, prioridad
   `colors.clip` > `baseColor`
2. **T2** — Tinte del metal: aplicar el color resuelto a `metal` (clip/clamp) en el effect existente
   de `badge-scene.component.ts`, sin mutar el material cacheado del GLB
3. **T3** — `BADGE_TEXTURE` width/height + rect derivado de `cardColliderHalfExtents` + cámara
   ortográfica `manual: true` con frustum 32:45. Test N1 de invariante: ratio del FBO == ratio del
   frustum == ratio de la cara del GLB
4. **T4** — `badge-texture.component.ts`: quad `baseColor` + plano webp por tier (fallback
   `defaultBaseTextureUrl`) con alpha; retirar `planeSize: [5, 5]` y la cámara perspectiva
5. **T5** — Validación del ratio del asset: fn pura `isRatioWithinTolerance(w, h, target, tol)` +
   warn dev al resolver la textura. Test N1
6. **T6** — `BADGE_TEXT_LAYOUT` con anclaje/align + render de los 3 textos, alineado derecha,
   reducción uniforme por `maxWidth`. Funciones puras con test N1: `fitTextScale` (ya existe),
   `alignOffsetX(bboxWidth, align)` y `uvAnchorToRtPosition(anchor)`
7. **T7** — Playground: webp por tier en ambos temas demo, control de `baseColor`, y un tier con
   asset de ratio inválido para verificar el warn. Verificación visual N3
8. **T8** — Documentación: contrato del asset frontal + `baseColor` + layout de textos en el README
   publicado, y ampliar la entrada **0.3.0** del CHANGELOG con los breaking de esta spec

## Versionado

Los cambios de API pública de esta spec (`BadgeTextSlot` cambia de forma, `BADGE_TEXTURE.size` →
`width`/`height`, `BADGE_TEXT.maxWidth` desaparece a favor del `maxWidth` por slot) **se pliegan en
la 0.3.0**, que aún **no está publicada** en npm (el registry sirve 0.2.1; el bump vive en la rama
`feature/blender-assets`). Decisión de Sergio, 2026-08-01.

**Consecuencia operativa: no se mergea a `main` hasta cerrar esta spec**, porque el merge dispara la
publicación de la 0.3.0 por CI (`.github/workflows/release-publish.yml`).

## Criterios de aceptación

- [ ] Webp con alpha ajusta EXACTO al frontal: sin estirado, sin bandas, transparencias muestran `baseColor`
- [ ] El frente **no** se deforma al redimensionar la ventana (regresión del defecto conocido de 0.3.0)
- [ ] Asset con ratio ≠ 32:45 → warn en dev
- [ ] `baseColor` default negro; cambiarlo tiñe el fondo del frente y clip+clamp; `colors.clip` hace override en el metal
- [ ] El frente sigue **sin espejar** (la inversión de V se conserva)
- [ ] `name` y `memberNumber` abajo-derecha, alineados a la derecha, tipografía sin deformar
- [ ] Nombre largo → escala uniforme reducida (nunca compresión en un solo eje)
- [ ] RT 1600×2250 + cámara ortográfica `manual` 32:45 → cero distorsión
- [ ] Cambios de `member`/`theme` reactivos sin recrear canvas
- [ ] Constantes solo en `badge.config.ts`, derivadas de `cardColliderHalfExtents` donde aplique
- [ ] N1 (`resolveClipColor`, `isRatioWithinTolerance`, `fitTextScale`, `alignOffsetX`, `uvAnchorToRtPosition`, invariante de ratios) + N3 (checklist visual) en el informe
- [ ] `pnpm build` + `pnpm ng lint ngx-products-3d` + `pnpm ng test ngx-products-3d` + `pnpm ng build products-3d-playground` verdes

## No hacer

- No tocar física, GLB ni correa (F3 cerrada)
- No perspectiva en la cámara de la RT (ortográfica)
- No escalado no uniforme de textos bajo ninguna circunstancia
- No recortar la silueta de la card en el asset — la transparencia del webp + UV exacto lo resuelven
- No campos de tema nuevos más allá de `baseColor`
- No cambiar el material de la tarjeta al `base` del GLB (perdería el clearcoat de spec-03)
- No borrar la inversión de V de `BADGE_TEXTURE.mapRepeat`/`mapOffset`
- No mergear a `main` mientras la spec esté abierta (publicaría la 0.3.0 a medias)

## A observar en la N3 (no son tareas)

- **Canto y dorso de la tarjeta**: fuera de alcance por decisión explícita (ver R2). Anotar qué se ve.
- **Tone mapping doble**: la escena RT se renderiza con el tone mapping del renderer y su resultado
  vuelve a pasar por él como `map` de un material físico. Si el arte sale lavado respecto al webp
  original, la causa es ésta (`toneMapped: false` en los materiales de la escena RT sería el
  candidato a arreglo, en spec aparte).
- **Coste del FBO**: `fboParams` multiplica por `viewport.dpr()` → 1600×2250 a dpr 2 = 3200×4500 con
  `samples: 8`. Es *menos* píxel que el 2000² actual (4000×4000 a dpr 2), así que no debería
  empeorar; confirmar que no hay caída de FPS.

## Assets que aporta Sergio (bloquean T7)

En `projects/products-3d-playground/public/assets/`, todos **1600 × 2250, WebP con alpha, sRGB**:

| Fichero | Tema | Tier |
|---|---|---|
| `base-gold.webp` | violet | gold |
| `base-silver.webp` | violet | silver |
| `base-default.webp` | violet | fallback |
| `base-ember-gold.webp` | ember | gold |
| `base-ember-silver.webp` | ember | silver |
| `base-ember-default.webp` | ember | fallback |

**Al menos uno debe tener zonas transparentes generosas** para poder verificar `baseColor` debajo.

Además se **conserva un PNG 256×256 de los actuales** renombrado a `base-wrong-ratio.png` y cableado
a un tier del demo, para verificar el warn de ratio inválido en la N3.

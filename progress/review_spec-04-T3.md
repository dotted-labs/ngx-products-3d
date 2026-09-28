# Review — spec-04 T3 (`badge-font-opentype`, feature `id: 3`)

**Veredicto:** APPROVED

## Criterios de aceptación (feature_list.json, id: 3)
- isOpentypeFontUrl testeada N1 (.otf, .OTF, .ttf, .otf?v=2, .otf#hash, .json, string vacío): [x] — `badge-font.spec.ts:26-57`, cubre además `#hash`, `otf.json`, `/assets/otf/font.json` y `?v=2` sin `url`.
- URL de typeface JSON sigue haciendo passthrough del string a soba: [x] — `badge-texture.component.spec.ts` "passes a typeface JSON url straight through to soba, untouched" (`resolvedFont()` es el string, `ttfLoaderMock.loaded` vacío).
- Import de TTFLoader dinámico, fuera del bundle de quien no usa OTF: [x] — verificado por el leader en el fesm2022 (`import(...)` dinámico presente, `opentype` ausente salvo identificadores propios), bundle 103 155 B.
- `dist/ngx-products-3d/package.json` sin dependencia nueva: [x] — confirmado, `dependencies: {"tslib":"^2.3.0"}`, y `git diff` de `package.json`/`projects/ngx-products-3d/package.json` vacío.
- Misma URL ⇒ misma referencia de objeto: [x] — `badge-font.spec.ts:74-82` (`toBe(first)` + cuenta de `loaded` en 1) y `badge-texture.component.spec.ts` "keeps the same font reference when the theme object changes but the url does not".
- Fuente rota degrada a sin texto con warn dev, sin excepción: [x] — `badge-texture.component.spec.ts` "degrades to a front WITHOUT TEXT (warning in dev) when the font fails, never throwing"; el gate `@if (resolvedFont(); as font)` usa `resourceValueOrUndefined` (`resource-value.ts:15-17`), que nunca deja pasar el throw de `Resource.value()` en estado error.
- `SOBA_TEXT3D_DEFAULT_HEIGHT` sigue en su sitio y discrimina: [x] — línea 481/501 de `badge-texture.component.spec.ts`, intacto.
- `pnpm build`: [x]
- `pnpm ng lint ngx-products-3d`: [x]
- `pnpm ng test ngx-products-3d` > 0 y todo verde: [x] — reejecutado por mí: **177/177**, 12 ficheros.

## Docs
- architecture.md: [x] — `import()` dinámico SSR-safe, cero deps nuevas, caché a nivel de módulo (asset inmutable, no estado de escena, coherente con el patrón ya usado por soba).
- conventions.md: [x] — JSDoc en exports (`isOpentypeFontUrl`, `loadOpentypeFontData`, `parsedOpentypeFonts`), error con prefijo `[ngx-products-3d]`, sin `any`.
- verification.md N1: [x] — `badge-font.spec.ts` cubre camino feliz + error/fallback (rechazo sin cachear, reintento tras fallo).
- verification.md N3: [x] — no aplica a T3 por diseño explícito de alcance (los `fontUrl` de la demo siguen en `font.json` borrado; repuntarlos a `Ballega.otf` es T6). Correcto no exigir checklist manual aquí: no hay superficie visual nueva observable en el playground todavía.

## Discriminancia (§4 del informe) — validación del análisis por construcción

El leader pide validar explícitamente que ninguna de las seis filas es vacua. Repasadas las aserciones fila por fila:

1. **`isOpentypeFontUrl` → siempre `true`**: cae contra los 9 casos que esperan `false` (`badge-font.spec.ts:41-56`) y contra el passthrough JSON del componente. Sostenido.
2. **`isOpentypeFontUrl` → siempre `false`**: cae contra los 8 casos que esperan `true` (`:27-37`) y los tests `.otf`/`.ttf` del componente. Sostenido.
3. **Caché devolviendo objeto nuevo por llamada (la fila crítica)**: el doble de `TTFLoader.loadAsync` (`badge-font.spec.ts:10-21`) devuelve un **objeto literal nuevo en cada invocación** (`{ familyName: 'Ballega', resolution: 1000, glyphs: {} }`), así que si `loadOpentypeFontData` no memoizara por identidad, `second` sería un objeto distinto de `first` → `expect(second).toBe(first)` (línea 80) falla por sí solo. Además `ttfLoaderMock.loaded` pasaría a tener 2 entradas en vez de 1 → línea 81 también falla. **Ninguna de las dos aserciones es vacua**: no comparan contra derivados de la propia función bajo prueba, sino contra el conteo de invocaciones de un doble independiente. Confirmado: la garantía de "soba no re-parsea en cada CD" está realmente testeada.
4. **Cachear el resultado en vez de la promesa**: el test de llamadas concurrentes (`:84-94`, `Promise.all`) — si se cacheara tras `await` en vez de antes, ambas llamadas concurrentes invocarían `parseOpentypeFont` de forma independiente (el `Map.set` ocurriría después de que ambas ya hubieran arrancado), produciendo 2 entradas en `loaded` y objetos distintos. Sostenido.
5. **Cachear también los fallos**: `:110-121`, el reintento tras `failures.clear()` exige una segunda llamada a `loadAsync` (`loaded` con 2 entradas); si el rechazo quedara cacheado, el `await` fallaría y el `matchObject` posterior nunca se alcanzaría. Sostenido.
6. **Gate del template dejando pasar `undefined`**: si `resolvedFont()` no gateara el `@for`, `NgtsText3D` recibiría una fuente ausente y (según el propio `resource-value.ts` y el precedente citado en `progress/history.md:151`) el `value()` en estado error lanzaría dentro de CD. El test "degrades... never throwing" (con `fixture.detectChanges()` + `whenStable()` sin catch) fallaría con una excepción no capturada si el gate no existiera. Sostenido.

**Juicio explícito**: el análisis por construcción del leader se sostiene en las seis filas; ninguna aserción citada es vacua y todas comparan contra el doble de `TTFLoader` o contra literales, no contra derivados circulares de la función bajo prueba. Dado que además he reejecutado la suite completa (177/177 verde) y el diseño del código (`badge-font.ts`) corresponde exactamente a lo que el análisis describe (Map de promesas keyed por URL, sin memoizar tras `await`, borrado en `.catch`), considero la discriminancia **suficientemente cubierta sin necesidad de ejecutar la ronda de mutaciones real**. No pido repetir el ejercicio.

## Alcance
- Sin dependencias nuevas: [x]
- Sin import de `three-stdlib`: [x] (`grep` no encuentra ninguna referencia en `badge-font.ts` ni en el diff de `badge-texture.component.ts`)
- `REQUIRED_THEME_URL_FIELDS` intacto: [x] — `badge-theme.ts:4`, sin diff
- `SOBA_TEXT3D_DEFAULT_HEIGHT` conservado: [x]
- `fontUrl` de la demo siguen apuntando a `font.json` (borrado): correcto, fuera de alcance de T3 (es T6), no se cuenta como defecto.

## Cambios requeridos
Ninguno.

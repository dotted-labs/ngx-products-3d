# Sesión actual

- **Fecha**: 2026-07-13
- **Spec**: spec-03 (badge — GLB, materiales, textura dinámica, theming, API final)
- **Fase**: 3 COMPLETA y verificada (N1/N2/N3). En pausa antes de Fase 4 (a petición del usuario).
- **Rol**: leader (orquestación)

## Estado

- spec-03 features 1–5 → **done**. Fase 3 verificada visualmente (re-smoke del usuario 2026-07-13: badge visible al cargar).
- Bug de render inicial resuelto: assets reales del playground (PNG + font helvetiker) + endurecimiento de
  acceso a recursos en la lib (`resourceValueOrUndefined`, gate `hasValue()`) + `provideZonelessChangeDetection()`.
- Deps de soba instaladas (autorizadas): gainmap-js, @pmndrs/vanilla, three-mesh-bvh, troika-three-text.
  Pendiente feature 11: declararlas como peers opcionales del paquete + README.
- Build/lint/test 59/playground verdes.

## Próximo (pendiente de orden del usuario — NO iniciar sin luz verde)

- Fase 4 — feature 6 `badge-texture-scene` (Text3D del socio + textura base por tier → escena secundaria
  para la RenderTexture). Depende de 1 ✅. font.json real (helvetiker) y base-*.png ya disponibles.
- Luego: 7 (RenderTexture como map), 8 (validación tema), 9 (playground final), 10 (README), 11 (publish).

## Log

- Fase 3 cerrada (N1/N2/N3). Usuario pidió parar antes de la feature 6. Sesión en pausa.
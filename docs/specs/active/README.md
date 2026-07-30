# Spec activa

Esta carpeta contiene **la spec en curso**: como máximo **un** `spec-<nn>-*.md`.

- **Vacía** (solo este README) = **no hay trabajo en curso**. Un agente que
  llegue aquí y no encuentre spec **para y pregunta**; no saca trabajo del
  archivo ni lo inventa.
- La raíz de `docs/specs/` es el **archivo**: specs ya completadas. Sirven de
  contexto histórico, nunca de trabajo pendiente.

## Ciclo de vida

```
docs/specs/spec-<nn>-*.md        (archivo: completada)
        │  git mv  ← el líder activa, solo si active/ está vacía
        ▼
docs/specs/active/spec-<nn>-*.md (en curso: fases, implementer, reviewer)
        │  git mv  ← el líder archiva, solo con "Spec completa: SÍ"
        ▼
docs/specs/spec-<nn>-*.md        (archivo)
```

**Quién mueve qué**: solo el `leader`. El `implementer` avisa cuando cierra la
última fase; el `reviewer` emite el bloque `Cierre de spec` con el veredicto
`Spec completa: SÍ | NO`. Sin ese `SÍ`, la spec se queda aquí.

Requisitos para archivar (los verifica el líder, ver `.claude/agents/leader.md`):

1. Todas las fases con sus criterios de aceptación en `[x]` en `progress/review_*`.
2. Todas las features de la spec en `status: "done"` en `feature_list.json`.
3. Nivel 2 verde: `pnpm build`, `pnpm ng lint ngx-products-3d`, `pnpm ng test ngx-products-3d`.

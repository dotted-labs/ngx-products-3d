# CHECKPOINTS — Evaluación del estado final

> En sistemas multi-agente no se evalúa el camino, se evalúa el destino.
> Estos son los checkpoints objetivos que un juez (humano o IA) puede usar
> para decidir si el proyecto está sano.

## C1 — El arnés está completo

- [ ] Existen los 3 archivos base: `AGENTS.md`, `feature_list.json`,
      `progress/current.md`.
- [ ] Existen los 3 docs: `docs/architecture.md`, `docs/conventions.md`,
      `docs/verification.md`.
- [ ] `pnpm build && pnpm ng lint ngx-products-3d && pnpm ng test ngx-products-3d`
      termina con exit code 0.

## C2 — El estado es coherente

- [ ] Como mucho una feature en `in_progress` en `feature_list.json`.
- [ ] Toda feature `done` tiene tests asociados que pasan.
- [ ] `progress/current.md` está vacío o describe la sesión activa
      (no contiene basura de sesiones anteriores).

## C3 — El código respeta la arquitectura

- [ ] `projects/ngx-products-3d/src/lib/` solo contiene los módulos previstos
      en `docs/architecture.md`.
- [ ] Solo `tslib` como dependency en la lib; lo 3D como `peerDependencies`
      (ver `docs/architecture.md` §5).
- [ ] No hay `console.log` sueltos en código de lib (salvo `ngDevMode`), ni
      TODOs sin contexto.

## C4 — La verificación es real

- [ ] Toda lógica pura pública tiene su `*.spec.ts` (camino feliz + error/fallback).
- [ ] Los tests no mockean `angular-three`/rapier para escena entera; lógica
      pura aislada, escena verificada manualmente en playground (Nivel 3).
- [ ] `pnpm ng test ngx-products-3d` muestra > 0 tests y todos verdes.

## C5 — La sesión se cerró bien

- [ ] No hay archivos sin trackear sospechosos (`dist/`, `.angular/`, `out-tsc/`
      fuera del `.gitignore`).
- [ ] `progress/history.md` tiene una entrada por la última sesión.
- [ ] La última feature trabajada está reflejada en su estado correcto.

---

**Cómo usar este archivo:** un agente revisor (`.claude/agents/reviewer.md`)
recorre cada checkbox, marca `[x]` o `[ ]`, y rechaza el cierre de sesión
si quedan boxes vacíos en C1-C5.

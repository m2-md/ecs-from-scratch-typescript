# ECS from Scratch — Entity Component System in TypeScript

<!-- LINKS:BEGIN — üretildi: scripts/sync-repo-links.py · elle düzenleme -->
**▶ [Live demo](https://m2-md.github.io/ecs-from-scratch-typescript/)** · [Source](https://github.com/m2-md/ecs-from-scratch-typescript)
<!-- LINKS:END -->

Working code for the article "Entity Component System from Scratch: Write Your Own
ECS in TypeScript, Then Move to bitECS". It contains three things:

1. **A hand-written ECS core** (`src/ecs.ts`) — numeric entity ids, a bitmask
   component mask, SoA (`Float32Array`) component stores and `query()`.
2. **Systems** (`src/systems.ts`, `src/render.ts`) — pure `(world, dt) => void`
   functions: `movementSystem`, `gravitySystem`, `boundsSystem` plus the
   canvas-bound `renderSystem`.
3. **The bitECS version** (`src/ecs-bitecs.ts`) — the same logic with
   `defineComponent` / `defineQuery`. The system bodies are identical to the
   hand-written version.

There is also a benchmark that measures the OOP `Particle[]` (AoS) hot loop
side by side with the ECS (SoA) one, and Vitest tests that verify the pure logic.

## Setup

```bash
npm install
```

## Running

```bash
npm run dev
```

- `http://localhost:5173/` → 5000 particles falling and bouncing off the walls with
  ECS (the assembly line: `gravity → movement → bounds → render`).

## Test

```bash
npm test
```

Vitest verifies the pure logic, without rendering:

- `test/ecs.test.ts` — `movementSystem` determinism (3 ticks, `pos.x === 15`,
  `pos.y === -7.5`, exact in f32) and that `query` returns only the entities that
  have the whole requested component set (`posOnly` is filtered out, untouched).
- `test/ecs-bitecs.test.ts` — bitECS `movementQuery(world).length === 1` and the
  same deterministic movement expectation.

## Benchmark

```bash
npm run bench            # 50000 entities x 200 ticks (default)
npm run bench 200000 100 # customize count and ticks
```

Sample output (Node 22 / V8, a single machine — it will vary on yours):

```
benchmark: 50000 entity x 200 tick
OOP (array of structs): 48.2 ms
ECS (structure of arrays): 22.6 ms
speedup: 2.14x
```

Note: on the ECS side the benchmark writes the hot loop by walking the component
stores (SoA) directly rather than going through `query()` — what is being measured
is the memory layout (AoS vs SoA). `query()` allocates an `Entity[]` on every call
and adds a layer of index indirection; that cost is a separate topic and one of the
reasons to move to bitECS.

## File layout

```
src/
  oop-baseline.ts  # class Particle + runOop (the AoS "textbook" model)
  ecs.ts           # core: Entity, Vec2Store, World, query, bitmask ops
  systems.ts       # movementSystem, gravitySystem, boundsSystem
  render.ts        # renderSystem (canvas-bound, excluded from tests)
  ecs-bitecs.ts    # the bitECS version of the same logic
  benchmark.ts     # runEcs (SoA hot loop) + compare
  bench-cli.ts     # `npm run bench` entry point
  main.ts          # RAF loop: 5000 particles, scene split across systems
test/
  ecs.test.ts
  ecs-bitecs.test.ts
```

## Dependencies

- `bitecs@^0.3.40` — the `defineComponent` / `defineQuery` API in the article belongs to this family.
- Dev: `typescript`, `vite`, `vite-node` (bench CLI), `vitest`, `@types/node`.

## License

MIT

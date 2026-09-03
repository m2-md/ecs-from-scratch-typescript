// benchmark.ts
import {
  createWorld,
  createEntity,
  addComponent,
  Position,
  Velocity,
} from "./ecs";
import { runOop } from "./oop-baseline";

export function runEcs(count: number, ticks: number): number {
  const world = createWorld();
  for (let i = 0; i < count; i++) {
    const e = createEntity(world);
    addComponent(world, Position, e);
    addComponent(world, Velocity, e);
    Position.x[e] = Math.random() * 800;
    Position.y[e] = Math.random() * 600;
  }

  // Sıcak döngü: component store'larını (SoA) doğrudan, bitişik gez.
  // query() bir Entity[] allocate edip index dolaylaması getirir; burada
  // ölçtüğümüz şey bellek düzeni (AoS vs SoA), o yüzden rafa doğrudan uzanıyoruz.
  const px = Position.x;
  const py = Position.y;
  const vx = Velocity.x;
  const vy = Velocity.y;
  const n = world.count;
  const dt = 1 / 60;

  const start = performance.now();
  for (let t = 0; t < ticks; t++) {
    for (let e = 0; e < n; e++) vy[e] += 900 * dt; // gravity
    for (let e = 0; e < n; e++) {
      px[e] += vx[e] * dt; // movement
      py[e] += vy[e] * dt;
    }
  }
  return performance.now() - start;
}

export function compare(count: number, ticks: number): void {
  // JIT ısınsın diye birer tur çevir
  runOop(1000, 10);
  runEcs(1000, 10);

  const oop = runOop(count, ticks);
  const ecs = runEcs(count, ticks);
  console.log(`OOP (array of structs): ${oop.toFixed(1)} ms`);
  console.log(`ECS (structure of arrays): ${ecs.toFixed(1)} ms`);
  console.log(`hızlanma: ${(oop / ecs).toFixed(2)}x`);
}

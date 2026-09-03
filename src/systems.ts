// systems.ts
import { type World, query, Position, Velocity } from "./ecs";

export function movementSystem(world: World, dt: number): void {
  const ents = query(world, [Position, Velocity]);
  for (const e of ents) {
    Position.x[e] += Velocity.x[e] * dt;
    Position.y[e] += Velocity.y[e] * dt;
  }
}

// systems.ts (continued)
export function gravitySystem(world: World, dt: number, g = 900): void {
  const ents = query(world, [Velocity]);
  for (const e of ents) {
    Velocity.y[e] += g * dt;
  }
}

// systems.ts (continued)
export function boundsSystem(
  world: World,
  width: number,
  height: number,
): void {
  const ents = query(world, [Position, Velocity]);
  for (const e of ents) {
    if (Position.x[e] < 0 || Position.x[e] > width)
      Velocity.x[e] = -Velocity.x[e];
    if (Position.y[e] < 0 || Position.y[e] > height)
      Velocity.y[e] = -Velocity.y[e];
  }
}

// ecs-bitecs.ts
import {
  createWorld,
  defineComponent,
  defineQuery,
  addEntity,
  addComponent,
  Types,
  type IWorld,
} from "bitecs";

// Bizim defineVec2()'nin bitECS karşılığı
export const Position = defineComponent({ x: Types.f32, y: Types.f32 });
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32 });

// Bizim query(world, [Position, Velocity])'nin karşılığı — ama önceden derlenir
const movementQuery = defineQuery([Position, Velocity]);

export function movementSystem(world: IWorld, dt: number): IWorld {
  const ents = movementQuery(world);
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    Position.x[e] += Velocity.x[e] * dt;
    Position.y[e] += Velocity.y[e] * dt;
  }
  return world;
}

export { createWorld, addEntity, addComponent };

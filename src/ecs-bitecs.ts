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

// Our defineVec2() equivalent in bitECS
export const Position = defineComponent({ x: Types.f32, y: Types.f32 });
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32 });

// Our query(world, [Position, Velocity]) equivalent — precompiled
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

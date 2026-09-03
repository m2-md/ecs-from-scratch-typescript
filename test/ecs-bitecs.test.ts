// ecs-bitecs.test.ts
import { describe, it, expect } from "vitest";
import {
  createWorld,
  defineComponent,
  defineQuery,
  addEntity,
  addComponent,
  Types,
} from "bitecs";

const Position = defineComponent({ x: Types.f32, y: Types.f32 });
const Velocity = defineComponent({ x: Types.f32, y: Types.f32 });
const movementQuery = defineQuery([Position, Velocity]);

function movementSystem(world: any, dt: number) {
  const ents = movementQuery(world);
  for (let i = 0; i < ents.length; i++) {
    const e = ents[i];
    Position.x[e] += Velocity.x[e] * dt;
    Position.y[e] += Velocity.y[e] * dt;
  }
}

describe("bitECS movementSystem", () => {
  it("sadece Position+Velocity olan entity'yi ilerletir", () => {
    const world = createWorld();

    const full = addEntity(world);
    addComponent(world, Position, full);
    addComponent(world, Velocity, full);
    Velocity.x[full] = 10;
    Velocity.y[full] = -5;

    const posOnly = addEntity(world);
    addComponent(world, Position, posOnly);
    Position.x[posOnly] = 100;

    expect(movementQuery(world).length).toBe(1); // sadece 'full'

    for (let i = 0; i < 3; i++) movementSystem(world, 0.5);

    expect(Position.x[full]).toBe(15);
    expect(Position.y[full]).toBe(-7.5);
    expect(Position.x[posOnly]).toBe(100); // el değmedi
  });
});

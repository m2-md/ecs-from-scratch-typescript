// ecs.test.ts
import { describe, it, expect } from "vitest";
import {
  createWorld,
  createEntity,
  addComponent,
  hasComponent,
  query,
  Position,
  Velocity,
} from "../src/ecs";
import { movementSystem } from "../src/systems";

describe("movementSystem", () => {
  it("konumu hız * dt kadar deterministik ilerletir", () => {
    const world = createWorld();
    const e = createEntity(world);
    addComponent(world, Position, e);
    addComponent(world, Velocity, e);
    Position.x[e] = 0;
    Position.y[e] = 0;
    Velocity.x[e] = 10;
    Velocity.y[e] = -5;

    // dt = 0.5 ile üç tick: 3 * 0.5 = 1.5 saniye
    movementSystem(world, 0.5);
    movementSystem(world, 0.5);
    movementSystem(world, 0.5);

    // x: 0 + 10 * 1.5 = 15 ; y: 0 + (-5) * 1.5 = -7.5
    expect(Position.x[e]).toBe(15);
    expect(Position.y[e]).toBe(-7.5);
  });
});

// ecs.test.ts (devam)
describe("query", () => {
  it("yalnızca istenen component setinin TAMAMINA sahip entity'leri döndürür", () => {
    const world = createWorld();

    const full = createEntity(world); // Position + Velocity
    addComponent(world, Position, full);
    addComponent(world, Velocity, full);

    const posOnly = createEntity(world); // sadece Position
    addComponent(world, Position, posOnly);
    Position.x[posOnly] = 100;

    const moving = query(world, [Position, Velocity]);
    expect(moving).toEqual([full]);
    expect(moving).not.toContain(posOnly);

    // movementSystem posOnly'ye dokunmamalı
    movementSystem(world, 1);
    expect(Position.x[posOnly]).toBe(100);
    expect(hasComponent(world, Velocity, posOnly)).toBe(false);
  });
});

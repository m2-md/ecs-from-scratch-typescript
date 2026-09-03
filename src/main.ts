// main.ts — RAF loop, scene decoupled into systems
import {
  createWorld,
  createEntity,
  addComponent,
  Position,
  Velocity,
} from "./ecs";
import { gravitySystem, movementSystem, boundsSystem } from "./systems";
import { renderSystem } from "./render";

const canvas = document.querySelector("canvas")!;
const ctx = canvas.getContext("2d")!;
const W = (canvas.width = window.innerWidth);
const H = (canvas.height = window.innerHeight);

const world = createWorld();

// 5000 particles — each with random velocity
for (let i = 0; i < 5000; i++) {
  const e = createEntity(world);
  addComponent(world, Position, e);
  addComponent(world, Velocity, e);
  Position.x[e] = Math.random() * W;
  Position.y[e] = Math.random() * H;
  Velocity.x[e] = (Math.random() - 0.5) * 400;
  Velocity.y[e] = (Math.random() - 0.5) * 400;
}

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 1 / 30);
  last = now;

  // Pipeline stations — execution order matters
  gravitySystem(world, dt); // 1. apply gravity to velocity
  movementSystem(world, dt); // 2. advance position
  boundsSystem(world, W, H); // 3. bounce off the walls
  renderSystem(world, ctx, W, H); // 4. draw to screen

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

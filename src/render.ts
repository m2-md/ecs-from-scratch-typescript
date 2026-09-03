// render.ts — canvas bound; never mixed with pure logic
import { type World, query, Position } from "./ecs";

export function renderSystem(
  world: World,
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
): void {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#4ade80";
  const ents = query(world, [Position]);
  for (const e of ents) {
    ctx.fillRect(Position.x[e], Position.y[e], 3, 3);
  }
}

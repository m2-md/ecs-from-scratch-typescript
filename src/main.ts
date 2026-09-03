// main.ts — RAF döngüsü, sahne sistemlere bölünmüş
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

// 5000 parçacık — hepsi rastgele hızla, banttan geçen boş şasiler
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

  // Bant boyunca istasyonlar — sıra önemlidir
  gravitySystem(world, dt); // 1. hıza yerçekimi ekle
  movementSystem(world, dt); // 2. konumu ilerlet
  boundsSystem(world, W, H); // 3. duvardan sektir
  renderSystem(world, ctx, W, H); // 4. ekrana çiz

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// oop-baseline.ts — "usta" modeli: veri + davranış tek nesnede
class Particle {
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public life: number,
  ) {}

  update(dt: number, width: number, height: number): void {
    this.vy += 900 * dt; // yerçekimi
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < 0 || this.x > width) this.vx = -this.vx;
    if (this.y < 0 || this.y > height) this.vy = -this.vy;
    this.life -= dt;
  }
}

export function runOop(count: number, ticks: number): number {
  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    particles.push(
      new Particle(Math.random() * 800, Math.random() * 600, 0, 0, 5),
    );
  }

  const start = performance.now();
  for (let t = 0; t < ticks; t++) {
    for (const p of particles) p.update(1 / 60, 800, 600);
  }
  return performance.now() - start;
}

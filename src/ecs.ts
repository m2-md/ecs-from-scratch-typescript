// ecs.ts — core
export type Entity = number;
export const MAX_ENTITIES = 100_000;

// Each Vec2 component: one bit in the bitmask + two parallel Float32Arrays
export interface Vec2Store {
  bit: number;
  x: Float32Array;
  y: Float32Array;
}

let nextBit = 0;
export function defineVec2(): Vec2Store {
  return {
    bit: 1 << nextBit++, // each component owns exactly one bit in the bitmask
    x: new Float32Array(MAX_ENTITIES),
    y: new Float32Array(MAX_ENTITIES),
  };
}

export const Position = defineVec2();
export const Velocity = defineVec2();

// ecs.ts — World
export interface World {
  masks: Uint32Array; // entity id -> which components it has (bitmask)
  alive: Uint8Array; // entity id -> is alive?
  count: number; // highest allocated id so far (high-water mark)
  free: Entity[]; // deleted recycled IDs
}

export function createWorld(): World {
  return {
    masks: new Uint32Array(MAX_ENTITIES),
    alive: new Uint8Array(MAX_ENTITIES),
    count: 0,
    free: [],
  };
}

export function createEntity(world: World): Entity {
  // Recycle free ID if available, otherwise allocate new
  const e = world.free.length > 0 ? world.free.pop()! : world.count++;
  world.alive[e] = 1;
  world.masks[e] = 0;
  return e;
}

export function destroyEntity(world: World, e: Entity): void {
  world.alive[e] = 0;
  world.masks[e] = 0;
  world.free.push(e); // return ID to pool instead of discarding
}

// ecs.ts — attach/detach components
export function addComponent(
  world: World,
  store: { bit: number },
  e: Entity,
): void {
  world.masks[e] |= store.bit; // enable bit
}

export function removeComponent(
  world: World,
  store: { bit: number },
  e: Entity,
): void {
  world.masks[e] &= ~store.bit; // clear the bit
}

export function hasComponent(
  world: World,
  store: { bit: number },
  e: Entity,
): boolean {
  return (world.masks[e] & store.bit) !== 0;
}

// ecs.ts — query
export function query(world: World, stores: { bit: number }[]): Entity[] {
  let target = 0;
  for (const s of stores) target |= s.bit;

  const out: Entity[] = [];
  for (let e = 0; e < world.count; e++) {
    if (world.alive[e] === 1 && (world.masks[e] & target) === target) {
      out.push(e);
    }
  }
  return out;
}

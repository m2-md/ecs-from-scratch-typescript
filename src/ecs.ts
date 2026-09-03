// ecs.ts — çekirdek
export type Entity = number;
export const MAX_ENTITIES = 100_000;

// Her Vec2 component'i: bitmask'te bir bit + iki paralel Float32Array
export interface Vec2Store {
  bit: number;
  x: Float32Array;
  y: Float32Array;
}

let nextBit = 0;
export function defineVec2(): Vec2Store {
  return {
    bit: 1 << nextBit++, // her component bitmask'te tek bir biti sahiplenir
    x: new Float32Array(MAX_ENTITIES),
    y: new Float32Array(MAX_ENTITIES),
  };
}

export const Position = defineVec2();
export const Velocity = defineVec2();

// ecs.ts — dünya (World)
export interface World {
  masks: Uint32Array; // entity id -> hangi component'lere sahip (bitmask)
  alive: Uint8Array; // entity id -> canlı mı?
  count: number; // şu ana kadar açılmış en yüksek id (high-water mark)
  free: Entity[]; // silinip geri dönüşüme giren id'ler
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
  // Boşta id varsa geri dönüştür, yoksa yeni bir tane aç
  const e = world.free.length > 0 ? world.free.pop()! : world.count++;
  world.alive[e] = 1;
  world.masks[e] = 0;
  return e;
}

export function destroyEntity(world: World, e: Entity): void {
  world.alive[e] = 0;
  world.masks[e] = 0;
  world.free.push(e); // id'yi çöpe atma, havuza geri koy
}

// ecs.ts — component takma/sökme
export function addComponent(
  world: World,
  store: { bit: number },
  e: Entity,
): void {
  world.masks[e] |= store.bit; // biti aç
}

export function removeComponent(
  world: World,
  store: { bit: number },
  e: Entity,
): void {
  world.masks[e] &= ~store.bit; // biti kapat
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

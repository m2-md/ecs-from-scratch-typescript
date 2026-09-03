# Sıfırdan ECS — TypeScript'te Entity Component System

"Sıfırdan Entity Component System: TypeScript'te Kendi ECS'ini Yaz, Sonra bitECS'e
Geç" makalesinin çalışan kodu. Üç şey içerir:

1. **Elle yazılan ECS çekirdeği** (`src/ecs.ts`) — sayısal entity id, bitmask
   component maskesi, SoA (`Float32Array`) component store'ları ve `query()`.
2. **Sistemler** (`src/systems.ts`, `src/render.ts`) — saf `(world, dt) => void`
   fonksiyonları: `movementSystem`, `gravitySystem`, `boundsSystem` + canvas'a
   bağlı `renderSystem`.
3. **bitECS sürümü** (`src/ecs-bitecs.ts`) — aynı mantık, `defineComponent` /
   `defineQuery` ile. Sistem gövdeleri elle yazılan sürümle birebir aynı.

Ayrıca OOP `Particle[]` (AoS) ile ECS (SoA) hot loop'unu yan yana ölçen bir
benchmark ve saf mantığı doğrulayan Vitest testleri var.

## Kurulum

```bash
npm install
```

## Çalıştırma

```bash
npm run dev
```

- `http://localhost:5173/` → 5000 parçacık ECS ile düşüp duvarlardan sekiyor
  (montaj hattı: `gravity → movement → bounds → render`).

## Test

```bash
npm test
```

Vitest, render'sız saf mantığı doğrular:

- `test/ecs.test.ts` — `movementSystem` determinizmi (3 tick, `pos.x === 15`,
  `pos.y === -7.5`, f32'de tam) ve `query`'nin yalnızca istenen component setinin
  tamamına sahip entity'leri döndürmesi (`posOnly` filtrelenir, dokunulmaz).
- `test/ecs-bitecs.test.ts` — bitECS `movementQuery(world).length === 1` ve aynı
  deterministik hareket beklentisi.

## Benchmark

```bash
npm run bench            # 50000 entity x 200 tick (varsayılan)
npm run bench 200000 100 # count ve ticks özelleştir
```

Örnek çıktı (Node 22 / V8, tek makine — sizde oynar):

```
benchmark: 50000 entity x 200 tick
OOP (array of structs): 48.2 ms
ECS (structure of arrays): 22.6 ms
hızlanma: 2.14x
```

Not: benchmark ECS tarafında sıcak döngüyü `query()` üzerinden değil, component
store'larını (SoA) doğrudan gezerek yazar — ölçülen şey bellek düzenidir (AoS vs
SoA). `query()` her çağrıda bir `Entity[]` allocate edip index dolaylaması getirir;
o maliyet ayrı bir konudur ve bitECS'e geçme sebeplerinden biridir.

## Dosya yapısı

```
src/
  oop-baseline.ts  # class Particle + runOop (AoS "usta" modeli)
  ecs.ts           # çekirdek: Entity, Vec2Store, World, query, bitmask op'ları
  systems.ts       # movementSystem, gravitySystem, boundsSystem
  render.ts        # renderSystem (canvas'a bağlı, testten hariç)
  ecs-bitecs.ts    # aynı mantığın bitECS sürümü
  benchmark.ts     # runEcs (SoA hot loop) + compare
  bench-cli.ts     # `npm run bench` giriş noktası
  main.ts          # RAF döngüsü: 5000 parçacık, sistemlere bölünmüş sahne
test/
  ecs.test.ts
  ecs-bitecs.test.ts
```

## Bağımlılıklar

- `bitecs@^0.3.40` — makaledeki `defineComponent` / `defineQuery` API'si bu ailededir.
- Dev: `typescript`, `vite`, `vite-node` (bench CLI), `vitest`, `@types/node`.

## Lisans

MIT

# Sıfırdan Entity Component System: TypeScript'te Kendi ECS'ini Yaz, Sonra bitECS'e Geç

*Dağınık `update()` döngülerini ve nesne dizilerini önce elle yazılmış veri-odaklı bir ECS'e taşıyoruz — sonra tek satırlık farklarla bitECS'e. Kütüphaneyi hype ile değil, profil ile seçiyoruz.*

*Tahmini okuma süresi: 16 dakika*

---

Fizik motoru yazımızda cisimleri düz bir `Body[]` dizisinde geziyorduk. Her karede `for (const b of bodies)` döngüsü dönüyor, her cismin `pos`'unu, `vel`'ini, `radius`'unu okuyup güncelliyorduk. Birkaç yüz cisimde bu desen kusursuz çalışır — o yazıda haklıydık, orada yanlış bir şey yoktu.

Sonra sahneye 20 bin parçacık koyun.

Şimdi her `Body` ayrı bir nesne. Bellekte kim bilir nerede duruyor: biri şurada, diğeri üç kilobayt ötede, üçüncüsü bambaşka bir sayfada. CPU her cismin `pos.x`'ini okumak için belleğin dört bir yanına uzanıyor. Üstelik her nesnenin içinde işimize yaramayan `radius`, `bounciness`, `invMass` alanları da var — ama sırf `pos` ile `vel`'e dokunmak için CPU onları da cache'e çekiyor. Boşa taşınan yük.

İşte bu yazıda o `Body[]` desenini "önce" olarak alıp veri-odaklı (data-oriented) bir mimariye taşıyacağız: **Entity Component System**, kısaca ECS. Önce çekirdeğini kendimiz yazacağız — sayısal entity id, component store'ları, `world.query(...)`, sistemler. Sonra bu elle yazdığımız world'ü, sadece birkaç satırı değiştirerek `bitECS` kütüphanesine bağlayacağız. Ve en önemlisi: bunu neden yaptığımızı bir benchmark ile göstereceğiz.

Kafamdaki tek bir görüntüyle ilerleyelim, yazı boyunca ona sadık kalacağım: **montaj hattı** (assembly line).

### İki Üretim Felsefesi: Usta ve Montaj Hattı

Nesne tabanlı (OOP) yaklaşımı bir usta işçiye benzetin. Her araba ustanın önüne geliyor, usta o arabanın motorunu takıyor, tekerleğini vidalıyor, boyasını çekiyor — hepsini o tek araba için baştan sona. `Body` sınıfının `update()` metodu tam olarak bu: nesne, kendi verisini ve kendi davranışını bir arada taşıyan bağımsız bir usta.

ECS bunu tersine çevirir. Fabrikada usta yoktur; **montaj hattı** vardır. Arabanın gövdesi (entity) banttan geçen boş bir şasidir, üstünde sadece bir seri numarası. Parçalar (component) raflarda tipine göre dizili durur: bütün motorlar bir rafta, bütün tekerlekler başka rafta. İstasyonlar (system) ise sabittir — "motor istasyonu" bandan geçen *her* şasiye aynı motoru takar, sonra sıradaki şasiye geçer.

Bu üç kelimeyi aklınıza kazıyın, çünkü ECS'in tamamı bunlar:

- **Entity** : sadece bir sayı. Bir kimlik, içi boş bir şasi numarası.
- **Component** : saf veri. Konum, hız, sağlık — davranış yok, sadece alanlar.
- **System** : davranış. Belirli component'lere sahip entity'leri gezip iş yapan fonksiyon.

Usta modelinde veri ile davranış aynı nesnede sarılıdır. Montaj hattında ayrılır: veri raflarda, davranış istasyonlarda. Bütün yazı bu ayrımın hikayesi.

### Nesne Dizisi Neden Çöker

Önce hastalığı ölçelim. İşte klasik usta modeli — bir `Particle` sınıfı, kendi `update()`'iyle, düz bir dizide (`entity component system javascript` deyince akla ilk gelen yapı):

```ts
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
```

Kod temiz, okunması kolay, hiçbir itirazım yok. Sorun mimaride değil, **bellek düzeninde** (memory layout). Her `Particle` ayrı bir heap nesnesi; motoru banttan geçirirken CPU'nun cache'ine `x` ile `vx`'i çekmek isterken yanında `life`'ı, nesne başlığını, ne varsa hepsini taşıyor. Bu, "array of structs" (AoS) deseni — dizi var ama içi bağımsız nesnelerle dolu.

Birazdan aynı işi veri-odaklı yapacağız ve ikisini yan yana koyacağız. Şimdilik zihninizde tutun: usta her arabaya tek tek gidiyor, montaj hattı ise parçaları önüne dizilmiş halde buluyor.

### Veri Olarak Entity ve Component

Montaj hattını kuralım. İlk karar: entity artık bir nesne değil, sadece bir **sayı**. Şasi numarası. Bütün veri, entity'nin *dışında*, component store'larında yaşayacak (`ecs architecture typescript`'in çekirdek fikri budur).

Bir component'i şöyle tanımlıyorum: her component, o component'in tüm entity'ler için değerlerini tutan tipli dizilerden (typed array) oluşur. `Position` için `x` ve `y` iki ayrı `Float32Array`. Entity id, bu dizilere index olur — 42 numaralı entity'nin x'i `Position.x[42]`'dir. Basit ve doğrudan.

```ts
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
```

Peki bir entity'nin *hangi* component'lere sahip olduğunu nasıl bileceğiz? Şasiye hangi parçaların takıldığını bir yere yazmak lazım. Cevap zarif: her entity için bir **bitmask** (bit maskesi). `Position`'ın biti 1, `Velocity`'nin biti 2 (yani `0b10`) olsun; ikisi de takılıysa entity'nin maskesi `0b11` olur. Bir entity'nin belirli component'lere sahip olup olmadığını kontrol etmek, tek bir `AND` işlemine iner.

```ts
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
```

Component takıp sökmek, artık nesneye alan eklemek değil — sadece maskede bir biti açıp kapamak:

```ts
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
```

Dikkat edin: `addComponent` entity'ye veri *yazmıyor*, sadece "bu şasiye motor takılı" diye işaretliyor. Verinin kendisi (`Position.x[e] = ...`) ayrı bir adım. Parça rafta zaten var; biz sadece hangi şasiye takıldığını maskede not ediyoruz.

Bir entity oluşturmak, ona konum ve hız vermek şöyle görünür:

```ts
// Kullanım şeması (ayrı bir dosya değil) — projede aynı desen src/main.ts
// ve src/benchmark.ts içinde kuruluyor.
const world = createWorld();

const e = createEntity(world);
addComponent(world, Position, e);
addComponent(world, Velocity, e);
Position.x[e] = 100;
Position.y[e] = 50;
Velocity.x[e] = 10;
Velocity.y[e] = -5;
```

`new Body(...)` yok. Nesne yok. Sadece bir sayı ve o sayıya bağlı raflardaki hücreler.

### System'ler ve Query'ler

Şasilerimiz banttan geçiyor, parçalar takılı. Şimdi istasyonları kuralım. Bir system'in tek ihtiyacı şu: "bana şu component'lerin hepsine sahip olan entity'leri getir." Bu sorgunun adı **query**.

Query çok basit bir şey yapar: istenen component'lerin bitlerini `OR`'layıp tek bir hedef maske üretir, sonra tüm entity'leri gezip maskesi bu hedefi *içeren* (yani `mask & target === target`) olanları toplar.

```ts
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
```

İşte montaj hattının ilk istasyonu — `movementSystem`. `Position` ve `Velocity`'ye sahip her entity'yi gezer, konumu hıza göre ilerletir (`ecs systems and queries`'in kanonik örneği):

```ts
// systems.ts
import { type World, query, Position, Velocity } from "./ecs";

export function movementSystem(world: World, dt: number): void {
  const ents = query(world, [Position, Velocity]);
  for (const e of ents) {
    Position.x[e] += Velocity.x[e] * dt;
    Position.y[e] += Velocity.y[e] * dt;
  }
}
```

Şuna bir bakın. Fizik motorundaki `for (const b of bodies) { b.pos = add(b.pos, scale(b.vel, dt)) }` döngüsüyle aynı işi yapıyor — ama artık `b` bir nesne değil, `e` bir sayı; `b.pos` bir Vec2 nesnesi değil, `Position.x[e]` bir dizideki hücre. Aynı fizik, bambaşka bir bellek düzeni.

Ve asıl güzellik burada başlıyor: ikinci istasyonu eklemek için hiçbir şeyi yeniden yazmıyoruz. Yerçekimini ayrı bir system'e alalım — `GravitySystem`:

```ts
// systems.ts (devam)
export function gravitySystem(world: World, dt: number, g = 900): void {
  const ents = query(world, [Velocity]);
  for (const e of ents) {
    Velocity.y[e] += g * dt;
  }
}
```

Usta modelinde yerçekimini eklemek için `Particle.update()`'in içine girip kodu değiştirmemiz gerekirdi. Montaj hattında ise banda yeni bir istasyon koyuyoruz — mevcut istasyonlara dokunmadan. Davranışı veriden ayırmanın kârı tam olarak bu: her system bağımsız, test edilebilir, sıraları değiştirilebilir bir kutu.

### Structure-of-Arrays Component Store

Şimdi baştan verdiğim sözü ödeyelim: neden `Float32Array`? Neden `x` ile `y` ayrı iki dizide, tek bir `{x, y}` nesnesi değil?

Cevabı bir itirafla vereyim. Ben bu ECS'i ilk yazdığımda component'leri entity başına bir `Map<Entity, {x, y}>`'de tutuyordum. Kod şıktı, API tertemizdi. Profil rezildi. Çünkü her `{x, y}` yine ayrı bir heap nesnesiydi — usta modelinin nesne dağınıklığını, üstüne bir de `Map` maliyetiyle geri getirmiştim. Yani hiçbir şey kazanmamıştım.

Fark şu iki desende:

- **Array of Structs (AoS):** `[{x, y}, {x, y}, {x, y}, ...]`. Her eleman ayrı nesne, bellekte dağınık. Ustanın rafı: her araba için ayrı bir kutu, kutuların içinde parçalar karışık.
- **Structure of Arrays (SoA):** `{ x: [.....], y: [.....] }`. Tüm x'ler bitişik, tüm y'ler bitişik. Montaj hattının rafı: bütün x-parçaları tek sırada, elini uzatınca hepsi orada.

`movementSystem` sadece `Position.x` ve `Position.y`'yi okur. SoA'da bu iki dizi bellekte kesintisiz uzanır; CPU birini okurken yanındaki 15 komşuyu da cache'e çeker ve döngünün sonraki adımları bedavaya gelir. Buna **cache locality** (önbellek yerelliği) denir ve `data oriented design games` dünyasının bütün mesele budur. AoS'ta ise her adımda başka bir sayfaya zıplarsınız — cache sürekli ıskalar (cache miss), CPU boş bekler.

Bunu ölçebiliriz. İşte usta ile montaj hattını yan yana koyan benchmark. Ölçtüğümüz şey saf bellek düzeni olduğu için ECS tarafında sıcak döngüyü `query()` üzerinden değil, component store'larını (`Position.x`, `Velocity.y` …) doğrudan gezerek yazıyorum: `query()` her çağrıda bir `Entity[]` allocate eder ve araya index dolaylaması sokar — o maliyet SoA'nın layout kazancını maskeler, üstelik bir sonraki bölümde bitECS'e geçme sebebimizin ta kendisi. AoS ile SoA'yı adil kıyaslamak için raflara doğrudan uzanıyoruz:

```ts
// benchmark.ts
import {
  createWorld,
  createEntity,
  addComponent,
  Position,
  Velocity,
} from "./ecs";
import { runOop } from "./oop-baseline";

export function runEcs(count: number, ticks: number): number {
  const world = createWorld();
  for (let i = 0; i < count; i++) {
    const e = createEntity(world);
    addComponent(world, Position, e);
    addComponent(world, Velocity, e);
    Position.x[e] = Math.random() * 800;
    Position.y[e] = Math.random() * 600;
  }

  // Sıcak döngü: component store'larını (SoA) doğrudan, bitişik gez.
  // query() bir Entity[] allocate edip index dolaylaması getirir; burada
  // ölçtüğümüz şey bellek düzeni (AoS vs SoA), o yüzden rafa doğrudan uzanıyoruz.
  const px = Position.x;
  const py = Position.y;
  const vx = Velocity.x;
  const vy = Velocity.y;
  const n = world.count;
  const dt = 1 / 60;

  const start = performance.now();
  for (let t = 0; t < ticks; t++) {
    for (let e = 0; e < n; e++) vy[e] += 900 * dt; // gravity
    for (let e = 0; e < n; e++) {
      px[e] += vx[e] * dt; // movement
      py[e] += vy[e] * dt;
    }
  }
  return performance.now() - start;
}

export function compare(count: number, ticks: number): void {
  // JIT ısınsın diye birer tur çevir
  runOop(1000, 10);
  runEcs(1000, 10);

  const oop = runOop(count, ticks);
  const ecs = runEcs(count, ticks);
  console.log(`OOP (array of structs): ${oop.toFixed(1)} ms`);
  console.log(`ECS (structure of arrays): ${ecs.toFixed(1)} ms`);
  console.log(`hızlanma: ${(oop / ecs).toFixed(2)}x`);
}
```

50.000 entity, 200 tick ile bende çıkan mertebe şuydu (rakamlar makineye ve V8 sürümüne göre oynar; repodaki `npm run bench` sizin sayılarınızı basar — Node 22 / V8'de üç koşunun ortalaması):

| Yaklaşım | Bellek düzeni | Süre (ölçülen) |
|---|---|---|
| OOP `Particle[]` | array of structs | ~47 ms |
| Elle yazılan ECS | structure of arrays | ~20 ms |

Yani SoA burada yaklaşık **2.4x** hızlı. Sizin makinenizde oran farklı çıkabilir; önemli olan yön: bitişik diziler, dağınık nesnelerden hızlı gezilir.

Burada dürüst bir dipnot şart. Bu farkın büyüklüğü sabit değil: modern V8 basit sınıfları çok iyi optimize eder ve bazı senaryolarda arayı 2 kata kadar kapatır. ECS'i haklı çıkaran şey her zaman ham hız değil zaten — asıl kazanç, sahne büyüdükçe farkın *açılması* ve mimarinin dağılmadan ölçeklenmesi. Onun için ECS'i "%300 hızlı" diye değil, "binlerce entity'de öngörülebilir kalan mimari" diye satarım. İşin dürüst hali bu.

Bir uyarı da bitmask'ten: `1 << nextBit` bize en fazla 32 component verir, çünkü JavaScript bit işlemleri 32-bit'tir. 33. component'i tanımladığınız anda maske taşar ve sessizce yanlış çalışır — bunu bir kez yaşadım, iki saatimi yedi. Gerçek kütüphaneler bu yüzden tek sayı yerine bit dizileri kullanır. Bizim demolarımıza 32 fazlasıyla yetiyor, ama bilmek borç.

### bitECS'i Devreye Almak

Elle yazdığımız çekirdek çalışıyor, kavramları da avucumuzun içinde. Şimdi olgun bir kütüphaneye geçelim. Fizik yazısında Matter.js'e nasıl döndüysek, burada da `bitECS`'e dönüyoruz — ama motoru kendimiz yazdığımız için API artık yabancı dil değil, tanıdık bir aksan.

```bash
npm i bitecs@^0.3.40
```

`bitECS`, bizim yaptığımızın ta kendisini yapar: sayısal entity id, SoA typed-array store'ları, bitmask query'leri. Sadece hepsi bizimkinden daha hızlı ve savaş görmüş. Bakın kod ne kadar tanıdık (`bitecs tutorial`):

```ts
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

// Bizim defineVec2()'nin bitECS karşılığı
export const Position = defineComponent({ x: Types.f32, y: Types.f32 });
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32 });

// Bizim query(world, [Position, Velocity])'nin karşılığı — ama önceden derlenir
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
```

Farkı yakaladınız mı? `movementSystem`'in *gövdesi birebir aynı*. `Position.x[e] += Velocity.x[e] * dt` satırı hiç değişmedi — çünkü bizim `Position.x` da bir typed array'di, bitECS'in `Position.x`'i de. Değişen tek şey çeperdeki boilerplate: `defineVec2` yerine `defineComponent({ x: Types.f32, y: Types.f32 })`, elle yazdığımız `query` yerine `defineQuery([...])`, `createEntity` yerine `addEntity`.

Entity kurulumu da neredeyse aynı:

```ts
// bitECS kullanım şeması (ayrı bir dosya değil) — projede karşılığı
// src/ecs-bitecs.ts + test/ecs-bitecs.test.ts.
import { createWorld, defineComponent, defineQuery, addEntity, addComponent, Types } from "bitecs";

const world = createWorld();

const e = addEntity(world); // bizim createEntity'miz
addComponent(world, Position, e); // aynı imza!
addComponent(world, Velocity, e);
Position.x[e] = 100;
Position.y[e] = 50;
Velocity.x[e] = 10;
Velocity.y[e] = -5;
```

Elle yazdığımız world'den bitECS'e geçiş, gövde kodunda topu topu ~30 satırlık bir fark: component tanımları, world kurulumu, query tanımı. Sistemler — oyununuzun *asıl mantığı* — el değmeden taşınır. Bunu tesadüf sanmayın; kendi ECS'imizi bitECS'in zihin modeliyle aynı hizada yazdığımız için böyle. Kara kutu değil, cam kutu.

Peki neden kendimizinki yerine bitECS? İki somut sebep. Birincisi, bizim `query()` her çağrıda yeni bir `Entity[]` **allocate eder** — sıcak döngüde her karede çöp üretir, ki bu bir sonraki yazının (object pooling) tam konusu. bitECS'in `defineQuery`'si sonucu önceden ayrılmış bir buffer'da tutar, sıfır çöp. İkincisi, bitECS `enterQuery`/`exitQuery` ile "bu kareye hangi entity'ler girdi/çıktı" gibi olayları, serileştirmeyi, prefab'ları bedavaya verir. Bunları yeniden yazmak öğrenmek için harika, üretim için israf.

### Canvas Render Döngüsüne Bağlamak

ECS soyut bir veri yapısı olarak durmasın; onu bir `requestAnimationFrame` döngüsüne takıp ekranda hareket ettirelim. Buradaki asıl fikir — `canvas game architecture`'ın kalbi — sahneyi **art arda dizili sistemlere bölmek**. Her kare, bant boyunca istasyonları sırayla çalıştırmaktan ibaret.

Önce oyun mantığı olmayan iki system daha ekleyelim. Duvar sekmesi:

```ts
// systems.ts (devam)
export function boundsSystem(
  world: World,
  width: number,
  height: number,
): void {
  const ents = query(world, [Position, Velocity]);
  for (const e of ents) {
    if (Position.x[e] < 0 || Position.x[e] > width)
      Velocity.x[e] = -Velocity.x[e];
    if (Position.y[e] < 0 || Position.y[e] > height)
      Velocity.y[e] = -Velocity.y[e];
  }
}
```

Ve çizim system'i. Dikkat: bu system canvas'a bağlıdır; *render* katmanıdır — bilinçli olarak diğerlerinden ayrı tutuyoruz, çünkü render'sız kısımları test etmek istiyoruz (bir sonraki bölüm tam bunun için):

```ts
// render.ts — canvas'a bağlı; asla saf mantıkla karışmaz
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
```

Şimdi montaj hattını çalıştıran ana döngü. Fizik yazısındaki `dt` disiplininin aynısı — hız "saniyede" tanımlı, `dt` ile çarpılır, ve sekme dönüşünden sonra `dt` bir üst sınıra kırpılır ki sekme değişiminde entity duvarın içinden ışınlanmasın:

```ts
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
```

Sıralamanın önemine dikkat: önce yerçekimi hızı değiştirir, sonra hareket o hızı konuma taşır, sonra sınır kontrolü düzeltir, en son render eder. Sistemleri bant üzerindeki istasyonlar gibi düşünün — birinin çıktısı diğerinin girdisi. Yeni bir davranış mı lazım? Banda yeni istasyon koyarsınız; hiçbir eski system'e dokunmadan. Fizik motorundaki tek dev `step()` metodunu hatırlayın; orada her şey iç içeydi. Burada her adım ayrı, adı konmuş, yeri belli bir fonksiyon.

### System'leri İzole Test Etmek

ECS'in en sevdiğim yanı burada ortaya çıkıyor. Sistemler saf fonksiyonlar — `(world, dt) => void`. İçlerinde canvas yok, `requestAnimationFrame` yok, DOM yok. Tam da `unit testing game logic` için ideal: bir world kur, birkaç tick ilerlet, dizideki sayıya bak.

`movementSystem`'i test edelim. Bir entity oluştur, konumunu ve hızını sabitle, üç tick ilerlet, konumun tam beklenen değerde olduğunu doğrula:

```ts
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
```

`dt`, hız ve tick sayısını bilerek f32'de tam temsil edilebilen değerler seçtim (0.5, 10, -5) — böylece `toBe` kayan nokta hatası vermeden geçer. Deterministik test için bu küçük özen büyük dert açar kapatır.

Şimdi query'nin *doğru* entity'leri döndürdüğünü test edelim. Sadece `Position`'ı olan bir entity, `[Position, Velocity]` sorgusuna düşmemeli — çünkü montaj hattının hareket istasyonu ona dokunmamalı:

```ts
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
```

Aynı iki testi bitECS sürümü için de yazıyoruz — API farklı ama beklenti aynı. Kütüphaneye geçince de query'nin bileşen setini doğru filtrelediğini kanıtlamak, geçişin sağlamasıdır:

```ts
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
```

Render yok, `requestAnimationFrame` yok, tarayıcı yok. Saf mantık, saf sayı, saf sağlama. Oyun mantığını render'dan ayırmanın bedelini bir kez ödersiniz — sonrası bedava güven.

### Özetle:

1. **Usta değil, montaj hattı.** OOP'ta veri ve davranış nesnede sarılıdır (`Body.update()`); ECS'te ayrılır — veri component'lerde, davranış system'lerde.
2. Entity sadece bir **sayıdır**. Component, o sayıya index'lenen typed-array store'larıdır. `new Body(...)` yok.
3. Bir entity'nin hangi component'lere sahip olduğunu **bitmask** tutar; component takıp sökmek tek bir bit işlemidir.
4. **Query**, istenen bitlere sahip entity'leri süzer; **system**, o entity'leri gezip iş yapan saf fonksiyondur.
5. **SoA (structure of arrays)**, sıcak döngüde cache locality kazandırır — ECS'in ham hız avantajının kaynağı budur, ama asıl kazanç ölçeklenirken dağılmayan mimaridir.
6. Kendi ECS'ini bitECS'in zihin modeliyle yazarsan geçiş ~30 satırdır ve **sistemlerin hiç değişmez** — sadece çeperdeki boilerplate değişir.
7. Sistemler saf `(world, dt) => void` fonksiyonları olduğundan render'sız, deterministik olarak Vitest ile test edilir.
8. Kütüphaneyi hype ile değil profille seç: bitECS'i sıfır-allocation query, enter/exit olayları ve serileştirme için alırsın — yeniden yazmak öğrenmek için iyi, üretim için israf.

Kodun tamamı — elle yazılan çekirdek, bitECS sürümü, canvas demosu, benchmark ve testler — GitHub'da; README'deki `npm run dev` / `npm test` / `npm run bench` ile dakikada ayağa kalkıyor.

Bu yazıyı yazarken kafama takılan şey şu oldu: ECS aslında bir "oyun tekniği" değil, bir *bakış açısı* değişimi. Yıllarca nesneye "sen kimsin ve ne yaparsın?" diye sorduk. ECS ise nesneyi dağıtıp "bu veri nerede, kim ona dokunuyor?" diye soruyor. Montaj hattı, ustadan daha soğuk bir yer — orada aşk yok, akış var. Ama on binlerce arabayı da öyle üretiyoruz.

Fizik motorumuzdaki `Body[]` hâlâ orada duruyor, hiçbir şey yanlış değildi. Sadece artık banttan kaç arabanın geçtiğine bakıp, ne zaman usta ne zaman montaj hattı seçeceğinizi biliyorsunuz. ⚙️🧠

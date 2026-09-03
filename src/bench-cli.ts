// bench-cli.ts — `npm run bench` giriş noktası
import { compare } from "./benchmark";

const count = Number(process.argv[2] ?? 50_000);
const ticks = Number(process.argv[3] ?? 200);

console.log(`benchmark: ${count} entity x ${ticks} tick`);
compare(count, ticks);

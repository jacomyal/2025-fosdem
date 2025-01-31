import { initRouter } from "./core/routing.ts";

async function main() {
  // Mount router:
  initRouter();
}

main().catch(console.error);

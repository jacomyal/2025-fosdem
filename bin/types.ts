import { CONFIG } from "./config.ts";

export type Dataset = keyof (typeof CONFIG)["datasets"];

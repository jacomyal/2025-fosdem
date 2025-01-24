import { existsSync } from "fs";
import { mkdir } from "fs/promises";
import path from "path";

import { CONFIG } from "./config.ts";
import { type Dataset } from "./types.ts";
import { downloadFile, getDatasetLocalPath } from "./utils.ts";

export async function fetchDatasets() {
  console.log(`Fetch all datasets`);

  const datasetsFolder = path.resolve(CONFIG.datasetsFolder);
  if (!existsSync(datasetsFolder)) await mkdir(datasetsFolder);

  const datasets = CONFIG.datasets as Record<string, string>;
  for (const datasetName in datasets) {
    const localPath = getDatasetLocalPath(datasetName as Dataset);
    if (!existsSync(localPath)) {
      const url = datasets[datasetName];
      console.log(`  - Download file ${url.split("/").pop()}`);
      await downloadFile(url, localPath);
    } else {
      console.log(`  - File ${datasetName} already exists`);
    }
  }
}

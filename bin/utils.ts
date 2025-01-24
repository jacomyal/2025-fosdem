import { parse } from "fast-csv";
import fs from "fs";
import { stat } from "fs/promises";
import http from "http";
import https from "https";
import { type Driver, auth, driver } from "neo4j-driver";
import path from "path";

import { CONFIG } from "./config.ts";
import { type Dataset } from "./types.ts";

export function getDatasetLocalPath(datasetName: Dataset): string {
  return path.join(path.resolve(CONFIG.datasetsFolder), `${datasetName}.csv`);
}

export async function downloadFile(url: string, localPath: string) {
  const file = fs.createWriteStream(localPath);
  const isHTTPS = url.startsWith("https");
  const client = isHTTPS ? https : http;

  return new Promise<void>((resolve, reject) => {
    client.get(url, (response) => {
      response.pipe(file);

      file.on("finish", () => {
        file.close();
        resolve();
      });
      file.on("error", reject);
    });
  });
}

let _neo4jDriver: Driver;
export async function getNeo4JDriver(): Promise<Driver> {
  if (_neo4jDriver) return _neo4jDriver;
  _neo4jDriver = driver(CONFIG.neo4j.uri, auth.basic(CONFIG.neo4j.user, CONFIG.neo4j.password));
  return _neo4jDriver;
}

export async function indexCsvAsNodes({
  csvPath,
  neo4jBatchQuery,
  transform,
  log,
  batchSize = 1000,
}: {
  csvPath: string;
  neo4jBatchQuery: string;
  transform?: (row: Record<string, unknown>) => Record<string, unknown>;
  log?: boolean;
  batchSize?: number;
}) {
  const driver = await getNeo4JDriver();
  const session = driver.session();

  let batch: unknown[] = [];

  const { size } = await stat(csvPath);
  await new Promise<void>((resolve, reject) => {
    let parsedSize = 0;
    const rawStream = fs.createReadStream(csvPath);
    rawStream.on("data", (buffer) => {
      parsedSize += buffer.length;
    });
    const csvStream = rawStream
      .pipe(parse({ headers: true }))
      .on("data", async (row: Record<string, unknown>) => {
        batch.push(transform ? transform(row) : row);

        if (batch.length === batchSize) {
          csvStream.pause();
          await session.run(neo4jBatchQuery, { batch: batch });
          batch = [];
          csvStream.resume();
          if (log) console.log(`  Progress: ${((parsedSize / size) * 100).toFixed(1)}%`);
        }
      })
      .on("end", async () => {
        if (batch.length > 0) {
          await session.run(neo4jBatchQuery, { batch: batch });
        }
        resolve();
      })
      .on("error", reject);
  });

  await session.close();
}

export async function runQuery(query: string) {
  const driver = await getNeo4JDriver();
  const session = driver.session();
  await session.run(query);
  await session.close();
}

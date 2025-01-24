import { extractEntities } from "./extract-entities.ts";
import { extractTrades } from "./extract-trades.ts";
import { fetchDatasets } from "./fetch-datasets.ts";
import { runQuery } from "./utils.ts";

async function main() {
  await runQuery("MATCH (n) DETACH DELETE n");
  await fetchDatasets();
  await extractEntities();
  await extractTrades();
  console.log("All good!");
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

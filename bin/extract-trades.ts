import { getDatasetLocalPath, indexCsvAsNodes } from "./utils.ts";

export async function extractTrades() {
  console.log("Index all trades (ric_trades.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("ric_trades"),
    transform: (row: Record<string, unknown>) => {
      const { flow, rate, reporting, unit, year, partner, expimp } = row as Record<
        "flow" | "rate" | "unit" | "year" | "reporting" | "partner" | "expimp",
        string
      >;
      const total = (+flow * +unit) / +rate;
      const source = expimp === "Exp" ? reporting : partner;
      const target = expimp === "Exp" ? partner : reporting;
      return { total, year: +year, source, target, key: expimp } as Record<string, unknown>;
    },
    neo4jBatchQuery: `
UNWIND $batch AS row
MATCH (source:Entity { name: row.source })
MATCH (target:Entity { name: row.target })
MERGE (source)-[e:TRADES { year: row.year }]->(target)
SET e.value = row.total
WITH e, row.key as key, row.total as total
CALL apoc.create.setRelProperty(e, key, total)
YIELD rel
RETURN count(*)
`,
    log: true,
  });
}

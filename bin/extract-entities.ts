import { getDatasetLocalPath, indexCsvAsNodes } from "./utils.ts";

export async function extractEntities() {
  console.log("Index all entities from GeoPolHist (gph_entities.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("gph_entities"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (n:Entity { name: row.GPH_name })
MERGE (t:Continent { name: row.continent })
MERGE (n)-[:IS_IN_CONTINENT]->(t)
SET n.gphID = row.GPH_code
`,
  });

  console.log("Index all entities from RICardo (ric_entities.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("ric_entities"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (n:Entity { name: row.RICname })
MERGE (t1:Continent { name: row.continent })
MERGE (n)-[:IS_IN_CONTINENT]->(t1)
FOREACH (
  _ IN CASE 
      WHEN row.parent_entity IS NOT NULL AND row.parent_entity <> '' 
      THEN [1] 
      ELSE [] 
    END |
  MERGE (t2:Entity { name: row.parent_entity })
  MERGE (n)-[:IS_CHILD_OF]->(t2)
)
SET n.ricType = row.RICType
`,
  });

  console.log("Link GPH entities to RIC areas (gph_geoAreas.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("gph_geoAreas"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (gph:Entity { name: row.GPH_name })
MERGE (ric:Entity { name: row.RICname })
FOREACH (
  _ IN CASE 
      WHEN row.RICname IS NOT NULL AND row.RICname <> '' 
      THEN [1] 
      ELSE [] 
    END |
  MERGE (gph)-[:IS_PART_OF]->(ric)
)
`,
  });

  console.log("Link RIC entities to colonial RIC areas (ric_colonialToGeoAreas.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("ric_colonialToGeoAreas"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (entity:Entity { name: row.RICname })
MERGE (area:Entity { name: row.geographical_area })
FOREACH (
  _ IN CASE 
      WHEN row.continental IS NOT NULL AND row.continental <> 'yes' 
      THEN [1] 
      ELSE [] 
    END |
  MERGE (entity)-[:IS_COLONIAL_PART_OF]->(area)
)
`,
  });
}

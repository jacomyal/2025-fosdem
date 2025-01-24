import { getDatasetLocalPath, indexCsvAsNodes } from "./utils.ts";

export async function extractEntities() {
  console.log("Index all GPH entities (gph_entities.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("gph_entities"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (n:GPHEntity { id: row.GPH_code })
MERGE (t:Continent { id: row.continent })
MERGE (n)-[:IS_IN_CONTINENT]->(t)
SET n.name = row.GPH_name
`,
  });

  console.log("Index all RIC entities (ric_entities.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("ric_entities"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (n:RICEntity { id: row.RICname })
MERGE (t0:Continent { id: row.continent })
MERGE (n)-[:IS_IN_CONTINENT]->(t0)
FOREACH (
  _ IN CASE 
      WHEN row.GPH_code IS NOT NULL AND row.GPH_code <> '' 
      THEN [1] 
      ELSE [] 
    END |
  MERGE (t1:GPHEntity { id: row.GPH_code })
  MERGE (n)-[:IS_EQUIVALENT_TO]->(t1)
)
FOREACH (
  _ IN CASE 
      WHEN row.parent_entity IS NOT NULL AND row.parent_entity <> '' 
      THEN [1] 
      ELSE [] 
    END |
  MERGE (t2:RICEntity { id: row.parent_entity })
  MERGE (n)-[:IS_CHILD_OF]->(t2)
)
SET n.name = row.RICname, n.ricType = row.RICType
`,
  });

  console.log("Link GPH entities to RIC areas (gph_geoAreas.csv)");
  await indexCsvAsNodes({
    csvPath: getDatasetLocalPath("gph_geoAreas"),
    neo4jBatchQuery: `
UNWIND $batch AS row
MERGE (gph:GPHEntity { id: row.GPH_code })
MERGE (ric:RICEntity { id: row.RICname })
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
MERGE (entity:RICEntity { id: row.RICname })
MERGE (area:RICEntity { id: row.geographical_area })
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

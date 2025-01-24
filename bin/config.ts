export const CONFIG = {
  datasetsFolder: "data/datasets",
  datasets: {
    ric_trades: "https://ricardo.medialab.sciences-po.fr/data/RICardo_trade_flows_deduplicated.csv",
    // Entities related datasets:
    gph_entities:
      "https://raw.githubusercontent.com/medialab/GeoPolHist/refs/heads/master/data/GeoPolHist_entities.csv",
    ric_entities: "https://raw.githubusercontent.com/medialab/ricardo_data/refs/heads/master/data/RICentities.csv",
    ric_colonialToGeoAreas:
      "https://raw.githubusercontent.com/paulgirard/ricardo_gph_analysis/refs/heads/main/scripts/RICardo_colonial_to_geographical_area.csv",
    gph_geoAreas:
      "https://raw.githubusercontent.com/paulgirard/ricardo_gph_analysis/refs/heads/main/scripts/GPH_geographical_area.csv",
  },
  neo4j: {
    uri: "neo4j://localhost:7687",
    user: "neo4j",
    password: "neo4j",
  },
} as const;

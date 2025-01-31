import { MultiGraph } from "graphology";
import { Driver, auth, driver } from "neo4j-driver";

import { CONFIG } from "../config.ts";
import { DataEdge, DataGraph, EdgeType, Filter, NodeType } from "./types.ts";

interface Neo4JNode<T extends NodeType = NodeType> {
  elementId: string;
  labels: [T];
  properties: {
    name: string;
    id: string;
  };
}

interface Neo4JEdge<T extends EdgeType = EdgeType> {
  type: T;
  elementId: string;
  startNodeElementId: string;
  endNodeElementId: string;
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  properties: T extends "TRADES" ? { year: number; value: number } : {};
}

// language=cypher
const neo4jBatchQuery = /*cypher*/ `
MATCH (c { id: $centerNode })
/* Subquery #1: get neighbors of c, plus edges from c -> neighbors */
CALL {
  WITH c
  MATCH (c)-[r1]-(n)
  WHERE
    /* If edgeTypes is provided, only keep those relationship types */
    (
      $edgeTypes IS NULL OR size($edgeTypes) = 0
      OR type(r1) IN $edgeTypes
    )
    /* If nodeTypes is provided, only keep neighbors with a label in nodeTypes */
    AND (
      $nodeTypes IS NULL OR size($nodeTypes) = 0
      OR any(lbl in labels(n) WHERE lbl IN $nodeTypes)
    )
    /* TRADE edges must be within year range */
    AND (
      type(r1) <> 'TRADES' OR (
        r1.year >= $minYear AND r1.year <= $maxYear
      )
    )
  RETURN collect(DISTINCT n) AS neighbors,
         collect(DISTINCT r1) AS edgesToNeighbors
}

/* Subquery #2: find edges among these neighbors */
CALL {
  WITH neighbors
  /* We do a 'self-join' of neighbors to find all edges among them */
  UNWIND neighbors AS a
  UNWIND neighbors AS b
  /* Avoid a==b or duplicating same pair in reversed order */
  WITH a,b WHERE id(a) < id(b)
  MATCH (a)-[r2]-(b)
  WHERE
    (
      $edgeTypes IS NULL OR size($edgeTypes) = 0
      OR type(r2) IN $edgeTypes
    )
    AND (
      type(r2) <> 'TRADES' OR (
        r2.year >= $minYear AND r2.year <= $maxYear
      )
    )
  RETURN collect(DISTINCT r2) AS edgesAmongNeighbors
}

RETURN c, neighbors, edgesToNeighbors, edgesAmongNeighbors
`;

export class DBClient {
  private driver: Driver;

  constructor() {
    this.driver = driver(CONFIG.neo4j.uri, auth.basic(CONFIG.neo4j.user, CONFIG.neo4j.password));
  }

  async getEgoNetwork(centerNode: string, { nodeTypes, edgeTypes, minYear, maxYear }: Filter = {}): Promise<DataGraph> {
    const session = this.driver.session();

    // Run the multi-part query
    const result = await session.run(neo4jBatchQuery, {
      centerNode,
      nodeTypes: nodeTypes ? Array.from(nodeTypes) : [],
      edgeTypes: edgeTypes ? Array.from(edgeTypes) : [],
      minYear: minYear ?? Number.MIN_SAFE_INTEGER, // or some default
      maxYear: maxYear ?? Number.MAX_SAFE_INTEGER, // or some default
    });

    await session.close();

    // We expect exactly one record if centerNode exists
    if (result.records.length === 0) {
      return new MultiGraph() as DataGraph;
    }

    // Extract data from the first (and presumably only) record
    const record = result.records[0];
    const center = record.get("c") as Neo4JNode;
    const neighbors = (record.get("neighbors") || []) as Neo4JNode[];
    const edgesToNeighbors = (record.get("edgesToNeighbors") || []) as Neo4JEdge[];
    const edgesAmongNeighbors = (record.get("edgesAmongNeighbors") || []) as Neo4JEdge[];

    // Build a Graphology graph
    const graph = new MultiGraph() as DataGraph;

    neighbors.concat(center).forEach((node) =>
      graph.addNode(node.elementId, {
        dataType: node.labels[0],
        label: node.properties.name,
        id: node.properties.id,
      }),
    );

    edgesToNeighbors.concat(edgesAmongNeighbors).forEach((edge) =>
      graph.updateEdgeWithKey(
        `(${edge.startNodeElementId})-[${edge.type}]->(${edge.endNodeElementId})`,
        edge.startNodeElementId,
        edge.endNodeElementId,
        (properties) => {
          if (edge.type === "TRADES") {
            const props = properties as Partial<Extract<DataEdge, { dataType: "TRADES" }>>;
            return {
              dataType: "TRADES",
              years: (props.years || []).concat((edge as Neo4JEdge<"TRADES">).properties.year),
              value: (props.value || 0) + (edge as Neo4JEdge<"TRADES">).properties.value,
            };
          }

          return { dataType: edge.type };
        },
      ),
    );

    return graph;
  }
}

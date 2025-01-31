import { MultiGraph } from "graphology";
import { Driver, auth, driver } from "neo4j-driver";

import { CONFIG } from "../config.ts";
import { DataEdge, DataGraph, EDGE_TYPES_SET, EdgeType, Filter, NODE_TYPES_SET, NodeType } from "./types.ts";

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

export class DBClient {
  private driver: Driver;

  constructor() {
    this.driver = driver(CONFIG.neo4j.uri, auth.basic(CONFIG.neo4j.user, CONFIG.neo4j.password));
  }

  private neo4jDataToGraph(nodes: Neo4JNode[], edges: Neo4JEdge[]): DataGraph {
    const graph = new MultiGraph() as DataGraph;
    const parsedNodes = new Set<string>();
    const parsedEdges = new Set<string>();

    nodes.forEach((node) => {
      if (parsedNodes.has(node.elementId)) return;
      parsedNodes.add(node.elementId);
      graph.addNode(node.elementId, {
        dataType: node.labels[0],
        label: node.properties.name,
        id: node.properties.id,
      });
    });

    edges.forEach((edge) => {
      if (parsedEdges.has(edge.elementId)) return;
      parsedEdges.add(edge.elementId);
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
      );
    });

    return graph;
  }

  async getEgoNetwork(
    centerNode: string,
    { nodeTypes, edgeTypes, minYear, maxYear, minTradeValue }: Filter = {},
  ): Promise<DataGraph> {
    const session = this.driver.session();

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
        r1.year >= $minYear AND r1.year <= $maxYear AND r1.value >= $minTradeValue
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
        r2.year >= $minYear AND r2.year <= $maxYear AND r2.value >= $minTradeValue
      )
    )
  RETURN collect(DISTINCT r2) AS edgesAmongNeighbors
}

RETURN c, neighbors, edgesToNeighbors, edgesAmongNeighbors
`;

    // Run the multi-part query
    const result = await session.run(neo4jBatchQuery, {
      centerNode,
      nodeTypes: nodeTypes ? nodeTypes.filter((t) => NODE_TYPES_SET.has(t)) : [],
      edgeTypes: edgeTypes ? edgeTypes.filter((t) => EDGE_TYPES_SET.has(t)) : [],
      minYear: minYear ?? Number.MIN_SAFE_INTEGER,
      maxYear: maxYear ?? Number.MAX_SAFE_INTEGER,
      minTradeValue: minTradeValue ?? 0,
    });

    await session.close();

    // We expect exactly one record if centerNode exists
    if (result.records.length === 0) {
      return new MultiGraph() as DataGraph;
    }

    const rec = result.records[0];
    return this.neo4jDataToGraph(
      ((rec.get("neighbors") || []) as Neo4JNode[]).concat(rec.get("c") as Neo4JNode),
      ((rec.get("edgesToNeighbors") || []) as Neo4JEdge[]).concat(
        (rec.get("edgesAmongNeighbors") || []) as Neo4JEdge[],
      ),
    );
  }

  async getRelationsGraph(
    reporter1: string,
    reporter2: string,
    { nodeTypes, edgeTypes, minYear, maxYear, minTradeValue }: Filter = {},
  ): Promise<DataGraph> {
    const session = this.driver.session();

    // language=cypher
    const neo4jBatchQuery = /*cypher*/ `
MATCH (reporter1: GPHEntity { name: $reporter1 }), (reporter2: GPHEntity { name: $reporter2 })
CALL {
  WITH reporter1, reporter2
  MATCH (reporter1)-[r1]-(ric1: RICEntity)-[r2: TRADES]-(ric2: RICEntity)-[r3]-(reporter2)
    WHERE
    /* Edges constraints */    
    (type(r1) <> 'TRADES')
    AND (
      r2.year >= $minYear AND r2.year <= $maxYear AND r2.value >= $minTradeValue
    )
    AND (type(r3) <> 'TRADES')
  RETURN collect(DISTINCT ric1) AS ric1,
         collect(DISTINCT ric2) AS ric2,
         collect(DISTINCT r1) AS edges1,
         collect(DISTINCT r2) AS edges2,
         collect(DISTINCT r3) AS edges3
}

RETURN reporter1, reporter2, ric1, ric2, edges1, edges2, edges3
    `;

    // Run the multi-part query
    const result = await session.run(neo4jBatchQuery, {
      reporter1,
      reporter2,
      nodeTypes: nodeTypes ? nodeTypes.filter((t) => NODE_TYPES_SET.has(t)) : [],
      edgeTypes: edgeTypes ? edgeTypes.filter((t) => EDGE_TYPES_SET.has(t)) : [],
      minYear: minYear ?? Number.MIN_SAFE_INTEGER,
      maxYear: maxYear ?? Number.MAX_SAFE_INTEGER,
      minTradeValue: minTradeValue ?? 0,
    });

    await session.close();

    // We expect exactly one record if centerNode exists
    if (result.records.length === 0) {
      return new MultiGraph() as DataGraph;
    }

    const rec = result.records[0];
    return this.neo4jDataToGraph(
      ((rec.get("ric1") || []) as Neo4JNode[])
        .concat((rec.get("ric2") || []) as Neo4JNode[])
        .concat([rec.get("reporter1") as Neo4JNode, rec.get("reporter2") as Neo4JNode]),
      ((rec.get("edges1") || []) as Neo4JEdge[])
        .concat((rec.get("edges2") || []) as Neo4JEdge[])
        .concat((rec.get("edges3") || []) as Neo4JEdge[]),
    );
  }
}

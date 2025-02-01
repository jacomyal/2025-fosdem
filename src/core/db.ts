import { MultiGraph } from "graphology";
import { Driver, auth, driver } from "neo4j-driver";

import { CONFIG } from "../config.ts";
import { DataEdge, DataGraph, EDGE_TYPES_SET, EdgeType, Filter, NodeType } from "./types.ts";

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

interface Neo4JPath {
  segments: {
    start: Neo4JNode;
    relationship: Neo4JEdge;
    end: Neo4JNode;
  }[];
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
    { edgeTypes, minYear, maxYear, minTradeValue }: Filter = {},
  ): Promise<DataGraph> {
    const session = this.driver.session();

    // language=cypher
    const neo4jBatchQuery = /*cypher*/ `
MATCH (c { name: $centerNode })
CALL {
  WITH c
  MATCH (c)-[r1]-(n)
  WHERE
    (
      $edgeTypes IS NULL OR size($edgeTypes) = 0
      OR type(r1) IN $edgeTypes
    )
    AND (
      type(r1) <> 'TRADES' OR (
        r1.year >= $minYear AND r1.year <= $maxYear AND r1.value >= $minTradeValue
      )
    )
  RETURN collect(DISTINCT n) AS neighbors,
         collect(DISTINCT r1) AS edgesToNeighbors
}
CALL {
  WITH neighbors
  UNWIND neighbors AS a
  UNWIND neighbors AS b
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

    const result = await session.run(neo4jBatchQuery, {
      centerNode,
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
    { edgeTypes, minYear, maxYear, minTradeValue, getDirectTrades }: Filter & { getDirectTrades?: boolean } = {},
  ): Promise<DataGraph> {
    const session = this.driver.session();

    // language=cypher
    const neo4jBatchQuery = /*cypher*/ `
MATCH (e1:Entity {name: $name1}), (e2:Entity {name: $name2})
WITH e1, e2,
     $minTradeValue    AS minTradeValue,
     $minYear          AS minYear,
     $maxYear          AS maxYear,
     $allowedNonTrades AS allowedNonTrades,
     $getDirectTrades  AS getDirectTrades
CALL {
  WITH e1, e2, minTradeValue, minYear, maxYear, allowedNonTrades, getDirectTrades
  MATCH p = (e1)-[r:TRADES]-(e2)
  WHERE getDirectTrades
    AND r.value >= minTradeValue
    AND r.year  >= minYear
    AND r.year  <= maxYear
  RETURN p

  UNION

  WITH e1, e2, minTradeValue, minYear, maxYear, allowedNonTrades
  MATCH p = (e1)-[r1]-(m)-[r2]-(e2)
  WHERE
    (
      type(r1) = 'TRADES'
      AND r1.value >= minTradeValue
      AND r1.year  >= minYear
      AND r1.year  <= maxYear
      AND type(r2) <> 'TRADES'
      AND (
        allowedNonTrades IS NULL
        OR size(allowedNonTrades) = 0
        OR type(r2) IN allowedNonTrades
      )
    )
    OR
    (
      type(r2) = 'TRADES'
      AND r2.value >= minTradeValue
      AND r2.year  >= minYear
      AND r2.year  <= maxYear
      AND type(r1) <> 'TRADES'
      AND (
        allowedNonTrades IS NULL
        OR size(allowedNonTrades) = 0
        OR type(r1) IN allowedNonTrades
      )
    )
  RETURN p

  UNION

  WITH e1, e2, minTradeValue, minYear, maxYear, allowedNonTrades
  MATCH p = (e1)-[r1]-(n1)-[r2:TRADES]-(n2)-[r3]-(e2)
  WHERE
    r2.value >= minTradeValue
    AND r2.year  >= minYear
    AND r2.year  <= maxYear
    AND type(r1) <> 'TRADES'
    AND (
      allowedNonTrades IS NULL
      OR size(allowedNonTrades) = 0
      OR type(r1) IN allowedNonTrades
    )
    AND type(r3) <> 'TRADES'
    AND (
      allowedNonTrades IS NULL
      OR size(allowedNonTrades) = 0
      OR type(r3) IN allowedNonTrades
    )
  RETURN p
}
RETURN e1, e2, collect(p) AS paths;
    `;

    const result = await session.run(neo4jBatchQuery, {
      name1: reporter1,
      name2: reporter2,
      allowedNonTrades: edgeTypes ? edgeTypes.filter((t) => EDGE_TYPES_SET.has(t)) : [],
      minYear: minYear ?? Number.MIN_SAFE_INTEGER,
      maxYear: maxYear ?? Number.MAX_SAFE_INTEGER,
      minTradeValue: minTradeValue ?? 0,
      getDirectTrades,
    });

    await session.close();

    // We expect exactly one record if centerNode exists
    if (result.records.length === 0) {
      return new MultiGraph() as DataGraph;
    }

    const rec = result.records[0];
    const e1: Neo4JNode = rec.get("e1");
    const e2: Neo4JNode = rec.get("e2");
    const paths: Neo4JPath[] = rec.get("paths");

    const nodes: Record<string, Neo4JNode> = {
      [e1.elementId]: e1,
      [e2.elementId]: e2,
    };
    const edges: Record<string, Neo4JEdge> = {};

    paths.forEach((path) => {
      path.segments.forEach(({ start, end, relationship }) => {
        nodes[start.elementId] = start;
        nodes[end.elementId] = end;
        edges[relationship.elementId] = relationship;
      });
    });

    return this.neo4jDataToGraph(Object.values(nodes), Object.values(edges));
  }
}

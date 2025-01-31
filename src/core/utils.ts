import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";
import { MultiGraph } from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";

import { DataGraph, EDGE_TYPES, NODE_TYPES, SigmaGraph } from "./types.ts";

export function getCurvature(index: number, maxIndex: number): number {
  if (maxIndex <= 0) throw new Error("Invalid maxIndex");
  if (index < 0) return -getCurvature(-index, maxIndex);
  const amplitude = 3.5;
  const maxCurvature = amplitude * (1 - Math.exp(-maxIndex / amplitude)) * DEFAULT_EDGE_CURVATURE;
  return (maxCurvature * index) / maxIndex;
}

export function makeParallelEdgesCurved(sigmaGraph: SigmaGraph): void {
  indexParallelEdgesIndex(sigmaGraph, {
    edgeIndexAttribute: "parallelIndex",
    edgeMinIndexAttribute: "parallelMinIndex",
    edgeMaxIndexAttribute: "parallelMaxIndex",
  });
  sigmaGraph.forEachEdge((edge, { parallelIndex, parallelMinIndex, parallelMaxIndex }) => {
    if (typeof parallelMinIndex === "number") {
      sigmaGraph.mergeEdgeAttributes(edge, {
        type: parallelIndex ? "curved" : "straight",
        curvature: getCurvature(parallelIndex as number, parallelMaxIndex as number),
      });
    } else if (typeof parallelIndex === "number") {
      sigmaGraph.mergeEdgeAttributes(edge, {
        type: "curved",
        curvature: getCurvature(parallelIndex, parallelMaxIndex as number),
      });
    } else {
      sigmaGraph.setEdgeAttribute(edge, "type", "straight");
    }
  });
}

export function prepareGraph(
  graph: DataGraph,
  { largerNodes, fixedNodes }: { largerNodes?: string[]; fixedNodes?: string[] } = {},
): SigmaGraph {
  const sigmaGraph = new MultiGraph() as SigmaGraph;
  const largerNodesSet = new Set(largerNodes || []);
  const fixedNodesSet = new Set(fixedNodes || []);
  const fixedNodeIDs: string[] = [];

  graph.forEachNode((id, attributes) => {
    let larger = false;
    if (fixedNodesSet.has(attributes.label) && attributes.dataType === "GPHEntity") {
      fixedNodeIDs.push(id);
      larger = true;
    } else if (!fixedNodes?.length && largerNodesSet.has(attributes.id)) {
      larger = true;
    }
    sigmaGraph.addNode(id, {
      ...attributes,
      size: larger ? 40 : 20,
      color: NODE_TYPES[attributes.dataType].color,
      x: 0,
      y: 0,
    });
  });

  let tradeMax = -Infinity;
  graph.forEachEdge((_, attributes) => {
    if (attributes.dataType === "TRADES") {
      tradeMax = Math.max(tradeMax, attributes.value);
    }
  });

  graph.forEachEdge((id, attributes, source, target) =>
    sigmaGraph.addEdgeWithKey(id, source, target, {
      ...attributes,
      type: "straight",
      size: attributes.dataType === "TRADES" ? (attributes.value / tradeMax) * 40 : 1,
      color: EDGE_TYPES[attributes.dataType].color,
      zIndex: EDGE_TYPES[attributes.dataType].zIndex,
      label:
        attributes.dataType === "TRADES"
          ? attributes.value.toLocaleString("en-US", { style: "currency", currency: "USD" })
          : EDGE_TYPES[attributes.dataType].label,
    }),
  );

  makeParallelEdgesCurved(sigmaGraph);

  const CIRCULAR_RADIUS = 20;
  const FIXED_CIRCULAR_RADIUS = 50;
  circular.assign(sigmaGraph, { scale: CIRCULAR_RADIUS });
  if (fixedNodeIDs.length) {
    fixedNodeIDs.forEach((node, i) => {
      const angle = (i / fixedNodeIDs.length) * 2 * Math.PI;
      const x = FIXED_CIRCULAR_RADIUS * Math.cos(angle);
      const y = FIXED_CIRCULAR_RADIUS * Math.sin(angle);
      sigmaGraph.mergeNodeAttributes(node, { x, y, fixed: true });
    });
  }
  forceAtlas2.assign(sigmaGraph, {
    settings: { ...forceAtlas2.inferSettings(graph), strongGravityMode: true },
    iterations: 200,
  });

  return sigmaGraph;
}

import { DEFAULT_EDGE_CURVATURE, indexParallelEdgesIndex } from "@sigma/edge-curve";
import { MultiGraph } from "graphology";

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

export function prepareGraph(graph: DataGraph, { center }: { center?: string } = {}): SigmaGraph {
  const sigmaGraph = new MultiGraph() as SigmaGraph;

  graph.forEachNode((id, attributes) =>
    sigmaGraph.addNode(id, {
      ...attributes,
      size: attributes.id === center ? 40 : 20,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: NODE_TYPES[attributes.dataType].color,
    }),
  );

  let tradeMin = Infinity;
  let tradeMax = -Infinity;
  graph.forEachEdge((_, attributes) => {
    if (attributes.dataType === "TRADES") {
      tradeMin = Math.min(tradeMin, attributes.value);
      tradeMax = Math.max(tradeMax, attributes.value);
    }
  });

  graph.forEachEdge((id, attributes, source, target) =>
    sigmaGraph.addEdgeWithKey(id, source, target, {
      ...attributes,
      type: "straight",
      size: attributes.dataType === "TRADES" ? ((5 * (attributes.value - tradeMin)) / (tradeMax - tradeMin)) * 15 : 3,
      color: EDGE_TYPES[attributes.dataType].color,
      zIndex: EDGE_TYPES[attributes.dataType].zIndex,
      label:
        attributes.dataType === "TRADES"
          ? attributes.value.toLocaleString("en-US", { style: "currency", currency: "USD" })
          : EDGE_TYPES[attributes.dataType].label,
    }),
  );

  makeParallelEdgesCurved(sigmaGraph);

  return sigmaGraph;
}

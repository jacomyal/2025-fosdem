import { MultiGraph } from "graphology";
import { EdgeDisplayData, NodeDisplayData, PartialButFor } from "sigma/types";

export const NODE_TYPES = {
  Entity: {
    label: "Entity",
    color: "#5B0EED",
  },
  Continent: {
    label: "Continent",
    color: "#EDA4ED",
  },
} as const;
export const NODE_TYPES_SET = new Set<string>(Object.keys(NODE_TYPES));
export type NodeType = keyof typeof NODE_TYPES;

export const EDGE_TYPES = {
  TRADES: {
    label: "exports",
    color: "#749AF2",
    zIndex: 1,
  },
  IS_IN_CONTINENT: {
    label: "is in",
    color: "#74C2F2",
    zIndex: 0,
  },
  IS_EQUIVALENT_TO: {
    label: "is equivalent to",
    color: "#74EAF2",
    zIndex: 0,
  },
  IS_CHILD_OF: {
    label: "is child of",
    color: "#74F2A6",
    zIndex: 0,
  },
  IS_COLONIAL_PART_OF: {
    label: "is colonial part of",
    color: "#74F2D0",
    zIndex: 0,
  },
  IS_PART_OF: {
    label: "is part of",
    color: "#CBF1F4",
    zIndex: 0,
  },
} as const;
export const EDGE_TYPES_SET = new Set<string>(Object.keys(EDGE_TYPES));
export type EdgeType = keyof typeof EDGE_TYPES;

export interface Filter {
  minYear?: number;
  maxYear?: number;
  minTradeValue?: number;
  edgeTypes?: string[];
}

export type DataNode = { dataType: NodeType; label: string; id: string };
export type DataEdge =
  | { dataType: "TRADES"; years: number[]; value: number }
  | { dataType: Exclude<EdgeType, "TRADES"> };
export type DataGraph = MultiGraph<DataNode, DataEdge>;

export type SigmaNode = DataNode & PartialButFor<NodeDisplayData, "x" | "y" | "size" | "color">;
export type SigmaEdge = DataEdge &
  PartialButFor<EdgeDisplayData, "size" | "color" | "type"> & {
    parallelIndex?: number;
    parallelMinIndex?: number;
    parallelMaxIndex?: number;
    rawLabel?: string;
  };
export type SigmaGraph = MultiGraph<SigmaNode, SigmaEdge>;

export type BaseProps = Record<string, string | string[]>;

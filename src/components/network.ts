import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { MultiGraph } from "graphology";
import Sigma from "sigma";
import { EdgeArrowProgram, EdgeProgramType } from "sigma/rendering";

import { DBClient } from "../core/db.ts";
import { openView } from "../core/routing.ts";
import {
  DataGraph,
  EDGE_TYPES,
  EdgeType,
  NODE_TYPES,
  NodeType,
  SigmaEdge,
  SigmaGraph,
  SigmaNode,
} from "../core/types.ts";
import { prepareGraph } from "../core/utils.ts";
import { HTMLView } from "./html-view.ts";

type Props = {
  minYear?: string;
  maxYear?: string;
  edgeTypes?: string | string[];
  minTradeValue?: string;
} & ({ mode: "ego"; center: string } | { mode: "relations"; reporter1: string; reporter2: string });

export class Network extends HTMLView<Props> {
  private db: DBClient = new DBClient();
  private sigma: Sigma<SigmaNode, SigmaEdge>;

  constructor(props: Props) {
    super(props);

    const { edgeTypes } = this.props;
    const filteredEdgeTypes = (
      Array.isArray(edgeTypes) && edgeTypes.length
        ? edgeTypes
        : typeof edgeTypes === "string"
          ? [edgeTypes]
          : Object.keys(EDGE_TYPES)
    ) as EdgeType[];

    this.innerHTML = `
      <style>
        .network-component {
          position: relative;
          width: 100%;
          height: 100%;
        }
        .sigma-root,
        .loader {
          position: absolute;
          inset: 0;
        }
        .loader.hidden {
          display: none;
        }
        .loader {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .caption {
          background: white;
          position: absolute;
          max-width: 200px;
          bottom: 10px;
          right: 10px;
        }
        .controls {
          display: flex;
          flex-direction: row;
          justify-content: space-around;
          margin-bottom: 0.5em;
        }
        .controls button {
          height: 2em;
          line-height: 2em;
        }
      </style>
      <section class="network-component">
        <div class="sigma-root"></div>
        <div class="loader hidden"><span>Loading...</span></div>
        <fieldset class="caption">
          <legend><strong>How to read the graph</strong></legend>
          
          <div>Nodes</div>
          ${Object.keys(NODE_TYPES)
            .map(
              (nodeType) => `
          <div>
            <small>
              <span class="circle" style="background:${NODE_TYPES[nodeType as NodeType].color};"></span> ${NODE_TYPES[nodeType as NodeType].label}
            </small>
          </div>
          `,
            )
            .join("")}
          
          <br>
          <div>Edges</div>
          ${filteredEdgeTypes
            .map(
              (edgeType) => `
          <div>
            <small>
              <span class="slash" style="background:${EDGE_TYPES[edgeType].color};"></span> ${EDGE_TYPES[edgeType].label}
            </small>
          </div>
          `,
            )
            .join("")}
          
          <br>
          <div class="controls">
            <button id="zoom-out">🔍-</button>
            <button id="zoom-reset">🞊</button>
            <button id="zoom-in">🔍+</button>
            <button id="back-to-home">🏠</button>
          </div>
        </fieldset>
      </section>
    `;

    this.sigma = new Sigma<SigmaNode, SigmaEdge>(new MultiGraph() as SigmaGraph, this.getSigmaRoot(), {
      // renderEdgeLabels: true,
      zIndex: true,
      defaultEdgeType: "straight",
      allowInvalidContainer: true,
      labelFont: "monospace",
      edgeProgramClasses: {
        straight: EdgeArrowProgram,
        curved: EdgeCurvedArrowProgram,
      } as unknown as Record<string, EdgeProgramType<SigmaNode, SigmaEdge>>,
    });
  }

  init() {
    this.reloadGraph();

    this.querySelector("button#back-to-home")?.addEventListener("click", () => {
      openView("/", {});
    });
    this.querySelector("button#zoom-in")?.addEventListener("click", () => {
      this.sigma.getCamera().animatedZoom();
    });
    this.querySelector("button#zoom-out")?.addEventListener("click", () => {
      this.sigma.getCamera().animatedUnzoom();
    });
    this.querySelector("button#zoom-reset")?.addEventListener("click", () => {
      this.sigma.getCamera().animatedReset();
    });
  }

  /**
   * Internal helpers:
   * *****************
   */
  private getSigmaRoot() {
    return this.querySelector(".sigma-root") as HTMLDivElement;
  }
  private getLoader() {
    return this.querySelector(".loader") as HTMLDivElement;
  }
  private toggleLoading(isLoading?: boolean) {
    if (isLoading === undefined) this.getLoader().classList.toggle("hidden");
    else if (isLoading) this.getLoader().classList.remove("hidden");
    else this.getLoader().classList.add("hidden");
  }

  /**
   * DB lifecycle
   * ************
   */
  private async reloadGraph() {
    const { mode, minYear: rawMinYear, maxYear: rawMaxYear, minTradeValue: rawMinTradeValue, edgeTypes } = this.props;
    const minYear = rawMinYear ? parseInt(rawMinYear) : undefined;
    const maxYear = rawMaxYear ? parseInt(rawMaxYear) : undefined;
    const minTradeValue = rawMinTradeValue ? parseInt(rawMinTradeValue) : undefined;

    let dataGraph: DataGraph;
    let largerNodes: string[] = [];
    let fixedNodes: string[] = [];
    this.toggleLoading(true);
    switch (mode) {
      case "ego": {
        const center = this.props.center;
        largerNodes = [center];
        dataGraph = await this.db.getEgoNetwork(center, {
          minYear,
          maxYear,
          minTradeValue,
          edgeTypes: Array.isArray(edgeTypes) ? edgeTypes : edgeTypes ? [edgeTypes] : [],
        });
        break;
      }
      case "relations": {
        const { reporter1, reporter2 } = this.props;
        largerNodes = [reporter1, reporter2];
        fixedNodes = [reporter1, reporter2];
        dataGraph = await this.db.getRelationsGraph(reporter1, reporter2, {
          minYear,
          maxYear,
          minTradeValue,
          edgeTypes: Array.isArray(edgeTypes) ? edgeTypes : edgeTypes ? [edgeTypes] : [],
        });
        break;
      }
    }
    const graph = prepareGraph(dataGraph, { largerNodes, fixedNodes });
    this.sigma.setGraph(graph);
    this.sigma.refresh();

    this.toggleLoading(false);
  }
}

customElements.define("ricardo-network", Network);

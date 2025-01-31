import { EdgeCurvedArrowProgram } from "@sigma/edge-curve";
import { MultiGraph } from "graphology";
import { circular } from "graphology-layout";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import { EdgeArrowProgram, EdgeProgramType } from "sigma/rendering";

import { DBClient } from "../core/db.ts";
import { SigmaEdge, SigmaGraph, SigmaNode } from "../core/types.ts";
import { prepareGraph } from "../core/utils.ts";
import { HTMLView } from "./html-view.ts";

type Props = {
  center: string;
  minYear?: string;
  maxYear?: string;
  nodeTypes?: string | string[];
  edgeTypes?: string | string[];
  minTradeValue?: string;
};

export class EgoNetwork extends HTMLView<Props> {
  private db: DBClient = new DBClient();
  private sigma: Sigma<SigmaNode, SigmaEdge>;

  constructor(props: Props) {
    super(props);

    this.innerHTML = `
      <style>
        .ego-network-component {
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
      </style>
      <section class="ego-network-component">
        <div class="sigma-root"></div>
        <div class="loader hidden"><span>Loading...</span></div>
      </section>
    `;

    this.sigma = new Sigma<SigmaNode, SigmaEdge>(new MultiGraph() as SigmaGraph, this.getSigmaRoot(), {
      // renderEdgeLabels: true,
      zIndex: true,
      defaultEdgeType: "straight",
      allowInvalidContainer: true,
      edgeProgramClasses: {
        straight: EdgeArrowProgram,
        curved: EdgeCurvedArrowProgram,
      } as unknown as Record<string, EdgeProgramType<SigmaNode, SigmaEdge>>,
    });
  }

  init() {
    this.reloadGraph();
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
    const {
      center,
      minYear: rawMinYear,
      maxYear: rawMaxYear,
      minTradeValue: rawMinTradeValue,
      nodeTypes,
      edgeTypes,
    } = this.props;
    const minYear = rawMinYear ? parseInt(rawMinYear) : undefined;
    const maxYear = rawMaxYear ? parseInt(rawMaxYear) : undefined;
    const minTradeValue = rawMinTradeValue ? parseInt(rawMinTradeValue) : undefined;
    if (!center) return;

    this.toggleLoading(true);
    const dataGraph = await this.db.getEgoNetwork(center, {
      minYear,
      maxYear,
      minTradeValue,
      nodeTypes: Array.isArray(nodeTypes) ? nodeTypes : nodeTypes ? [nodeTypes] : [],
      edgeTypes: Array.isArray(edgeTypes) ? edgeTypes : edgeTypes ? [edgeTypes] : [],
    });
    const graph = prepareGraph(dataGraph, { center });
    circular.assign(graph, { scale: 100 });
    forceAtlas2.assign(graph, {
      settings: forceAtlas2.inferSettings(graph),
      iterations: 200,
    });
    this.sigma.setGraph(graph);
    this.sigma.refresh();

    this.toggleLoading(false);
  }
}

customElements.define("ego-network", EgoNetwork);

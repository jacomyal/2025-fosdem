import { map } from "lodash-es";

import { openView } from "../core/routing.ts";
import { EDGE_TYPES, NODE_TYPES } from "../core/types.ts";
import { HTMLView } from "./html-view.ts";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type Props = {};

export class RICardoHome extends HTMLView<Props> {
  constructor(props: Props) {
    super(props);

    this.innerHTML = `
      <style>
        .ricardo-home {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        
        .inline > * {
          display: inline-block;
        }
        form > section:not(:last-child) {
          margin-bottom: 0.5em;
        }
        p {
          max-width: 600px;
        }
        fieldset {
          width: 100%;
        }
      </style>
      <main class="ricardo-home">
        <div>
          <fieldset>
            <legend><strong>FOSDEM 2025 - Data Analytics devroom</strong></legend>
            <p>
              This application is a small demo to showcase how to use <a href="https://sigmajs.org/">sigma</a> to
              explore graph databases.
            </p>
            <p>
              This demo explores the <a href="https://ricardo.medialab.sciences-po.fr/#!/">RICardo</a> dataset, a
              project dedicated to trade between nations over a period spanning the beginning of the Industrial
              Revolution to the eve of the Second World War.
            </p>
          </fieldset>
          
          <br>
        
          <fieldset>
            <legend><strong>Explore trades</strong></legend>
            
            <form class="ego">
              <section>
                <label for="center">Look for some location</label>
                <input type="text" id="center" name="center" value="Zanzibar">
              </section>
              
              <section class="inline">
                Only consider trades between
                <input type="number" name="minYear" step="1" min="1833" max="1938" value="1860">
                and
                <input type="number" name="maxYear" step="1" min="1833" max="1938" value="1865">
              </section>
              
              <section>
                <label>Node types</label>
                ${map(
                  NODE_TYPES,
                  ({ label }, type) => `
                <div>
                  <input type="checkbox" id="nodeType-${type}" value="${type}" name="nodeTypes" checked />
                  <label for="nodeType-${type}">${label}</label>
                </div>
                `,
                ).join("")}
              </section>
              
              <section>
                <label>Edge types</label>
                ${map(
                  EDGE_TYPES,
                  ({ label }, type) => `
                <div>
                  <input type="checkbox" id="edgeType-${type}" value="${type}" name="edgeTypes" checked />
                  <label for="edgeType-${type}">${label}</label>
                </div>
                `,
                ).join("")}
              </section>
              
              <section>
                <label for="minTradeValue">Only keep annual trades over ... (in $)</label>
                <input type="number" id="minTradeValue" name="minTradeValue" value="0">
              </section>
              
              <section class="text-end">          
                <button type="submit">Open ego-network</button>
              </section>
            </form>
          </fieldset>
            
          <br>
        
          <fieldset>
            <legend><strong>Explore entities relationships</strong></legend>
            
            <p>This section open a blank canvas, where you can double-click on an entity to load its neighbors.</p>
            
            <section class="text-end">          
              <button type="button">Start exploring entities network</button>
            </section>
          </fieldset>
        </div>
      </main>
    `;
  }

  init() {
    const egoForm = this.querySelector("form.ego") as HTMLFormElement;
    egoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(egoForm);
      openView("/ego-network", {
        center: formData.get("center") as string,
        minYear: formData.get("minYear") as string,
        maxYear: formData.get("maxYear") as string,
        nodeTypes: formData.getAll("nodeTypes") as string[],
        edgeTypes: formData.getAll("edgeTypes") as string[],
        minTradeValue: formData.get("minTradeValue") as string,
      });
    });
  }
}

customElements.define("ricardo-home", RICardoHome);

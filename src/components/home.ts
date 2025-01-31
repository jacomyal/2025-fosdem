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
  section:not(:last-child) {
    margin-bottom: 0.5em;
  }
  p {
    max-width: 600px;
  }
  .graph-build-mode {
    display: flex;
    flex-direction: row;
    align-items: stretch;
  }
</style>
<main class="ricardo-home">
  <div>
    <form class="ego">
      <fieldset>
        <legend><strong>FOSDEM 2025 - Data Analytics devroom</strong></legend>
        <p>
          This application is a small demo to showcase how to use
          <a href="https://sigmajs.org/">sigma</a> to explore graph databases.
        </p>
        <p>
          This demo explores the datasets from
          <a href="https://ricardo.medialab.sciences-po.fr/#!/">RICardo</a>,
          a project dedicated to trade between nations over a period spanning
          the beginning of the Industrial Revolution to the eve of the Second
          World War.
        </p>
      </fieldset>

      <br />

      <fieldset>
        <legend>
          <strong>How the network should be built</strong>
        </legend>

        <div class="graph-build-mode">
          <fieldset>
            <section>
              <input type="radio" id="mode-ego" name="mode" value="ego" checked />
              <label for="mode-ego"><strong>Explore reported partners of a RIC entity</strong></label>
            </section>
            <section>
              <label for="center">Center RIC entity</label>
              <input type="text" id="center" name="center" value="Belgium" />
            </section>
          </fieldset>

          <fieldset>
            <section>
              <input type="radio" id="mode-relations" name="mode" value="relations" />
              <label for="mode-relations"><strong>Explore trades between two GPH entity</strong></label>
            </section>
            <section>
              <label for="reporter1">First RIC entity</label>
              <input type="text" id="reporter1" name="reporter1" value="France" disabled />
            </section>
            <section>
              <label for="reporter2">Second RIC entity</label>
              <input type="text" id="reporter2" name="reporter2" value="Algeria (Regency of Algiers)" disabled />
            </section>
          </fieldset>
        </div>
      </fieldset>

      <br>

      <fieldset>
        <legend>
          <strong>How to filter relations and entities</strong>
        </legend>

        <section class="inline">
          Only consider trades between
          <input
            type="number"
            name="minYear"
            step="1"
            min="1833"
            max="1938"
            value="1850"
          />
          and
          <input
            type="number"
            name="maxYear"
            step="1"
            min="1833"
            max="1938"
            value="1900"
          />
        </section>

        <section>
          <label>Node types</label>
          ${map(
            NODE_TYPES,
            ({ label }, type) => `
          <div>
            <input
              type="checkbox"
              id="nodeType-${type}"
              value="${type}"
              name="nodeTypes"
              checked
            />
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
            <input
              type="checkbox"
              id="edgeType-${type}"
              value="${type}"
              name="edgeTypes"
              checked
            />
            <label for="edgeType-${type}">${label}</label>
          </div>
          `,
          ).join("")}
        </section>

        <section>
          <label for="minTradeValue">Only keep annual trades over ... (in $)</label
          >
          <input
            type="number"
            id="minTradeValue"
            name="minTradeValue"
            value="500000"
          />
        </section>
      </fieldset>
      
      <br>
      
      <section class="text-end">
        <button type="submit">Generate network</button>
      </section>
    </form>
  </div>
</main>
    
`;
  }

  init() {
    // Handle form submit:
    const egoForm = this.querySelector("form.ego") as HTMLFormElement;
    egoForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const formData = new FormData(egoForm);
      openView("/network", {
        mode: formData.get("mode") as string,
        center: formData.get("center") as string,
        reporter1: formData.get("reporter1") as string,
        reporter2: formData.get("reporter2") as string,
        minYear: formData.get("minYear") as string,
        maxYear: formData.get("maxYear") as string,
        nodeTypes: formData.getAll("nodeTypes") as string[],
        edgeTypes: formData.getAll("edgeTypes") as string[],
        minTradeValue: formData.get("minTradeValue") as string,
      });
    });

    // Handle some minor inputs interactions:
    const refreshDisabledInputs = () => {
      this.querySelectorAll('input[type="radio"]').forEach((input) => {
        const checked = (input as HTMLInputElement).checked;
        input.parentNode?.parentNode?.querySelectorAll('input:not([type="radio"])').forEach((i) => {
          (i as HTMLInputElement).disabled = !checked;
        });
      });
    };
    this.querySelectorAll('input[type="radio"]').forEach((input) => {
      input.addEventListener("change", refreshDisabledInputs);
    });
  }
}

customElements.define("ricardo-home", RICardoHome);

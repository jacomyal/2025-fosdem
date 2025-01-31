import { map } from "lodash-es";

import { EgoNetwork } from "../components/ego-network.ts";
import { RICardoHome } from "../components/home.ts";
import { HTMLViewType } from "../components/html-view.ts";
import { BaseProps } from "./types.ts";

const VIEWS = {
  "/": RICardoHome,
  "/ego-network": EgoNetwork,
} as const;

const ROUTES = Object.keys(VIEWS);
const ROUTES_SET = new Set<string>(ROUTES);
const DEFAULT_ROUTE = "/";
type Route = keyof typeof VIEWS;

function readURLSearchParams(params: URLSearchParams): BaseProps {
  const res: BaseProps = {};
  params.forEach((value, key) => {
    if (Array.isArray(res[key])) res[key].push(value);
    else if (res[key]) res[key] = [res[key], value];
    else res[key] = value;
  });
  return res;
}

function writeURLSearchParams(props: BaseProps): string {
  return map(props, (value, key) =>
    Array.isArray(value)
      ? value.map((v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`).join("&")
      : `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
  ).join("&");
}

function readLocation() {
  // Read URL:
  const fragment = location.hash.replace(/^#/, "");
  const [path, query] = fragment.split("?");
  const route: Route = ROUTES_SET.has(path) ? (path as Route) : DEFAULT_ROUTE;
  const props = readURLSearchParams(new URLSearchParams(query));

  const View: HTMLViewType = VIEWS[route];
  const view = new View(props);

  // Mount view:
  const root = document.getElementById("root") as HTMLDivElement;
  root.innerHTML = "";
  root.appendChild(view);

  setTimeout(() => {
    view.init();
  }, 0);
}

export function initRouter() {
  addEventListener("hashchange", readLocation);
  readLocation();
}

export function openView(route: Route, props: BaseProps) {
  location.href = `#${route}?${writeURLSearchParams(props)}`;
}

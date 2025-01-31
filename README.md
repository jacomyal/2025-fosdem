# FOSDEM 2025 - Sigma.js demo

This repository contains a TypeScript web application to demo [sigma.js](https://sigmajs.org) on exploring the [RICardo](https://ricardo.medialab.sciences-po.fr/) datasets. This demo has been developed to illustrate my presentation at [FOSDEM 2025](https://fosdem.org/2025/) [Data Analytics Devroom](https://fosdem.org/2025/schedule/track/analytics/), [_Developing Custom UIs to Explore Graph Databases Using Sigma.js_](https://fosdem.org/2025/schedule/event/fosdem-2025-5614-developing-custom-uis-to-explore-graph-databases-using-sigma-js/).

The web application is very light, and simply provides two different views on the dataset. It's built with Vite and TypeScript, and using web components.

There is no public instance, since I don't want to maintain some Neo4J server. But you can run this project locally. For this, you need:

- A clean and recent [Node](https://nodejs.org/en) + [NPM](https://npmjs.com/) environment
- A clean [Docker](https://hub.docker.com/_/neo4j) installation, or some [Neo4J](https://neo4j.com/) instance

## Build the Neo4J database

The Neo4J graph can be generated from open CSV files, directly available from different RICardo repositories.

1. Spawn a Neo4J Docker container: `npm run docker:start`
2. Download the CSV files and feed the Neo4J graph: `npm run data:prepare`

If you directly use a Neo4J instance instead, you first need to update `./bin/config.ts` to help the scripts connect to the database.

## Run this application locally

1. Open the project: `cd path/to/fosdem-2025-sigmajs-ricardo`
2. Install dependencies: `npm install`
3. Run the development version: `npm run dev`

Then, you can access the website at [localhost:5173](http://localhost:5173/).

## Build the application for production

1. Open the project: `cd path/to/fosdem-2025-sigmajs-ricardo`
2. Install dependencies: `npm install`
3. Build the production version: `npm run build`

Then, the whole website is built under the `dist` folder.

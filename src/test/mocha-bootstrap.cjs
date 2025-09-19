// Ensures ts-node is registered early with proper project before mocha scans tests
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || "tsconfig.unit-test.json"
require("ts-node/register/transpile-only")
require("tsconfig-paths/register")
require("source-map-support/register")
require("./requires.cjs")

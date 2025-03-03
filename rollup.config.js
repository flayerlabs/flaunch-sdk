import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import { terser } from "rollup-plugin-terser";
import pkg from "./package.json";

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

export default [
  // ESM build
  {
    input: "src/index.ts",
    output: {
      file: pkg.module,
      format: "esm",
      sourcemap: true,
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
      resolve(),
      commonjs(),
      json(),
    ],
    external,
  },
  // CommonJS build
  {
    input: "src/index.ts",
    output: {
      file: pkg.main,
      format: "cjs",
      sourcemap: true,
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
      resolve(),
      commonjs(),
      json(),
    ],
    external,
  },
  // UMD build (minified)
  {
    input: "src/index.ts",
    output: {
      name: pkg.name.replace(/-/g, "").replace(/\//g, "_"),
      file: pkg.unpkg,
      format: "umd",
      sourcemap: true,
      globals: {
        "@delvtech/drift": "drift",
        viem: "viem",
        "@uniswap/v3-sdk": "v3Sdk",
      },
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
      resolve(),
      commonjs(),
      json(),
      terser(),
    ],
    external,
  },
];

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

// Custom onwarn function to ignore circular dependency warnings from viem
const onwarn = (warning, warn) => {
  // Ignore circular dependency warnings from viem
  if (
    warning.code === "CIRCULAR_DEPENDENCY" &&
    warning.message.includes("viem")
  ) {
    return;
  }
  // Use default warning for everything else
  warn(warning);
};

export default [
  // ESM build
  {
    input: "src/index.ts",
    output: {
      file: pkg.module,
      format: "esm",
      sourcemap: true,
      exports: "named",
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
      resolve(),
      commonjs(),
      json(),
    ],
    external,
    onwarn,
  },
  // CommonJS build
  {
    input: "src/index.ts",
    output: {
      file: pkg.main,
      format: "cjs",
      sourcemap: true,
      exports: "named",
    },
    plugins: [
      typescript({ tsconfig: "./tsconfig.json" }),
      resolve(),
      commonjs(),
      json(),
    ],
    external,
    onwarn,
  },
  // UMD build (minified)
  {
    input: "src/index.ts",
    output: {
      name: pkg.name.replace(/-/g, "").replace(/\//g, "_"),
      file: pkg.unpkg,
      format: "umd",
      sourcemap: true,
      exports: "named",
      globals: {
        "@delvtech/drift": "drift",
        viem: "viem",
        "@uniswap/v3-sdk": "v3Sdk",
        axios: "axios",
        react: "React",
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
    onwarn,
  },
];

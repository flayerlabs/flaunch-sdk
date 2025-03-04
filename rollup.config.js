import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
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

const createConfig = (input, output, format, plugins = []) => ({
  input,
  output: {
    ...output,
    sourcemap: true,
    exports: "named",
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      outDir: output.dir || "./dist",
      declaration: false,
    }),
    resolve(),
    commonjs(),
    json(),
    ...plugins,
  ],
  external,
  onwarn,
});

// Main entry point configs
const mainConfigs = [
  // ESM
  createConfig("src/index.ts", {
    file: pkg.module,
    format: "esm",
  }),
  // CJS
  createConfig("src/index.ts", {
    file: pkg.main,
    format: "cjs",
  }),
  // UMD (minified)
  createConfig(
    "src/index.ts",
    {
      name: pkg.name.replace(/-/g, "").replace(/\//g, "_"),
      file: pkg.unpkg,
      format: "umd",
      globals: {
        "@delvtech/drift": "drift",
        viem: "viem",
        "@uniswap/v3-sdk": "v3Sdk",
        axios: "axios",
        react: "React",
      },
    },
    "umd",
    [terser()]
  ),
];

// Create configs for directory-based subpaths
const directorySubpaths = ["abi", "helpers", "hooks"].map((subpath) => ({
  name: subpath,
  input: `src/${subpath}/index.ts`,
}));

// Create configs for file-based subpaths
const fileSubpaths = [{ name: "addresses", input: "src/addresses.ts" }];

// Create all subpath configs
const subpathConfigs = [...directorySubpaths, ...fileSubpaths].flatMap(
  ({ name, input }) => [
    // ESM for subpath
    createConfig(input, {
      dir: `dist/${name}`,
      format: "esm",
      entryFileNames: "index.js",
    }),
    // CJS for subpath
    createConfig(input, {
      dir: `dist/${name}`,
      format: "cjs",
      entryFileNames: "index.cjs",
    }),
  ]
);

export default [...mainConfigs, ...subpathConfigs];

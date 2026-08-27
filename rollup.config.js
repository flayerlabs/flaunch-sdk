import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import terser from "@rollup/plugin-terser";
import pkg from "./package.json";

const externalDependencies = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const isExternalDependency = (id) =>
  externalDependencies.some(
    (dependency) => id === dependency || id.startsWith(`${dependency}/`)
  );

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
    ...(output.file ? { inlineDynamicImports: true } : {}),
    sourcemap: true,
    exports: "named",
  },
  plugins: [
    typescript({
      tsconfig: "./tsconfig.json",
      outDir: output.dir || "./dist",
      declaration: false,
      declarationMap: false,
      inlineSources: true,
    }),
    resolve(),
    commonjs(),
    json(),
    ...plugins,
  ],
  // Keep deep imports external for module consumers. UMD keeps its historical
  // behavior of bundling deep imports because they do not have standalone globals.
  external: format === "umd" ? externalDependencies : isExternalDependency,
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
        "@delvtech/drift-viem": "driftViem",
        viem: "viem",
        axios: "axios",
        react: "React",
      },
    },
    "umd",
    [terser()]
  ),
];

// Create configs for directory-based subpaths
const directorySubpaths = ["abi", "helpers", "hooks", "utils"].map((subpath) => ({
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
      file: `dist/${name}/index.mjs`,
      format: "esm",
    }),
    // CJS for subpath
    createConfig(input, {
      file: `dist/${name}/index.cjs`,
      format: "cjs",
    }),
  ]
);

export default [...mainConfigs, ...subpathConfigs];

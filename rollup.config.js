import typescript from "@rollup/plugin-typescript";

// One ESM entry. viem stays external so consumers share one copy.
export default {
  input: "src/index.ts",
  output: { file: "dist/index.mjs", format: "esm", sourcemap: true },
  plugins: [typescript({ tsconfig: "./tsconfig.json", inlineSources: true })],
  external: (id) => id === "viem" || id.startsWith("viem/"),
};

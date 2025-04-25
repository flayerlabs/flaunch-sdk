const fs = require("fs");
const path = require("path");

function combineDocumentation() {
  // Read README
  const readmePath = path.join(__dirname, "..", "README.md");
  const readme = fs.readFileSync(readmePath, "utf8");

  // Read TypeDoc generated files
  const docsPath = path.join(__dirname, "..", "docs");
  let combinedDocs = [readme, "\n\n# API Documentation\n\n"];

  function readDocsRecursively(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        readDocsRecursively(fullPath);
      } else if (file.endsWith(".md") && file !== "README.md") {
        let content = fs.readFileSync(fullPath, "utf8");

        // Remove "Defined in" lines and GitHub URLs
        content = content.replace(/#### Defined in[\s\S]*?(?=\n\n|$)/g, "");

        // Remove file paths (e.g., "flaunch-sdk/src/helpers/hex.ts:7")
        content = content.replace(/flaunch-sdk\/src\/.*:\d+/g, "");

        // Remove empty markdown links
        content = content.replace(/\[\]\([^)]+\)\n?/g, "");

        // Remove markdown links while keeping the text
        content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

        // Remove GitHub specific URLs
        content = content.replace(/https:\/\/github\.com\/[^\s\n]+/g, "");

        // Remove "#### " prefixes from headings as they're not needed
        content = content.replace(/#### /g, "");

        // Remove empty lines after removals
        content = content.replace(/\n{3,}/g, "\n\n");

        // Remove lines that only contain dashes (horizontal rules)
        content = content.replace(/^-+$/gm, "");

        // Remove any remaining empty sections
        content = content.replace(/###\s*\w+\s*\n\n(?=###|$)/g, "");

        combinedDocs.push(content);
        combinedDocs.push("\n\n---\n\n");
      }
    }
  }

  // Generate TypeDoc documentation first
  require("child_process").execSync("npm run docs:generate", {
    stdio: "inherit",
  });

  // Combine all documentation
  readDocsRecursively(docsPath);

  // Write combined documentation
  const outputPath = path.join(__dirname, "..", "llms-full.txt");
  fs.writeFileSync(outputPath, combinedDocs.join(""));

  console.log("Generated llms-full.txt successfully!");
}

combineDocumentation();

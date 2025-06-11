# Publishing Process for @flaunch/sdk

This document outlines the process for versioning and publishing updates to the `@flaunch/sdk` package.

## Versioning Guidelines

We follow [Semantic Versioning](https://semver.org/) (SemVer) with the following guidelines:

- **MAJOR version (1.0.0 → 2.0.0)**: Incompatible API changes
- **MINOR version (0.1.0 → 0.2.0)**:
  - For versions < 1.0.0: Breaking changes (as pre-1.0 is considered development phase)
  - For versions ≥ 1.0.0: Backward-compatible new features
- **PATCH version (0.1.0 → 0.1.1)**: Backward-compatible bug fixes

## When to Update Versions

- **Breaking Changes**: If you remove or rename parameters, change function signatures, or make any other changes that would break existing code using the SDK, increment the appropriate version (MAJOR for ≥1.0.0, MINOR for <1.0.0).
- **New Features**: When adding new functionality without breaking existing code, increment the MINOR version.
- **Bug Fixes**: When fixing bugs without changing the API, increment the PATCH version.

## Publishing Process

### 1. Update the Version

Use the pnpm version command to update the version in package.json:

```bash
# For bug fixes
pnpm version patch

# For breaking changes in pre-1.0 or new features in post-1.0
pnpm version minor

# For breaking changes in post-1.0
pnpm version major
```

This command will:

- Update the version in package.json
- Create a git commit with the message "@flaunch/sdk v{version}"
- Create a git tag with the name "@flaunch/sdk@{version}"

### 2. Push Changes to GitHub

Push both the commit and the tag to GitHub:

```bash
git push && git push --tags
```

### 3. Build and Publish the Package

Build the package and publish it to npm:

```bash
pnpm publish
```

The `pnpm publish` command will automatically run the build script (via prepublishOnly) before publishing.

### 4.

Update the llm docs:

```bash
pnpm docs:llms
```

### 5.

Update CHANGELOG.md by running this prompt:

````
You are tasked with creating a detailed and accurate changelog entry for a new software version by analyzing git changes. Follow this systematic approach:

## Step 1: Gather Git Information
1. Get the commit history since the last version:
   ```
   git log --oneline --since="YYYY-MM-DD" --until="now"
   git log --since="YYYY-MM-DD" --until="now" --pretty=format:"%h - %s (%an, %ad)" --date=short
  ```

2. Get the actual code differences:
   ```
   git diff PREVIOUS_VERSION..CURRENT_VERSION
   ```

## Step 2: Analyze the Changes

**Important**: Don't rely solely on commit messages. Examine the actual code diffs to understand:

- **New files added** - What functionality do they provide?
- **Modified files** - What specific changes were made?
- **Function/method additions** - What new capabilities were added?
- **API changes** - What interfaces changed?
- **Configuration changes** - Address mappings, constants, etc.
- **Refactoring** - Code organization improvements
- **Bug fixes** - What issues were resolved?

## Step 3: Categorize Changes

Organize findings into these categories:

### Added

- New features, functions, methods, or capabilities
- New files, modules, or components
- New configuration options or addresses
- New utility functions or helpers

### Changed

- Modified existing functionality
- Updated dependencies or versions
- Refactored code (improved organization)
- Updated documentation or comments
- Address or configuration updates

### Fixed

- Bug fixes and error corrections
- Performance improvements
- Security patches
- Documentation corrections

### Deprecated (if applicable)

- Features marked for removal
- Methods or APIs being phased out

## Step 4: Write the Changelog Entry

Format: `## [VERSION] - YYYY-MM-DD`

**Guidelines:**

- Use **bold** for major feature categories
- Use `code blocks` for function/method names, file names, and technical terms
- Provide context - don't just list what changed, but explain what it enables
- Group related changes under logical headings
- Be specific but concise
- Include technical details developers would find useful
- Mention both the "what" and "why" when relevant

**Example Structure:**

```
## [X.Y.Z] - YYYY-MM-DD

### Added

- **Major Feature Name** description of what it enables
  - `specificMethod()` and `anotherMethod()` for doing X
  - New `FileName.ts` utility with functionality for Y
  - Support for Z with configurable options

### Changed

- **Improved functionality** description
  - Refactored duplicate logic into reusable utilities
  - Updated address mappings for network support

### Fixed

- **Issue description** - specific fix details
```

## Step 5: Verification

- Ensure every significant change in the diff is reflected
- Check that technical terms and method names are accurate
- Verify that the impact and benefits are clearly explained
- Confirm the changelog helps users understand what changed and why it matters

## Key Principles:

1. **Accuracy over speed** - Take time to understand the actual changes
2. **Developer-focused** - Write for people who will use or maintain the code
3. **Context matters** - Explain not just what changed, but what it enables
4. **Be specific** - Use exact function names, file names, and technical terms
5. **Logical grouping** - Group related changes together under clear headings

This approach ensures the changelog accurately reflects the actual code changes rather than just commit message summaries.

````

## Configuration

The versioning and commit message format is configured in the `.npmrc` file:

```

tag-version-prefix="@flaunch/sdk@"
message="@flaunch/sdk v%s"

```

This ensures consistent tagging and commit messages across all releases.

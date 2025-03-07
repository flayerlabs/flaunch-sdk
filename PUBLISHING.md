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
# For breaking changes in pre-1.0 or new features in post-1.0
pnpm version minor

# For breaking changes in post-1.0
pnpm version major

# For bug fixes
pnpm version patch
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

## Configuration

The versioning and commit message format is configured in the `.npmrc` file:

```
tag-version-prefix="@flaunch/sdk@"
message="@flaunch/sdk v%s"
```

This ensures consistent tagging and commit messages across all releases.

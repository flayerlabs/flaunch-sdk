---
name: manager-from-abi
description: Integrates new treasury manager contracts into this SDK from ABI plus minimal deployment context. Use when adding manager addresses, ABI exports, manager clients, FlaunchZap/FlaunchSDK helpers, and docs for a newly deployed manager contract.
---

# Manager From ABI

## Goal

Add support for a new manager contract using only:
- ABI JSON path
- Deployment addresses per chain
- Any behavior notes (permissions, mutable config, share semantics, claim modes)

Preserve existing manager flows. Add new APIs for net-new behavior instead of changing old semantics.

## Required Inputs

Collect these first:
1. ABI file path
2. Manager name (PascalCase and address constant name)
3. Chain addresses (Base, Base Sepolia, placeholders allowed)
4. Behavioral differences from existing managers
5. Whether manager needs a dedicated client (default: yes if it has manager-specific methods)

## Integration Workflow

1. Add addresses
- File: `src/addresses.ts`
- Add `XManagerAddress` as `Addresses` map.
- Use `zeroAddress` placeholder for unknown chain deployments.

2. Add ABI module
- File: `src/abi/XManager.ts`
- Source from provided ABI JSON.
- Export from `src/abi/index.ts`.

3. Add dedicated client (when manager has custom functionality)
- File: `src/clients/XManagerClient.ts`
- Add `ReadXManager` and `ReadWriteXManager`.
- Include:
  - Baseline treasury methods (`permissions`, `managerOwner`, ownership/permissions writes)
  - Manager-specific reads/writes from ABI
  - Overload-safe helper methods for overloaded functions (for example `claim()` and `claimForData(...)`)

4. Wire launch/deploy flows
- File: `src/clients/FlaunchZapClient.ts`
- Add new params and methods for manager-specific initialization/deployment:
  - Keep old manager helpers untouched.
  - Add separate methods if new manager semantics differ (do not retrofit old method behavior).
- Build init calldata with `encodeAbiParameters` matching ABI tuple shape exactly.
- Add lightweight input validation for dangerous mistakes (zero address, duplicates, impossible values).

5. Surface in SDK API
- File: `src/sdk/FlaunchSDK.ts`
- Add forwarding methods for new zap helpers.
- Export new client/types from `src/index.ts` if needed by consumers.

6. Documentation
- Update `README.md` with:
  - New manager usage example
  - Differences from existing managers
  - Post-deploy management example (if applicable)
- Update `CHANGELOG.md` under `[Unreleased]` using the changelog protocol below.

## Changelog Protocol (Required)

When writing changelog entries for manager integrations, follow this process:
Every code change in scope must be reflected in `CHANGELOG.md` (no omissions).

### Step 1: Gather Git Information

1. Get commit history for the release window:
   - `git log --oneline --since="YYYY-MM-DD" --until="now"`
   - `git log --since="YYYY-MM-DD" --until="now" --pretty=format:"%h - %s (%an, %ad)" --date=short`
2. Get actual code differences:
   - `git diff PREVIOUS_VERSION..CURRENT_VERSION`

### Step 2: Analyze Actual Diffs

Do not rely only on commit messages. Inspect diffs for:
- New files and what capability they add
- Modified files and concrete behavior changes
- New functions/methods and API surface additions
- Configuration/address mapping changes
- Refactors
- Bug fixes

### Step 3: Categorize Changes

Use the standard sections:
- `### Added`
- `### Changed`
- `### Fixed`
- `### Deprecated` (if applicable)

### Step 4: Write Entry Format

- Header format: `## [VERSION] - YYYY-MM-DD`
- Use bold labels for major feature groupings
- Use backticks for method names, files, and technical terms
- Explain both what changed and why it matters
- Group related points together and keep concise but specific

### Step 5: Verify Completeness

Before finalizing:
- Ensure all significant diff changes are represented
- Ensure every code change made in this task is covered in `CHANGELOG.md`
- Verify names and technical terms are accurate
- Confirm impact/benefit is clear for SDK users
- Confirm entry reflects code changes, not only commit summaries

## Compatibility Rules

- Do not break existing manager APIs.
- Do not silently change percent-based APIs into weight-based APIs.
- Keep static and dynamic managers in separate methods and types.
- Prefer explicit parameter names (`creatorShare`, `ownerShare`, `moderator`, `recipientShares`) over generic blobs.

## Validation Checklist

- `src/addresses.ts` has new address constant.
- ABI file exists and is exported from `src/abi/index.ts`.
- Client file exists with read + write classes.
- FlaunchZap and FlaunchSDK include new helper methods.
- Root exports include the new public surface.
- README + changelog updated.
- Changelog entry follows the required protocol in this skill.
- Every code change is reflected in changelog entries.
- Run:
  - `pnpm typecheck`
  - lint diagnostics for changed files
- Confirm no existing manager method changed behavior.

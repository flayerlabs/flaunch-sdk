# Publishing the combined SDK

The `0.17.0-preview.1` candidate (previously labelled `0.16.0-preview.5`) combines the vested/Game Mode branch (PR #43)
with the Arbitrum v1.4.1 release (PR #44), retaining spend-gate v2. Published
`0.16.0` contains Arbitrum support but does not contain the preview APIs.

## Release preparation

1. This integration lives on `release/0.17.0-vested-game-developer` (a superset of
   `master` at `0.16.0`); PR #43 is retargeted to it and reviewed against `master`. Preserve the Arbitrum deployments and the
   preview launch APIs. Do not publish the old PR #43 snapshot.
2. The version is `0.17.0` for the stable combined release, since
   `SpendReferralMessage` changes from `maxSpendWei` plus `nonce` to cumulative
   `spendCeilingWei`. Its encoder/decoder now use spend-gate v2; callers must
   migrate with their gate. `0.16.0` cannot be republished.
3. Update `package.json`, CHANGELOG, PR #43's title/release notes and generated
   documentation for that version. Record the v2 migration and the preview
   deployment limits (vesting/developer-split deployments remain Base Sepolia).
4. Using the repository's Node `.nvmrc` and pnpm version, run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm typecheck
   pnpm test
   pnpm test:package
   pnpm audit --audit-level=moderate
   pnpm docs:llms
   ```

5. Complete the Base Sepolia integration acceptance before stable publication:
   vested launches and vesting claims, paired/Any Game Mode launches with the
   pinned developer share, pre-buys and spend-gate v2 buys. The opt-in Anvil
   scripts `test:vested:fork`, `test:prebuy:fork` and `test:referrals:fork` document
   their localhost-only configuration. Verify Arbitrum deployment routing,
   native-ETH launch/split, protected buy/sell and token-denominated claims too.
   Unit tests and package consumer checks do not replace these integration checks.

## Publication

The current GitHub workflow validates the package; it does not publish it.
Choose an authorized npm maintainer with 2FA for an interactive publication,
or configure npm trusted publishing and an OIDC release workflow first.
Never put npm credentials in this repository.

After the final release commit is approved and merged, build and inspect the
package contents, then publish from that exact commit:

```sh
pnpm build
npm pack --dry-run --ignore-scripts
npm publish --access public --tag latest
```

`prepublishOnly` also builds the package. For a registry prerelease, use a new
prerelease version and `--tag next` so it does not replace `latest`. No npm
publication is part of the frontend conflict fix.

Tag the approved release commit as `v0.17.0`, create release notes, and verify
`npm view @flaunch/sdk@0.17.0 version dist.integrity` plus a fresh consumer install.
Check ESM/CJS and the root, abi, addresses, helpers, hooks and utils exports.
Then switch reflaunch from the vendored candidate to the exact published version,
regenerate its lockfile, delete the superseded candidate artifact, and rerun its
validation/browser CI. Keep the protected SDK alias and Game Mode package pins
until their own migration is tested.

References: [npm publishing](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/),
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

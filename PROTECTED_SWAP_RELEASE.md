# Protected-swap release gate

This branch is not ready to publish. Existing address maps still include legacy routers; the protected planner intentionally rejects routers without `exactInputVersion` support.

Release in this order:

1. Review the companion contract changes and link their PR. Verify full input consumption, quote-derived minimum net output, expiry, buyer binding and refunds on fork/testnet.
2. Deploy approved routers and verify bytecode and hook-to-router mappings on each supported chain, including superseded hooks. Update gate approvals before enabling consumers.
3. Update this SDK's address maps; run the packaged-artifact suite and supported-chain fork matrix. CI typecheck is necessary but not execution evidence.
4. Upgrade the ordinary frontend swap implementation and Game Mode host together. Main's raw V2 implementation does not become protected merely by installing a newer SDK.
5. Execute the same quote-backed plan presented to the user. Acquire-and-swap compositions must be atomic wherever the product promises one purchase. Report actual fills; unobserved receipts must not invite duplicate spending or be represented as confirmed fills.

Do not publish a package claiming compatibility with legacy routers, do not change only the frontend version, and do not roll back to an unprotected route. Disable affected routes when protection cannot be established.

SDK #23 is independent legacy launch maintenance and does not provide v1.3 manager-launch parity. Merge/release it separately before rebasing this release candidate.

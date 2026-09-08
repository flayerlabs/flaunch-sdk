import { parseAbi } from "viem";

/** Shared fee configuration and referral events across supported hook generations. */
export const ReferralFeeAbi = parseAbi([
  "function getPoolFeeDistribution(bytes32 _poolId) view returns ((uint24 swapFee, uint24 referrer, uint24 protocol, bool active) feeDistribution_)",
  "function referralEscrow() view returns (address)",
  "event ReferralEscrowUpdated(address _referralEscrow)",
  "event ReferrerFeePaid(bytes32 indexed _poolId, address _recipient, address _token, uint256 _amount)",
]);

/** Keep overloads separate so adapters cannot select the wrong claim signature. */
export const ReferralEscrowUnwrapAbi = parseAbi([
  "function claimTokens(address[] _tokens, address _recipient, bool _unwrap)",
]);

export const ReferralEventsAbi = parseAbi([
  "event TokensAssigned(bytes32 indexed _poolId, address indexed _user, address indexed _token, uint256 _amount)",
  "event TokensClaimed(address indexed _user, address _recipient, address indexed _token, uint256 _amount)",
  "event ReferrerFeePaid(bytes32 indexed _poolId, address _recipient, address _token, uint256 _amount)",
]);

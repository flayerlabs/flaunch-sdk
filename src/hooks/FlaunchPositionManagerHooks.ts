import { useState, useEffect } from "react";
import {
  PoolCreatedLogs,
  PoolSwapLogs,
} from "../clients/FlaunchPositionManagerClient";
import { ReadFlaunchSDK } from "../sdk/FlaunchSDK";
import { Address } from "viem";

export function usePoolCreatedEvents(
  flaunch: ReadFlaunchSDK,
  startBlockNumber?: bigint
) {
  const [logs, setLogs] = useState<PoolCreatedLogs>([]);
  const [isFetchingFromStart, setIsFetchingFromStart] = useState(false);

  useEffect(() => {
    const setupWatcher = async () => {
      const cleanup = await flaunch.watchPoolCreated({
        onPoolCreated: ({ logs: newLogs, isFetchingFromStart }) => {
          setIsFetchingFromStart(isFetchingFromStart);
          setLogs((prevLogs) => [...newLogs, ...prevLogs]);
        },
        startBlockNumber,
      });
      return cleanup;
    };

    const cleanupPromise = setupWatcher();

    return () => {
      cleanupPromise.then(({ cleanup }) => cleanup());
    };
  }, [flaunch, startBlockNumber]);

  // Add effect to update times
  useEffect(() => {
    const timer = setInterval(() => {
      // Force re-render to update relative times
      setLogs((prev) => [...prev]);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return { logs, isFetchingFromStart };
}

export function usePoolSwapEvents(
  flaunch: ReadFlaunchSDK,
  coinAddress: Address,
  startBlockNumber?: bigint
) {
  const [logs, setLogs] = useState<PoolSwapLogs>([]);
  const [isFetchingFromStart, setIsFetchingFromStart] = useState(false);

  useEffect(() => {
    const setupWatcher = async () => {
      const cleanup = await flaunch.watchPoolSwap({
        onPoolSwap: ({ logs: newLogs, isFetchingFromStart }) => {
          setIsFetchingFromStart(isFetchingFromStart);
          setLogs((prevLogs) => [...newLogs, ...prevLogs]);
        },
        filterByCoin: coinAddress,
        startBlockNumber,
      });
      return cleanup;
    };

    const cleanupPromise = setupWatcher();

    return () => {
      cleanupPromise.then(({ cleanup }) => cleanup());
    };
  }, [flaunch, coinAddress, startBlockNumber]);

  // Add effect to update times
  useEffect(() => {
    const timer = setInterval(() => {
      // Force re-render to update relative times
      setLogs((prev) => [...prev]);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return { logs, isFetchingFromStart };
}

import { useState, useEffect } from "react";
import { PoolCreatedLogs } from "../clients/FlaunchPositionManagerClient";
import { ReadFlaunchSDK } from "../sdk/FlaunchSDK";

export function usePoolCreatedEvents(flaunch: ReadFlaunchSDK) {
  const [logs, setLogs] = useState<PoolCreatedLogs>([]);

  useEffect(() => {
    const setupWatcher = async () => {
      const cleanup = await flaunch.watchPoolCreated({
        onPoolCreated: (newLogs) => {
          setLogs((prevLogs) => [...newLogs, ...prevLogs]);
        },
      });
      return cleanup;
    };

    const cleanupPromise = setupWatcher();

    return () => {
      cleanupPromise.then(({ cleanup }) => cleanup());
    };
  }, [flaunch]);

  // Add effect to update times
  useEffect(() => {
    const timer = setInterval(() => {
      // Force re-render to update relative times
      setLogs((prev) => [...prev]);
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return logs;
}

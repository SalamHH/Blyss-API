import {
  FlowerDetailOut,
  FlowerOut,
  createFlower,
  forceReadyFlowerDev,
  getFlowerDetail,
  listFlowers,
  sendFlower,
  waterFlower
} from "@blyss/shared";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "../config";
import { useAuth } from "../auth/AuthContext";
import { addShareTokenHistory } from "./shareTokenHistory";
import { logEvent } from "../lib/analytics";
import { getUserErrorMessage } from "../lib/errorMessages";

type FlowersContextValue = {
  flowers: FlowerOut[];
  flowerDetails: Record<number, FlowerDetailOut>;
  loading: boolean;
  refreshing: boolean;
  creating: boolean;
  wateringFlowerId: number | null;
  sendingFlowerId: number | null;
  detailLoadingFlowerId: number | null;
  error: string | null;
  loadFlowers: () => Promise<void>;
  loadFlowerDetail: (flowerId: number) => Promise<void>;
  getFlowerById: (flowerId: number) => FlowerOut | undefined;
  getFlowerDetailById: (flowerId: number) => FlowerDetailOut | undefined;
  createFlowerOptimistic: (title: string) => Promise<void>;
  waterFlowerById: (flowerId: number, message: string) => Promise<void>;
  sendFlowerById: (flowerId: number, recipientName?: string) => Promise<string>;
  forceReadyFlowerByIdDev: (flowerId: number) => Promise<void>;
};

const FlowersContext = createContext<FlowersContextValue | null>(null);

function makeOptimisticFlower(title: string, ownerId: number): FlowerOut {
  const optimisticId = -Math.floor(Date.now() + Math.random() * 1000);
  const timestamp = new Date().toISOString();

  return {
    id: optimisticId,
    owner_id: ownerId,
    title,
    flower_type: "rose",
    status: "growing",
    stage: 0,
    water_count: 0,
    streak_count: 0,
    ready_at: null,
    sent_at: null,
    created_at: timestamp
  };
}

export function FlowersProvider({ children }: { children: React.ReactNode }) {
  const { withAuthenticated, currentUser } = useAuth();
  const [flowers, setFlowers] = useState<FlowerOut[]>([]);
  const [flowerDetails, setFlowerDetails] = useState<Record<number, FlowerDetailOut>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [wateringFlowerId, setWateringFlowerId] = useState<number | null>(null);
  const [sendingFlowerId, setSendingFlowerId] = useState<number | null>(null);
  const [detailLoadingFlowerId, setDetailLoadingFlowerId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnceRef = useRef(false);
  const detailLoadingRef = useRef<number | null>(null);

  const loadFlowers = useCallback(async () => {
    if (!currentUser) {
      setFlowers([]);
      setFlowerDetails({});
      hasLoadedOnceRef.current = false;
      return;
    }

    const firstLoad = !hasLoadedOnceRef.current;
    setError(null);
    setLoading(firstLoad);
    setRefreshing(!firstLoad);

    try {
      const data = await withAuthenticated((token) => listFlowers(token, API_BASE_URL));
      setFlowers(data);
      hasLoadedOnceRef.current = true;
      logEvent("flowers.list.loaded", { count: data.length });
    } catch (err) {
      const message = getUserErrorMessage(err, "Could not load flowers");
      setError(message);
      logEvent("flowers.list.failed", { message });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser, withAuthenticated]);

  const loadFlowerDetail = useCallback(
    async (flowerId: number) => {
      if (detailLoadingRef.current === flowerId) {
        return;
      }
      detailLoadingRef.current = flowerId;
      setDetailLoadingFlowerId(flowerId);
      setError(null);
      try {
        const detail = await withAuthenticated((token) => getFlowerDetail(token, flowerId, API_BASE_URL));
        setFlowerDetails((prev) => ({ ...prev, [flowerId]: detail }));
        setFlowers((prev) => {
          const exists = prev.some((item) => item.id === flowerId);
          if (!exists) {
            return [detail.flower, ...prev];
          }
          return prev.map((item) => (item.id === flowerId ? detail.flower : item));
        });
        logEvent("flowers.detail.loaded", { flower_id: flowerId });
      } catch (err) {
        const message = getUserErrorMessage(err, "Could not load flower detail");
        setError(message);
        logEvent("flowers.detail.failed", { flower_id: flowerId, message });
      } finally {
        detailLoadingRef.current = null;
        setDetailLoadingFlowerId(null);
      }
    },
    [withAuthenticated]
  );

  const createFlowerOptimistic = useCallback(
    async (title: string) => {
      if (!currentUser) {
        setError("Sign in required");
        return;
      }

      const trimmedTitle = title.trim();
      if (!trimmedTitle || creating) {
        return;
      }

      setCreating(true);
      setError(null);

      const optimistic = makeOptimisticFlower(trimmedTitle, currentUser.id);
      setFlowers((prev) => [optimistic, ...prev]);

      try {
        const created = await withAuthenticated((token) =>
          createFlower(token, { title: trimmedTitle, flower_type: "rose" }, API_BASE_URL)
        );
        setFlowers((prev) => prev.map((item) => (item.id === optimistic.id ? created : item)));
        logEvent("flowers.create.success", { title_length: trimmedTitle.length });
      } catch (err) {
        setFlowers((prev) => prev.filter((item) => item.id !== optimistic.id));
        const message = getUserErrorMessage(err, "Could not create flower");
        setError(message);
        logEvent("flowers.create.failed", { message });
        throw err;
      } finally {
        setCreating(false);
      }
    },
    [creating, currentUser, withAuthenticated]
  );

  const getFlowerById = useCallback(
    (flowerId: number) => flowers.find((item) => item.id === flowerId),
    [flowers]
  );

  const getFlowerDetailById = useCallback(
    (flowerId: number) => flowerDetails[flowerId],
    [flowerDetails]
  );

  const waterFlowerById = useCallback(
    async (flowerId: number, message: string) => {
      const trimmed = message.trim();
      if (!trimmed || wateringFlowerId === flowerId) {
        return;
      }

      setWateringFlowerId(flowerId);
      setError(null);

      try {
        const data = await withAuthenticated((token) =>
          waterFlower(token, flowerId, { message: trimmed, drop_type: "text" }, API_BASE_URL)
        );
        setFlowers((prev) => prev.map((item) => (item.id === flowerId ? data.flower : item)));
        logEvent("flowers.water.success", { flower_id: flowerId, day_number: data.day_number });
      } catch (err) {
        const messageText = getUserErrorMessage(err, "Could not water flower");
        setError(messageText);
        logEvent("flowers.water.failed", { flower_id: flowerId, message: messageText });
        throw err;
      } finally {
        setWateringFlowerId(null);
      }
    },
    [wateringFlowerId, withAuthenticated]
  );

  const sendFlowerById = useCallback(
    async (flowerId: number, recipientName?: string): Promise<string> => {
      if (sendingFlowerId === flowerId) {
        return "";
      }

      setSendingFlowerId(flowerId);
      setError(null);

      try {
        const response = await withAuthenticated((token) =>
          sendFlower(
            token,
            flowerId,
            {
              recipient_name: recipientName?.trim() || null,
              delivery_mode: "instant"
            },
            API_BASE_URL
          )
        );
        await addShareTokenHistory(flowerId, response.share_token);
        setFlowerDetails((prev) => {
          const current = prev[flowerId];
          if (!current) {
            return prev;
          }
          return {
            ...prev,
            [flowerId]: {
              ...current,
              share_token: response.share_token,
              delivery_mode: response.delivery_mode,
              sent_at: response.sent_at
            }
          };
        });
        await loadFlowers();
        logEvent("flowers.send.success", { flower_id: flowerId });
        return response.share_token;
      } catch (err) {
        const messageText = getUserErrorMessage(err, "Could not send flower");
        setError(messageText);
        logEvent("flowers.send.failed", { flower_id: flowerId, message: messageText });
        throw err;
      } finally {
        setSendingFlowerId(null);
      }
    },
    [loadFlowers, sendingFlowerId, withAuthenticated]
  );

  const forceReadyFlowerByIdDev = useCallback(
    async (flowerId: number) => {
      if (!__DEV__) {
        return;
      }
      setError(null);

      try {
        const updated = await withAuthenticated((token) => forceReadyFlowerDev(token, flowerId, API_BASE_URL));
        setFlowers((prev) => prev.map((item) => (item.id === flowerId ? updated : item)));
        await loadFlowerDetail(flowerId);
        logEvent("flowers.dev.force_ready", { flower_id: flowerId });
      } catch (err) {
        const messageText = getUserErrorMessage(err, "Could not force flower to ready state");
        setError(messageText);
        logEvent("flowers.dev.force_ready_failed", { flower_id: flowerId, message: messageText });
        throw err;
      }
    },
    [loadFlowerDetail, withAuthenticated]
  );

  const value = useMemo<FlowersContextValue>(
    () => ({
      flowers,
      flowerDetails,
      loading,
      refreshing,
      creating,
      wateringFlowerId,
      sendingFlowerId,
      detailLoadingFlowerId,
      error,
      loadFlowers,
      loadFlowerDetail,
      getFlowerById,
      getFlowerDetailById,
      createFlowerOptimistic,
      waterFlowerById,
      sendFlowerById,
      forceReadyFlowerByIdDev
    }),
    [
      flowers,
      flowerDetails,
      loading,
      refreshing,
      creating,
      wateringFlowerId,
      sendingFlowerId,
      detailLoadingFlowerId,
      error,
      loadFlowers,
      loadFlowerDetail,
      getFlowerById,
      getFlowerDetailById,
      createFlowerOptimistic,
      waterFlowerById,
      sendFlowerById,
      forceReadyFlowerByIdDev
    ]
  );

  return <FlowersContext.Provider value={value}>{children}</FlowersContext.Provider>;
}

export function useFlowers(): FlowersContextValue {
  const value = useContext(FlowersContext);
  if (!value) {
    throw new Error("useFlowers must be used within FlowersProvider");
  }
  return value;
}

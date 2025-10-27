import React from "react";
import { JsonRpcProvider, ethers } from "ethers";
import type { Eip1193Provider, FhevmInstance } from "@/fhevm/fhevmTypes";
import { RelayerSDKLoader, isFhevmWindowType } from "./RelayerSDKLoader";

export class FhevmAbortError extends Error {
  constructor(message = "FHEVM operation was cancelled") {
    super(message);
    this.name = "FhevmAbortError";
  }
}

type FhevmRelayerStatusType =
  | "sdk-loading"
  | "sdk-loaded"
  | "sdk-initializing"
  | "sdk-initialized"
  | "creating";

async function getChainId(providerOrUrl: Eip1193Provider | string): Promise<number> {
  if (typeof providerOrUrl === "string") {
    const provider = new JsonRpcProvider(providerOrUrl);
    return Number((await provider.getNetwork()).chainId);
  }
  const chainId = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(chainId as string, 16);
}

async function getWeb3Client(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const version = await rpc.send("web3_clientVersion", []);
    return version;
  } finally {
    rpc.destroy();
  }
}

async function getFHEVMRelayerMetadata(rpcUrl: string) {
  const rpc = new JsonRpcProvider(rpcUrl);
  try {
    const meta = await rpc.send("fhevm_relayer_metadata", []);
    return meta;
  } finally {
    rpc.destroy();
  }
}

type ResolveResult =
  | { isMock: true; chainId: number; rpcUrl: string }
  | { isMock: false; chainId: number; rpcUrl?: string };

async function resolve(providerOrUrl: Eip1193Provider | string, mockChains?: Record<number, string>): Promise<ResolveResult> {
  const chainId = await getChainId(providerOrUrl);
  let rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : undefined;
  const _mockChains: Record<number, string> = { 31337: "http://localhost:8545", ...(mockChains ?? {}) };
  if (Object.hasOwn(_mockChains, chainId)) {
    if (!rpcUrl) rpcUrl = _mockChains[chainId];
    return { isMock: true, chainId, rpcUrl };
  }
  return { isMock: false, chainId, rpcUrl };
}

export async function createFhevmInstance(parameters: {
  provider: Eip1193Provider | string;
  mockChains?: Record<number, string>;
  signal: AbortSignal;
  onStatusChange?: (status: FhevmRelayerStatusType) => void;
}): Promise<FhevmInstance> {
  const { provider: providerOrUrl, mockChains, signal, onStatusChange } = parameters;
  const notify = (s: FhevmRelayerStatusType) => onStatusChange && onStatusChange(s);
  const throwIfAborted = () => { if (signal.aborted) throw new FhevmAbortError(); };

  console.log("[createFhevmInstance] starting with provider:", typeof providerOrUrl);
  
  const { isMock, rpcUrl, chainId } = await resolve(providerOrUrl, mockChains);
  console.log("[createFhevmInstance] resolved - isMock:", isMock, "chainId:", chainId, "rpcUrl:", rpcUrl);

  if (isMock) {
    console.log("[createFhevmInstance] checking for FHEVM Hardhat node...");
    try {
      const version = await getWeb3Client(rpcUrl);
      console.log("[createFhevmInstance] web3_clientVersion:", version);
      
      if (typeof version === "string" && version.toLowerCase().includes("hardhat")) {
        console.log("[createFhevmInstance] detected Hardhat, fetching FHEVM metadata...");
        const metadata = await getFHEVMRelayerMetadata(rpcUrl);
        console.log("[createFhevmInstance] FHEVM metadata:", metadata);
        
        if (metadata && metadata.ACLAddress && metadata.InputVerifierAddress && metadata.KMSVerifierAddress) {
          console.log("[createFhevmInstance] creating mock instance...");
          const fhevmMock = await import("./mock/fhevmMock");
          const instance = await fhevmMock.fhevmMockCreateInstance({ rpcUrl, chainId, metadata });
          console.log("[createFhevmInstance] mock instance created successfully");
          return instance as FhevmInstance;
        }
      }
    } catch (e) {
      console.error("[createFhevmInstance] mock creation failed:", e);
    }
  }

  console.log("[createFhevmInstance] falling back to production SDK...");
  
  if (!isFhevmWindowType(window)) {
    notify("sdk-loading");
    console.log("[createFhevmInstance] loading SDK from CDN...");
    const loader = new RelayerSDKLoader({});
    await loader.load();
    throwIfAborted();
    notify("sdk-loaded");
    console.log("[createFhevmInstance] SDK loaded");
  }

  notify("sdk-initializing");
  console.log("[createFhevmInstance] initializing SDK...");
  // @ts-ignore
  const ok = await window.relayerSDK.initSDK();
  if (!ok) throw new Error("FHEVM SDK init failed");
  throwIfAborted();
  notify("sdk-initialized");
  console.log("[createFhevmInstance] SDK initialized");

  // @ts-ignore
  const relayerSDK = window.relayerSDK;
  const config = { ...relayerSDK.SepoliaConfig, network: providerOrUrl };
  notify("creating");
  console.log("[createFhevmInstance] creating production instance with config:", config);
  const instance = await relayerSDK.createInstance(config);
  throwIfAborted();
  console.log("[createFhevmInstance] production instance created successfully");
  return instance as FhevmInstance;
}

export type FhevmGoState = "idle" | "loading" | "ready" | "error";

export function useFhevm(parameters: {
  provider: Eip1193Provider | undefined;
  chainId: number | undefined;
  enabled?: boolean;
  initialMockChains?: Readonly<Record<number, string>>;
}): { instance: FhevmInstance | undefined; refresh: () => void; error: Error | undefined; status: FhevmGoState } {
  const { provider, chainId, enabled = true, initialMockChains } = parameters;

  const [instance, setInstance] = React.useState<FhevmInstance | undefined>(undefined);
  const [status, setStatus] = React.useState<FhevmGoState>("idle");
  const [error, setError] = React.useState<Error | undefined>(undefined);
  const initializingRef = React.useRef<boolean>(false);

  const refresh = React.useCallback(() => {
    initializingRef.current = false;
    setInstance(undefined);
    setError(undefined);
    setStatus("idle");
  }, []);

  React.useEffect(() => {
    if (!enabled || !provider || initializingRef.current) {
      console.log("[useFhevm] skipping - enabled:", enabled, "provider:", !!provider, "initializing:", initializingRef.current);
      return;
    }
    
    // 防止重复初始化
    initializingRef.current = true;
    
    console.log("[useFhevm] starting initialization...");
    setStatus("loading");
    setError(undefined);
    
    const initAsync = async () => {
      try {
        // 创建一个简单的 signal，但不会被 React 取消
        const abortController = new AbortController();
        
        const inst = await createFhevmInstance({ 
          provider: provider!, 
          mockChains: initialMockChains as any, 
          signal: abortController.signal, 
          onStatusChange: (s) => console.log("[useFhevm] status:", s) 
        });
        
        console.log("[useFhevm] instance created successfully");
        setInstance(inst); 
        setStatus("ready");
      } catch (e) {
        console.error("[useFhevm] instance creation failed:", e);
        setError(e as Error); 
        setStatus("error"); 
      } finally {
        initializingRef.current = false;
      }
    };
    
    initAsync();
  }, [enabled, provider, chainId]);

  return { instance, refresh, error, status };
}



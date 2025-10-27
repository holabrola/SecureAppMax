export const SDK_CDN_URL =
  "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";

type TraceType = (...args: any[]) => void;

export function isFhevmWindowType(w: any, trace?: TraceType): w is any {
  const ok = !!w && !!w.relayerSDK;
  if (!ok && trace) trace("[RelayerSDKLoader] window.relayerSDK missing");
  return ok;
}

export class RelayerSDKLoader {
  private _trace?: TraceType;
  constructor(options: { trace?: TraceType }) {
    this._trace = options.trace;
  }

  public load(): Promise<void> {
    return new Promise((resolve, reject) => {
      if ("relayerSDK" in window) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src = SDK_CDN_URL;
      script.type = "text/javascript";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load ${SDK_CDN_URL}`));
      document.head.appendChild(script);
    });
  }
}



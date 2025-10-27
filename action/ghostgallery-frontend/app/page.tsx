"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { useGallery } from "@/hooks/useGallery";

export default function Page() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const forceSepolia = process.env.NEXT_PUBLIC_FORCE_SEPOLIA === "1";
  const autoSwitchTriedRef = useState<{ tried: boolean }>({ tried: false })[0];

  useEffect(() => {
    const detectProvider = () => {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const eth = (window as any).ethereum as ethers.Eip1193Provider;
        console.log("[Page] MetaMask detected:", !!eth);
        setProvider(eth);
        eth.request({ method: "eth_chainId" }).then((cid) => {
          const chainIdNum = parseInt(cid as string, 16);
          console.log("[Page] Chain ID:", chainIdNum);
          setChainId(chainIdNum);
        });
        return true;
      }
      return false;
    };

    // 立即尝试检测
    if (!detectProvider()) {
      console.log("[Page] MetaMask not ready, waiting...");
      // 如果没检测到，等待一下再试
      const timer = setInterval(() => {
        if (detectProvider()) {
          clearInterval(timer);
        }
      }, 100);
      
      // 10秒后停止检测
      setTimeout(() => clearInterval(timer), 10000);
    }
  }, []);

  const { instance, status, error } = useFhevm({ provider, chainId, initialMockChains: { 31337: "http://localhost:8545" }, enabled: true });
  const gallery = useGallery({ instance, provider, chainId });

  const connect = async () => {
    if (!provider) return;
    await provider.request?.({ method: "eth_requestAccounts" });
  };

  const switchToSepolia = async () => {
    if (!provider) return;
    try {
      await provider.request?.({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        await provider.request?.({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
            rpcUrls: ["https://rpc.sepolia.org"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          }],
        });
        await provider.request?.({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
      }
    }
    const cid = await provider.request?.({ method: "eth_chainId" });
    if (cid) setChainId(parseInt(cid as string, 16));
  };

  // 当强制使用 Sepolia 时，自动提示切换网络
  useEffect(() => {
    if (!forceSepolia || !provider || chainId === undefined) return;
    if (chainId !== 11155111 && !autoSwitchTriedRef.tried) {
      autoSwitchTriedRef.tried = true;
      switchToSepolia();
    }
  }, [forceSepolia, provider, chainId]);

  const content = useMemo(() => {
    if (!provider) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <div className="glass-card p-12 max-w-md animate-fade-in">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-2xl">🔗</span>
              </div>
              <h2 className="text-2xl font-bold text-gradient mb-2">连接钱包</h2>
              <p className="text-white/70">请连接 MetaMask 钱包开始体验匿名艺术展览</p>
            </div>
            <button onClick={connect} className="btn-primary w-full">
              连接 MetaMask
            </button>
          </div>
        </div>
      );
    }
    
    if (status !== "ready") {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="glass-card p-8 text-center animate-pulse">
            <div className="w-12 h-12 border-4 border-primary-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h3 className="text-xl font-semibold mb-2">FHEVM 初始化中</h3>
            <p className="text-white/70">状态: {status}</p>
            {error && <p className="text-red-400 mt-2">{error.message}</p>}
            {provider && chainId !== undefined && chainId !== 11155111 && (
              <div className="mt-4">
                <p className="text-white/70 mb-2">当前网络链 ID: {chainId}，请切换到 Sepolia</p>
                <button onClick={switchToSepolia} className="btn-primary">一键切换到 Sepolia</button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="animate-fade-in">
        {provider && chainId !== 11155111 && (
          <div className="glass-card p-4 mb-6 border-l-4 border-yellow-400">
            <div className="flex items-center justify-between gap-4">
              <p className="text-white/80">当前网络链 ID: {chainId ?? '-'}，请切换到 Sepolia 以使用测试网</p>
              <button onClick={switchToSepolia} className="btn-primary">一键切换到 Sepolia</button>
            </div>
          </div>
        )}
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gradient mb-4">
            匿名艺术展厅
          </h1>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            探索区块链上的匿名艺术作品，每一次点赞和投票都经过同态加密保护
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={gallery.refreshArtworks} 
              disabled={!gallery.canRefresh || gallery.busy}
              className="btn-primary"
            >
              {gallery.busy ? "加载中..." : "🔄 刷新作品"}
            </button>
            <button 
              onClick={() => gallery.mockUpload()} 
              className="btn-secondary"
            >
              ⚡ 快速上传示例
            </button>
          </div>
        </div>

        {/* Message Display */}
        {gallery.message && (
          <div className="glass-card p-4 mb-8 border-l-4 border-primary-400">
            <p className="text-white/90">{gallery.message}</p>
          </div>
        )}

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {gallery.items.length === 0 ? (
            <div className="col-span-full">
              <div className="glass-card p-12 text-center">
                <div className="text-6xl mb-4">🎨</div>
                <h3 className="text-2xl font-semibold mb-2">暂无作品</h3>
                <p className="text-white/70">成为第一个上传作品的艺术家吧！</p>
              </div>
            </div>
          ) : (
            gallery.items.map((item) => (
              <div key={item.id} className="glass-card p-6 hover:scale-105 transition-all duration-300 animate-slide-up">
                {/* Artwork Placeholder */}
                <div className="w-full h-48 bg-gradient-to-br from-primary-500/20 to-primary-700/20 rounded-lg mb-4 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-4xl mb-2">🖼️</div>
                    <p className="text-sm text-white/60">艺术作品</p>
                  </div>
                </div>

                {/* Artwork Info */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-2 text-gradient">{item.title}</h3>
                  <p className="text-white/60 text-sm mb-2">
                    匿名艺术家: {item.artist.slice(0, 6)}...{item.artist.slice(-4)}
                  </p>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.tags.map((tag, idx) => (
                      <span key={idx} className="px-2 py-1 bg-primary-500/20 rounded-full text-xs text-primary-300">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.categories.map((cat, idx) => (
                      <span key={idx} className="px-2 py-1 bg-yellow-500/20 rounded-full text-xs text-yellow-300 border border-yellow-400/30">
                        🏆 {cat === 'best-photography' ? '摄影' : 
                            cat === 'best-digital' ? '数字艺术' : 
                            cat === 'best-abstract' ? '抽象艺术' : 
                            cat === 'best-contemporary' ? '当代艺术' : cat}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-white/50 break-all">
                    文件: {item.fileHash.slice(0, 20)}...
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 mb-4">
                  <button 
                    onClick={() => gallery.like(item.id)} 
                    disabled={!gallery.canLike || gallery.busy || gallery.likedItems.has(item.id)}
                    className={`w-full ${
                      gallery.likedItems.has(item.id) 
                        ? 'bg-green-500/30 border-green-400 text-green-300 cursor-not-allowed' 
                        : 'btn-secondary'
                    }`}
                  >
                    {gallery.likedItems.has(item.id) ? '✅ 已点赞' : '❤️ 点赞'}
                  </button>
                  
                  {/* 投票按钮 - 根据作品类别显示 */}
                  {item.categories.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-white/60">可投票类别:</p>
                      {item.categories.map((cat) => (
                        <button 
                          key={cat}
                          onClick={() => gallery.vote(item.id, cat)} 
                          disabled={!gallery.canVote || gallery.busy || gallery.votedItems.has(item.id)}
                          className={`w-full text-sm ${
                            gallery.votedItems.has(item.id) 
                              ? 'bg-purple-500/30 border-purple-400 text-purple-300 cursor-not-allowed' 
                              : 'btn-secondary'
                          }`}
                        >
                          {gallery.votedItems.has(item.id) ? '✅ 已投票' : `🏆 投票 - ${
                            cat === 'best-photography' ? '摄影' : 
                            cat === 'best-digital' ? '数字艺术' : 
                            cat === 'best-abstract' ? '抽象艺术' : 
                            cat === 'best-contemporary' ? '当代艺术' : cat
                          }`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={() => gallery.decryptLikes(item.id)} 
                  disabled={!gallery.canDecrypt || gallery.busy}
                  className="btn-primary w-full text-sm"
                >
                  🔓 解密点赞数
                </button>

                {/* Decrypted Likes */}
                {gallery.likesClear[item.id] !== undefined && (
                  <div className="mt-4 p-3 bg-green-500/20 rounded-lg border border-green-400/30">
                    <p className="text-green-300 text-sm font-medium">
                      💎 点赞数: {String(gallery.likesClear[item.id])}
                    </p>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }, [provider, status, error, gallery]);

  return content;
}


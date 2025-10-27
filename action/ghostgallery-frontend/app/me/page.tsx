"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { GhostGalleryABI } from "@/abi/GhostGalleryABI";
import { GhostGalleryAddresses } from "@/abi/GhostGalleryAddresses";

export default function MePage() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [items, setItems] = useState<any[]>([]);
  const [addr0, setAddr0] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const detectProvider = () => {
      if (typeof window !== "undefined" && (window as any).ethereum) {
        const eth = (window as any).ethereum as ethers.Eip1193Provider;
        setProvider(eth);
        eth.request({ method: "eth_chainId" }).then((cid) => setChainId(parseInt(cid as string, 16)));
        return true;
      }
      return false;
    };

    if (!detectProvider()) {
      const timer = setInterval(() => {
        if (detectProvider()) clearInterval(timer);
      }, 100);
      setTimeout(() => clearInterval(timer), 5000);
    }
  }, []);

  const addr = useMemo(() => (chainId ? (GhostGalleryAddresses as any)[chainId.toString()]?.address : undefined), [chainId]);

  const refreshMine = async () => {
    if (!provider || !addr) return;
    setLoading(true);
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const my = await s.getAddress();
      setAddr0(my);
      const rp = await bp;
      const contract = new ethers.Contract(addr, GhostGalleryABI.abi, rp);
      const ids: bigint[] = await contract.getAllArtworks();
      const mine: any[] = [];
      for (const idb of ids) {
        const id = Number(idb);
        const art = await contract.getArtwork(id);
        if (String(art[1]).toLowerCase() === my.toLowerCase()) {
          mine.push({ 
            id, 
            title: art[2], 
            descriptionHash: art[3],
            fileHash: art[4], 
            tags: art[5],
            ts: Number(art[6]) 
          });
        }
      }
      setItems(mine.sort((a, b) => b.ts - a.ts));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshMine(); }, [provider, addr]);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
  };

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gradient mb-4">👤 我的作品</h1>
        <p className="text-white/80">管理你上传的匿名艺术作品</p>
        
        {addr0 && (
          <div className="mt-6 glass-card p-4 inline-block">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">👤</span>
              </div>
              <div>
                <p className="text-sm text-white/70">匿名身份</p>
                <p className="font-mono text-primary-300">{addr0.slice(0, 8)}...{addr0.slice(-4)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center mb-8">
        <button
          onClick={refreshMine}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
              加载中...
            </>
          ) : (
            "🔄 刷新我的作品"
          )}
        </button>
      </div>

      {items.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-4">🎨</div>
          <h3 className="text-2xl font-semibold mb-2">还没有上传作品</h3>
          <p className="text-white/70 mb-6">开始你的匿名艺术创作之旅吧！</p>
          <a href="/upload" className="btn-primary inline-block">
            📤 上传第一件作品
          </a>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-4 text-gradient">📊 统计概览</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-primary-500/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-primary-300">{items.length}</div>
                <div className="text-sm text-white/70">总作品数</div>
              </div>
              <div className="bg-green-500/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-300">{items.reduce((acc, item) => acc + item.tags.length, 0)}</div>
                <div className="text-sm text-white/70">总标签数</div>
              </div>
              <div className="bg-purple-500/20 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-300">
                  {items.length > 0 ? Math.floor((Date.now() / 1000 - Math.min(...items.map(i => i.ts))) / (24 * 60 * 60)) : 0}
                </div>
                <div className="text-sm text-white/70">创作天数</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <div key={item.id} className="glass-card p-6 hover:scale-105 transition-all duration-300">
                {/* Artwork Placeholder */}
                <div className="w-full h-40 bg-gradient-to-br from-primary-500/20 to-primary-700/20 rounded-lg mb-4 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🖼️</div>
                    <p className="text-sm text-white/60">作品 #{item.id}</p>
                  </div>
                </div>

                {/* Artwork Info */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-gradient">{item.title}</h3>
                  
                  <div className="flex flex-wrap gap-1">
                    {item.tags.map((tag: string, idx: number) => (
                      <span key={idx} className="px-2 py-1 bg-primary-500/20 rounded-full text-xs text-primary-300">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-white/70">
                      <span>📅</span>
                      <span>{formatDate(item.ts)}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-white/60">
                      <span>📝</span>
                      <span className="truncate">{item.descriptionHash || '无简介'}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-white/60">
                      <span>🔗</span>
                      <span className="truncate">{item.fileHash || '无文件'}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="pt-4 border-t border-white/10">
                    <button
                      onClick={() => window.open(`/?id=${item.id}`, '_blank')}
                      className="btn-secondary w-full text-sm"
                    >
                      👁️ 在展厅查看
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="mt-12 glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gradient">💡 创作者提示</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-white/70">
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>你的作品完全匿名，只能通过钱包地址识别</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>作品上链后无法删除或修改，请谨慎上传</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>点赞和投票数据通过 FHE 加密保护</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>建议使用有意义的标签帮助观众发现作品</p>
          </div>
        </div>
      </div>
    </div>
  );
}



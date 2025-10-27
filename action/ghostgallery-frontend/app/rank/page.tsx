"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { GhostGalleryABI } from "@/abi/GhostGalleryABI";
import { GhostGalleryAddresses } from "@/abi/GhostGalleryAddresses";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";

const categories = [
  { id: "best-photography", name: "🏆 最佳摄影", icon: "📸" },
  { id: "best-digital", name: "🎨 最佳数字艺术", icon: "💻" },
  { id: "best-abstract", name: "🌀 最佳抽象", icon: "🎭" },
  { id: "best-contemporary", name: "⭐ 最佳当代", icon: "🔥" },
];

export default function RankPage() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [category, setCategory] = useState("best-photography");
  const [rows, setRows] = useState<{ id: number; title: string; handle: string; clear?: bigint | string; artist: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [decrypting, setDecrypting] = useState(false);

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

  const { instance, status } = useFhevm({ provider, chainId, initialMockChains: { 31337: "http://localhost:8545" }, enabled: true });
  const addr = useMemo(() => (chainId ? (GhostGalleryAddresses as any)[chainId.toString()]?.address : undefined), [chainId]);

  const refresh = async () => {
    if (!provider || !addr) return;
    setLoading(true);
    setMsg("");
    try {
      const bp = new ethers.BrowserProvider(provider);
      const rp = await bp;
      const contract = new ethers.Contract(addr, GhostGalleryABI.abi, rp);
      const ids: bigint[] = await contract.getAllArtworks();
      const arr: { id: number; title: string; handle: string; artist: string }[] = [];
      
      for (const idb of ids) {
        const id = Number(idb);
        const art = await contract.getArtwork(id);
        const artCategories = art[6]; // categories 字段
        
        // 只有作品属于当前选择的类别才显示
        const belongsToCategory = artCategories.includes(category);
        if (belongsToCategory) {
          const handle = await contract.getVotes(id, category);
          arr.push({ 
            id, 
            title: art[2], 
            handle, 
            artist: art[1],
          });
        }
      }
      setRows(arr);
      
      if (arr.length === 0) {
        setMsg(`📭 当前类别 "${getCategoryName(category)}" 下暂无作品`);
      }
    } catch (e: any) {
      setMsg("❌ " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name.replace(/🏆|🎨|🌀|⭐/, '').trim() : catId;
  };

  const decryptAll = async () => {
    if (!provider || !addr || !instance || rows.length === 0) return;
    setDecrypting(true);
    setMsg("");
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const { publicKey, privateKey } = instance.generateKeypair();
      const sig = await FhevmDecryptionSignature.new(instance, [addr], publicKey, privateKey, s);
      if (!sig) throw new Error("解密签名失败");
      
      // 过滤掉空的 handle（0x0000...）
      const validPairs = rows
        .filter((r) => r.handle && r.handle !== "0x0000000000000000000000000000000000000000000000000000000000000000")
        .map((r) => ({ handle: r.handle, contractAddress: addr! }));
      
      if (validPairs.length === 0) {
        setMsg("📭 当前类别下没有投票数据可解密");
        return;
      }
      
      const res = await instance.userDecrypt(validPairs, sig.privateKey, sig.publicKey, sig.signature, sig.contractAddresses, sig.userAddress, sig.startTimestamp, sig.durationDays);
      
      setRows((old) => old.map((r) => ({
        ...r, 
        clear: r.handle && r.handle !== "0x0000000000000000000000000000000000000000000000000000000000000000" 
          ? res[r.handle] as any 
          : 0
      })));
      
      setMsg(`✅ 解密完成，共解密 ${validPairs.length} 个有效投票数据`);
    } catch (e: any) { 
      setMsg("❌ 解密失败: " + (e?.message ?? String(e))); 
    } finally {
      setDecrypting(false);
    }
  };

  useEffect(() => { refresh(); }, [provider, addr, category]);

  const sorted = [...rows].sort((a, b) => Number(b.clear ?? 0) - Number(a.clear ?? 0));
  const currentCategory = categories.find(c => c.id === category) || categories[0];

  return (
    <div className="animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gradient mb-4">🏆 艺术排行榜</h1>
        <p className="text-white/80">发现最受欢迎的匿名艺术作品</p>
        <div className="mt-4 text-sm text-white/60">
          FHEVM 状态: <span className={`px-2 py-1 rounded ${status === 'ready' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
            {status}
          </span>
        </div>
      </div>

      {/* Category Selection */}
      <div className="glass-card p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4 text-white/90">选择排行类别</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`p-4 rounded-lg border transition-all duration-200 ${
                category === cat.id
                  ? 'bg-primary-500/30 border-primary-400 text-primary-200'
                  : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
              }`}
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-sm font-medium">{cat.name.replace(/🏆|🎨|🌀|⭐/, '').trim()}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-8">
        <button
          onClick={refresh}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
              加载中...
            </>
          ) : (
            "🔄 刷新排行"
          )}
        </button>
        
        <button
          onClick={decryptAll}
          disabled={decrypting || rows.length === 0}
          className="btn-secondary"
        >
          {decrypting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
              解密中...
            </>
          ) : (
            "🔓 解密所有票数"
          )}
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className={`glass-card p-4 mb-8 border-l-4 ${
          msg.includes('✅') 
            ? 'border-green-400 bg-green-500/10' 
            : 'border-red-400 bg-red-500/10'
        }`}>
          <p className="text-white/90">{msg}</p>
        </div>
      )}

      {/* Rankings */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-3xl">{currentCategory.icon}</span>
          <h2 className="text-2xl font-bold text-gradient">{currentCategory.name}</h2>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏆</div>
            <h3 className="text-xl font-semibold mb-2">暂无排行数据</h3>
            <p className="text-white/70">还没有作品获得投票，快去投票支持你喜欢的作品吧！</p>
          </div>
        ) : (
          <div className="space-y-4">
            {sorted.map((item, index) => (
              <div
                key={item.id}
                className={`flex items-center gap-4 p-4 rounded-lg transition-all duration-200 ${
                  index < 3 
                    ? 'bg-gradient-to-r from-primary-500/20 to-primary-600/20 border border-primary-400/30' 
                    : 'bg-white/5 border border-white/10'
                } hover:scale-[1.02]`}
              >
                {/* Rank */}
                <div className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                  index === 0 ? 'bg-yellow-500/30 text-yellow-300' :
                  index === 1 ? 'bg-gray-400/30 text-gray-300' :
                  index === 2 ? 'bg-orange-500/30 text-orange-300' :
                  'bg-white/10 text-white/70'
                }`}>
                  {index < 3 ? ['🥇', '🥈', '🥉'][index] : index + 1}
                </div>

                {/* Artwork Info */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white/90 truncate">#{item.id} {item.title}</h3>
                  <p className="text-sm text-white/60">
                    匿名艺术家: {item.artist.slice(0, 6)}...{item.artist.slice(-4)}
                  </p>
                </div>

                {/* Vote Count */}
                <div className="flex-shrink-0 text-right">
                  <div className={`text-2xl font-bold ${
                    item.clear !== undefined ? 'text-primary-300' : 'text-white/40'
                  }`}>
                    {item.clear !== undefined ? String(item.clear) : '?'}
                  </div>
                  <div className="text-xs text-white/60">票数</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}



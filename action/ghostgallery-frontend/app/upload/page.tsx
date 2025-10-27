"use client";

import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { GhostGalleryABI } from "@/abi/GhostGalleryABI";
import { GhostGalleryAddresses } from "@/abi/GhostGalleryAddresses";

export default function UploadPage() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [descHash, setDescHash] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [tags, setTags] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [msg, setMsg] = useState("");
  const [uploading, setUploading] = useState(false);

  const categories = [
    { id: "best-photography", name: "摄影", icon: "📸" },
    { id: "best-digital", name: "数字艺术", icon: "💻" },
    { id: "best-abstract", name: "抽象艺术", icon: "🎭" },
    { id: "best-contemporary", name: "当代艺术", icon: "🔥" },
  ];

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

  const { status } = useFhevm({ provider, chainId, initialMockChains: { 31337: "http://localhost:8545" }, enabled: true });
  const addr = useMemo(() => (chainId ? (GhostGalleryAddresses as any)[chainId.toString()]?.address : undefined), [chainId]);

  const onUpload = async () => {
    if (!provider || !addr || !title.trim() || selectedCategories.length === 0) return;
    
    setUploading(true);
    setMsg("");
    
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const contract = new ethers.Contract(addr, GhostGalleryABI.abi, s);
      const tagArr = tags.trim() ? tags.split(",").map((t) => t.trim()) : [];
      
      setMsg("正在上传到区块链...");
      const tx = await contract.uploadArtwork(title, descHash, fileHash, tagArr, selectedCategories);
      
      setMsg("等待交易确认...");
      await tx.wait();
      
      setMsg("✅ 作品上传成功！");
      // 清空表单
      setTitle("");
      setDescHash("");
      setFileHash("");
      setTags("");
      setSelectedCategories([]);
    } catch (e: any) {
      setMsg("❌ 上传失败: " + (e?.message ?? String(e)));
    } finally {
      setUploading(false);
    }
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const fillExample = () => {
    setTitle("神秘的月夜");
    setDescHash("ipfs://QmExampleDescriptionHash123");
    setFileHash("ipfs://QmExampleFileHash456");
    setTags("摄影, 黑白, 月亮, 艺术");
    setSelectedCategories(["best-photography"]);
  };

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gradient mb-4">📤 上传作品</h1>
        <p className="text-white/80">将你的艺术作品匿名上传到区块链展览</p>
        <div className="mt-4 text-sm text-white/60">
          FHEVM 状态: <span className={`px-2 py-1 rounded ${status === 'ready' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
            {status}
          </span>
        </div>
      </div>

      <div className="glass-card p-8">
        <div className="space-y-6">
          <div>
            <label className="block text-white/90 font-medium mb-2">
              🎨 作品标题 *
            </label>
            <input
              type="text"
              placeholder="为你的作品起个名字..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input-field w-full"
              disabled={uploading}
            />
          </div>

          <div>
            <label className="block text-white/90 font-medium mb-2">
              📝 简介哈希
            </label>
            <input
              type="text"
              placeholder="ipfs://QmYourDescriptionHash..."
              value={descHash}
              onChange={(e) => setDescHash(e.target.value)}
              className="input-field w-full"
              disabled={uploading}
            />
            <p className="text-xs text-white/50 mt-1">
              将作品简介上传到 IPFS 后填入哈希值
            </p>
          </div>

          <div>
            <label className="block text-white/90 font-medium mb-2">
              🖼️ 文件哈希
            </label>
            <input
              type="text"
              placeholder="ipfs://QmYourFileHash..."
              value={fileHash}
              onChange={(e) => setFileHash(e.target.value)}
              className="input-field w-full"
              disabled={uploading}
            />
            <p className="text-xs text-white/50 mt-1">
              将艺术作品文件上传到 IPFS/Arweave 后填入哈希值
            </p>
          </div>

          <div>
            <label className="block text-white/90 font-medium mb-2">
              🏷️ 标签
            </label>
            <input
              type="text"
              placeholder="摄影, 抽象, 黑白, 现代艺术"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="input-field w-full"
              disabled={uploading}
            />
            <p className="text-xs text-white/50 mt-1">
              用逗号分隔多个标签，便于其他人发现你的作品
            </p>
          </div>

          <div>
            <label className="block text-white/90 font-medium mb-3">
              🎯 作品类别 * (可多选)
            </label>
            <div className="grid grid-cols-2 gap-3">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  disabled={uploading}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    selectedCategories.includes(cat.id)
                      ? 'bg-primary-500/30 border-primary-400 text-primary-200'
                      : 'bg-white/5 border-white/20 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="text-2xl mb-1">{cat.icon}</div>
                  <div className="text-sm font-medium">{cat.name}</div>
                  {selectedCategories.includes(cat.id) && (
                    <div className="text-xs text-primary-300 mt-1">✓ 已选择</div>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-white/50 mt-2">
              选择作品所属的类别，将参与对应的排行榜竞争
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={onUpload}
              disabled={!title.trim() || selectedCategories.length === 0 || uploading || status !== 'ready'}
              className="btn-primary flex-1"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2 inline-block"></div>
                  上传中...
                </>
              ) : (
                "🚀 确认上传"
              )}
            </button>
            <button
              onClick={fillExample}
              disabled={uploading}
              className="btn-secondary"
            >
              📋 填入示例
            </button>
          </div>

          {msg && (
            <div className={`p-4 rounded-lg border-l-4 ${
              msg.includes('✅') 
                ? 'bg-green-500/20 border-green-400 text-green-300' 
                : msg.includes('❌')
                ? 'bg-red-500/20 border-red-400 text-red-300'
                : 'bg-blue-500/20 border-blue-400 text-blue-300'
            }`}>
              <p className="font-medium">{msg}</p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 glass-card p-6">
        <h3 className="text-lg font-semibold mb-4 text-gradient">💡 使用提示</h3>
        <div className="space-y-3 text-sm text-white/70">
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>作品一旦上传到区块链将无法删除或修改</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>建议先将文件上传到 IPFS 或 Arweave 等去中心化存储</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>点赞和投票数据通过 FHE 同态加密保护隐私</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary-400">•</span>
            <p>你的身份完全匿名，仅通过钱包地址识别</p>
          </div>
        </div>
      </div>
    </div>
  );
}



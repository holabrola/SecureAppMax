"use client";

import { ethers } from "ethers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GhostGalleryABI } from "@/abi/GhostGalleryABI";
import { GhostGalleryAddresses } from "@/abi/GhostGalleryAddresses";

type ArtworkItem = {
  id: number;
  artist: string;
  title: string;
  descriptionHash: string;
  fileHash: string;
  tags: string[];
  categories: string[];
  timestamp: number;
  likesHandle: string;
};

export function useGallery(parameters: {
  instance: FhevmInstance | undefined;
  provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
}) {
  const { instance, provider, chainId } = parameters;
  const [items, setItems] = useState<ArtworkItem[]>([]);
  const [likesClear, setLikesClear] = useState<Record<number, string | bigint | boolean>>({});
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [votedItems, setVotedItems] = useState<Set<number>>(new Set());

  const signer = useMemo(() => (provider ? new ethers.BrowserProvider(provider).getSigner() : undefined), [provider]);

  const contractAddress = useMemo(() => {
    if (!chainId) return undefined;
    const entry = (GhostGalleryAddresses as any)[chainId?.toString()];
    return entry?.address as `0x${string}` | undefined;
  }, [chainId]);

  const readonlyProvider = useMemo(() => (provider ? new ethers.BrowserProvider(provider) : undefined), [provider]);

  const canRefresh = useMemo(() => !!contractAddress && !!readonlyProvider, [contractAddress, readonlyProvider]);
  const canDecrypt = useMemo(() => !!contractAddress && !!instance && !!provider, [contractAddress, instance, provider]);
  const canLike = useMemo(() => !!contractAddress && !!instance && !!provider, [contractAddress, instance, provider]);
  const canVote = canLike;

  const refreshArtworks = useCallback(async () => {
    if (!canRefresh || !readonlyProvider || !contractAddress) return;
    setBusy(true);
    try {
      const rp = await readonlyProvider;
      const contract = new ethers.Contract(contractAddress, GhostGalleryABI.abi, rp);
      const ids: bigint[] = await contract.getAllArtworks();
      const rows: ArtworkItem[] = [];
      for (const idb of ids) {
        const id = Number(idb);
        const [rid, artist, title, descriptionHash, fileHash, tags, categories, timestamp, likesHandle] = await contract.getArtwork(id);
        rows.push({ id: Number(rid), artist, title, descriptionHash, fileHash, tags, categories, timestamp: Number(timestamp), likesHandle });
      }
      setItems(rows.sort((a, b) => b.timestamp - a.timestamp));
    } catch (e: any) {
      setMessage("查询失败: " + e?.message);
    } finally {
      setBusy(false);
    }
  }, [canRefresh, readonlyProvider, contractAddress]);

  const like = useCallback(async (id: number) => {
    if (!provider || !contractAddress || !instance || likedItems.has(id)) return;
    setBusy(true);
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const contract = new ethers.Contract(contractAddress, GhostGalleryABI.abi, s);
      const tx = await contract.likeArtwork(id);
      await tx.wait();
      
      // 标记为已点赞
      setLikedItems(prev => new Set([...prev, id]));
      setMessage(`✅ 作品 #${id} 点赞成功！`);
      
      await refreshArtworks();
    } catch (e: any) {
      setMessage(`❌ 点赞失败: ${e?.message}`);
    } finally { 
      setBusy(false); 
    }
  }, [provider, contractAddress, instance, refreshArtworks, likedItems]);

  const vote = useCallback(async (id: number, category: string) => {
    if (!provider || !contractAddress || !instance || votedItems.has(id)) return;
    setBusy(true);
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const contract = new ethers.Contract(contractAddress, GhostGalleryABI.abi, s);
      const tx = await contract.voteArtwork(id, category);
      await tx.wait();
      
      // 标记为已投票
      setVotedItems(prev => new Set([...prev, id]));
      setMessage(`✅ 作品 #${id} 投票成功！类别: ${category}`);
    } catch (e: any) {
      setMessage(`❌ 投票失败: ${e?.message}`);
    } finally { 
      setBusy(false); 
    }
  }, [provider, contractAddress, instance, votedItems]);

  const decryptLikes = useCallback(async (id: number) => {
    if (!provider || !contractAddress || !instance) return;
    const row = items.find((r) => r.id === id);
    if (!row) return;
    setBusy(true);
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const { publicKey, privateKey } = instance.generateKeypair();
      const sig = await FhevmDecryptionSignature.new(instance, [contractAddress], publicKey, privateKey, s);
      if (!sig) throw new Error("构建解密签名失败");
      const res = await instance.userDecrypt(
        [{ handle: row.likesHandle, contractAddress }],
        sig.privateKey, sig.publicKey, sig.signature,
        sig.contractAddresses, sig.userAddress,
        sig.startTimestamp, sig.durationDays
      );
      setLikesClear((m) => ({ ...m, [id]: res[row.likesHandle] }));
    } catch (e: any) {
      setMessage("解密失败: " + e?.message);
    } finally { setBusy(false); }
  }, [provider, contractAddress, instance, items]);

  const mockUpload = useCallback(async () => {
    if (!provider || !contractAddress) return;
    try {
      const bp = new ethers.BrowserProvider(provider);
      const s = await bp.getSigner();
      const contract = new ethers.Contract(contractAddress, GhostGalleryABI.abi, s);
      const tags = ["摄影", "黑白"];
      const categories = ["best-photography"];
      const tx = await contract.uploadArtwork("Untitled", "ipfs://descHash", "ipfs://fileHash", tags, categories);
      await tx.wait();
      await refreshArtworks();
    } catch (e: any) {
      setMessage("上传失败: " + e?.message);
    }
  }, [provider, contractAddress, refreshArtworks]);

  useEffect(() => { refreshArtworks(); }, [refreshArtworks]);

  return {
    items,
    likesClear,
    message,
    canRefresh,
    canDecrypt,
    canLike,
    canVote,
    refreshArtworks,
    like,
    vote,
    decryptLikes,
    mockUpload,
    busy,
    likedItems,
    votedItems,
  };
}



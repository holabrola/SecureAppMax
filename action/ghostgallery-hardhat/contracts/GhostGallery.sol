// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, euint64, euint256, externalEuint32, externalEuint64, externalEuint256} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title GhostGallery – 匿名艺术作品上链展览（FHE 版）
/// @notice 作品的点赞数、投票计数等以 FHE 加密存储，作者与投票者通过 ACL 进行解密授权；
///         作品文件与简介等明文内容仅保存哈希（例如 IPFS/Arweave 哈希）。
contract GhostGallery is SepoliaConfig {
    struct Artwork {
        uint256 id;                    // 作品ID
        address artist;                // 匿名作者（地址）
        string title;                  // 标题（明文）
        string descriptionHash;        // 简介哈希（加密文本外链，如 IPFS/Arweave）
        string fileHash;               // 文件哈希（图片/视频/音频）
        string[] tags;                 // 标签（明文用于筛选）
        string[] categories;           // 作品类别（可多选，用于排行榜）
        euint32 likesEnc;              // 加密的点赞计数
        uint64 timestamp;              // 上链时间
    }

    struct VoteEntry {
        uint256 artworkId;             // 作品ID
        address voter;                 // 投票者
        string category;               // 类别（明文，用于排行榜与筛选）
        uint64 timestamp;              // 投票时间
    }

    // next ids
    uint256 public nextArtworkId = 1;

    // storage
    mapping(uint256 => Artwork) private _artworks;
    uint256[] private _artworkIds;

    // 投票计数：按 (artworkId, category) 聚合，加密存储。
    mapping(uint256 => mapping(bytes32 => euint32)) private _votesByArtworkAndCategory;
    mapping(uint256 => mapping(bytes32 => bool)) private _votesInitialized;

    // 事件
    event ArtworkUploaded(uint256 indexed artworkId, address indexed artist, string title);
    event ArtworkLiked(uint256 indexed artworkId, address indexed liker);
    event ArtworkVoted(uint256 indexed artworkId, address indexed voter, string category);

    /// @notice 匿名上传作品。计数器以 FHE 初始化为 0，并将解密权限授予合约与作者。
    function uploadArtwork(
        string calldata title,
        string calldata descriptionHash,
        string calldata fileHash,
        string[] calldata tags,
        string[] calldata categories
    ) external returns (uint256 artworkId) {
        artworkId = nextArtworkId++;

        euint32 likes = FHE.asEuint32(0);

        Artwork storage a = _artworks[artworkId];
        a.id = artworkId;
        a.artist = msg.sender;
        a.title = title;
        a.descriptionHash = descriptionHash;
        a.fileHash = fileHash;
        a.timestamp = uint64(block.timestamp);
        a.likesEnc = likes;

        for (uint256 i = 0; i < tags.length; i++) {
            a.tags.push(tags[i]);
        }
        
        for (uint256 i = 0; i < categories.length; i++) {
            a.categories.push(categories[i]);
        }

        // 授权：合约自身与作者可以访问/授权 likesEnc
        FHE.allowThis(a.likesEnc);
        FHE.allow(a.likesEnc, msg.sender);

        _artworkIds.push(artworkId);

        emit ArtworkUploaded(artworkId, msg.sender, title);
    }

    /// @notice 点赞（加密计数 +1）。
    /// @dev 使用明文 1 做标量加法，省 gas；同时将最新值授权给合约、作者与点赞者（临时授权可选）。
    function likeArtwork(uint256 artworkId) external {
        Artwork storage a = _artworks[artworkId];
        require(a.artist != address(0), "Artwork not found");

        // FHE add scalar 1
        a.likesEnc = FHE.add(a.likesEnc, 1);

        // 刷新授权：保持合约与作者可解密，临时授权本次发送者（仅当前 tx）
        FHE.allowThis(a.likesEnc);
        FHE.allow(a.likesEnc, a.artist);
        FHE.allowTransient(a.likesEnc, msg.sender);

        emit ArtworkLiked(artworkId, msg.sender);
    }

    /// @notice 按类别投票（加密计数 +1）。只能对作品所属的类别投票。
    function voteArtwork(uint256 artworkId, string calldata category) external {
        Artwork storage a = _artworks[artworkId];
        require(a.artist != address(0), "Artwork not found");
        
        // 检查作品是否属于该类别
        bool belongsToCategory = false;
        for (uint256 i = 0; i < a.categories.length; i++) {
            if (keccak256(bytes(a.categories[i])) == keccak256(bytes(category))) {
                belongsToCategory = true;
                break;
            }
        }
        require(belongsToCategory, "Artwork does not belong to this category");

        bytes32 catKey = keccak256(bytes(category));
        euint32 current = _votesByArtworkAndCategory[artworkId][catKey];
        if (!_votesInitialized[artworkId][catKey]) {
            current = FHE.asEuint32(0);
            _votesInitialized[artworkId][catKey] = true;
        }
        current = FHE.add(current, 1);
        _votesByArtworkAndCategory[artworkId][catKey] = current;

        // 授权：合约与作者可解密，临时授权投票者（当前 tx）
        FHE.allowThis(current);
        FHE.allow(current, a.artist);
        FHE.allowTransient(current, msg.sender);

        emit ArtworkVoted(artworkId, msg.sender, category);
    }

    /// @notice 获取作品元数据（不含明文点赞数）。
    function getArtwork(uint256 artworkId)
        external
        view
        returns (
            uint256 id,
            address artist,
            string memory title,
            string memory descriptionHash,
            string memory fileHash,
            string[] memory tags,
            string[] memory categories,
            uint64 timestamp,
            euint32 likesHandle
        )
    {
        Artwork storage a = _artworks[artworkId];
        require(a.artist != address(0), "Artwork not found");
        return (
            a.id,
            a.artist,
            a.title,
            a.descriptionHash,
            a.fileHash,
            a.tags,
            a.categories,
            a.timestamp,
            a.likesEnc
        );
    }

    /// @notice 获取全部作品的 ID 列表（用于前端批量查询）。
    function getAllArtworks() external view returns (uint256[] memory ids) {
        return _artworkIds;
    }

    /// @notice 获取某作品在某类别下的投票计数（加密句柄）。
    function getVotes(uint256 artworkId, string calldata category) external view returns (euint32 votesHandle) {
        bytes32 catKey = keccak256(bytes(category));
        return _votesByArtworkAndCategory[artworkId][catKey];
    }
}



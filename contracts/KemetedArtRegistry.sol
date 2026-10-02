// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title KEMETED Art Registry
/// @notice Jumeau numérique des œuvres physiques enregistrées par KEMETED.
///         Un jeton = une œuvre. Le jeton porte l'identifiant KEMETED (ex. KEM-CUL-0001)
///         et l'empreinte SHA-256 du certificat d'origine, gravés une fois pour toutes.
///         Aucune donnée personnelle n'est inscrite on-chain.
contract KemetedArtRegistry is ERC721, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct Artwork {
        string artworkId;
        bytes32 certificateHash;
        uint64 registeredAt;
    }

    uint256 public totalMinted;
    string private _base;

    mapping(uint256 => Artwork) private _artworks;
    mapping(bytes32 => uint256) private _tokenOfArtwork; // keccak(artworkId) => tokenId (0 = aucun)

    event ArtworkRegistered(uint256 indexed tokenId, string artworkId, bytes32 certificateHash);
    event BaseURIChanged(string baseURI);

    error ArtworkAlreadyRegistered(string artworkId, uint256 tokenId);
    error EmptyArtworkId();

    constructor(address admin, address minter, string memory baseURI_) ERC721("KEMETED Art Registry", "KEMART") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _base = baseURI_;
    }

    /// @notice Enregistre une œuvre. Un même identifiant KEMETED ne peut être enregistré qu'une fois.
    function register(address to, string calldata artworkId, bytes32 certificateHash)
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (bytes(artworkId).length == 0) revert EmptyArtworkId();
        bytes32 key = keccak256(bytes(artworkId));
        uint256 existing = _tokenOfArtwork[key];
        if (existing != 0) revert ArtworkAlreadyRegistered(artworkId, existing);

        tokenId = ++totalMinted;
        _tokenOfArtwork[key] = tokenId;
        _artworks[tokenId] = Artwork(artworkId, certificateHash, uint64(block.timestamp));
        _safeMint(to, tokenId);
        emit ArtworkRegistered(tokenId, artworkId, certificateHash);
    }

    function artworkOf(uint256 tokenId) external view returns (Artwork memory) {
        _requireOwned(tokenId);
        return _artworks[tokenId];
    }

    function tokenOfArtwork(string calldata artworkId) external view returns (uint256) {
        return _tokenOfArtwork[keccak256(bytes(artworkId))];
    }

    /// @notice Vérifie qu'un certificat correspond à celui gravé lors de l'enregistrement.
    function verifyCertificate(string calldata artworkId, bytes32 certificateHash) external view returns (bool) {
        uint256 tokenId = _tokenOfArtwork[keccak256(bytes(artworkId))];
        return tokenId != 0 && _artworks[tokenId].certificateHash == certificateHash;
    }

    /// @dev tokenURI = baseURI + identifiant KEMETED (ex. https://…/nft-metadata/KEM-CUL-0001)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_base, _artworks[tokenId].artworkId);
    }

    function setBaseURI(string calldata baseURI_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _base = baseURI_;
        emit BaseURIChanged(baseURI_);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}

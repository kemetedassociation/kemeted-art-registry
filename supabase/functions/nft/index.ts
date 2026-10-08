// Crée (mint) ou transfère le NFT d'une œuvre. Réservé aux administrateurs.
//
// POST { action: "mint", artwork_id }               → grave l'œuvre + l'empreinte du certificat
// POST { action: "transfer", artwork_id, to }        → envoie le NFT au portefeuille du propriétaire
//
// Secrets : MINTER_PRIVATE_KEY (0x…), NFT_CONTRACT (0x…), NFT_CHAIN (base | base-sepolia), RPC_URL (optionnel)
import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, createWalletClient, http, isAddress, parseAbi, parseEventLogs } from "npm:viem@2";
import { privateKeyToAccount } from "npm:viem@2/accounts";
import { base, baseSepolia } from "npm:viem@2/chains";
import { canonicalCertificate, certificateHash } from "../_shared/certificate.js";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

const abi = parseAbi([
  "function register(address to, string artworkId, bytes32 certificateHash) returns (uint256)",
  "function tokenOfArtwork(string artworkId) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function safeTransferFrom(address from, address to, uint256 tokenId)",
  "event ArtworkRegistered(uint256 indexed tokenId, string artworkId, bytes32 certificateHash)",
]);

const chainName = Deno.env.get("NFT_CHAIN") ?? "base-sepolia";
const chain = chainName === "base" ? base : baseSepolia;
const transport = http(Deno.env.get("RPC_URL") || undefined);
const minterKey = Deno.env.get("MINTER_PRIVATE_KEY");
const contract = Deno.env.get("NFT_CONTRACT") as `0x${string}`;
const configured = !!minterKey && !!contract;
const account = configured ? privateKeyToAccount(minterKey as `0x${string}`) : null!;
const pub = createPublicClient({ chain, transport });
const wallet = configured ? createWalletClient({ chain, transport, account }) : null!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!configured) return json({ error: "Blockchain pas encore configurée (contrat non déployé)" }, 503);

  // Vérifie que l'appelant est admin, avec SON jeton (les RLS s'appliquent)
  const asUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: isAdmin } = await asUser.rpc("is_admin");
  if (!isAdmin) return json({ error: "réservé aux administrateurs" }, 403);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { action, artwork_id, to } = await req.json().catch(() => ({}));
  const { data: art } = await db.from("artworks").select("*, artists(name)").eq("id", artwork_id).maybeSingle();
  if (!art) return json({ error: "œuvre introuvable" }, 404);

  try {
    if (action === "mint") {
      if (art.nft_token_id) return json({ error: "NFT déjà créé", token_id: art.nft_token_id }, 409);
      const existing = await pub.readContract({ address: contract, abi, functionName: "tokenOfArtwork", args: [art.id] });
      if (existing !== 0n) return json({ error: `déjà enregistrée on-chain (jeton ${existing})` }, 409);

      const issuedAt = art.certificate_issued_at ?? new Date().toISOString();
      const hash = await certificateHash({ ...art, artist_name: art.artists.name, certificate_issued_at: issuedAt });
      const txHash = await wallet.writeContract({
        address: contract, abi, functionName: "register", args: [account.address, art.id, hash as `0x${string}`],
      });
      const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
      const [event] = parseEventLogs({ abi, logs: receipt.logs, eventName: "ArtworkRegistered" });
      const tokenId = event.args.tokenId.toString();

      // Signature KEMETED du certificat, vérifiable hors ligne sur le téléphone du visiteur
      let offline_signature: string | null = null;
      const jwk = Deno.env.get("OFFLINE_SIGNING_KEY_JWK");
      if (jwk) {
        const key = await crypto.subtle.importKey("jwk", JSON.parse(jwk), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
        const msg = canonicalCertificate({ ...art, artist_name: art.artists.name, certificate_issued_at: issuedAt });
        const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(msg)));
        offline_signature = btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      }
      const { error } = await db.from("artworks").update({
        offline_signature,
        certificate_issued_at: issuedAt, certificate_hash: hash,
        nft_chain: chainName, nft_contract: contract, nft_token_id: tokenId, nft_tx: txHash,
        nft_minted_at: new Date().toISOString(),
      }).eq("id", art.id);
      if (error) throw error;
      return json({ token_id: tokenId, tx: txHash, certificate_hash: hash });
    }

    if (action === "transfer") {
      if (!art.nft_token_id) return json({ error: "pas encore de NFT" }, 400);
      if (typeof to !== "string" || !isAddress(to)) return json({ error: "adresse de portefeuille invalide" }, 400);
      const tokenId = BigInt(art.nft_token_id);
      const holder = await pub.readContract({ address: contract, abi, functionName: "ownerOf", args: [tokenId] });
      if (holder.toLowerCase() !== account.address.toLowerCase()) {
        return json({ error: "le NFT n'est plus détenu par KEMETED : seul son détenteur peut le transférer" }, 409);
      }
      const txHash = await wallet.writeContract({
        address: contract, abi, functionName: "safeTransferFrom", args: [account.address, to, tokenId],
      });
      await pub.waitForTransactionReceipt({ hash: txHash });
      return json({ tx: txHash });
    }

    return json({ error: "action inconnue" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message?.slice(0, 300) ?? "erreur blockchain" }, 502);
  }
});

# KEMETED Art Registry

Passeport numérique des œuvres accompagnées par KEMETED. Une puce NFC sécurisée sur l'œuvre, un QR code, une fiche officielle, un certificat et un NFT sur la blockchain Base.

## Tester tout de suite (mode démo)

```bash
npm install
npm run dev            # puis ouvrir http://localhost:5190
```

Sans configuration Supabase, le site tourne en **mode démo** : œuvres fictives, données dans le navigateur.
Le lien « Simuler un scan NFC » du bandeau ouvre la fiche avec un vrai code de puce (vecteur officiel NXP), vérifié cryptographiquement :

| Essai | Résultat attendu |
| --- | --- |
| 1er clic sur « Simuler un scan NFC » | Œuvre authentifiée |
| Recharger la page | Authentifiée (vérifiée il y a X min) : le code a été retiré de l'adresse |
| Rouvrir le même lien dans un autre onglet | Ce lien a déjà servi (copie détectée) |
| `/a/?id=KEM-CUL-0003&p=…&m=…` (même code, autre œuvre) | Cette puce appartient à une autre œuvre |
| `/a/?id=KEM-CUL-0002` | Fiche officielle (QR code) |
| `/a/?id=KEM-CUL-9999` | Identifiant inconnu du registre |

L'espace admin (`/admin/`) permet d'enregistrer artistes, œuvres et expositions, de lier une puce, de générer le QR code, d'enregistrer une vente et de créer le NFT (simulé en démo). « Réinitialiser la démo » remet les données d'origine.

## Structure

```
index.html                 registre public (liste des œuvres)
a/index.html               passeport d'une œuvre : /a/?id=KEM-CUL-0001
admin/index.html           espace KEMETED
proprietaire/index.html    espace propriétaire (contenus réservés, ouvert par code d'accès)
assets/                    styles, config publique, couche de données (Supabase ou démo)
supabase/migrations/       schéma Postgres + sécurité RLS
supabase/functions/
  verify-scan/             vérifie un scan NFC (signature SUN, anti-rejeu) ou QR
  nft/                     crée / transfère le NFT (admins seulement)
  nft-metadata/            métadonnées ERC-721 lues par les portefeuilles
  _shared/sun.js           cryptographie NTAG 424 DNA (testée sur les vecteurs NXP)
  _shared/certificate.js   certificat canonique + empreinte SHA-256 (navigateur et serveur)
contracts/                 contrat ERC-721 KemetedArtRegistry (OpenZeppelin 5)
scripts/                   compilation et déploiement du contrat
tests/                     tests SUN et contrat
```

## Tests

```bash
npm test                 # cryptographie SUN : vecteurs NXP AN12196 + RFC 4493
npm run test:contract    # contrat sur une blockchain locale Hardhat
```

## Mise en production

### 1. Supabase (nouveau projet dédié)

1. Créer un projet sur supabase.com (région Europe).
2. Exécuter les fichiers de `supabase/migrations/` dans l'ordre, dans l'éditeur SQL.
3. Créer le compte administrateur (Authentication → Users → Add user), puis :
   ```sql
   insert into public.admins(user_id) select id from auth.users where email = 'kemeted.association@gmail.com';
   ```
4. Mettre `SUPABASE_URL` et la clé `anon` dans `assets/config.js` (clés publiques, protégées par les règles RLS).
5. Déployer les fonctions :
   ```bash
   supabase functions deploy verify-scan nft nft-metadata --project-ref <ref>
   ```

### 2. Clés des puces NFC

Générer deux clés AES-128 aléatoires et les garder hors du dépôt :

```bash
node -e "console.log(crypto.randomBytes(16).toString('hex'))"   # deux fois
supabase secrets set SUN_META_KEY=<clé1> SUN_FILE_KEY=<clé2> --project-ref <ref>
```

Ces mêmes clés sont programmées dans chaque puce (clés 1 et 2). Ne jamais les perdre : sans elles, plus aucune puce ne peut être vérifiée.

### 3. Blockchain (Base)

1. Créer deux portefeuilles : **admin** (gardé hors ligne, idéalement un Safe multisignature) et **minter** (utilisé par le serveur, quelques euros d'ETH sur Base).
2. Tester d'abord sur Base Sepolia (ETH de test gratuit) :
   ```bash
   DEPLOYER_PRIVATE_KEY=0x… MINTER_ADDRESS=0x… CHAIN=base-sepolia \
   BASE_URI=https://<ref>.supabase.co/functions/v1/nft-metadata/ npm run deploy
   ```
3. Secrets côté serveur :
   ```bash
   supabase secrets set MINTER_PRIVATE_KEY=0x… NFT_CONTRACT=0x… NFT_CHAIN=base-sepolia PUBLIC_SITE_URL=https://registry.kemeted.org --project-ref <ref>
   ```
4. Mettre `NFT_CONTRACT`, `NFT_CHAIN`, `RPC_URL`, `EXPLORER_URL` dans `assets/config.js`.
5. Pour passer en production, refaire les étapes 2 à 4 avec `CHAIN=base`. Les NFT de test ne sont pas migrés.

### 4. Hébergement

Site statique sans étape de compilation : GitHub Pages (racine du dépôt), sur un sous-domaine en **https** (ex. `registry.kemeted.org`). L'adresse ne doit plus changer une fois les puces programmées, car elle est inscrite dedans.

### 5. Programmer une puce (NTAG 424 DNA)

Outils : lecteur USB (ex. ACR1252U) + NXP TagXplorer, ou une application Android compatible SUN.
L'espace admin affiche pour chaque œuvre l'URL à écrire et les offsets exacts (PICCDataOffset, SDMMACOffset). Ensuite :

1. Écrire l'URL NDEF et activer SDM avec miroir UID + compteur.
2. Mettre SUN_META_KEY en clé 1 et SUN_FILE_KEY en clé 2, puis changer la clé maître (clé 0).
3. Scanner la puce : son UID apparaît (journal des scans, « puce inconnue »). Le lier à l'œuvre dans l'admin.
4. Coller la puce sous le châssis avec une étiquette anti-décollement. Coller le QR code sur le cartel.

## Médias et espace propriétaire

Dans l'admin, chaque œuvre peut recevoir des vidéos et des audios de l'artiste :

- **Public** : affichés sur la fiche, section « Rencontre avec l'artiste ».
- **Propriétaire** : visibles seulement dans `/proprietaire/?id=…`, avec le code d'accès généré dans l'admin. Le lien à remettre à l'acheteur porte le code après `#`, il n'est donc jamais transmis aux serveurs. Après une revente, générer un nouveau code coupe l'accès de l'ancien propriétaire.

Les vidéos de plus de 50 Mo vont sur YouTube (non répertoriée) ou Vimeo : on colle le lien. Les fichiers réservés téléversés sont rangés dans un dossier aléatoire non listable.

## Ce que le système garantit

- **Garanti** : une fausse puce ne peut pas produire de signature valide. Un lien copié est détecté au 2e usage. Une puce déplacée vers une autre fiche est signalée. Le certificat d'origine ne peut pas être modifié sans que la vérification blockchain échoue.
- **Non garanti** : qu'une puce authentique n'a pas été décollée et posée sur une copie. Les photos de détail sur la fiche servent à cette comparaison.
- **Vie privée** : aucune donnée personnelle on-chain. Le nom du propriétaire n'est public qu'avec son consentement.

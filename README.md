# Études Marché IA

Crée « Études de Marché IA » — une application web interne pour Marketing Confort, 100 % en FRANÇAIS. C'est le front-end d'un backend FastAPI DÉJÀ DÉPLOYÉ qui automatise des études de marché e-commerce. Pas d'authentification, pas de Supabase, pas de backend Lovable : l'app appelle directement l'API REST existante. NE JAMAIS mocker les données — en cas d'échec réseau, afficher les états d'erreur prévus.

## API BACKEND (existante, à consommer telle quelle)
Base URL : https://market-research-backend-zhz2.onrender.com — centralisée dans un seul module (src/lib/api.ts). Utiliser React Query pour le cache et le polling.

1) POST /products — body {name, description, category, region, image_url?} → 201 {id, name, description, category, region, image_url, created_at, updated_at}. IMPORTANT : la création d'un produit déclenche AUTOMATIQUEMENT une étude côté serveur.
2) POST /products/extract — body {url, region, use_agent: boolean} → 201 {product: {…comme ci-dessus}, source_url, warnings: string[]}. Appel SYNCHRONE et LENT (10 s à 2 min) : timeout fetch de 3 min et loader avec messages d'étape rotatifs (« Chargement de la page… », « Lecture de la fiche produit… », « Peut prendre jusqu'à 2 minutes »). Erreurs : 422 (URL/région invalide ou page trop incomplète), 502 (page non chargeable), 504 (délai dépassé) — afficher le `detail` FastAPI.
3) POST /studies — body {product_id, region} → 202 (étude créée). 409 = une étude est déjà active pour ce couple produit/région : le corps est {"detail": {"message": "...", "study_id": "..."}} → NE PAS afficher d'erreur, naviguer vers cette étude avec un toast d'information.
4) GET /studies?product_id=&status=&limit=&offset= → {items: Study[], total, limit, offset}, tri created_at décroissant.
   Study = {id, product_id, region, langue, devise, status, trigger_source, progress, error, started_at, finished_at, created_at, updated_at}. ATTENTION : PAS de nom de produit dans la réponse (voir cache produits plus bas). Parser défensivement : si un futur champ nom de produit apparaît, l'utiliser en priorité.
5) GET /studies/{id} → un Study. C'est l'endpoint à POLLER toutes les 6 s tant que status ∈ {created, collecting, analyzing, reporting}.
6) GET /studies/{id}/sources → {items: [{source, status: "succeeded"|"failed"|"skipped_region", error, exit_code, duration_seconds}], total}. Les sources apparaissent au fil de la collecte.
7) GET /studies/{id}/sources/{source} → {id, study_id, source, status, error, exit_code, duration_seconds, payload, created_at, updated_at}. Sources valides : google_trends, reddit, recherche_web, aliexpress, amazon, meta_ads. Un 404 signifie « ce collecteur n'a pas encore écrit sa ligne » (normal pendant la collecte). Les payloads peuvent peser plusieurs Mo → charger à la demande, cache en mémoire par étude.

Statuts d'étude : created, collecting, analyzing, reporting (actifs → pastille bleue pulsante) ; completed (vert), partial (ambre, « Étude partielle »), failed (rouge). Une étude dure 30 à 60 minutes.

`progress` (objet jsonb) : une clé par module, valeur = objet avec des champs du type status / exit_code / duration_seconds / horodatage (parser défensivement, ne jamais planter sur une clé inconnue). Modules et libellés FR :
- Collecteurs : google_trends « Google Trends », reddit « Reddit », recherche_web « Recherche web », aliexpress « AliExpress », amazon « Amazon », meta_ads « Meta Ads »
- Analyses : f3_insights « Insights consommateurs (F3) », f4_concurrence « Analyse concurrentielle (F4) », f5_verdict « Verdict stratégique (F5) », f6_plc « Cycle de vie produit (F6) », f7_rapport « Rapport final (F7) »
- Clé spéciale phase_durations {collecting, analyzing, reporting, total} en secondes → à afficher comme durées, pas comme module.

## LAYOUT — inspiré de l'interface Claude.ai (claude.ai), thème bleu
Structure à deux zones, identique à Claude : une sidebar gauche fixe (~280 px, repliable, drawer sur mobile) et une zone principale centrée (max-w ~880 px).

SIDEBAR (l'équivalent de l'historique des conversations de Claude, mais pour les ÉTUDES) :
- En-tête : petit logo carré arrondi bleu avec icône graphique + « Études de Marché ».
- Bouton primaire bleu « + Nouvelle étude ».
- Champ de recherche + filtre statut (Toutes / En cours / Terminées / Échouées).
- Liste des études (GET /studies, limit 50, rafraîchie toutes les 30 s), groupée par date comme Claude : « Aujourd'hui », « 7 derniers jours », « Plus ancien ». Chaque entrée : nom du produit (depuis le cache localStorage productNames[product_id] = {name, image_url}, sinon « Étude {8 premiers caractères de l'id} »), badge région (MA/FR/ES/US/AE), pastille de statut colorée (pulsante si active), date relative en français (« il y a 2 h »). Entrée active surlignée bleu très pâle.

ZONE PRINCIPALE — Route « / » : écran « Nouvelle étude » (l'équivalent de l'accueil de Claude) :
- Grand titre serif accueillant centré : « Quelle étude de marché lançons-nous ? » + sous-titre.
- Carte centrale avec 2 onglets (segmented control) :
  1. « Depuis une URL produit » : champ URL (placeholder https://…/produit), sélecteur de région, interrupteur « Extraction assistée par IA » (use_agent, activé par défaut, aide contextuelle) → POST /products/extract.
  2. « Saisie manuelle » : Nom du produit, Description (textarea), Catégorie, Région, URL d'image (optionnel) → POST /products.
- Sélecteur de région commun (obligatoire) avec drapeaux : 🇲🇦 Maroc (MA), 🇫🇷 France (FR), 🇪🇸 Espagne (ES), 🇺🇸 États-Unis (US), 🇦🇪 Émirats arabes unis (AE).
- Après un 201 : enregistrer le produit dans le cache localStorage, puis retrouver l'étude auto-créée : GET /studies?product_id={id}&limit=1 (réessayer 3 fois sur ~6 s si vide ; si toujours vide, POST /studies ; si 409, utiliser detail.study_id) → naviguer vers /etudes/{study_id}.
- Note discrète sous la carte : « Une étude complète dure 30 à 60 minutes ».

Route « /etudes/:id » : VUE ÉTUDE :
- En-tête : nom du produit (cache, sinon id court) en serif, badges région/langue/devise, badge de statut, dates début/fin, durée totale si phase_durations.total, bouton secondaire « Relancer l'étude » (POST /studies {product_id, region} ; 409 → naviguer vers l'étude active avec toast).
- ÉTUDE ACTIVE : timeline horizontale des 3 phases (Collecte → Analyse → Rapport) avec l'état courant, barre de progression globale (modules avec status terminé / 11), grille des 11 modules (carte compacte : icône ✓ vert / spinner bleu / ✗ rouge / « — » gris, libellé FR, durée en s si finie). Polling GET /studies/{id} toutes les 6 s. Les bandes sources (ci-dessous) apparaissent progressivement dès qu'une source est disponible.
- ÉTUDE FAILED : carte d'erreur rouge claire avec study.error et bouton « Relancer l'étude ».
- ÉTUDE COMPLETED/PARTIAL : la VUE RÉSULTATS ci-dessous. Si partial, bandeau ambre « Étude partielle : certaines sources ou analyses ont échoué ».

## VUE RÉSULTATS — le cœur de l'app, rendu très professionnel
1. QUATRE BANDES D'IMAGES HORIZONTALES à défilement horizontal (scroll-snap, scrollbar masquée, boutons flèches ‹ › en survol, cartes ~200 px de large, images en lazy loading). Données : GET /studies/{id}/sources/{source}, chargées en parallèle avec skeletons, max 12 éléments par bande + puce « +N autres » en fin de bande. Toute image en erreur (onError) → placeholder élégant (dégradé bleu pâle + initiale), JAMAIS d'icône d'image cassée. Source failed → bande repliée « Source indisponible » ; skipped_region → « Source non couverte pour cette région ».
   a) « Produits AliExpress » — liste dans payload.produits[]. Carte : image = champ `image` ; `titre` (2 lignes max, ellipsis) ; prix = `prix_formate` (sinon `prix_vente` + `devise`) en bleu gras ; `prix_original` barré + badge « -{remise_pourcentage arrondi} % » si présents ; « ★ {note} · {nb_commandes} commandes ». Clic → `url_produit` (nouvel onglet).
   b) « Produits Amazon » — payload.produits[]. Carte : `image`, `titre`, prix = `prix` + `devise` (avec `prix_barre` barré si présent), « ★ {note} ({nb_avis} avis) », `marque` en petit. Clic → `url`.
   c) « Annonces Meta » — payload.annonces[]. Carte : média = `image` si non null ; sinon si `type_media` === "video" → vignette sombre avec icône lecture et badge « Vidéo » (NE PAS charger la vidéo, les URLs fbcdn expirent) ; `annonceur` en gras, `titre`, `texte` (3 lignes max), badge bleu `cta`, « Diffusée depuis {duree_diffusion_jours} j », petites icônes selon `plateformes` (facebook/instagram). Clic → `url_bibliotheque`.
   d) « Offres web retenues » — payload.pages[]. PAS de champ image : extraire la PREMIÈRE image du champ `contenu_markdown` (regex sur ![alt](url), sinon première URL en .jpg/.jpeg/.png/.webp) ; à défaut, carte avec favicon https://www.google.com/s2/favicons?sz=128&domain={domaine} sur fond dégradé bleu pâle. Afficher `titre`, `domaine`, badge selon `type_source` (site_marchand → « Marchand », comparateur → « Comparateur », sinon la valeur), petite jauge `pertinence`. Trier : type_source "site_marchand" d'abord. Clic → `url`.
2. Carte « Analyses réalisées » : les 5 modules d'analyse (F3→F7) avec leur état et durée depuis progress, + bandeau info discret : « Le rapport complet (verdict, recommandations) sera disponible dans une prochaine version du backend ».
3. Section repliable « Détail de la collecte » : tableau des 6 sources depuis /sources (libellé FR, badge de statut Succès / Échec / Région non couverte, durée en s, message d'erreur éventuel) + bouton « JSON brut » par source ouvrant un modal : payload joliment formaté (max-height scrollable, tronqué à ~200 Ko avec bouton « Télécharger le JSON » qui télécharge le payload complet en fichier .json).

## DESIGN SYSTEM — le look Claude, accent bleu
- Fond général crème chaud très clair #FAF9F5 ; surfaces blanches ; sidebar légèrement plus foncée #F2F0E9 ; bordures subtiles #E7E4DB.
- Texte : anthracite chaud #1F1E1B, secondaire #6E6A60.
- ACCENT BLEU partout où Claude utilise son corail : primaire #2761D8 (hover #1E4FB8), fonds actifs bleu très pâle #EAF0FC, focus rings bleus.
- Statuts : actif #2761D8 (pastille pulsante), completed #178A50, partial #B7791F, failed #C6392E, skipped gris.
- Typographie : titres en serif élégante « Lora » (Google Fonts), corps en « Inter ». Grands titres serif comme l'accueil de Claude.
- Arrondis généreux (rounded-xl/2xl), ombres très douces, transitions discrètes, beaucoup d'air. Dates et nombres au format fr-FR.

## ROBUSTESSE
- Le backend est sur Render : premier appel après une période d'inactivité = démarrage à froid (~1 min). Sur échec réseau/timeout d'un GET : bandeau « Le serveur se réveille, nouvelle tentative… » + 3 retries avec backoff.
- Toasts d'erreur en français avec le `detail` FastAPI quand présent. États vides élégants (aucune étude → invitation à créer la première).
- Aucune clé secrète côté front. Si un appel échoue en CORS dans la préview, ne pas contourner ni mocker : l'équipe backend ajoutera le middleware CORS.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71c3289a-44ed-4309-9605-41d1739bf08f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# Mapora

Mapora est une application cartographique desktop offline permettant d’explorer le monde sans connexion Internet. Elle fournit une carte mondiale détaillée incluant les frontières administratives, les réseaux hydrographiques et des points d’intérêt touristiques, le tout dans une application légère et rapide basée sur Tauri.

---

## Fonctionnalités

### Cartographie offline

* Carte mondiale vectorielle utilisable sans connexion Internet
* Navigation fluide (zoom, déplacement, rotation)
* Rendu haute performance via WebGL

### Données géographiques

* Frontières des pays et régions administratives
* Fleuves, rivières, lacs et océans
* Villes et zones urbaines

### Points d’intérêt touristiques

* Monuments historiques
* Musées
* Parcs nationaux
* Sites culturels et attractions

### Application desktop

* Interface native via Tauri
* Léger et performant
* Compatible Windows, Linux et macOS

---

## Architecture

### Backend (Quarkus)

* API REST pour la gestion des données géographiques
* Distribution des packs cartographiques offline
* Pipeline de génération et de transformation des tuiles vectorielles

### Frontend (Tauri + Web UI)

* Interface utilisateur moderne
* Intégration de MapLibre GL pour le rendu cartographique
* Gestion du cache local des cartes

### Pipeline de données

* Utilisation des données OpenStreetMap
* Génération de tuiles vectorielles (MBTiles / PMTiles)
* Filtrage et enrichissement des points d’intérêt touristiques

---

## Stack technique

### Backend

* Java 21+
* Quarkus
* RESTEasy Reactive
* PostgreSQL (optionnel)
* PostGIS (optionnel pour extensions géospatiales)

### Frontend

* Tauri (Rust + WebView)
* TypeScript
* Angular
* MapLibre GL JS

### Traitement des données

* Planetiler (génération de tuiles)
* Osmium (filtrage et extraction OpenStreetMap)

---

## Structure du projet

```txt
atlasvault/
│
├── backend/               # Application Quarkus
│   ├── src/
│   └── build-tools/
│
├── frontend/              # Application Tauri
│   ├── src/
│   ├── public/
│   └── tauri/
│
├── data-pipeline/         # Scripts de traitement des données
│   ├── scripts/
│   ├── configs/
│
├── maps/                  # Cartes générées offline
│   └── world.mbtiles
│
└── README.md
```

---

## Pipeline de génération des cartes

1. Téléchargement des données OpenStreetMap
2. Filtrage des entités géographiques pertinentes

   * tourisme
   * hydrographie
   * frontières
   * villes
3. Génération des tuiles vectorielles via Planetiler
4. Export en MBTiles ou PMTiles
5. Distribution via l’application ou le backend

---

## Mode offline

Mapora est conçu pour fonctionner entièrement hors ligne après installation initiale :

* Cartes stockées localement
* Base de données de points d’intérêt embarquée
* Aucune dépendance à des services externes en runtime

---

## Application desktop

L’application est construite avec Tauri afin d’offrir :

* Une empreinte mémoire réduite
* Des performances natives
* Une installation légère
* Une sécurité renforcée

---

## Licence

GNU AFFERO GENERAL PUBLIC LICENSE V3

---

## Sources de données

Les données cartographiques proviennent d’OpenStreetMap et sont utilisées conformément à la licence Open Database License (ODbL).

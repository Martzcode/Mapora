# Guide de Développement et Lancement

Ce document décrit comment configurer votre environnement, lancer l'application en mode développement, et compiler l'application en mode production.

---

## 📋 Prérequis

Pour exécuter et développer sur Mapora, vous devez avoir installé :
- **Java 21+** (recommandé : Java 21 ou 25)
- **Apache Maven 3.9+** (ou utiliser le wrapper `./mvnw` fourni)
- **Node.js 22+** et **NPM 10+**
- **Rust et Cargo** (requis pour compiler l'application native Tauri)
- **Bibliothèques système Linux** (pour le rendu de la WebView Tauri) :
  Sur Ubuntu/Debian/Fedora, assurez-vous d'avoir installé les paquets de développement requis pour Tauri. Exemple pour Fedora :
  ```bash
  sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget glibc-devel libsoup3-devel
  ```

---

## 🚀 Lancement Rapide (Automatique)

Pour simplifier le développement, un script d'automatisation `start.sh` est disponible à la racine du projet pour installer les dépendances et lancer les services en parallèle :

* **Tout lancer en mode développement (Recommandé) :**
  ```bash
  ./start.sh
  ```
* **Lancer uniquement le backend :**
  ```bash
  ./start.sh backend
  ```
* **Lancer uniquement le frontend :**
  ```bash
  ./start.sh frontend
  ```
* **Installer les dépendances frontend & vérifier les prérequis :**
  ```bash
  ./start.sh install
  ```
* **Compiler le backend et le frontend pour la production :**
  ```bash
  ./start.sh build
  ```

---

## ⚙️ 1. Backend (Quarkus)

Le backend gère l'API REST, les traitements géographiques et distribue les packs de cartes offline.

### Lancer en mode développement (Hot Reloading)

1. Naviguez dans le dossier `backend` :
   ```bash
   cd backend
   ```
2. Lancez Quarkus en mode développement :
   ```bash
   ./mvnw quarkus:dev
   ```
   *Le backend sera accessible sur : **`http://localhost:8080`***

### Compiler pour la production

Pour générer le fichier JAR exécutable de production :
```bash
./mvnw clean package
```

---

## 💻 2. Frontend (Tauri + Angular)

Le frontend utilise Angular pour l'interface utilisateur et Tauri (Rust) pour l'intégration desktop native.

### Installer les dépendances (NPM)

Avant de lancer le frontend pour la première fois, installez les dépendances :
```bash
cd frontend
npm install
```

### Lancer en mode développement (Desktop App)

Pour démarrer l'application avec le rechargement automatique du code Angular et Rust :
```bash
cd frontend
npm run tauri dev
```
Cette commande va :
1. Lancer le serveur de développement Angular sur `http://localhost:1420`.
2. Compiler le code Rust natif situé dans `src-tauri/`.
3. Ouvrir la fenêtre native de l'application contenant l'interface Angular.

### Compiler pour la production (Générer l'exécutable)

Pour générer l'installateur desktop natif (ex. `.deb`, `.appimage` sous Linux, ou `.msi` sous Windows) :
```bash
cd frontend
npm run tauri build
```
Les exécutables générés se situeront dans le dossier `frontend/src-tauri/target/release/bundle/`.

---

## 🗂️ 3. Pipeline de Données & Cartes

- **`data-pipeline/`** : Contient les scripts et les configurations pour préparer les cartes vectorielles à partir d'OpenStreetMap (OSM) via des outils comme Planetiler ou Osmium.
- **`maps/`** : Emplacement destiné à stocker le fichier final `world.mbtiles` qui sera servi par le backend et lu localement par l'application pour le fonctionnement 100% offline.

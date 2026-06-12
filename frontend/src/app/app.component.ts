import { Component, OnInit, AfterViewInit, Inject, PLATFORM_ID, NgZone } from "@angular/core";
import { CommonModule, isPlatformBrowser } from "@angular/common";
import { FormsModule } from "@angular/forms";
import * as L from "leaflet";

interface Place {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  category: 'city' | 'monument' | 'nature';
  categoryLabel: string;
  lat: number;
  lng: number;
  zoom: number;
  description: string;
  population?: string;
  area?: string;
  elevation?: string;
  facts: string[];
  pois: { name: string; type: string; desc: string }[];
}

interface SearchSuggestion {
  name: string;
  subtitle: string;
  lat: number;
  lng: number;
  country: string;
  countryCode: string;
  extratags?: any;
}

@Component({
  selector: "app-root",
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
})
export class AppComponent implements OnInit, AfterViewInit {
  // Application Title
  appName = "Mapora";
  appSub = "Offline Explorer";

  // Backend Connection
  isBackendConnected = false;
  backendMessage = "";

  // Search & Filter
  searchQuery = "";
  selectedCategory: 'all' | 'city' | 'monument' | 'nature' = 'all';
  filteredPlaces: Place[] = [];
  searchSuggestions: SearchSuggestion[] = [];

  // Selected place
  selectedPlace: Place | null = null;
  activeMarkerId: string | null = null;

  // Map settings
  map!: L.Map;
  tileLayer!: L.TileLayer;
  markersGroup!: L.LayerGroup;
  customMarkerGroup!: L.LayerGroup;
  currentStyle: 'voyager' | 'dark' | 'osm' | 'local' = 'voyager';

  // Tile styles configurations
  stylesConfig = {
    voyager: {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    },
    dark: {
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    osm: {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: '&copy; OpenStreetMap contributors'
    },
    local: {
      url: "http://localhost:8080/tiles/{z}/{x}/{y}.png",
      attribution: 'Mapora Local Offline Tiles'
    }
  };

  places: Place[] = [];

  // IDs des zones intégrées par défaut — ne peuvent pas être supprimées
  private readonly BUILTIN_IDS = new Set<string>();

  private readonly STORAGE_KEY = 'mapora_saved_zones';

  constructor(@Inject(PLATFORM_ID) private platformId: Object, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.loadSavedZones();
    this.filteredPlaces = [...this.places];
    this.checkBackendConnection();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      // Small delay ensures the WebView (Tauri) has finished its initial
      // layout pass before Leaflet reads the container dimensions.
      // Without this, Leaflet sees a 0×0 container and renders grey tiles.
      setTimeout(() => this.initMap(), 50);
    }
  }

  // Check Quarkus backend connection status
  checkBackendConnection(): void {
    fetch("http://localhost:8080/hello")
      .then(res => {
        if (res.ok) {
          return res.text();
        }
        throw new Error("Erreur de connexion");
      })
      .then(text => {
        this.isBackendConnected = true;
        this.backendMessage = "Serveur local connecté !";
      })
      .catch(err => {
        this.isBackendConnected = false;
        this.backendMessage = "Mode autonome hors-ligne";
      });
  }

  // Initialize Leaflet Map
  initMap(): void {
    // Fix Leaflet's broken default icon URLs in WebView / Tauri environments.
    // The default paths reference webpack-bundled assets that don't resolve
    // correctly when running inside a native WebView window.
    const iconDefault = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41]
    });
    L.Marker.prototype.options.icon = iconDefault;

    // Standard starting position: center of Europe/Mediterranean
    this.map = L.map("map", {
      zoomControl: false, // will use custom styles/position
      center: [40, 5],
      zoom: 3,
      minZoom: 2,
      maxZoom: 18
    });


    // Add zoom control to top right for better UI flow
    L.control.zoom({ position: "topright" }).addTo(this.map);

    // Initial tile layer (Google maps default style like - Cartodb Voyager)
    this.tileLayer = L.tileLayer(this.stylesConfig.voyager.url, {
      attribution: this.stylesConfig.voyager.attribution,
      maxZoom: 18
    }).addTo(this.map);

    this.markersGroup = L.layerGroup().addTo(this.map);
    this.customMarkerGroup = L.layerGroup().addTo(this.map);

    // Populate default place markers
    this.renderPlaceMarkers();

    // Setup map click event handler
    this.map.on("click", (e: L.LeafletMouseEvent) => {
      this.ngZone.run(() => {
        const { lat, lng } = e.latlng;
        this.reverseGeocode(lat, lng);
      });
    });

    // Force Leaflet to recalculate container dimensions.
    // Critical fix for Tauri WebView: tiles may appear grey if Leaflet
    // initialises before the WebView has painted at full size.
    setTimeout(() => this.map.invalidateSize(), 100);
    setTimeout(() => this.map.invalidateSize(), 500);

    // Keep the map responsive to window / WebView resize events
    window.addEventListener('resize', () => {
      this.map.invalidateSize();
    });
  }

  // Render pre-configured places on map
  renderPlaceMarkers(): void {
    this.markersGroup.clearLayers();
    this.places.forEach(place => {
      // Determine if active
      const isActive = this.selectedPlace && this.selectedPlace.id === place.id;
      
      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="marker-pin ${isActive ? 'active' : ''}"></div><div class="marker-label">${place.name}</div>`,
        iconSize: [30, 42],
        iconAnchor: [15, 30]
      });

      const marker = L.marker([place.lat, place.lng], { icon: customIcon });
      
      marker.on("click", () => {
        this.ngZone.run(() => {
          this.selectPlace(place);
        });
      });

      this.markersGroup.addLayer(marker);
    });
  }

  // Change Map styling on the fly
  changeStyle(styleName: 'voyager' | 'dark' | 'osm' | 'local'): void {
    this.currentStyle = styleName;
    const config = this.stylesConfig[styleName];
    
    // Update active tile layer
    this.map.removeLayer(this.tileLayer);
    this.tileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 18
    }).addTo(this.map);
  }

  // Select place from list or click
  selectPlace(place: Place): void {
    this.selectedPlace = place;
    this.activeMarkerId = place.id;
    this.searchSuggestions = []; // Clear suggestions
    
    // Fly to position smoothly
    this.map.flyTo([place.lat, place.lng], place.zoom, {
      animate: true,
      duration: 1.5
    });

    // Re-render markers to update active class
    this.renderPlaceMarkers();
    this.customMarkerGroup.clearLayers(); // clear custom click pin when selecting catalog place
  }

  // Filter list based on sidebar search input
  filterPlaces(query: string): void {
    this.searchQuery = query;
    const lowerQuery = query.toLowerCase().trim();

    // Local filter
    this.filteredPlaces = this.places.filter(place => {
      const matchQuery = place.name.toLowerCase().includes(lowerQuery) ||
                         place.country.toLowerCase().includes(lowerQuery) ||
                         place.description.toLowerCase().includes(lowerQuery);
      
      const matchCategory = this.selectedCategory === 'all' || place.category === this.selectedCategory;
      
      return matchQuery && matchCategory;
    });

    // Fetch live search suggestions if connected online (smart autocomplete)
    if (lowerQuery.length > 2) {
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(lowerQuery)}&limit=5&addressdetails=1&extratags=1`, {
        headers: {
          'Accept-Language': 'fr'
        }
      })
      .then(res => res.json())
      .then(data => {
        if (data && data.length > 0) {
          this.searchSuggestions = data.map((item: any) => {
            const name = item.display_name.split(',')[0];
            const sub = item.display_name.split(',').slice(1, 3).join(',').trim();
            const country = item.address ? item.address.country : '';
            const cc = item.address ? item.address.country_code : '';
            return {
              name: name,
              subtitle: sub || country,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              country: country,
              countryCode: cc,
              extratags: item.extratags
            };
          });
        } else {
          this.searchSuggestions = [];
        }
      })
      .catch(() => {
        this.searchSuggestions = []; // Fail silently if offline or blocked
      });
    } else {
      this.searchSuggestions = [];
    }
  }

  // Set category filter
  setCategory(category: 'all' | 'city' | 'monument' | 'nature'): void {
    this.selectedCategory = category;
    this.filterPlaces(this.searchQuery);
  }

  // Clear search bar
  clearSearch(): void {
    this.searchQuery = "";
    this.searchSuggestions = [];
    this.filterPlaces("");
  }

  // Select a suggestion from the live search
  selectSuggestion(sug: SearchSuggestion): void {
    const flag = this.getFlagEmoji(sug.countryCode);
    const newPlace: Place = {
      id: `custom_${Date.now()}`,
      name: sug.name,
      country: sug.country || "Monde",
      countryCode: flag,
      category: 'city',
      categoryLabel: "Zone Recherchée",
      lat: sug.lat,
      lng: sug.lng,
      zoom: 13,
      description: `Zone trouvée via la recherche globale à ${sug.name}, ${sug.subtitle}.`,
      facts: [
        `Latitude : ${sug.lat.toFixed(6)}`,
        `Longitude : ${sug.lng.toFixed(6)}`,
        `Pays : ${sug.country || 'Inconnu'}`
      ],
      pois: [
        { name: "Point de recherche", type: "Recherche", desc: "Localisation trouvée via l'index de recherche Nominatim." }
      ]
    };

    this.selectedPlace = newPlace;
    this.activeMarkerId = newPlace.id;
    this.searchSuggestions = [];
    this.searchQuery = sug.name;

    // Fly to position
    this.map.flyTo([sug.lat, sug.lng], 13, {
      animate: true,
      duration: 1.5
    });

    // Render single custom search marker
    this.customMarkerGroup.clearLayers();
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin active"></div><div class="marker-label">${sug.name}</div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 30]
    });
    const marker = L.marker([sug.lat, sug.lng], { icon: customIcon });
    this.customMarkerGroup.addLayer(marker);

    // Refresh catalog markers (de-select catalog highlight)
    this.renderPlaceMarkers();

    // Fetch details dynamically from Wikipedia, Wikidata, and Overpass APIs
    this.fetchAdditionalDetails(newPlace, sug.extratags);
  }

  // Reverse geocoding on click
  reverseGeocode(lat: number, lng: number): void {
    // Highlight coordinate click
    this.customMarkerGroup.clearLayers();
    
    // Quick loader/preview while loading Nominatim
    const tempFlag = '🌐';
    this.selectedPlace = {
      id: 'custom_click',
      name: `Point : ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
      country: 'Chargement...',
      countryCode: tempFlag,
      category: 'nature',
      categoryLabel: 'Position',
      lat: lat,
      lng: lng,
      zoom: this.map.getZoom(),
      description: `Identification de la zone géographique en cours...`,
      facts: [
        `Latitude: ${lat.toFixed(6)}`,
        `Longitude: ${lng.toFixed(6)}`
      ],
      pois: []
    };

    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin active" style="background: #22c55e;"></div><div class="marker-label">Clic : ${lat.toFixed(3)}</div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 30]
    });
    const marker = L.marker([lat, lng], { icon: customIcon });
    this.customMarkerGroup.addLayer(marker);

    // Fetch information
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1&extratags=1`, {
      headers: {
        'Accept-Language': 'fr'
      }
    })
    .then(res => res.json())
    .then(data => {
      if (data && data.address) {
        const city = data.address.city || data.address.town || data.address.village || data.address.suburb || data.address.hamlet || 'Lieu-dit';
        const country = data.address.country || 'Inconnu';
        const countryCode = data.address.country_code ? data.address.country_code.toUpperCase() : '🌐';
        const flag = this.getFlagEmoji(countryCode);
        const displayName = data.display_name.split(',')[0] || city;

        const newPlace: Place = {
          id: 'custom_click',
          name: displayName,
          country: country,
          countryCode: flag,
          category: 'nature',
          categoryLabel: 'Zone explorée',
          lat: lat,
          lng: lng,
          zoom: Math.max(this.map.getZoom(), 12),
          description: `Zone située à proximité de ${city}, en ${country}. Adresse complète enregistrée : ${data.display_name}.`,
          facts: [
            `Latitude : ${lat.toFixed(6)}`,
            `Longitude : ${lng.toFixed(6)}`,
            `Code Pays : ${countryCode}`,
            `Élément clé : ${data.type || 'Foncier'}`
          ],
          pois: [
            { name: displayName, type: "Adresse", desc: data.display_name }
          ]
        };

        this.selectedPlace = newPlace;

        // Update active marker label
        this.customMarkerGroup.clearLayers();
        const finalIcon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div class="marker-pin active" style="background: #22c55e;"></div><div class="marker-label">${displayName}</div>`,
          iconSize: [30, 42],
          iconAnchor: [15, 30]
        });
        const finalMarker = L.marker([lat, lng], { icon: finalIcon });
        this.customMarkerGroup.addLayer(finalMarker);

        // Fetch details dynamically from Wikipedia, Wikidata, and Overpass APIs
        this.fetchAdditionalDetails(newPlace, data.extratags);
      }
    })
    .catch(() => {
      // Offline fallback
      this.selectedPlace = {
        id: 'custom_click',
        name: `Point : ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        country: 'Mode Hors-ligne',
        countryCode: '🌐',
        category: 'nature',
        categoryLabel: 'Coordonnées',
        lat: lat,
        lng: lng,
        zoom: this.map.getZoom(),
        description: `Vous avez cliqué sur la carte en mode hors-ligne. Le géocodage inversé nécessite une connexion internet. Les coordonnées physiques ont été enregistrées avec succès.`,
        facts: [
          `Latitude : ${lat.toFixed(6)}`,
          `Longitude : ${lng.toFixed(6)}`
        ],
        pois: []
      };
    });

    // Reset catalog highlights
    this.activeMarkerId = null;
    this.renderPlaceMarkers();
  }

  // Fetch additional details from open source APIs (Wikipedia, Wikidata, Overpass)
  fetchAdditionalDetails(place: Place, extratags: any): void {
    const lat = place.lat;
    const lng = place.lng;
    
    // 1. Identify Wikipedia Page & Wikidata ID
    let wikipediaLang = 'fr';
    let wikipediaTitle = place.name;
    const wikidataId = extratags?.wikidata || null;

    if (extratags?.wikipedia) {
      const parts = extratags.wikipedia.split(':');
      if (parts.length === 2) {
        wikipediaLang = parts[0];
        wikipediaTitle = parts[1];
      }
    }

    // 2. Fetch Wikipedia Summary
    const wikiUrl = `https://${wikipediaLang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaTitle)}`;
    
    fetch(wikiUrl)
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        this.ngZone.run(() => {
          if (data.extract) {
            place.description = data.extract;
            if (this.selectedPlace && this.selectedPlace.id === place.id) {
              this.selectedPlace = { ...place };
            }
            // Update in places array if already saved
            const idx = this.places.findIndex(p => p.id === place.id);
            if (idx !== -1) {
              this.places[idx] = { ...place };
              this.updateSavedZoneInStorage(place);
            }
          }
        });
      })
      .catch(() => {});

    // 3. Fetch Wikidata Info (population, area, elevation)
    if (wikidataId) {
      const wikidataUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=claims&format=json&origin=*`;
      fetch(wikidataUrl)
        .then(res => res.json())
        .then(data => {
          const entity = data.entities?.[wikidataId];
          if (entity && entity.claims) {
            const popVal = this.getWikidataClaimValue(entity.claims, 'P1082');
            const areaVal = this.getWikidataClaimValue(entity.claims, 'P2046');
            const elevVal = this.getWikidataClaimValue(entity.claims, 'P2044');

            this.ngZone.run(() => {
              if (popVal) place.population = `${popVal} hab.`;
              if (areaVal) place.area = `${areaVal} km²`;
              if (elevVal) place.elevation = `${elevVal} m`;

              if (this.selectedPlace && this.selectedPlace.id === place.id) {
                this.selectedPlace = { ...place };
              }
              // Update in places array if already saved
              const idx = this.places.findIndex(p => p.id === place.id);
              if (idx !== -1) {
                this.places[idx] = { ...place };
                this.updateSavedZoneInStorage(place);
              }
            });
          }
        })
        .catch(() => {});
    }
    
    // 4. Fetch local POIs via Overpass API
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=[out:json][timeout:10];(node(around:3000,${lat},${lng})["tourism"~"museum|monument|attraction|viewpoint"];node(around:3000,${lat},${lng})["historic"];);out 5;`;
    fetch(overpassUrl)
      .then(res => res.json())
      .then(data => {
        if (data.elements && data.elements.length > 0) {
          const newPois = data.elements.map((el: any) => {
            let typeLabel = "Attraction";
            if (el.tags.tourism) typeLabel = el.tags.tourism;
            else if (el.tags.historic) typeLabel = el.tags.historic;
            
            typeLabel = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);

            return {
              name: el.tags.name || "Lieu d'intérêt",
              type: typeLabel,
              desc: el.tags.description || el.tags.note || `Point d'intérêt situé à proximité.`
            };
          });

          this.ngZone.run(() => {
            place.pois = newPois;
            if (this.selectedPlace && this.selectedPlace.id === place.id) {
              this.selectedPlace = { ...place };
            }
            // Update in places array if already saved
            const idx = this.places.findIndex(p => p.id === place.id);
            if (idx !== -1) {
              this.places[idx] = { ...place };
              this.updateSavedZoneInStorage(place);
            }
          });
        }
      })
      .catch(() => {});
  }

  // Retrieve numeric/text values from Wikidata Entity claims object
  getWikidataClaimValue(claims: any, prop: string): string | null {
    const claim = claims[prop];
    if (!claim || claim.length === 0) return null;
    const mainsnak = claim[0].mainsnak;
    if (!mainsnak || !mainsnak.datavalue) return null;
    const value = mainsnak.datavalue.value;
    if (typeof value === 'object') {
      if (value.amount) {
        return parseFloat(value.amount).toLocaleString('fr-FR');
      }
      return value.numeric || null;
    }
    return value.toString();
  }

  // Update a saved zone in LocalStorage if details are fetched after initial save
  updateSavedZoneInStorage(place: Place): void {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const saved: Place[] = raw ? JSON.parse(raw) : [];
      const idx = saved.findIndex(p => p.id === place.id);
      if (idx !== -1) {
        saved[idx] = place;
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saved));
      }
    } catch (e) {
      console.warn('[Mapora] Impossible de mettre à jour la zone dans le localStorage :', e);
    }
  }

  // Update a custom marker helper
  updateCustomMarker(lat: number, lng: number, label: string): void {
    this.customMarkerGroup.clearLayers();
    const customIcon = L.divIcon({
      className: 'custom-div-icon',
      html: `<div class="marker-pin active" style="background: #22c55e;"></div><div class="marker-label">${label}</div>`,
      iconSize: [30, 42],
      iconAnchor: [15, 30]
    });
    const marker = L.marker([lat, lng], { icon: customIcon });
    this.customMarkerGroup.addLayer(marker);
  }

  // Generate unicode country flags
  getFlagEmoji(countryCode: string): string {
    if (!countryCode || countryCode === '🌐') return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    try {
      return String.fromCodePoint(...codePoints);
    } catch (e) {
      return '🌐';
    }
  }

  // Copy coordinates to clipboard
  copyCoords(lat: number, lng: number): void {
    const coordsStr = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    navigator.clipboard.writeText(coordsStr).then(() => {
      // Visual feedback can be shown
      alert(`Coordonnées copiées : ${coordsStr}`);
    });
  }

  // Recenter map on selected item
  centerOnSelected(): void {
    if (this.selectedPlace) {
      this.map.flyTo([this.selectedPlace.lat, this.selectedPlace.lng], this.selectedPlace.zoom, {
        animate: true,
        duration: 1.2
      });
    }
  }

  // Close details panel & clear selection
  closeDetails(): void {
    this.selectedPlace = null;
    this.activeMarkerId = null;
    this.customMarkerGroup.clearLayers();
    this.renderPlaceMarkers();
  }

  // ── LocalStorage persistence ──────────────────────────────────────────────

  /** Vérifie si une zone fait partie du catalogue intégré (non supprimable). */
  isBuiltinPlace(place: Place): boolean {
    return this.BUILTIN_IDS.has(place.id);
  }

  /** Vérifie si une zone personnalisée est déjà enregistrée dans le localStorage. */
  isZoneSaved(id: string): boolean {
    if (this.BUILTIN_IDS.has(id)) return true; // built-in = toujours "sauvegardé"
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const saved: Place[] = raw ? JSON.parse(raw) : [];
      return saved.some(p => p.id === id);
    } catch {
      return false;
    }
  }

  /** Charge les zones sauvegardées depuis le localStorage et les fusionne dans la liste. */
  loadSavedZones(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const saved: Place[] = JSON.parse(raw);
      saved.forEach(zone => {
        // Évite les doublons avec les zones intégrées
        if (!this.places.find(p => p.id === zone.id)) {
          this.places.push(zone);
        }
      });
    } catch (e) {
      console.warn('[Mapora] Impossible de charger les zones sauvegardées :', e);
    }
  }

  /** Enregistre la zone actuellement sélectionnée dans le localStorage. */
  saveCurrentZone(): void {
    if (!this.selectedPlace || this.isBuiltinPlace(this.selectedPlace)) return;
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const saved: Place[] = raw ? JSON.parse(raw) : [];
      const alreadySaved = saved.find(p => p.id === this.selectedPlace!.id);
      if (!alreadySaved) {
        saved.push(this.selectedPlace);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(saved));
        // Ajoute également à la liste en mémoire si absent
        if (!this.places.find(p => p.id === this.selectedPlace!.id)) {
          this.places.push(this.selectedPlace);
        }
        this.filterPlaces(this.searchQuery);
      }
    } catch (e) {
      console.warn('[Mapora] Impossible de sauvegarder la zone :', e);
    }
  }

  /** Supprime une zone personnalisée du localStorage et de la liste en mémoire. */
  deleteZone(place: Place): void {
    if (this.isBuiltinPlace(place)) return; // protection
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      const saved: Place[] = raw ? JSON.parse(raw) : [];
      const updated = saved.filter(p => p.id !== place.id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
      // Retire de la liste en mémoire
      this.places = this.places.filter(p => p.id !== place.id);
    } catch (e) {
      console.warn('[Mapora] Impossible de supprimer la zone :', e);
    }
    // Ferme le panneau et rafraîchit
    this.selectedPlace = null;
    this.activeMarkerId = null;
    this.customMarkerGroup.clearLayers();
    this.renderPlaceMarkers();
    this.filterPlaces(this.searchQuery);
  }
}

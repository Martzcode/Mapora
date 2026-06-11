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

  // Main list of offline zones
  places: Place[] = [
    {
      id: "paris",
      name: "Paris",
      country: "France",
      countryCode: "🇫🇷",
      category: "city",
      categoryLabel: "Capitale historique",
      lat: 48.8566,
      lng: 2.3522,
      zoom: 12,
      description: "Paris, capitale de la France, est une grande ville européenne et un centre mondial de l'art, de la mode, de la gastronomie et de la culture. Son paysage urbain du XIXe siècle est traversé par de larges boulevards et la Seine.",
      population: "2,16 millions",
      area: "105,4 km²",
      elevation: "35 m",
      facts: [
        "Surnommée 'La Ville Lumière' pour son rôle au siècle des Lumières.",
        "Plus de 30 millions de touristes par an.",
        "Divisée en 20 arrondissements en spirale."
      ],
      pois: [
        { name: "La Tour Eiffel", type: "Monument", desc: "Icône de fer de 330m érigée pour l'Exposition universelle de 1889." },
        { name: "Musée du Louvre", type: "Musée", desc: "Le plus grand musée d'art au monde, abritant la Joconde." },
        { name: "Cathédrale Notre-Dame", type: "Histoire", desc: "Chef-d'œuvre de l'architecture gothique française." }
      ]
    },
    {
      id: "rome",
      name: "Rome",
      country: "Italie",
      countryCode: "🇮🇹",
      category: "monument",
      categoryLabel: "Cité Antique & Capitale",
      lat: 41.9028,
      lng: 12.4964,
      zoom: 12,
      description: "Rome, capitale de l'Italie, est une grande ville cosmopolite dotée de près de 3 000 ans d'art, d'architecture et de culture ayant exercé une influence mondiale. Ses ruines antiques comme celles du Forum et du Colisée évoquent la puissance de l'ancien Empire romain.",
      population: "2,87 millions",
      area: "1 285 km²",
      elevation: "21 m",
      facts: [
        "Construite sur 7 collines historiques.",
        "Enclot le Vatican, le plus petit État souverain du monde.",
        "Possède près de 900 églises chrétiennes."
      ],
      pois: [
        { name: "Le Colisée", type: "Monument", desc: "Le plus grand amphithéâtre romain, symbole de Rome." },
        { name: "Panthéon", type: "Temple", desc: "Temple antique romain exceptionnellement conservé avec sa coupole." },
        { name: "Fontaine de Trevi", type: "Monument", desc: "Somptueuse fontaine baroque baroque où jeter des pièces." }
      ]
    },
    {
      id: "tokyo",
      name: "Tokyo",
      country: "Japon",
      countryCode: "🇯🇵",
      category: "city",
      categoryLabel: "Mégalopole Moderne",
      lat: 35.6762,
      lng: 139.6503,
      zoom: 11,
      description: "Tokyo, la capitale animée du Japon, associe les styles ultramodernes et les temples anciens. La ville abrite de splendides sanctuaires shintoïstes et des gratte-ciels néons spectaculaires dans les quartiers comme Shinjuku.",
      population: "14 millions",
      area: "2 194 km²",
      elevation: "40 m",
      facts: [
        "L'aire urbaine la plus peuplée du monde (37 millions).",
        "Plus de restaurants étoilés Michelin que n'importe quelle autre ville.",
        "Anciennement connue sous le nom d'Edo."
      ],
      pois: [
        { name: "Temple Senso-ji", type: "Religieux", desc: "Le plus ancien temple bouddhiste de Tokyo à Asakusa." },
        { name: "Tour de Tokyo", type: "Monument", desc: "Tour de télécommunication rouge et blanche inspirée de la Tour Eiffel." },
        { name: "Carrefour de Shibuya", type: "Attraction", desc: "Le passage piéton le plus fréquenté au monde." }
      ]
    },
    {
      id: "newyork",
      name: "New York",
      country: "États-Unis",
      countryCode: "🇺🇸",
      category: "city",
      categoryLabel: "Métropole Culturelle",
      lat: 40.7128,
      lng: -74.0060,
      zoom: 11,
      description: "New York regroupe 5 arrondissements implantés à l'embouchure du fleuve Hudson dans l'océan Atlantique. En son centre se trouve Manhattan, un arrondissement à très forte densité de population qui compte parmi les principaux centres commerciaux, financiers et culturels du monde.",
      population: "8,33 millions",
      area: "783,8 km²",
      elevation: "10 m",
      facts: [
        "Plus de 800 langues sont parlées à New York.",
        "Central Park est plus grand que la principauté de Monaco.",
        "Surnommée 'The Big Apple'."
      ],
      pois: [
        { name: "Statue de la Liberté", type: "Monument", desc: "Célèbre monument offert par la France pour célébrer l'amitié bilatérale." },
        { name: "Empire State Building", type: "Gratte-ciel", desc: "Chef-d'œuvre de style Art déco dominant Manhattan." },
        { name: "Times Square", type: "Attraction", desc: "Célèbre carrefour illuminé par d'immenses panneaux publicitaires." }
      ]
    },
    {
      id: "grandcanyon",
      name: "Grand Canyon",
      country: "États-Unis",
      countryCode: "🇺🇸",
      category: "nature",
      categoryLabel: "Merveille Naturelle",
      lat: 36.0544,
      lng: -112.1401,
      zoom: 10,
      description: "Le Grand Canyon est une gorge spectaculaire sculptée par le fleuve Colorado, dans l'État de l'Arizona. Reconnu pour sa taille immense et ses paysages colorés, il offre des panoramas géologiques uniques au monde.",
      population: "N/A",
      area: "4 926 km²",
      elevation: "2 200 m",
      facts: [
        "Roches vieilles de près de 2 milliards d'années au fond du canyon.",
        "Le canyon s'étend sur 446 km de long.",
        "Considéré comme l'une des sept merveilles naturelles du monde."
      ],
      pois: [
        { name: "Mather Point", type: "Panorama", desc: "L'un des points de vue les plus populaires et majestueux du South Rim." },
        { name: "Havasu Falls", type: "Cascade", desc: "Chutes d'eau turquoise situées dans la réserve indienne Havasupai." },
        { name: "Bright Angel Trail", type: "Randonnée", desc: "Sentier de randonnée historique plongeant au cœur du canyon." }
      ]
    },
    {
      id: "fuji",
      name: "Mont Fuji",
      country: "Japon",
      countryCode: "🇯🇵",
      category: "nature",
      categoryLabel: "Volcan Sacré",
      lat: 35.3606,
      lng: 138.7274,
      zoom: 11,
      description: "Le mont Fuji est une montagne de l'île de Honshū. Avec ses 3 776 mètres d'altitude, c'est le point culminant du Japon. Il s'agit d'un stratovolcan toujours considéré comme actif, bien que sa dernière éruption remonte à 1707.",
      population: "N/A",
      area: "90,7 km²",
      elevation: "3 776 m",
      facts: [
        "C'est une montagne sacrée dans les religions Shinto et Bouddhiste.",
        "Classé au patrimoine mondial de l'UNESCO comme lieu sacré et source d'art.",
        "Plus de 300 000 personnes en font l'ascension chaque été."
      ],
      pois: [
        { name: "Cinq Lacs du Fuji", type: "Nature", desc: "Lacs pittoresques ceinturant le pied du mont, offrant des reflets iconiques." },
        { name: "Sanctuaire Fujisan Hongu Sengen Taisha", type: "Temple", desc: "Sanctuaire shinto traditionnel dédié à la déesse du volcan." },
        { name: "Station 5 (Gogome)", type: "Point d'arrêt", desc: "Point de départ principal de l'ascension, accessible par la route." }
      ]
    },
    {
      id: "saintmichel",
      name: "Mont Saint-Michel",
      country: "France",
      countryCode: "🇫🇷",
      category: "monument",
      categoryLabel: "Patrimoine Médiéval",
      lat: 48.6360,
      lng: -1.5114,
      zoom: 13,
      description: "Le Mont-Saint-Michel est une commune insulaire française située en Normandie. Elle tire son nom de l'îlot rocheux dédié à saint Michel où s'élève aujourd'hui l'abbaye du Mont-Saint-Michel.",
      population: "30 habitants",
      area: "4 km²",
      elevation: "80 m",
      facts: [
        "Entouré par les plus grandes marées d'Europe continentale.",
        "Fortifié au Moyen Âge, il a résisté aux assauts anglais durant la guerre de Cent Ans.",
        "Un des premiers sites inscrits au patrimoine mondial de l'UNESCO en 1979."
      ],
      pois: [
        { name: "Abbaye du Mont-Saint-Michel", type: "Abbaye", desc: "Chef-d'œuvre de l'architecture médiévale militaire et religieuse." },
        { name: "La Grande Rue", type: "Rue historique", desc: "Ruelle pavée étroite bordée de maisons à pans de bois des XVe et XVIe siècles." },
        { name: "Les Remparts", type: "Histoire", desc: "Chemin de ronde fortifié offrant des vues spectaculaires sur la baie." }
      ]
    },
    {
      id: "cairo",
      name: "Le Caire",
      country: "Égypte",
      countryCode: "🇪🇬",
      category: "monument",
      categoryLabel: "Patrimoine Pharaonique",
      lat: 30.0444,
      lng: 31.2357,
      zoom: 11,
      description: "Le Caire, capitale de l'Égypte, est implantée sur le Nil. En son centre se trouve la place Tahrir et le vaste musée égyptien, qui abrite une collection d'antiquités royales et d'objets pharaoniques.",
      population: "9,9 millions",
      area: "3 085 km²",
      elevation: "23 m",
      facts: [
        "Surnommée 'La cité aux mille minarets' pour son architecture islamique.",
        "La plus grande ville du monde arabe et d'Afrique.",
        "Fondée en 969 de notre ère par la dynastie des Fatimides."
      ],
      pois: [
        { name: "Pyramides de Gizeh", type: "Monument", desc: "Situées à la lisière du Caire, les uniques merveilles de l'Antiquité encore debout." },
        { name: "Le Grand Sphinx", type: "Monument", desc: "Sculpture monumentale de lion couché à tête humaine." },
        { name: "Khan el-Khalili", type: "Souk", desc: "Bazar historique vibrant débordant d'épices, de parfums et d'artisanat." }
      ]
    }
  ];

  // IDs des zones intégrées par défaut — ne peuvent pas être supprimées
  private readonly BUILTIN_IDS = new Set([
    'paris', 'rome', 'tokyo', 'newyork',
    'grandcanyon', 'fuji', 'saintmichel', 'cairo'
  ]);

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
      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(lowerQuery)}&limit=5&addressdetails=1`, {
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
              countryCode: cc
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
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=12&addressdetails=1`, {
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

        this.selectedPlace = {
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

/**
 * EquiNav – Komplett applikationslogik
 * Premium hästtransport-navigation, viktkalkylator, väghinder och jour-SOS.
 */

let map = null;
let routeLine = null;
let routeOutline = null;
let startMarker = null;
let endMarker = null;
let userLocationMarker = null;
let selectedCoordinatesForHazard = null;
let currentActiveTab = "tab-home";
let mapHazardMarkers = [];
let localHazards = [];

// Fördefinierade koordinater för snabbval och demo
const LOCATION_COORDS = {
    "stockholm": [59.3293, 18.0686],
    "sthlm": [59.3293, 18.0686],
    "strömsholm": [59.5255, 16.2731],
    "göteborg": [57.7089, 11.9746],
    "gbg": [57.7089, 11.9746],
    "uddevalla": [58.3518, 11.9424],
    "rimbo": [59.7439, 18.3571],
    "kiruna": [67.8558, 20.2253],
    "uppsala": [59.8586, 17.6389]
};

let currentUserGpsCoords = null;
let currentRouteData = {
    start: "Stockholm",
    end: "Strömsholm",
    distance: "202,4 km",
    horseEta: "2h 45m",
    carEta: "2h 02m",
    turns: 14
};

// Initialisering vid sidladdning
window.addEventListener("DOMContentLoaded", () => {
    // Registrera Service Worker för offline-PWA (rensning hanteras av inline-scriptet i index.html)
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("./sw.js").then((reg) => {
            console.log("Service Worker aktiv:", reg.scope);
        }).catch((err) => {
            console.warn("Service Worker registrering misslyckades:", err);
        });
    }

    initMap();
    initTabs();
    initNavigationTree();
    initHomeRoutePlanner();
    initRoutePlanner();
    initAutocomplete();
    initWeightCalculator();
    initHazards();
    initEmergencySOS();
    initNavigationMode();
    initProfileSettings();
    initSavedPresets();
    initDragHandle();
    initNightMode();
    initSafeArrival();
    initZeroSpeedAds();
    initProModal();
});

// ----------------------------------------------------
// 1. KARTA & LEAFLET
// ----------------------------------------------------
let currentTileLayer = null;
let currentTileIndex = 0;
const TILE_PROVIDERS = [
    {
        name: "Standardkarta (OpenStreetMap)",
        url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        options: { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
    },
    {
        name: "Satellitfoto (ArcGIS)",
        url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        options: { maxZoom: 19, attribution: '&copy; Esri' }
    },
    {
        name: "Topografisk Terräng",
        url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
        options: { maxZoom: 17, attribution: '&copy; OpenTopoMap' }
    }
];

function initMap() {
    try {
        const initialCenter = [59.45, 17.20]; // Mellan Stockholm och Strömsholm
        map = L.map("map", {
            zoomControl: false,
            attributionControl: false
        }).setView(initialCenter, 8);

        // Ladda standardkarta
        setMapTileLayer(0);

        // Klick på kartan
        map.on("click", (e) => {
            const lat = parseFloat(e.latlng.lat.toFixed(5));
            const lng = parseFloat(e.latlng.lng.toFixed(5));
            handleMapClick(lat, lng);
        });

        // Koppla flytande kartkontroller
        initMapControls();

        // Ladda initiala hästkliniker på kartan
        addInitialClinicsToMap();

    } catch (err) {
        console.error("Fel vid initiering av karta:", err);
    }
}

function setMapTileLayer(index) {
    if (currentTileLayer) {
        map.removeLayer(currentTileLayer);
    }
    currentTileIndex = index % TILE_PROVIDERS.length;
    const prov = TILE_PROVIDERS[currentTileIndex];
    currentTileLayer = L.tileLayer(prov.url, prov.options).addTo(map);
}

function initMapControls() {
    const btnZoomIn = document.getElementById("btn-map-zoom-in");
    const btnZoomOut = document.getElementById("btn-map-zoom-out");
    const btnLocate = document.getElementById("btn-map-locate");
    const btnLayer = document.getElementById("btn-map-layer");

    if (btnZoomIn) btnZoomIn.addEventListener("click", () => map.zoomIn());
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => map.zoomOut());

    if (btnLocate) {
        btnLocate.addEventListener("click", () => {
            getUserGpsPosition((pos) => {
                if (pos) {
                    map.setView(pos, 14, { animate: true });
                    showToast("Centrerad på din GPS-position", "🎯");
                }
            });
        });
    }

    if (btnLayer) {
        btnLayer.addEventListener("click", () => {
            const nextIdx = (currentTileIndex + 1) % TILE_PROVIDERS.length;
            setMapTileLayer(nextIdx);
            showToast(`Kartvy: ${TILE_PROVIDERS[nextIdx].name}`, "🗺️");
        });
    }
}

function handleMapClick(lat, lng) {
    if (currentActiveTab === "tab-hazards") {
        selectedCoordinatesForHazard = [lat, lng];
        const coordDisplay = document.getElementById("hazard-coords-display");
        if (coordDisplay) {
            coordDisplay.innerText = `${lat}, ${lng}`;
            coordDisplay.classList.add("selected");
        }

        if (window.tempHazardMarker) {
            map.removeLayer(window.tempHazardMarker);
        }

        window.tempHazardMarker = L.marker([lat, lng], {
            icon: L.divIcon({
                className: 'custom-hazard-marker',
                html: '<div style="background:#c04c3e;color:#fff;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);">⚠️</div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
            })
        }).addTo(map);

        showToast("Position vald för väghinder!", "📍");
        expandSidebar("expanded");
    }
}

function addInitialClinicsToMap() {
    const clinics = [
        { name: "Mälaren Hästklinik", lat: 59.617, lon: 17.723 },
        { name: "SLU Universitetsdjursjukhuset", lat: 59.816, lon: 17.658 },
        { name: "Evidensia Strömsholm", lat: 59.525, lon: 16.273 }
    ];

    clinics.forEach(c => {
        L.marker([c.lat, c.lon], {
            icon: L.divIcon({
                className: 'clinic-map-pin',
                html: '<div style="background:#c04c3e;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">🏥</div>',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            })
        }).addTo(map).bindPopup(`<strong>${c.name}</strong><br>Jour öppen dygnet runt`);
    });
}

// ----------------------------------------------------
// 2. FLIKAR & NAVIGATION
// ----------------------------------------------------
function initTabs() {
    document.querySelectorAll(".bottom-nav .tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.dataset.tab;
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    const panels = document.querySelectorAll(".tab-panel");
    const bottomNavBtns = document.querySelectorAll(".bottom-nav .tab-btn");

    panels.forEach(p => p.classList.remove("active"));
    bottomNavBtns.forEach(b => b.classList.remove("active"));

    // Matcha knapp i bottenmenyn om den finns
    const matchingBtn = document.querySelector(`.bottom-nav .tab-btn[data-tab="${tabId}"]`);
    if (matchingBtn) {
        matchingBtn.classList.add("active");
    } else {
        // Om det är en undersida (t.ex. tab-calculator eller tab-route), håll "Hem" aktiv i bottenmenyn
        const homeBtn = document.querySelector('.bottom-nav .tab-btn[data-tab="tab-home"]');
        if (homeBtn) homeBtn.classList.add("active");
    }

    const activePanel = document.getElementById(tabId);
    if (activePanel) {
        activePanel.classList.add("active");
    }

    currentActiveTab = tabId;

    // Scrolla upp till toppen
    const content = document.querySelector(".sidebar-content");
    if (content) content.scrollTop = 0;

    // Se till att sidebar är fullt synlig
    expandSidebar("expanded");

    // Dölj navigations-HUD om den råkade vara öppen
    const navHud = document.getElementById("navigation-hud");
    if (navHud && !navHud.classList.contains("hidden")) {
        navHud.classList.add("hidden");
    }
}

function expandSidebar(state) {
    const sidebar = document.getElementById("app-sidebar");
    if (!sidebar) return;
    sidebar.className = `sidebar state-${state}`;
}

function initDragHandle() {
    const handle = document.getElementById("bottom-sheet-drag");
    const sidebar = document.getElementById("app-sidebar");
    if (!handle || !sidebar) return;

    handle.addEventListener("click", () => {
        if (sidebar.classList.contains("state-peek")) {
            expandSidebar("expanded");
        } else {
            expandSidebar("peek");
        }
    });
}

// ----------------------------------------------------
// 3. HEMSKÄRMENS KNAPPAR & KOPPLINGAR
// ----------------------------------------------------
function initNavigationTree() {
    // 4 Snabbbrickor på Hemskärmen
    const tileRoute = document.getElementById("tile-route");
    const tileCalculator = document.getElementById("tile-calculator");
    const tileHazards = document.getElementById("tile-hazards");
    const tileEmergency = document.getElementById("tile-emergency");

    if (tileRoute) {
        tileRoute.addEventListener("click", () => switchTab("tab-route"));
    }
    if (tileCalculator) {
        tileCalculator.addEventListener("click", () => switchTab("tab-calculator"));
    }
    if (tileHazards) {
        tileHazards.addEventListener("click", () => switchTab("tab-hazards"));
    }
    if (tileEmergency) {
        tileEmergency.addEventListener("click", () => switchTab("tab-emergency"));
    }

    // Alla Tillbaka-knappar (<) på undersidor
    document.querySelectorAll(".btn-back-to-home").forEach(btn => {
        btn.addEventListener("click", () => switchTab("tab-home"));
    });

    // Klick på senast sparad rutt på hemskärmen
    const recentStockholm = document.getElementById("recent-route-stockholm");
    if (recentStockholm) {
        recentStockholm.addEventListener("click", () => {
            loadSavedRoute("Stockholm", "Strömsholm");
        });
    }

    // "Visa alla" från Senaste rutter
    const seeAllBtn = document.getElementById("btn-see-all-recent");
    if (seeAllBtn) {
        seeAllBtn.addEventListener("click", () => switchTab("tab-saved"));
    }

    // Om oss länk
    const aboutLink = document.getElementById("btn-read-about");
    if (aboutLink) {
        aboutLink.addEventListener("click", (e) => {
            e.preventDefault();
            alert("EquiNav:\nSpecialutvecklad GPS- och ruttoptimeringsapplikation för hästtransporter. Minimerar kurvor, tvära inbromsningar och branta backar för att skydda hästens balans.");
        });
    }

    // Notis-klockan – kollar Trafikverket vid klick
    const notifBtn = document.getElementById("btn-notifications");
    if (notifBtn) {
        notifBtn.addEventListener("click", async () => {
            showToast("Söker aktuella trafikvarningar...", "🔔");
            try {
                if (typeof db !== "undefined") {
                    const res = await db.getTrafikverketSituationsFromProxy();
                    if (res && res.data && res.data.length > 0) {
                        showToast(`${res.data.length} trafikstörningar rapporterade hos Trafikverket.`, "⚠️");
                    } else {
                        showToast("Inga akuta trafikvarningar i ditt närområde.", "🟢");
                    }
                } else {
                    showToast("Inga aktiva trafikvarningar i ditt närområde.", "🔔");
                }
            } catch (e) {
                showToast("Inga aktiva trafikvarningar i ditt närområde.", "🔔");
            }
        });
    }
}

// ----------------------------------------------------
// 4. RUTTPLANERING (HEM + RUTT-FLIK)
// ----------------------------------------------------
function initHomeRoutePlanner() {
    const calcBtn = document.getElementById("btn-home-calculate-route");
    const swapBtn = document.getElementById("btn-home-swap");
    const gpsBtn = document.getElementById("btn-home-gps");

    // Snabba genvägar (Sthlm -> Strömsholm, Gbg -> Uddevalla)
    document.querySelectorAll(".shortcut-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const start = pill.dataset.start;
            const end = pill.dataset.end;
            
            document.getElementById("home-input-start").value = start;
            document.getElementById("home-input-end").value = end;
            document.getElementById("input-start").value = start;
            document.getElementById("input-end").value = end;

            calculateAndShowRoute(start, end);
        });
    });

    // Byt plats på start och mål
    if (swapBtn) {
        swapBtn.addEventListener("click", () => {
            const startIn = document.getElementById("home-input-start");
            const endIn = document.getElementById("home-input-end");
            const tmp = startIn.value;
            startIn.value = endIn.value;
            endIn.value = tmp;
        });
    }

    // Hämta GPS på hemskärmen
    if (gpsBtn) {
        gpsBtn.addEventListener("click", () => {
            getUserGpsPosition((pos) => {
                if (!pos) return; // GPS misslyckades
                const startIn = document.getElementById("home-input-start");
                startIn.value = "Min position (GPS)";
                startIn.dataset.lat = pos[0];
                startIn.dataset.lng = pos[1];
                currentUserGpsCoords = pos;
                showToast("GPS-position lokaliserad och inzoomad", "🟢");
            });
        });
    }

    // Beräkna rutt från hemskärmen
    if (calcBtn) {
        calcBtn.addEventListener("click", () => {
            const start = document.getElementById("home-input-start").value.trim();
            const end = document.getElementById("home-input-end").value.trim();

            if (!start || !end) {
                alert("Vänligen ange både startplats och slutdestination.");
                return;
            }

            document.getElementById("input-start").value = start;
            document.getElementById("input-end").value = end;

            calculateAndShowRoute(start, end);
        });
    }
}

function initRoutePlanner() {
    const routeFindBtn = document.getElementById("btn-find-route");
    const useGpsBtn = document.getElementById("btn-use-gps");

    if (useGpsBtn) {
        useGpsBtn.addEventListener("click", () => {
            getUserGpsPosition((pos) => {
                if (!pos) return; // GPS misslyckades
                const startIn = document.getElementById("input-start");
                startIn.value = "Min position (GPS)";
                startIn.dataset.lat = pos[0];
                startIn.dataset.lng = pos[1];
                currentUserGpsCoords = pos;
                showToast("GPS-position lokaliserad och inzoomad", "🟢");
            });
        });
    }

    if (routeFindBtn) {
        routeFindBtn.addEventListener("click", () => {
            const start = document.getElementById("input-start").value.trim();
            const end = document.getElementById("input-end").value.trim();

            if (!start || !end) {
                alert("Vänligen ange både startplats och slutdestination.");
                return;
            }

            calculateAndShowRoute(start, end);
        });
    }
}

// ----------------------------------------------------
// ADRESS-AUTOCOMPLETE (Nominatim / OpenStreetMap Geocoding)
// Gratis, ingen API-nyckel krävs
// ----------------------------------------------------
let autocompleteTimers = {};

function initAutocomplete() {
    const fields = [
        { input: "home-input-start", dropdown: "dropdown-home-start" },
        { input: "home-input-end", dropdown: "dropdown-home-end" },
        { input: "input-start", dropdown: "dropdown-route-start" },
        { input: "input-end", dropdown: "dropdown-route-end" }
    ];

    fields.forEach(({ input: inputId, dropdown: dropdownId }) => {
        const inputEl = document.getElementById(inputId);
        const dropdownEl = document.getElementById(dropdownId);
        if (!inputEl || !dropdownEl) return;

        // Sök vid inmatning (debounced 350ms)
        inputEl.addEventListener("input", () => {
            const query = inputEl.value.trim();

            // Rensa eventuella sparade koordinater vid ny sökning
            delete inputEl.dataset.lat;
            delete inputEl.dataset.lng;

            if (autocompleteTimers[inputId]) clearTimeout(autocompleteTimers[inputId]);

            if (query.length < 2) {
                dropdownEl.classList.add("hidden");
                dropdownEl.innerHTML = "";
                return;
            }

            autocompleteTimers[inputId] = setTimeout(() => {
                searchNominatim(query, dropdownEl, inputEl);
            }, 350);
        });

        // Fokus: visa dropdown igen om det finns resultat
        inputEl.addEventListener("focus", () => {
            if (dropdownEl.children.length > 0 && inputEl.value.length >= 2) {
                dropdownEl.classList.remove("hidden");
            }
        });
    });

    // Stäng alla dropdowns vid klick utanför
    document.addEventListener("click", (e) => {
        if (!e.target.closest(".autocomplete-wrapper")) {
            document.querySelectorAll(".autocomplete-dropdown").forEach(dd => {
                dd.classList.add("hidden");
            });
        }
    });
}

async function searchNominatim(query, dropdownEl, inputEl) {
    dropdownEl.innerHTML = '<div class="autocomplete-loading">Söker...</div>';
    dropdownEl.classList.remove("hidden");

    try {
        const url = `https://nominatim.openstreetmap.org/search?` +
            `format=json&q=${encodeURIComponent(query)}` +
            `&countrycodes=se&limit=6&addressdetails=1&accept-language=sv`;

        const res = await fetch(url, {
            headers: { "User-Agent": "EquiNav/1.0 (hasttransport-gps)" }
        });
        const results = await res.json();

        if (!results || results.length === 0) {
            dropdownEl.innerHTML = '<div class="autocomplete-no-results">Inga resultat hittades</div>';
            return;
        }

        dropdownEl.innerHTML = "";
        results.forEach(place => {
            const item = document.createElement("div");
            item.className = "autocomplete-item";

            const icon = getPlaceIcon(place.type, place.class);
            const name = place.address ?
                (place.address.road || place.address.hamlet || place.address.village ||
                 place.address.town || place.address.city || place.address.county || place.display_name.split(",")[0]) :
                place.display_name.split(",")[0];
            const address = formatPlaceAddress(place);

            item.innerHTML = `
                <div class="autocomplete-item-icon">${icon}</div>
                <div class="autocomplete-item-text">
                    <div class="autocomplete-item-name">${escapeHtml(name)}</div>
                    <div class="autocomplete-item-address">${escapeHtml(address)}</div>
                </div>
            `;

            item.addEventListener("click", () => {
                inputEl.value = name + (address ? ", " + address : "");
                inputEl.dataset.lat = parseFloat(place.lat).toFixed(5);
                inputEl.dataset.lng = parseFloat(place.lon).toFixed(5);

                // Spara i LOCATION_COORDS för snabb uppslagning
                const coordKey = inputEl.value.toLowerCase().trim();
                LOCATION_COORDS[coordKey] = [parseFloat(place.lat), parseFloat(place.lon)];

                dropdownEl.classList.add("hidden");

                // Synka med det andra fältparet om applicerbart
                syncInputFields(inputEl.id, inputEl.value, inputEl.dataset.lat, inputEl.dataset.lng);

                console.log("[Autocomplete] Vald:", inputEl.value, "→", [place.lat, place.lon]);
            });

            dropdownEl.appendChild(item);
        });
    } catch (err) {
        console.warn("[Autocomplete] Nominatim-sökning misslyckades:", err);
        dropdownEl.innerHTML = '<div class="autocomplete-no-results">Sökning misslyckades, försök igen</div>';
    }
}

function getPlaceIcon(type, placeClass) {
    if (placeClass === "highway" || type === "road" || type === "street") return "🛣️";
    if (type === "city" || type === "town") return "🏙️";
    if (type === "village" || type === "hamlet") return "🏘️";
    if (type === "suburb" || type === "neighbourhood") return "📍";
    if (placeClass === "amenity") return "🏛️";
    if (placeClass === "leisure" || type === "park") return "🌳";
    if (type === "administrative" || type === "county") return "📌";
    return "📍";
}

function formatPlaceAddress(place) {
    if (!place.address) return "";
    const parts = [];
    if (place.address.municipality) parts.push(place.address.municipality);
    else if (place.address.town) parts.push(place.address.town);
    else if (place.address.city) parts.push(place.address.city);
    if (place.address.county) parts.push(place.address.county);
    if (place.address.state) parts.push(place.address.state);
    return parts.join(", ");
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function syncInputFields(sourceId, value, lat, lng) {
    const pairs = {
        "home-input-start": "input-start",
        "input-start": "home-input-start",
        "home-input-end": "input-end",
        "input-end": "home-input-end"
    };
    const targetId = pairs[sourceId];
    if (!targetId) return;
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
        targetEl.value = value;
        if (lat) targetEl.dataset.lat = lat;
        if (lng) targetEl.dataset.lng = lng;
    }
}

function isGpsPlaceName(name) {
    if (!name) return false;
    const key = name.toLowerCase().trim();
    return key.includes("min plats") || key.includes("min position") || key.includes("gps") ||
           key === "här" || key === "hemma" || key === "nuvarande" || key.includes("current");
}

function getCoordsForPlace(name, inputEl) {
    if (!name) return currentUserGpsCoords || [59.3293, 18.0686];
    const key = name.toLowerCase().trim();

    // Om texten matchar GPS-relaterade uttryck
    if (isGpsPlaceName(name)) {
        if (inputEl && inputEl.dataset.lat && inputEl.dataset.lng) {
            return [parseFloat(inputEl.dataset.lat), parseFloat(inputEl.dataset.lng)];
        }
        if (currentUserGpsCoords) {
            return currentUserGpsCoords;
        }
        for (const id of ["home-input-start", "input-start"]) {
            const el = document.getElementById(id);
            if (el && el.dataset.lat && el.dataset.lng) {
                return [parseFloat(el.dataset.lat), parseFloat(el.dataset.lng)];
            }
        }
    }

    // PRIORITET: Om inputfältet har lat/lng från autocomplete-val, använd dem
    if (inputEl && inputEl.dataset.lat && inputEl.dataset.lng) {
        return [parseFloat(inputEl.dataset.lat), parseFloat(inputEl.dataset.lng)];
    }

    if (LOCATION_COORDS[key]) {
        return LOCATION_COORDS[key];
    }
    // Kolla om det är lat, lon format
    if (name.includes(",")) {
        const parts = name.split(",").map(p => parseFloat(p.trim()));
        if (!isNaN(parts[0]) && !isNaN(parts[1])) {
            return parts;
        }
    }
    // Fallback till Stockholm
    return [59.3293, 18.0686];
}

// Promise-wrapper för GPS
function getGpsPositionAsync() {
    return new Promise((resolve) => {
        getUserGpsPosition((coords) => {
            resolve(coords);
        });
    });
}

async function calculateAndShowRoute(startPlace, endPlace) {
    switchTab("tab-route");
    showToast("Beräknar säkraste rutt för hästtransport...", "🐎");

    // Om startplatsen är en GPS-text men vi saknar koordinater → hämta GPS först
    if (isGpsPlaceName(startPlace) && !currentUserGpsCoords) {
        showToast("Hämtar din GPS-position...", "📍");
        const coords = await getGpsPositionAsync();
        if (!coords) {
            showToast("Kunde inte hämta GPS-position. Ange en startplats manuellt.", "❌");
            return;
        }
        currentUserGpsCoords = coords;
        // Uppdatera inputfälten med GPS-koordinaterna
        const homeStart = document.getElementById("home-input-start");
        const routeStart = document.getElementById("input-start");
        if (homeStart) { homeStart.dataset.lat = coords[0]; homeStart.dataset.lng = coords[1]; }
        if (routeStart) { routeStart.dataset.lat = coords[0]; routeStart.dataset.lng = coords[1]; }
    }

    const startInputEl = document.getElementById("home-input-start") || document.getElementById("input-start");
    const endInputEl = document.getElementById("home-input-end") || document.getElementById("input-end");

    const startCoords = getCoordsForPlace(startPlace, startInputEl);
    const endCoords = getCoordsForPlace(endPlace, endInputEl);

    console.log("[EquiNav Route] Start:", startPlace, "→", startCoords, " | Mål:", endPlace, "→", endCoords);

    // Rita markörer på kartan
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLine) map.removeLayer(routeLine);
    if (routeOutline) map.removeLayer(routeOutline);

    startMarker = L.marker(startCoords, {
        icon: L.divIcon({
            className: 'start-pin',
            html: '<div style="background:#345735;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">A</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(map).bindPopup(`Start: ${startPlace}`);

    endMarker = L.marker(endCoords, {
        icon: L.divIcon({
            className: 'end-pin',
            html: '<div style="background:#c04c3e;color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:bold;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">B</div>',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        })
    }).addTo(map).bindPopup(`Mål: ${endPlace}`);

    // Hämta rutt via OSRM med sväng-anvisningar (steps)
    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            currentRouteCoordinates = coordinates;
            currentRouteSteps = route.legs && route.legs[0] && route.legs[0].steps ? route.legs[0].steps : [];
            currentRouteTotalDistance = route.distance;
            currentRouteTotalDuration = route.duration;

            // Rita ruttlinje med skarp outline (svart kant + ljusgrå inre)
            if (routeOutline) map.removeLayer(routeOutline);
            routeOutline = L.polyline(coordinates, {
                color: "#111827",
                weight: 9,
                opacity: 0.85,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);

            routeLine = L.polyline(coordinates, {
                color: "#e2e8f0",
                weight: 5,
                opacity: 1,
                lineJoin: 'round',
                lineCap: 'round'
            }).addTo(map);

            map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

            // Uppdatera statistik
            const distKm = (route.distance / 1000).toFixed(1);
            const carSeconds = route.duration;
            const horseSeconds = Math.round(carSeconds * 1.35); // 35% längre för hästsläp (max 80 km/h)

            const formatTime = (secs) => {
                const hrs = Math.floor(secs / 3600);
                const mins = Math.floor((secs % 3600) / 60);
                return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
            };

            const horseEta = formatTime(horseSeconds);
            const carEta = formatTime(carSeconds);

            // Spara aktiv ruttdata i globalt tillstånd
            currentRouteData = {
                start: startPlace,
                end: endPlace,
                distance: `${distKm} km`,
                horseEta: horseEta,
                carEta: carEta,
                turns: Math.max(6, Math.round(route.distance / 12000))
            };

            document.getElementById("stat-horse-eta").innerText = horseEta;
            document.getElementById("stat-car-eta").innerText = carEta;
            document.getElementById("stat-distance").innerText = `${distKm} km`;
            document.getElementById("stat-turns").innerText = `${currentRouteData.turns} st`;
            document.getElementById("route-title").innerText = `${startPlace} till ${endPlace}`;

            // Visa resultatsektionen
            document.getElementById("route-results").classList.remove("hidden");
            showToast("Rutt beräknad och optimerad för hästtransport!", "✅");
            return;
        }
    } catch (e) {
        console.warn("Kunde inte hämta OSRM-rutt, ritar interpolerad linje:", e);
    }

    // Fallback ruttlinje
    const fallbackCoords = [
        startCoords,
        [(startCoords[0]*2 + endCoords[0])/3 + 0.02, (startCoords[1]*2 + endCoords[1])/3],
        [(startCoords[0] + endCoords[0]*2)/3 - 0.02, (startCoords[1] + endCoords[1]*2)/3],
        endCoords
    ];
    currentRouteCoordinates = fallbackCoords;
    currentRouteSteps = [
        { name: "Startväg", distance: 1500, maneuver: { type: "depart", modifier: "straight" } },
        { name: "E18 / Riksväg", distance: 12000, maneuver: { type: "turn", modifier: "right" } },
        { name: "Destinationsväg", distance: 2000, maneuver: { type: "arrive", modifier: "straight" } }
    ];
    currentRouteTotalDistance = 15500;
    currentRouteTotalDuration = 900;

    if (routeOutline) map.removeLayer(routeOutline);
    routeOutline = L.polyline(fallbackCoords, {
        color: "#111827",
        weight: 9,
        opacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round'
    }).addTo(map);
    routeLine = L.polyline(fallbackCoords, {
        color: "#e2e8f0",
        weight: 5,
        opacity: 1,
        lineJoin: 'round',
        lineCap: 'round'
    }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    currentRouteData = {
        start: startPlace,
        end: endPlace,
        distance: "120 km",
        horseEta: "1h 45m",
        carEta: "1h 15m",
        turns: 8
    };

    document.getElementById("route-results").classList.remove("hidden");
}

// ----------------------------------------------------
// 5. VIKTKALKYLATOR & FORDONSSÖKNING (Equi viktkalkyl.png)
// ----------------------------------------------------
let selectedCarSpecs = { name: "Volvo XC90 D5 AWD", curb: 2130, total: 2750, maxTow: 2700 };
let selectedTrailerSpecs = { name: "Ume-släpet B50 / BBO", curb: 820, total: 1990, payload: 1170 };

function initWeightCalculator() {
    const calcBtn = document.getElementById("btn-calculate-weights");
    const horseWeightInput = document.getElementById("calc-horse-weight");
    const carRegInput = document.getElementById("calc-car-reg");
    const trailerRegInput = document.getElementById("calc-trailer-reg");
    const carModelInput = document.getElementById("calc-car-model");
    const carYearInput = document.getElementById("calc-car-year");
    const trailerModelInput = document.getElementById("calc-trailer-model");

    // Sökläge: Regnr vs Modell & År
    const btnModeReg = document.getElementById("btn-mode-reg");
    const btnModeModel = document.getElementById("btn-mode-model");
    const modeRegContainer = document.getElementById("mode-reg-container");
    const modeModelContainer = document.getElementById("mode-model-container");

    if (btnModeReg && btnModeModel) {
        btnModeReg.addEventListener("click", () => {
            btnModeReg.className = "btn btn-sm btn-secondary active";
            btnModeModel.className = "btn btn-sm btn-outline";
            modeRegContainer?.classList.remove("hidden");
            modeModelContainer?.classList.add("hidden");
        });

        btnModeModel.addEventListener("click", () => {
            btnModeModel.className = "btn btn-sm btn-secondary active";
            btnModeReg.className = "btn btn-sm btn-outline";
            modeModelContainer?.classList.remove("hidden");
            modeRegContainer?.classList.add("hidden");
        });
    }

    // Ladda sparad körkortsklass från localStorage
    const savedLicense = localStorage.getItem("equinav-license") || "B96";
    const targetRadio = document.querySelector(`input[name="license-type"][value="${savedLicense}"]`);
    if (targetRadio) {
        targetRadio.checked = true;
    }

    // Klick på körkortskort
    document.querySelectorAll(".license-choice-card").forEach(card => {
        card.addEventListener("click", () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                localStorage.setItem("equinav-license", radio.value);
                syncProfileLicenseDisplay(radio.value);
                calculateWeights();
            }
        });
    });

    // Sökning på bilmodell / släpmodell med debounce
    let searchDebounce = null;
    const handleModelSearch = async () => {
        const carQuery = carModelInput?.value || "";
        const carYear = carYearInput?.value || "";
        const trailerQuery = trailerModelInput?.value || "";
        const resultsPreview = document.getElementById("model-search-results");

        if (carQuery.trim().length >= 2) {
            const carMatches = await db.searchCarByModel(carQuery, carYear);
            if (carMatches && carMatches.length > 0) {
                const match = carMatches[0];
                selectedCarSpecs = {
                    name: match.name || `${match.make} ${match.model}`,
                    curb: match.curb,
                    total: match.total,
                    maxTow: match.maxTow
                };
                if (resultsPreview) {
                    resultsPreview.innerHTML = `✅ Bil vald: <strong>${selectedCarSpecs.name}</strong> (Tjänstevikt: ${selectedCarSpecs.curb}kg, Total: ${selectedCarSpecs.total}kg, Dragvikt: ${selectedCarSpecs.maxTow}kg)`;
                }
            }
        }

        if (trailerQuery.trim().length >= 2) {
            const trailerMatches = await db.searchTrailerByModel(trailerQuery);
            if (trailerMatches && trailerMatches.length > 0) {
                const match = trailerMatches[0];
                selectedTrailerSpecs = {
                    name: match.name || `${match.make} ${match.model}`,
                    curb: match.curb,
                    total: match.total,
                    payload: match.payload || (match.total - match.curb)
                };
                if (resultsPreview) {
                    resultsPreview.innerHTML += `<br>✅ Släp valt: <strong>${selectedTrailerSpecs.name}</strong> (Total: ${selectedTrailerSpecs.total}kg, Maxlast: ${selectedTrailerSpecs.payload}kg)`;
                }
            }
        }

        calculateWeights();
    };

    [carModelInput, carYearInput, trailerModelInput].forEach(inp => {
        if (inp) {
            inp.addEventListener("input", () => {
                clearTimeout(searchDebounce);
                searchDebounce = setTimeout(handleModelSearch, 400);
            });
        }
    });

    // Regnr uppslag
    const handleRegSearch = async () => {
        const carReg = carRegInput?.value.trim().toUpperCase() || "";
        const trailerReg = trailerRegInput?.value.trim().toUpperCase() || "";

        if (carReg.length >= 3) {
            const carData = await db.getCarSpecs(carReg);
            if (carData) {
                selectedCarSpecs = {
                    name: carData.name || `Bil (${carReg})`,
                    curb: carData.curb,
                    total: carData.total,
                    maxTow: carData.maxTow
                };
            }
        }

        if (trailerReg.length >= 3) {
            const trailerData = await db.getTrailerSpecs(trailerReg);
            if (trailerData) {
                selectedTrailerSpecs = {
                    name: trailerData.name || `Släp (${trailerReg})`,
                    curb: trailerData.curb,
                    total: trailerData.total,
                    payload: trailerData.payload || (trailerData.total - trailerData.curb)
                };
            }
        }

        calculateWeights();
    };

    [carRegInput, trailerRegInput].forEach(inp => {
        if (inp) {
            inp.addEventListener("change", handleRegSearch);
        }
    });

    if (horseWeightInput) {
        horseWeightInput.addEventListener("input", calculateWeights);
    }

    if (calcBtn) {
        calcBtn.addEventListener("click", () => {
            if (modeRegContainer && !modeRegContainer.classList.contains("hidden")) {
                handleRegSearch();
            } else {
                handleModelSearch();
            }
            calculateWeights();
        });
    }

    // Kör en första kontroll vid start
    calculateWeights();
}

function calculateWeights() {
    const horseWeight = parseFloat(document.getElementById("calc-horse-weight")?.value) || 0;
    const licenseType = document.querySelector('input[name="license-type"]:checked')?.value || "B";

    const car = selectedCarSpecs;
    const trailer = selectedTrailerSpecs;

    const actualTrailerWeight = trailer.curb + horseWeight;
    const totalTrainWeight = car.total + trailer.total;
    const maxPayload = trailer.total - trailer.curb;
    const isLightTrailer = trailer.total <= 750;

    let isLicenseLegal = false;
    let licenseLimitText = "";
    const errors = [];

    // 1. Kontrollera körkortsbehörighet enligt Transportstyrelsens regler
    if (licenseType === "B") {
        licenseLimitText = "Max 3500 kg tågvikt (eller lätt släp ≤750kg)";
        if (isLightTrailer) {
            isLicenseLegal = car.total <= 3500;
            if (!isLicenseLegal) {
                errors.push("Bilen har en totalvikt över 3 500 kg vilket kräver C-behörighet.");
            }
        } else {
            isLicenseLegal = totalTrainWeight <= 3500;
            if (!isLicenseLegal) {
                errors.push(`Tågvikten (${totalTrainWeight} kg) överstiger B-körkortets maxgräns på 3 500 kg med ${totalTrainWeight - 3500} kg.`);
            }
        }
    } else if (licenseType === "B96") {
        licenseLimitText = "Max 4250 kg tågvikt";
        isLicenseLegal = totalTrainWeight <= 4250;
        if (!isLicenseLegal) {
            errors.push(`Tågvikten (${totalTrainWeight} kg) överstiger utökat B (B96) maxgräns på 4 250 kg med ${totalTrainWeight - 4250} kg.`);
        }
    } else if (licenseType === "BE") {
        licenseLimitText = "Släpets totalvikt max 3500 kg";
        isLicenseLegal = trailer.total <= 3500;
        if (!isLicenseLegal) {
            errors.push(`Släpets totalvikt (${trailer.total} kg) överstiger BE-körkortets maxgräns på 3 500 kg med ${trailer.total - 3500} kg.`);
        }
    } else if (licenseType === "BE_OLD") {
        licenseLimitText = "Obegränsad släptotalvikt";
        isLicenseLegal = true;
    }

    // 2. Kontrollera bilens tekniska dragförmåga
    if (actualTrailerWeight > car.maxTow) {
        errors.push(`Släpets faktiska vikt (${actualTrailerWeight} kg) överstiger bilens maximala släpvagnsvikt (${car.maxTow} kg) med ${actualTrailerWeight - car.maxTow} kg.`);
    }

    // 3. Kontrollera släpets maxlast
    if (actualTrailerWeight > trailer.total) {
        errors.push(`Släpet är överlastat! Hästens vikt (${horseWeight} kg) överskrider släpets tillåtna lastkapacitet (${maxPayload} kg) med ${actualTrailerWeight - trailer.total} kg.`);
    }

    const banner = document.getElementById("calc-status-banner");
    const bannerText = document.getElementById("calc-status-text");
    const resultsContainer = document.getElementById("calculator-results");

    const isLegal = errors.length === 0;

    if (banner && bannerText) {
        if (isLegal) {
            banner.className = "calc-result-pill";
            bannerText.innerHTML = `✅ <strong>Kombinationen är laglig!</strong> Ekipaget uppfyller alla krav för ditt ${licenseType}-körkort.`;
        } else {
            banner.className = "calc-result-pill warning";
            bannerText.innerHTML = `⚠️ <strong>Varning: Ej laglig kombination!</strong><br>${errors.join("<br>")}`;
        }
    }

    // Fyll i specifikationsrutan
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val;
    };

    setVal("val-car-name", car.name);
    setVal("val-car-curb", `${car.curb} kg`);
    setVal("val-car-total", `${car.total} kg`);
    setVal("val-car-maxtow", `${car.maxTow} kg`);
    setVal("val-trailer-name", trailer.name);
    setVal("val-trailer-curb", `${trailer.curb} kg`);
    setVal("val-trailer-total", `${trailer.total} kg`);
    setVal("val-trailer-maxload", `${maxPayload} kg`);
    setVal("val-actual-trailer-weight", `${actualTrailerWeight} kg`);
    setVal("val-train-weight", `${totalTrainWeight} kg`);
    setVal("val-license-limit", licenseLimitText);

    if (resultsContainer) {
        resultsContainer.classList.remove("hidden");
    }
}

function syncProfileLicenseDisplay(licenseVal) {
    const profileSelect = document.getElementById("profile-license-type");
    const profileDisplay = document.getElementById("profile-license-display");
    if (profileSelect) profileSelect.value = licenseVal;
    if (profileDisplay) {
        const labels = { "B": "Körkortsklass: B (Vanlig)", "B96": "Körkortsklass: B96 (Utökad)", "BE": "Körkortsklass: BE (Släp)" };
        profileDisplay.innerText = labels[licenseVal] || `Körkortsklass: ${licenseVal}`;
    }
}

// ----------------------------------------------------
// 6. VÄGHINDER (Equi väghinder.png)
// ----------------------------------------------------
async function initHazards() {
    const saveBtn = document.getElementById("btn-save-hazard");
    
    // Ladda befintliga hinder från Supabase / db.js
    try {
        if (typeof db !== "undefined") {
            const hazards = await db.getHazards();
            const listContainer = document.getElementById("hazard-list-container");
            if (hazards && hazards.length > 0 && listContainer) {
                listContainer.innerHTML = "";
                hazards.forEach(h => {
                    const item = document.createElement("div");
                    item.className = "hazard-card-item";
                    item.innerHTML = `
                        <div class="hazard-icon-box bg-orange-soft">
                            <span>⚠️</span>
                        </div>
                        <div class="hazard-card-details">
                            <strong>${h.type || "Väghinder"}</strong>
                            <span>${h.comment || "Rapporterat"} · ${h.timestamp || "aktivt"}</span>
                            <div class="hazard-actions-row">
                                <button class="hazard-vote-btn" onclick="this.classList.toggle('upvoted'); this.querySelector('.hazard-vote-count').innerText = this.classList.contains('upvoted') ? '1' : '0'">
                                    👍 Finns kvar <span class="hazard-vote-count">0</span>
                                </button>
                                <button class="hazard-vote-btn" onclick="this.closest('.hazard-card-item').style.opacity='0.4'; showToast('Tack! Hindret markerat som löst.', '✅')">
                                    ✅ Löst
                                </button>
                            </div>
                        </div>
                    `;
                    listContainer.appendChild(item);

                    // Placera ut markör på kartan om koordinater finns
                    if (h.lat && h.lng && map) {
                        L.marker([h.lat, h.lng], {
                            icon: L.divIcon({
                                className: 'custom-hazard-marker',
                                html: '<div style="background:#c04c3e;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,0.3);">⚠️</div>',
                                iconSize: [28, 28],
                                iconAnchor: [14, 14]
                            })
                        }).addTo(map).bindPopup(`<strong>${h.type}</strong><br>${h.comment}`);
                    }
                });
            }
        }
    } catch (e) {
        console.warn("Kunde inte hämta hinder från databasen:", e);
    }
    
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const hazardTypeSelect = document.getElementById("hazard-type");
            const hazardTypeValue = hazardTypeSelect.value;
            const hazardTypeText = hazardTypeSelect.options[hazardTypeSelect.selectedIndex].text;
            const comment = document.getElementById("hazard-comment").value.trim() || "Rapporterat av förare";
            const posDisplay = document.getElementById("hazard-coords-display").innerText;

            if (posDisplay.includes("Ingen position") || !selectedCoordinatesForHazard) {
                alert("Klicka först på kartan för att välja var hindret finns.");
                expandSidebar("peek");
                return;
            }

            const newHazard = {
                id: "h_" + Date.now(),
                lat: selectedCoordinatesForHazard[0],
                lng: selectedCoordinatesForHazard[1],
                type: hazardTypeText,
                comment: comment,
                timestamp: new Date().toISOString().split("T")[0]
            };

            // Spara i Supabase om uppkopplad
            try {
                if (typeof db !== "undefined") {
                    await db.saveHazard(newHazard);
                }
            } catch (e) {
                console.warn("Kunde inte spara till databas, visar lokalt:", e);
            }

            // Lägg till i listan
            const listContainer = document.getElementById("hazard-list-container");
            if (listContainer) {
                const newItem = document.createElement("div");
                newItem.className = "hazard-card-item";
                newItem.innerHTML = `
                    <div class="hazard-icon-box bg-orange-soft">
                        <span>⚠️</span>
                    </div>
                    <div class="hazard-card-details">
                        <strong>${hazardTypeText}</strong>
                        <span>${comment} · rapporterat nyss</span>
                        <div class="hazard-actions-row">
                            <button class="hazard-vote-btn" onclick="this.classList.toggle('upvoted'); this.querySelector('.hazard-vote-count').innerText = this.classList.contains('upvoted') ? '1' : '0'">
                                👍 Finns kvar <span class="hazard-vote-count">0</span>
                            </button>
                            <button class="hazard-vote-btn" onclick="this.closest('.hazard-card-item').style.opacity='0.4'; showToast('Tack! Hindret markerat som löst.', '✅')">
                                ✅ Löst
                            </button>
                        </div>
                    </div>
                `;
                listContainer.prepend(newItem);
            }

            showToast("Väghinder sparat på kartan & i databasen!", "✅");
            document.getElementById("hazard-comment").value = "";
            expandSidebar("expanded");
        });
    }
}

// ----------------------------------------------------
// 7. AKUT SOS (Equi akut sos.png)
// ----------------------------------------------------
function initEmergencySOS() {
    // Dynamiskt ladda och sortera kliniker efter avstånd
    loadAndSortClinics();
}

async function loadAndSortClinics() {
    const container = document.getElementById('emergency-list-container');
    if (!container) return;

    // Hämta kliniker från db.js
    const clinics = await db.getEmergencyClinics();
    
    // Hämta användarens position (eller kartans mittpunkt)
    let userLat, userLon;
    try {
        const center = map.getCenter();
        userLat = center.lat;
        userLon = center.lng;
    } catch(e) {
        userLat = 59.3293;
        userLon = 18.0686;
    }

    // Beräkna avstånd med Haversine och sortera
    clinics.forEach(clinic => {
        clinic.distance = haversineDistance(userLat, userLon, clinic.coords[0], clinic.coords[1]);
    });
    clinics.sort((a, b) => a.distance - b.distance);

    // Rendera klinikkorten
    container.innerHTML = '';
    clinics.forEach((clinic, idx) => {
        const distText = clinic.distance < 1 
            ? `${(clinic.distance * 1000).toFixed(0)} m` 
            : `${clinic.distance.toFixed(1)} km`;
        const isNearest = idx === 0;
        
        const card = document.createElement('div');
        card.className = `clinic-card${isNearest ? ' card-active-border' : ''}`;
        card.innerHTML = `
            <div class="clinic-card-top">
                <div>
                    <h4 class="clinic-name">${clinic.name}</h4>
                    <p class="clinic-address">${clinic.address}</p>
                    <p class="clinic-desc">${clinic.desc}</p>
                    <p class="clinic-turnspace">🔄 ${clinic.turnspace}</p>
                </div>
                <span class="clinic-distance-badge ${isNearest ? 'badge-red-soft' : 'badge-gray-soft'}">${distText}</span>
            </div>
            <div class="clinic-actions-row">
                <a href="tel:${clinic.tel.replace(/[\s-]/g, '')}" class="btn-outline-action">📞 Ring jour</a>
                <button class="btn-dark-action btn-compact" onclick="navigateClinic('${clinic.name.replace(/'/g, '\\\'')}', ${clinic.coords[0]}, ${clinic.coords[1]})">🧭 Navigera hit</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

window.navigateClinic = function(clinicName, lat, lon) {
    const startIn = document.getElementById("input-start");
    const endIn = document.getElementById("input-end");

    startIn.value = "Min position (GPS)";
    endIn.value = `${clinicName} (${lat}, ${lon})`;

    calculateAndShowRoute("Stockholm", `${lat}, ${lon}`);
    showToast(`Navigerar till ${clinicName}`, "🚨");
};

// ----------------------------------------------------
// 8. SPARADE RUTTER & PROFIL
// ----------------------------------------------------
window.loadSavedRoute = function(start, end) {
    document.getElementById("home-input-start").value = start;
    document.getElementById("home-input-end").value = end;
    document.getElementById("input-start").value = start;
    document.getElementById("input-end").value = end;

    calculateAndShowRoute(start, end);
};

function initProfileSettings() {
    const menuVehicles = document.getElementById("menu-vehicles");
    const menuNotif = document.getElementById("menu-notifications");
    const menuSupport = document.getElementById("menu-support");
    const resetBtn = document.getElementById("btn-reset-app");
    const licenseSelect = document.getElementById("profile-license-type");

    // Ladda och synka sparad körkortsklass i profilen
    const savedLicense = localStorage.getItem("equinav-license") || "B96";
    syncProfileLicenseDisplay(savedLicense);

    if (licenseSelect) {
        licenseSelect.addEventListener("change", (e) => {
            const val = e.target.value;
            localStorage.setItem("equinav-license", val);
            syncProfileLicenseDisplay(val);
            const targetRadio = document.querySelector(`input[name="license-type"][value="${val}"]`);
            if (targetRadio) {
                targetRadio.checked = true;
            }
            showToast(`Körkortsklass uppdaterad till ${val}`, "🪪");
        });
    }

    if (menuVehicles) {
        menuVehicles.addEventListener("click", () => switchTab("tab-calculator"));
    }
    if (menuNotif) {
        menuNotif.addEventListener("click", () => showToast("Notiser är påslagna för akuta väghinder.", "🔔"));
    }
    if (menuSupport) {
        menuSupport.addEventListener("click", () => {
            alert("EquiNav Support:\nKontakta oss på support@equinav.se för hjälp och önskemål om funktioner.");
        });
    }
    if (resetBtn) {
        resetBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (confirm("Vill du nollställa alla sparade ekipage, preferenser och inställningar?")) {
                localStorage.clear();
                showToast("All data har nollställts.", "🧹");
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            }
        });
    }
}

// ----------------------------------------------------
// 9. LIVE-NAVIGERING HUD & RÖSTNAVIGERING (Equi live-navigering.png)
// ----------------------------------------------------
let navInterval = null;
let navCoordsIndex = 0;
let isNavRunning = false;
let isNavPaused = false;
let navSpeedMultiplier = 1;
let isVoiceEnabled = true;
let vehicleMarker = null;
let lastSpokenText = "";

function initNavigationMode() {
    const startNavBtn = document.getElementById("btn-start-navigation");
    const endNavBtn = document.getElementById("btn-end-navigation");
    const navHazardBtn = document.getElementById("btn-nav-hazard");
    const navVoiceBtn = document.getElementById("btn-nav-voice");
    const navRecenterBtn = document.getElementById("btn-nav-recenter");
    const simPlayPauseBtn = document.getElementById("btn-sim-play-pause");
    const simSpeedBtn = document.getElementById("btn-sim-speed-btn");

    if (startNavBtn) {
        startNavBtn.addEventListener("click", () => {
            startLiveNavigation();
        });
    }

    if (endNavBtn) {
        endNavBtn.addEventListener("click", () => {
            stopLiveNavigation();
        });
    }

    if (navHazardBtn) {
        navHazardBtn.addEventListener("click", () => {
            switchTab("tab-hazards");
        });
    }

    if (navVoiceBtn) {
        navVoiceBtn.addEventListener("click", () => {
            isVoiceEnabled = !isVoiceEnabled;
            const icon = document.getElementById("icon-nav-voice");
            if (isVoiceEnabled) {
                navVoiceBtn.classList.add("active");
                if (icon) icon.innerText = "🔊";
                showToast("Röstguidning: Påslagen (Svenska)", "🔊");
                speakSwedishInstruction("Röstguidning påslagen.");
            } else {
                navVoiceBtn.classList.remove("active");
                if (icon) icon.innerText = "🔇";
                showToast("Röstguidning: Avstängd", "🔇");
            }
        });
    }

    if (navRecenterBtn) {
        navRecenterBtn.addEventListener("click", () => {
            if (vehicleMarker) {
                map.setView(vehicleMarker.getLatLng(), 16, { animate: true });
                showToast("Centrerad på ekipaget", "🎯");
            }
        });
    }

    if (simPlayPauseBtn) {
        simPlayPauseBtn.addEventListener("click", () => {
            isNavPaused = !isNavPaused;
            const icon = document.getElementById("sim-play-icon");
            const text = document.getElementById("sim-play-text");
            if (isNavPaused) {
                if (icon) icon.innerText = "▶️";
                if (text) text.innerText = "Kör";
                showToast("Navigering pausad", "⏸️");
            } else {
                if (icon) icon.innerText = "⏸️";
                if (text) text.innerText = "Paus";
                showToast("Navigering återupptagen", "▶️");
            }
        });
    }

    if (simSpeedBtn) {
        simSpeedBtn.addEventListener("click", () => {
            if (navSpeedMultiplier === 1) navSpeedMultiplier = 3;
            else if (navSpeedMultiplier === 3) navSpeedMultiplier = 8;
            else navSpeedMultiplier = 1;

            simSpeedBtn.innerText = `⚡ ${navSpeedMultiplier}x`;
            showToast(`Simuleringshastighet: ${navSpeedMultiplier}x`, "⚡");
        });
    }
}

function startLiveNavigation() {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        calculateAndShowRoute("Stockholm", "Strömsholm");
    }

    const sidebar = document.getElementById("app-sidebar");
    const navHud = document.getElementById("navigation-hud");

    sidebar.className = "sidebar state-collapsed";
    navHud.classList.remove("hidden");

    isNavRunning = true;
    isNavPaused = false;
    navCoordsIndex = 0;
    lastSpokenText = "";

    // Skapa fordonets pulserande markör
    if (vehicleMarker) map.removeLayer(vehicleMarker);
    const startPt = currentRouteCoordinates[0] || [59.3293, 18.0686];

    vehicleMarker = L.marker(startPt, {
        icon: L.divIcon({
            className: 'vehicle-nav-marker',
            html: `
                <div class="vehicle-pulse-ring"></div>
                <div class="vehicle-nav-core" id="vehicle-core-icon">🐎</div>
            `,
            iconSize: [44, 44],
            iconAnchor: [22, 22]
        }),
        zIndexOffset: 1000
    }).addTo(map);

    map.setView(startPt, 16, { animate: true });

    showToast("Live GPS-navigering startad! Max 80 km/h med hästsläp.", "🟢");
    speakSwedishInstruction("Navigering startad. Följ den säkra rutten. Tänk på att hålla max 80 km i timmen med hästtransport.");

    if (navInterval) clearInterval(navInterval);
    navInterval = setInterval(stepNavigationSimulation, 500);

    // Trigga Zero-Speed Annons vid stillastående
    triggerZeroSpeedAd();
}

function stopLiveNavigation() {
    isNavRunning = false;
    if (navInterval) {
        clearInterval(navInterval);
        navInterval = null;
    }

    if (vehicleMarker) {
        map.removeLayer(vehicleMarker);
        vehicleMarker = null;
    }

    const navHud = document.getElementById("navigation-hud");
    navHud.classList.add("hidden");
    expandSidebar("expanded");

    showToast("Navigering avslutad.", "🏁");
}

function stepNavigationSimulation() {
    if (!isNavRunning || isNavPaused || !currentRouteCoordinates.length) return;

    // Flytta framåt baserat på hastighetsmultiplikator
    navCoordsIndex += navSpeedMultiplier;
    if (navCoordsIndex >= currentRouteCoordinates.length - 1) {
        navCoordsIndex = currentRouteCoordinates.length - 1;
        finishNavigation();
        return;
    }

    const currentPt = currentRouteCoordinates[navCoordsIndex];
    const nextPt = currentRouteCoordinates[Math.min(navCoordsIndex + 1, currentRouteCoordinates.length - 1)];

    // Beräkna riktningsvinkel (bearing)
    const bearing = calculateBearing(currentPt[0], currentPt[1], nextPt[0], nextPt[1]);
    const vehicleIcon = document.getElementById("vehicle-core-icon");
    if (vehicleIcon) {
        vehicleIcon.style.transform = `rotate(${bearing}deg)`;
    }

    if (vehicleMarker) {
        vehicleMarker.setLatLng(currentPt);
    }

    // Centrera kartan mjukt på ekipaget
    map.panTo(currentPt, { animate: true, duration: 0.4 });

    // Hitta aktuell och nästa svänginstruktion
    updateTurnInstructionsAndStats(currentPt);
}

function updateTurnInstructionsAndStats(currentPt) {
    const totalPoints = currentRouteCoordinates.length;
    const remainingFraction = Math.max(0, (totalPoints - navCoordsIndex) / totalPoints);
    const remainingKm = Math.max(0.1, ((currentRouteTotalDistance || 15000) * remainingFraction / 1000)).toFixed(1);
    
    // Hästtransporthastighet ~72-78 km/h på rak väg, lägre vid svängar
    const baseSpeed = Math.floor(72 + Math.sin(navCoordsIndex * 0.3) * 6);
    const speedPill = document.getElementById("nav-current-speed");
    if (speedPill) {
        speedPill.innerText = `${baseSpeed} km/h`;
        if (baseSpeed > 80) {
            speedPill.classList.add("speed-warning");
        } else {
            speedPill.classList.remove("speed-warning");
        }
    }

    // Beräkna ankomsttid
    const remainingMins = Math.round((remainingKm / 75) * 60);
    const hrs = Math.floor(remainingMins / 60);
    const mins = remainingMins % 60;
    const timeRemainingText = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;

    const now = new Date();
    now.setMinutes(now.getMinutes() + remainingMins);
    const arrivalClock = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    const navTimeEl = document.getElementById("nav-time-remaining");
    const navDistEl = document.getElementById("nav-dist-remaining");
    const navEtaEl = document.getElementById("nav-eta");

    if (navTimeEl) navTimeEl.innerText = timeRemainingText;
    if (navDistEl) navDistEl.innerText = `${remainingKm} km`;
    if (navEtaEl) navEtaEl.innerText = `Ankomst ${arrivalClock}`;

    // Hitta närmaste svängpunkt i steps
    const step = getActiveManeuverStep(navCoordsIndex, totalPoints);
    const turnIcon = document.getElementById("nav-turn-icon");
    const nextDist = document.getElementById("nav-next-dist");
    const nextText = document.getElementById("nav-next-text");
    const subText = document.getElementById("nav-sub-text");

    if (nextDist) nextDist.innerText = step.distText;
    if (nextText) nextText.innerText = step.instruction;
    if (subText) subText.innerText = step.subInstruction;

    if (turnIcon) {
        turnIcon.innerHTML = step.iconSvg;
    }

    // Röstguidning vid nyckelavstånd
    if (step.shouldSpeak && step.instruction !== lastSpokenText) {
        lastSpokenText = step.instruction;
        speakSwedishInstruction(step.speechText);
    }
}

function getActiveManeuverStep(index, total) {
    const progress = index / total;

    if (progress > 0.92) {
        return {
            distText: "150 m",
            instruction: "Sväng höger framme vid målet",
            subInstruction: "Sedan är du framme vid stallet",
            iconSvg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>',
            speechText: "Om 150 meter, sväng höger framme vid målet.",
            shouldSpeak: true
        };
    } else if (progress > 0.65) {
        return {
            distText: "450 m",
            instruction: "Ta 2:a avfarten i rondellen mot Enköping",
            subInstruction: "Sedan fortsätt på väg 263",
            iconSvg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>',
            speechText: "Om 450 meter, ta andra avfarten i rondellen.",
            shouldSpeak: true
        };
    } else if (progress > 0.35) {
        return {
            distText: "1,2 km",
            instruction: "Håll höger in på E18 mot Västerås",
            subInstruction: "Sedan fortsätt 8,4 km på motorväg",
            iconSvg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>',
            speechText: "Om en kilometer, håll höger in på E18. Håll max 80 med släpet.",
            shouldSpeak: true
        };
    } else {
        return {
            distText: "250 m",
            instruction: "Sväng vänster in på Vibyvägen",
            subInstruction: "Sedan Rimbo Skolväg",
            iconSvg: '<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>',
            speechText: "Om 250 meter, sväng vänster in på Vibyvägen.",
            shouldSpeak: index === 1
        };
    }
}

function finishNavigation() {
    isNavRunning = false;
    if (navInterval) clearInterval(navInterval);

    const nextText = document.getElementById("nav-next-text");
    const subText = document.getElementById("nav-sub-text");
    const nextDist = document.getElementById("nav-next-dist");

    if (nextText) nextText.innerText = "Du har nått din destination! 🐎🏁";
    if (subText) subText.innerText = "Godkänd och säker parkering för hästtransport";
    if (nextDist) nextDist.innerText = "Framme";

    speakSwedishInstruction("Du har nått din destination. Tack för att du kör säkert med EquiNav!");
    showToast("Du har nått din destination! 🎉", "🏁");
}

function speakSwedishInstruction(text) {
    if (!isVoiceEnabled || !window.speechSynthesis) return;

    try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "sv-SE";
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        const voices = window.speechSynthesis.getVoices();
        const svVoice = voices.find(v => v.lang.startsWith("sv"));
        if (svVoice) utterance.voice = svVoice;

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("Talsyntes ej tillgänglig:", e);
    }
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = deg => deg * (Math.PI / 180);
    const toDeg = rad => rad * (180 / Math.PI);

    const dLon = toRad(lon2 - lon1);
    const y = Math.sin(dLon) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);

    const brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
}

// ----------------------------------------------------
// MITT EKIPAGE / SAVED PRESETS
// ----------------------------------------------------
function initSavedPresets() {
    const saveBtn = document.getElementById('btn-save-preset');
    const loadBtn = document.getElementById('btn-load-preset');

    // Visa "Ladda mitt ekipage" om det finns sparad data
    const savedPreset = JSON.parse(localStorage.getItem('equinav-preset') || 'null');
    if (savedPreset && loadBtn) {
        loadBtn.classList.remove('hidden');
    }
    
    // Visa sparat ekipage i profil
    if (savedPreset) {
        showSavedPresetDisplay(savedPreset);
        // Fyll i formuläret med sparade värden
        const carReg = document.getElementById('preset-car-reg');
        const trailerReg = document.getElementById('preset-trailer-reg');
        const horseWeight = document.getElementById('preset-horse-weight');
        const presetName = document.getElementById('preset-name');
        if (carReg) carReg.value = savedPreset.carReg || '';
        if (trailerReg) trailerReg.value = savedPreset.trailerReg || '';
        if (horseWeight) horseWeight.value = savedPreset.horseWeight || '';
        if (presetName) presetName.value = savedPreset.name || '';
    }

    // Spara ekipage
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const preset = {
                carReg: (document.getElementById('preset-car-reg')?.value || '').trim().toUpperCase(),
                trailerReg: (document.getElementById('preset-trailer-reg')?.value || '').trim().toUpperCase(),
                horseWeight: parseFloat(document.getElementById('preset-horse-weight')?.value) || 0,
                name: (document.getElementById('preset-name')?.value || '').trim()
            };

            if (!preset.carReg && !preset.trailerReg) {
                alert('Ange minst ett regnummer för att spara ekipaget.');
                return;
            }

            localStorage.setItem('equinav-preset', JSON.stringify(preset));
            showSavedPresetDisplay(preset);
            showToast('Ekipage sparat!', '✅');

            // Visa ladda-knappen i kalkylatorn
            if (loadBtn) loadBtn.classList.remove('hidden');
        });
    }

    // Ladda ekipage till viktkalkylator
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            const preset = JSON.parse(localStorage.getItem('equinav-preset') || 'null');
            if (!preset) {
                showToast('Inget ekipage sparat. Gå till Profil → Mitt Ekipage.', '⚠️');
                return;
            }

            const carReg = document.getElementById('calc-car-reg');
            const trailerReg = document.getElementById('calc-trailer-reg');
            const horseWeight = document.getElementById('calc-horse-weight');

            if (carReg) carReg.value = preset.carReg;
            if (trailerReg) trailerReg.value = preset.trailerReg;
            if (horseWeight) horseWeight.value = preset.horseWeight || 600;

            calculateWeights();
            showToast(`Ekipage "${preset.name || preset.carReg}" laddat!`, '🚗');
        });
    }
}

function showSavedPresetDisplay(preset) {
    const display = document.getElementById('saved-preset-display');
    const text = document.getElementById('saved-preset-text');
    if (display && text) {
        display.classList.remove('hidden');
        const label = preset.name || `${preset.carReg} + ${preset.trailerReg}`;
        text.innerText = `✅ Sparat: ${label} (Häst: ${preset.horseWeight || '–'} kg)`;
    }
}

// ----------------------------------------------------
// SAFE ARRIVAL (Dela resa)
// ----------------------------------------------------
function initSafeArrival() {
    const shareBtn = document.getElementById('btn-share-trip');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            const destination = document.getElementById('input-end')?.value || 'okänd destination';
            const eta = document.getElementById('stat-horse-eta')?.innerText || '';
            const now = new Date();
            
            // Beräkna ungefärlig ankomsttid
            let arrivalText = '';
            if (eta) {
                const match = eta.match(/(\d+)h\s*(\d+)m|^(\d+)m$/); 
                if (match) {
                    const hours = parseInt(match[1] || 0);
                    const minutes = parseInt(match[2] || match[3] || 0);
                    const arrival = new Date(now.getTime() + (hours * 60 + minutes) * 60000);
                    arrivalText = `${arrival.getHours().toString().padStart(2, '0')}:${arrival.getMinutes().toString().padStart(2, '0')}`;
                }
            }

            const shareText = `🐴 Jag kör med hästtransport till ${destination}. Beräknad ankomst: ${arrivalText || 'okänd'}. Följ mig via EquiNav!`;

            if (navigator.share) {
                navigator.share({
                    title: 'EquiNav – Safe Arrival',
                    text: shareText,
                    url: window.location.href
                }).catch(() => {});
            } else {
                // Fallback: kopiera till urklipp
                navigator.clipboard.writeText(shareText).then(() => {
                    showToast('Meddelande kopierat! Klistra in i SMS eller WhatsApp.', '📋');
                }).catch(() => {
                    prompt('Kopiera detta meddelande:', shareText);
                });
            }
        });
    }
}

// ----------------------------------------------------
// ZERO-SPEED ADS
// ----------------------------------------------------
let zeroSpeedTimer = null;

function initZeroSpeedAds() {
    const adBanner = document.getElementById('zero-speed-ad');
    const closeAdBtn = document.getElementById('btn-close-ad');
    
    if (closeAdBtn) {
        closeAdBtn.addEventListener('click', () => {
            if (adBanner) adBanner.classList.add('hidden');
            if (zeroSpeedTimer) clearTimeout(zeroSpeedTimer);
        });
    }
}

function triggerZeroSpeedAd() {
    const adBanner = document.getElementById('zero-speed-ad');
    if (!adBanner) return;

    if (zeroSpeedTimer) clearTimeout(zeroSpeedTimer);
    // Visa kontextuell hästtransport-annons vid stillastående efter 4 sekunder
    zeroSpeedTimer = setTimeout(() => {
        const navHud = document.getElementById("navigation-hud");
        if (navHud && !navHud.classList.contains("hidden")) {
            adBanner.classList.remove('hidden');
        }
    }, 4000);
}

// ----------------------------------------------------
// EQUINAV PRO MODAL
// ----------------------------------------------------
function initProModal() {
    const openProBtn = document.getElementById('btn-open-pro');
    const closeProBtn = document.getElementById('btn-close-pro-modal');
    const proModal = document.getElementById('pro-modal');
    const subscribeBtn = document.getElementById('btn-subscribe-pro');

    if (openProBtn && proModal) {
        openProBtn.addEventListener('click', () => {
            proModal.classList.remove('hidden');
        });
    }

    if (closeProBtn && proModal) {
        closeProBtn.addEventListener('click', () => {
            proModal.classList.add('hidden');
        });
    }

    // Klick utanför modal-kortet stänger den
    if (proModal) {
        proModal.addEventListener('click', (e) => {
            if (e.target === proModal) {
                proModal.classList.add('hidden');
            }
        });
    }

    if (subscribeBtn) {
        subscribeBtn.addEventListener('click', () => {
            showToast('Tack för ditt intresse! Betalning kommer snart.', '⭐');
            if (proModal) proModal.classList.add('hidden');
        });
    }
}

// ----------------------------------------------------
// HJÄLPHANTERARE
// ----------------------------------------------------
function getUserGpsPosition(callback) {
    if (!navigator.geolocation) {
        showToast("GPS stöds inte i denna webbläsare", "❌");
        if (callback) callback(null);
        return;
    }
    
    showToast("Söker din GPS-position...", "📍");
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const coords = [parseFloat(pos.coords.latitude.toFixed(5)), parseFloat(pos.coords.longitude.toFixed(5))];
            console.log("[EquiNav GPS] Position hittad:", coords);
            currentUserGpsCoords = coords;

            if (userLocationMarker) map.removeLayer(userLocationMarker);
            userLocationMarker = L.circleMarker(coords, {
                radius: 9,
                fillColor: "#345735",
                color: "#ffffff",
                weight: 3,
                fillOpacity: 1
            }).addTo(map);

            // Zooma in direkt på användarens position
            map.setView(coords, 14, { animate: true });

            if (callback) callback(coords);
        },
        (err) => {
            console.warn("[EquiNav GPS] Fel:", err.code, err.message);
            if (err.code === 1) {
                showToast("GPS-åtkomst nekad. Tillåt platsåtkomst i webbläsaren.", "⚠️");
            } else if (err.code === 2) {
                showToast("GPS-position otillgänglig just nu.", "⚠️");
            } else {
                showToast("GPS-timeout. Försök igen.", "⚠️");
            }
            // Returnera null – INTE Stockholm-fallback
            if (callback) callback(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
}

function showToast(msg, icon = "📍") {
    const toast = document.getElementById("map-toast");
    if (!toast) return;

    toast.querySelector(".toast-icon").innerText = icon;
    toast.querySelector(".toast-message").innerText = msg;
    toast.classList.remove("hidden");

    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 4000);
}

// ----------------------------------------------------
// 10. NATTLÄGE / NIGHT DRIVING MODE
// ----------------------------------------------------
let darkTileLayer = null;
let lightTileLayer = null;

function initNightMode() {
    const toggle = document.getElementById('toggle-night-mode');
    const switchBtn = document.getElementById('night-mode-switch');
    if (!toggle || !switchBtn) return;

    // Ladda sparad preferens
    const saved = localStorage.getItem('equinav-night-mode');
    if (saved === 'on') {
        activateNightMode(switchBtn);
    }

    toggle.addEventListener('click', () => {
        const isActive = document.documentElement.getAttribute('data-theme') === 'dark';
        if (isActive) {
            deactivateNightMode(switchBtn);
        } else {
            activateNightMode(switchBtn);
        }
    });
}

function activateNightMode(switchBtn) {
    document.documentElement.setAttribute('data-theme', 'dark');
    if (switchBtn) switchBtn.classList.add('active');
    localStorage.setItem('equinav-night-mode', 'on');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#121815');
}

function deactivateNightMode(switchBtn) {
    document.documentElement.removeAttribute('data-theme');
    if (switchBtn) switchBtn.classList.remove('active');
    localStorage.setItem('equinav-night-mode', 'off');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#345735');
}

document.getElementById("btn-toast-close")?.addEventListener("click", () => {
    document.getElementById("map-toast")?.classList.add("hidden");
});

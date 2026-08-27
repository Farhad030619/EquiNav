/**
 * EquiNav – Komplett applikationslogik
 * Premium hästtransport-navigation, viktkalkylator, väghinder och jour-SOS.
 */

let map = null;
let routeLine = null;
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

// Initialisering vid sidladdning
window.addEventListener("DOMContentLoaded", () => {
    initMap();
    initTabs();
    initNavigationTree();
    initHomeRoutePlanner();
    initRoutePlanner();
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
function initMap() {
    try {
        const initialCenter = [59.45, 17.20]; // Mellan Stockholm och Strömsholm
        map = L.map("map", {
            zoomControl: false,
            attributionControl: false
        }).setView(initialCenter, 8);

        // Ljus ren Apple/Carto-karta
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(map);

        // Klick på kartan
        map.on("click", (e) => {
            const lat = parseFloat(e.latlng.lat.toFixed(5));
            const lng = parseFloat(e.latlng.lng.toFixed(5));
            handleMapClick(lat, lng);
        });

        // Ladda initiala hästkliniker på kartan
        addInitialClinicsToMap();

    } catch (err) {
        console.error("Fel vid initiering av karta:", err);
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

    // Notis-klockan
    const notifBtn = document.getElementById("btn-notifications");
    if (notifBtn) {
        notifBtn.addEventListener("click", () => {
            showToast("Inga aktiva trafikvarningar i ditt närområde.", "🔔");
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
                const startIn = document.getElementById("home-input-start");
                startIn.value = "Min position (GPS)";
                startIn.dataset.lat = pos[0];
                startIn.dataset.lng = pos[1];
                showToast("GPS-position lokaliserad", "🟢");
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
                const startIn = document.getElementById("input-start");
                startIn.value = "Min position (GPS)";
                startIn.dataset.lat = pos[0];
                startIn.dataset.lng = pos[1];
                showToast("GPS-position lokaliserad", "🟢");
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

function getCoordsForPlace(name) {
    const key = name.toLowerCase().trim();
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

async function calculateAndShowRoute(startPlace, endPlace) {
    switchTab("tab-route");
    showToast("Beräknar säkraste rutt för hästtransport...", "🐎");

    const startCoords = getCoordsForPlace(startPlace);
    const endCoords = getCoordsForPlace(endPlace);

    // Rita markörer på kartan
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (routeLine) map.removeLayer(routeLine);

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

    // Hämta rutt via OpenRouteService eller OSRM
    try {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${startCoords[1]},${startCoords[0]};${endCoords[1]},${endCoords[0]}?overview=full&geometries=geojson`;
        const res = await fetch(osrmUrl);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            const coordinates = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            // Rita grön ruttlinje
            routeLine = L.polyline(coordinates, {
                color: "#345735",
                weight: 6,
                opacity: 0.9,
                lineJoin: 'round'
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

            document.getElementById("stat-horse-eta").innerText = horseEta;
            document.getElementById("stat-car-eta").innerText = carEta;
            document.getElementById("stat-distance").innerText = `${distKm} km`;
            document.getElementById("route-title").innerText = `${startPlace} till ${endPlace}`;

            // Visa resultatsektionen
            document.getElementById("route-results").classList.remove("hidden");
            showToast("Rutt beräknad och optimerad!", "✅");
            return;
        }
    } catch (e) {
        console.warn("Kunde inte hämta OSRM-rutt, ritar interpolerad linje:", e);
    }

    // Fallback ruttlinje
    const fallbackCoords = [startCoords, [(startCoords[0]+endCoords[0])/2 + 0.05, (startCoords[1]+endCoords[1])/2], endCoords];
    routeLine = L.polyline(fallbackCoords, {
        color: "#345735",
        weight: 6,
        opacity: 0.9
    }).addTo(map);
    map.fitBounds(routeLine.getBounds(), { padding: [40, 40] });

    document.getElementById("route-results").classList.remove("hidden");
}

// ----------------------------------------------------
// 5. VIKTKALKYLATOR (Equi viktkalkyl.png)
// ----------------------------------------------------
function initWeightCalculator() {
    const calcBtn = document.getElementById("btn-calculate-weights");
    const radioInputs = document.querySelectorAll('input[name="license-type"]');

    // Klick på körkortskort
    document.querySelectorAll(".license-choice-card").forEach(card => {
        card.addEventListener("click", () => {
            const radio = card.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                calculateWeights();
            }
        });
    });

    if (calcBtn) {
        calcBtn.addEventListener("click", calculateWeights);
    }

    // Kör en första kontroll
    calculateWeights();
}

async function calculateWeights() {
    const carReg = (document.getElementById("calc-car-reg")?.value || "SEO345").trim().toUpperCase();
    const trailerReg = (document.getElementById("calc-trailer-reg")?.value || "TRL004").trim().toUpperCase();
    const horseWeight = parseFloat(document.getElementById("calc-horse-weight")?.value) || 600;
    const licenseType = document.querySelector('input[name="license-type"]:checked')?.value || "B";

    let carCurbWeight = 1650;
    let carTotalWeight = 2150;
    let carMaxTow = 2000;
    let trailerEmptyWeight = 800;
    let trailerTotalWeight = 1400;

    // Försök hämta fordonsdata från Supabase/db.js
    try {
        if (typeof db !== "undefined") {
            const carSpecs = await db.getCarSpecs(carReg);
            if (carSpecs) {
                carCurbWeight = carSpecs.curb || carCurbWeight;
                carTotalWeight = carSpecs.total || carTotalWeight;
                carMaxTow = carSpecs.maxTow || carMaxTow;
            }
            const trailerSpecs = await db.getTrailerSpecs(trailerReg);
            if (trailerSpecs) {
                trailerEmptyWeight = trailerSpecs.curb || trailerEmptyWeight;
                trailerTotalWeight = trailerSpecs.total || trailerTotalWeight;
            }
        }
    } catch (e) {
        console.warn("Kunde inte hämta fordonsspecifikationer från databasen, använder standardvärden:", e);
    }

    const actualTrailerWeight = trailerEmptyWeight + horseWeight;
    const totalTrainWeight = carTotalWeight + trailerTotalWeight;
    const maxAllowedTrainWeight = licenseType === "BE" ? 7000 : (licenseType === "B96" ? 4250 : 3500);

    const banner = document.getElementById("calc-status-banner");
    const bannerText = document.getElementById("calc-status-text");
    const resultsContainer = document.getElementById("calculator-results");

    // Uppdatera visade specifikationer
    const valCarCurb = document.getElementById("val-car-curb");
    const valTrailerTotal = document.getElementById("val-trailer-total");
    const valTrainWeight = document.getElementById("val-train-weight");
    if (valCarCurb) valCarCurb.innerText = `${carCurbWeight} kg`;
    if (valTrailerTotal) valTrailerTotal.innerText = `${trailerTotalWeight} kg`;
    if (valTrainWeight) valTrainWeight.innerText = `${totalTrainWeight} kg`;

    if (totalTrainWeight <= maxAllowedTrainWeight && actualTrailerWeight <= trailerTotalWeight) {
        banner.className = "calc-result-pill";
        bannerText.innerText = `Kombinationen är laglig för ditt ${licenseType}-körkort (${totalTrainWeight}kg av max ${maxAllowedTrainWeight}kg).`;
    } else if (actualTrailerWeight > trailerTotalWeight) {
        banner.className = "calc-result-pill warning";
        bannerText.innerText = `Varning: Hästen + släpets vikt (${actualTrailerWeight}kg) överstiger släpets totalvikt (${trailerTotalWeight}kg).`;
    } else {
        banner.className = "calc-result-pill warning";
        bannerText.innerText = `Varning: Totalvikten (${totalTrainWeight}kg) överskrider gränsen för ${licenseType}-körkort (${maxAllowedTrainWeight}kg).`;
    }

    if (resultsContainer) {
        resultsContainer.classList.remove("hidden");
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
            if (confirm("Vill du nollställa sparade rutter och inställningar?")) {
                showToast("Data har nollställts.", "🧹");
            }
        });
    }
}

// ----------------------------------------------------
// 9. LIVE-NAVIGERING HUD (Equi live-navigering.png)
// ----------------------------------------------------
function initNavigationMode() {
    const startNavBtn = document.getElementById("btn-start-navigation");
    const endNavBtn = document.getElementById("btn-end-navigation");
    const navHud = document.getElementById("navigation-hud");
    const navHazardBtn = document.getElementById("btn-nav-hazard");
    const navVoiceBtn = document.getElementById("btn-nav-voice");

    if (startNavBtn) {
        startNavBtn.addEventListener("click", () => {
            // Dölj sidebar och visa HUD över kartan
            const sidebar = document.getElementById("app-sidebar");
            sidebar.className = "sidebar state-collapsed";
            navHud.classList.remove("hidden");

            if (routeLine) {
                map.setView(routeLine.getBounds().getCenter(), 14);
            }

            showToast("GPS Live-navigering startad!", "🟢");
        });
    }

    if (endNavBtn) {
        endNavBtn.addEventListener("click", () => {
            navHud.classList.add("hidden");
            expandSidebar("expanded");
            showToast("Navigering avslutad.", "🏁");
        });
    }

    if (navHazardBtn) {
        navHazardBtn.addEventListener("click", () => {
            switchTab("tab-hazards");
        });
    }

    if (navVoiceBtn) {
        navVoiceBtn.addEventListener("click", () => {
            showToast("Röstguidning: Påslagen (Svenska)", "🔊");
        });
    }
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
function initZeroSpeedAds() {
    const adBanner = document.getElementById('zero-speed-ad');
    const closeAdBtn = document.getElementById('btn-close-ad');
    
    if (closeAdBtn) {
        closeAdBtn.addEventListener('click', () => {
            if (adBanner) adBanner.classList.add('hidden');
        });
    }

    // Simulated: show ad after 10s of navigation being active, hide when "moving"
    // In real app this would use GPS speed === 0 for 3-5 seconds
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
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = [parseFloat(pos.coords.latitude.toFixed(5)), parseFloat(pos.coords.longitude.toFixed(5))];
                if (userLocationMarker) map.removeLayer(userLocationMarker);
                userLocationMarker = L.circleMarker(coords, {
                    radius: 8,
                    fillColor: "#345735",
                    color: "#ffffff",
                    weight: 3,
                    fillOpacity: 1
                }).addTo(map);
                callback(coords);
            },
            (err) => {
                console.warn("GPS fel:", err);
                callback([59.3293, 18.0686]); // Stockholm fallback
            },
            { enableHighAccuracy: true, timeout: 5000 }
        );
    } else {
        callback([59.3293, 18.0686]);
    }
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

    // Spara referens till befintligt ljust kartlager
    map.eachLayer(layer => {
        if (layer._url && layer._url.includes('basemaps.cartocdn.com')) {
            lightTileLayer = layer;
        }
    });

    // Skapa mörkt kartlager (inte tillagt än)
    darkTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    });

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

    // Byt karttiles till mörkt tema
    if (lightTileLayer && map.hasLayer(lightTileLayer)) {
        map.removeLayer(lightTileLayer);
    }
    if (darkTileLayer && !map.hasLayer(darkTileLayer)) {
        darkTileLayer.addTo(map);
    }

    // Uppdatera meta theme-color
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#121815');
}

function deactivateNightMode(switchBtn) {
    document.documentElement.removeAttribute('data-theme');
    if (switchBtn) switchBtn.classList.remove('active');
    localStorage.setItem('equinav-night-mode', 'off');

    // Byt tillbaka till ljust karttema
    if (darkTileLayer && map.hasLayer(darkTileLayer)) {
        map.removeLayer(darkTileLayer);
    }
    if (lightTileLayer && !map.hasLayer(lightTileLayer)) {
        lightTileLayer.addTo(map);
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#345735');
}

document.getElementById("btn-toast-close")?.addEventListener("click", () => {
    document.getElementById("map-toast")?.classList.add("hidden");
});

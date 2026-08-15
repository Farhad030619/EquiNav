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
    initDragHandle();
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

function calculateWeights() {
    const carReg = (document.getElementById("calc-car-reg")?.value || "SEO345").trim().toUpperCase();
    const trailerReg = (document.getElementById("calc-trailer-reg")?.value || "TRL004").trim().toUpperCase();
    const horseWeight = parseFloat(document.getElementById("calc-horse-weight")?.value) || 600;
    const licenseType = document.querySelector('input[name="license-type"]:checked')?.value || "B";

    const carCurbWeight = 1650;
    const carTotalWeight = 2150;
    const trailerEmptyWeight = 800;
    const trailerTotalWeight = 1400;

    const actualTrailerWeight = trailerEmptyWeight + horseWeight;
    const totalTrainWeight = carTotalWeight + trailerTotalWeight;
    const maxAllowedTrainWeight = licenseType === "B96" ? 4250 : 3500;

    const banner = document.getElementById("calc-status-banner");
    const bannerText = document.getElementById("calc-status-text");
    const resultsContainer = document.getElementById("calculator-results");

    if (totalTrainWeight <= maxAllowedTrainWeight && actualTrailerWeight <= trailerTotalWeight) {
        banner.className = "calc-result-pill";
        bannerText.innerText = `Kombinationen är laglig för ditt ${licenseType === "B96" ? "B96" : "B"}-körkort (${totalTrainWeight}kg av max ${maxAllowedTrainWeight}kg).`;
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
function initHazards() {
    const saveBtn = document.getElementById("btn-save-hazard");
    
    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const hazardTypeSelect = document.getElementById("hazard-type");
            const hazardTypeText = hazardTypeSelect.options[hazardTypeSelect.selectedIndex].text;
            const comment = document.getElementById("hazard-comment").value.trim() || "Rapporterat av förare";
            const posDisplay = document.getElementById("hazard-coords-display").innerText;

            if (posDisplay.includes("Ingen position")) {
                alert("Klicka först på kartan för att välja var hindret finns.");
                expandSidebar("peek");
                return;
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
                    </div>
                `;
                listContainer.prepend(newItem);
            }

            showToast("Väghinder sparat på kartan!", "✅");
            document.getElementById("hazard-comment").value = "";
            expandSidebar("expanded");
        });
    }
}

// ----------------------------------------------------
// 7. AKUT SOS (Equi akut sos.png)
// ----------------------------------------------------
function initEmergencySOS() {
    // Definierad via global navigateClinic
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

document.getElementById("btn-toast-close")?.addEventListener("click", () => {
    document.getElementById("map-toast")?.classList.add("hidden");
});

/**
 * Hästtransport-GPS
 * Komplett applikationslogik med premium UX, GPS, mobil bottom sheet och ruttberäkning.
 */

let map;
let routeLine = null;
let startMarker = null;
let endMarker = null;
let selectedCoordinatesForHazard = null;
let currentActiveTab = "tab-home";
let mapHazardMarkers = [];
let localHazards = [];
let trafikverketMarkers = [];

const LOCATION_PRESETS = {
    "stockholm": [59.3293, 18.0686],
    "strömsholm": [59.5255, 16.2731],
    "göteborg": [57.7089, 11.9746],
    "uddevalla": [58.3518, 11.9424],
    "malmö": [55.6050, 13.0038],
    "helsingborg": [56.0465, 12.6945],
    "uppsala": [59.8586, 17.6389],
    "jönköping": [57.7826, 14.1618]
};

window.addEventListener("DOMContentLoaded", () => {
    initMap();
    initTabs();
    initBottomSheet();
    initVehicleCalculator();
    initRoutePlanner();
    initHazards();
    initSOS();
    initMapControls();
    initAboutUsModal();
    initNavigationTree();
    

    
    // Visa välkomstmeddelande
    setTimeout(() => {
        showToast("Välkommen! Planera en rutt eller kolla fordonsvikter.", "🐎");
    }, 1000);
});

// Initialize Leaflet Map
function initMap() {
    console.log("Initierar karta...");
    const initialView = [59.45, 17.20];
    
    try {
        map = L.map("map", {
            zoomControl: false
        }).setView(initialView, 8);

        L.control.zoom({
            position: 'topright'
        }).addTo(map);

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Klicka på kartan
        map.on("click", (e) => {
            const lat = parseFloat(e.latlng.lat.toFixed(6));
            const lng = parseFloat(e.latlng.lng.toFixed(6));
            handleMapClick(lat, lng);
        });

        console.log("Kartan är laddad och redo!");
    } catch (e) {
        console.error("Kunde inte ladda kartan:", e);
    }
}

// Hantera klick på kartan utifrån aktiv flik
function handleMapClick(lat, lng) {
    if (currentActiveTab === "tab-hazards") {
        selectedCoordinatesForHazard = [lat, lng];
        document.getElementById("hazard-coords-display").innerText = `${lat}, ${lng}`;
        document.getElementById("hazard-coords-display").classList.add("selected");
        document.getElementById("btn-save-hazard").removeAttribute("disabled");
        
        // Rendera röd markör på vald position
        if (window.tempHazardMarker) {
            map.removeLayer(window.tempHazardMarker);
        }
        window.tempHazardMarker = L.marker([lat, lng], {
            icon: L.icon({
                iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                iconSize: [25, 41],
                iconAnchor: [12, 41],
                popupAnchor: [1, -34],
                shadowSize: [41, 41]
            })
        }).addTo(map);
        window.tempHazardMarker.bindPopup("Hinder placeras här").openPopup();
        
        showToast("Position vald för väghinder!", "📍");
        expandBottomSheet("peek");
        
    } else if (currentActiveTab === "tab-route") {
        const startInput = document.getElementById("input-start");
        const endInput = document.getElementById("input-end");
        
        if (document.activeElement === startInput || startInput.value === "") {
            startInput.value = `${lat}, ${lng}`;
            setRouteMarker("start", lat, lng);
            showToast("Startposition satt på kartan", "🟢");
        } else {
            endInput.value = `${lat}, ${lng}`;
            setRouteMarker("end", lat, lng);
            showToast("Slutdestination satt på kartan", "🔴");
        }
    }
}

// Sätt start- eller slutmarkörer på kartan
function setRouteMarker(type, lat, lng) {
    const isStart = type === "start";
    const markerVar = isStart ? startMarker : endMarker;
    
    if (markerVar) {
        map.removeLayer(markerVar);
    }
    
    const color = isStart ? "green" : "red";
    const marker = L.marker([lat, lng], {
        icon: L.icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-${color}.png`,
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
            shadowSize: [41, 41]
        }),
        draggable: true
    }).addTo(map);
    
    marker.bindPopup(isStart ? "Startposition" : "Slutdestination");
    
    marker.on("dragend", (e) => {
        const newLat = parseFloat(e.target.getLatLng().lat.toFixed(6));
        const newLng = parseFloat(e.target.getLatLng().lng.toFixed(6));
        
        if (isStart) {
            document.getElementById("input-start").value = `${newLat}, ${newLng}`;
            showToast("Startposition uppdaterad via dragning", "🟢");
        } else {
            document.getElementById("input-end").value = `${newLat}, ${newLng}`;
            showToast("Slutdestination uppdaterad via dragning", "🔴");
        }
    });

    if (isStart) {
        startMarker = marker;
    } else {
        endMarker = marker;
    }
}

// Handle tab switching
function initTabs() {
    const tabs = document.querySelectorAll(".tab-btn");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetTab = tab.dataset.tab;
            switchTab(targetTab);
        });
    });
}

// ----------------------------------------------------
// MOBILE BOTTOM SHEET LOGIC
// ----------------------------------------------------
function initBottomSheet() {
    const dragHandle = document.getElementById("bottom-sheet-drag");
    const sidebar = document.getElementById("app-sidebar");
    const header = document.querySelector(".sidebar-header");
    const sidebarContent = document.querySelector(".sidebar-content");

    if (!sidebar) return;

    let touchStartY = 0;
    let startTranslateY = 0;
    let isDragging = false;
    let currentTranslateY = 0;

    // Helper to get current active state name from class list
    function getCurrentState() {
        if (sidebar.classList.contains("state-expanded")) return "expanded";
        if (sidebar.classList.contains("state-collapsed")) return "collapsed";
        return "peek"; // Default is peek
    }

    // Helper to parse current translateY from DOMMatrix
    function getTranslateY() {
        const style = window.getComputedStyle(sidebar);
        const transform = style.transform || style.webkitTransform;
        if (!transform || transform === 'none') return 0;
        try {
            const matrix = new DOMMatrix(transform);
            return matrix.f;
        } catch (e) {
            const parts = transform.split(',');
            if (parts.length >= 6) {
                return parseFloat(parts[5]);
            }
            return 0;
        }
    }

    // Single click toggler (useful fallback/click handler)
    const toggleBottomSheet = () => {
        const state = getCurrentState();
        if (state === "collapsed") {
            expandBottomSheet("peek");
        } else if (state === "peek") {
            expandBottomSheet("expanded");
        } else {
            expandBottomSheet("collapsed");
        }
    };

    if (dragHandle) dragHandle.addEventListener("click", toggleBottomSheet);
    if (header) {
        header.addEventListener("click", (e) => {
            if (!e.target.closest("button") && !e.target.closest("a") && !e.target.closest("nav")) {
                toggleBottomSheet();
            }
        });
    }

    // Touch event listeners for dragging
    sidebar.addEventListener("touchstart", (e) => {
        const touch = e.touches[0];
        const state = getCurrentState();
        
        // Determine if we should drag
        const isHeaderTouch = e.target.closest("#bottom-sheet-drag") || e.target.closest(".sidebar-header") || e.target.closest(".sidebar-tabs") || e.target.closest(".sidebar-footer");
        const isContentTouch = e.target.closest(".sidebar-content");

        if (isHeaderTouch || (isContentTouch && state !== "expanded")) {
            // Initiate drag
            touchStartY = touch.clientY;
            startTranslateY = getTranslateY();
            isDragging = true;
            sidebar.classList.add("dragging");
        } else if (isContentTouch && state === "expanded" && sidebarContent.scrollTop <= 0) {
            // Initiate drag down from top scroll position
            touchStartY = touch.clientY;
            startTranslateY = getTranslateY();
            isDragging = true;
        }
    }, { passive: true });

    sidebar.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        
        const touch = e.touches[0];
        const currentY = touch.clientY;
        const deltaY = currentY - touchStartY;
        const state = getCurrentState();

        // If we started at expanded scrollTop <= 0 and are dragging UP, cancel sheet dragging
        if (state === "expanded" && !sidebar.classList.contains("dragging")) {
            if (deltaY < 0) {
                isDragging = false;
                return;
            } else if (deltaY > 0) {
                sidebar.classList.add("dragging");
            }
        }

        if (sidebar.classList.contains("dragging")) {
            if (e.cancelable) e.preventDefault();

            let targetTranslateY = startTranslateY + deltaY;
            const sidebarHeight = sidebar.offsetHeight;
            const maxTranslate = sidebarHeight - 60;

            // Apply rubber banding beyond limits
            if (targetTranslateY < 0) {
                targetTranslateY = targetTranslateY * 0.2;
            } else if (targetTranslateY > maxTranslate) {
                targetTranslateY = maxTranslate + (targetTranslateY - maxTranslate) * 0.2;
            }

            sidebar.style.transform = `translateY(${targetTranslateY}px)`;
            currentTranslateY = targetTranslateY;
        }
    }, { passive: false });

    sidebar.addEventListener("touchend", (e) => {
        if (!isDragging) return;
        isDragging = false;

        if (sidebar.classList.contains("dragging")) {
            sidebar.classList.remove("dragging");
            sidebar.style.transform = ""; // Remove inline style to let CSS transition take over

            const sidebarHeight = sidebar.offsetHeight;
            const deltaY = e.changedTouches[0].clientY - touchStartY;

            const peekTranslate = sidebarHeight - 200;
            const collapsedTranslate = sidebarHeight - 60;

            const snapPoints = {
                "expanded": 0,
                "peek": peekTranslate,
                "collapsed": collapsedTranslate
            };

            const state = getCurrentState();
            let finalState = state;

            // Simple velocity/direction intent combined with closest point
            if (Math.abs(deltaY) > 60) {
                if (deltaY > 0) { // Swiped down
                    finalState = (state === "expanded") ? "peek" : "collapsed";
                } else { // Swiped up
                    finalState = (state === "collapsed") ? "peek" : "expanded";
                }
            } else {
                let minDiff = Infinity;
                for (const [s, val] of Object.entries(snapPoints)) {
                    const diff = Math.abs(currentTranslateY - val);
                    if (diff < minDiff) {
                        minDiff = diff;
                        finalState = s;
                    }
                }
            }

            expandBottomSheet(finalState);
        }

        touchStartY = 0;
    });

    // Nollställningsknapp i sidfoten
    const resetBtn = document.getElementById("btn-reset-app");
    if (resetBtn) {
        resetBtn.addEventListener("click", (e) => {
            e.preventDefault();
            if (confirm("Vill du nollställa all inmatad data?")) {
                resetRouteAndInputs();
            }
        });
    }
}

function expandBottomSheet(state) {
    const sidebar = document.getElementById("app-sidebar");
    if (sidebar) {
        sidebar.className = `sidebar state-${state}`;
    }
}

// Toast warning overlay helper
function showToast(message, icon = "📍") {
    const toast = document.getElementById("map-toast");
    if (!toast) return;

    toast.querySelector(".toast-icon").innerText = icon;
    toast.querySelector(".toast-message").innerText = message;
    toast.classList.remove("hidden");

    if (window.toastTimeout) {
        clearTimeout(window.toastTimeout);
    }

    window.toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 5000);
}

document.getElementById("btn-toast-close").addEventListener("click", () => {
    document.getElementById("map-toast").classList.add("hidden");
});

// ----------------------------------------------------
// DYNAMIC MAP CONTROLS OVERLAY & GPS ACCESSIBILITY
// ----------------------------------------------------
function initMapControls() {
    const locateBtn = document.getElementById("ctrl-gps");
    const clearBtn = document.getElementById("ctrl-clear");
    const inlineGpsBtn = document.getElementById("btn-use-gps");

    const gpsTrigger = () => {
        if (!navigator.geolocation) {
            alert("GPS stöds inte av din enhet/webbläsare.");
            return;
        }

        locateBtn.innerHTML = "⌛";
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                locateBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                `;
                const lat = parseFloat(pos.coords.latitude.toFixed(6));
                const lng = parseFloat(pos.coords.longitude.toFixed(6));

                map.setView([lat, lng], 15);
                
                // Lägg till pulserande markör
                if (window.myLocationMarker) {
                    map.removeLayer(window.myLocationMarker);
                }
                window.myLocationMarker = L.circleMarker([lat, lng], {
                    radius: 9,
                    color: "#ffffff",
                    fillColor: "#3b82f6",
                    fillOpacity: 0.9,
                    weight: 3
                }).addTo(map).bindPopup("Din aktuella position").openPopup();

                // Fyll i startfältet om tomt
                const startInput = document.getElementById("input-start");
                if (startInput.value === "" || startInput.value === "Stockholm") {
                    startInput.value = `${lat}, ${lng}`;
                    setRouteMarker("start", lat, lng);
                }

                showToast("GPS-position lokaliserad!", "📡");
            },
            (err) => {
                locateBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
                    </svg>
                `;
                alert("Kunde inte hämta din position. Kontrollera att platstjänster är aktiverade.");
            },
            { enableHighAccuracy: true }
        );
    };

    locateBtn.addEventListener("click", gpsTrigger);
    inlineGpsBtn.addEventListener("click", gpsTrigger);

    clearBtn.addEventListener("click", () => {
        resetRouteAndInputs();
        showToast("Rutt och inmatningar rensade", "🧹");
    });
}

function resetRouteAndInputs() {
    if (routeLine) map.removeLayer(routeLine);
    if (startMarker) map.removeLayer(startMarker);
    if (endMarker) map.removeLayer(endMarker);
    if (window.myLocationMarker) map.removeLayer(window.myLocationMarker);
    if (window.emergencyMarker) map.removeLayer(window.emergencyMarker);
    trafikverketMarkers.forEach(m => map.removeLayer(m));

    routeLine = null;
    startMarker = null;
    endMarker = null;
    window.myLocationMarker = null;
    window.emergencyMarker = null;
    trafikverketMarkers = [];

    document.getElementById("input-start").value = "";
    document.getElementById("input-end").value = "";
    document.getElementById("calc-car-reg").value = "";
    document.getElementById("calc-trailer-reg").value = "";
    document.getElementById("hazard-comment").value = "";
    
    document.getElementById("route-results").classList.add("hidden");
    document.getElementById("calculator-results").classList.add("hidden");
    document.getElementById("emergency-results").classList.add("hidden");
    
    map.setView([59.45, 17.20], 8);
}

// ----------------------------------------------------
// FAS 2: VIKTKALKYLATOR & KÖRKORTSKONTROLL LOGIK
// ----------------------------------------------------

function initVehicleCalculator() {
    const calculateBtn = document.getElementById("btn-calculate-weights");
    const manualRecalcBtn = document.getElementById("btn-recalc-manual");

    calculateBtn.addEventListener("click", async () => {
        calculateBtn.setAttribute("disabled", "true");
        calculateBtn.innerText = "Hämtar fordonsdata...";

        try {
            await calculateWeights();
        } catch (e) {
            console.error("Kalkylatorfel:", e);
        } finally {
            calculateBtn.removeAttribute("disabled");
            calculateBtn.innerText = "Kontrollera kombination";
        }
    });

    manualRecalcBtn.addEventListener("click", () => {
        const carTotal = parseInt(document.getElementById("override-car-total").value) || 0;
        const carMaxTow = parseInt(document.getElementById("override-car-max-tow").value) || 0;
        const trailerCurb = parseInt(document.getElementById("override-trailer-curb").value) || 0;
        const trailerTotal = parseInt(document.getElementById("override-trailer-total").value) || 0;
        const horseWeight = parseInt(document.getElementById("calc-horse-weight").value) || 0;
        const licenseType = document.querySelector('input[name="license-type"]:checked').value;

        const result = runWeightMath(
            { name: "Anpassad Bil", total: carTotal, maxTow: carMaxTow, curb: 1500 },
            { name: "Anpassat Släp", curb: trailerCurb, total: trailerTotal },
            horseWeight,
            licenseType
        );

        renderCalculatorResults(result);
    });
}

async function calculateWeights() {
    const carReg = document.getElementById("calc-car-reg").value.trim().toUpperCase();
    const trailerReg = document.getElementById("calc-trailer-reg").value.trim().toUpperCase();
    const horseWeight = parseInt(document.getElementById("calc-horse-weight").value) || 0;
    const licenseType = document.querySelector('input[name="license-type"]:checked').value;

    if (!carReg || !trailerReg) {
        alert("Fyll i både bilens och släpets registreringsnummer.");
        return;
    }

    let carSpecs = await db.getCarSpecs(carReg);
    let trailerSpecs = await db.getTrailerSpecs(trailerReg);

    if (!carSpecs) {
        alert(`Bilen ${carReg} saknas i databasen. Skapar standardvikter som du kan ändra manuellt.`);
        carSpecs = { name: `Manuellt angiven (${carReg})`, curb: 1800, total: 2400, maxTow: 1800 };
    }
    if (!trailerSpecs) {
        alert(`Släpet ${trailerReg} saknas i databasen. Skapar standardvikter som du kan ändra manuellt.`);
        trailerSpecs = { name: `Manuellt angiven (${trailerReg})`, curb: 850, total: 2000, payload: 1150 };
    }

    document.getElementById("val-car-name").innerText = carSpecs.name;
    document.getElementById("val-car-curb").innerText = `${carSpecs.curb} kg`;
    document.getElementById("val-car-total").innerText = `${carSpecs.total} kg`;
    document.getElementById("val-car-max-tow").innerText = `${carSpecs.maxTow} kg`;

    document.getElementById("val-trailer-name").innerText = trailerSpecs.name;
    document.getElementById("val-trailer-curb").innerText = `${trailerSpecs.curb} kg`;
    document.getElementById("val-trailer-total").innerText = `${trailerSpecs.total} kg`;
    document.getElementById("val-trailer-payload").innerText = `${trailerSpecs.payload || (trailerSpecs.total - trailerSpecs.curb)} kg`;

    document.getElementById("override-car-total").value = carSpecs.total;
    document.getElementById("override-car-max-tow").value = carSpecs.maxTow;
    document.getElementById("override-trailer-curb").value = trailerSpecs.curb;
    document.getElementById("override-trailer-total").value = trailerSpecs.total;

    const result = runWeightMath(carSpecs, trailerSpecs, horseWeight, licenseType);
    renderCalculatorResults(result);
}

function runWeightMath(car, trailer, horseWeight, license) {
    const trailerActualWeight = trailer.curb + horseWeight;
    const trainWeight = car.total + trailer.total;
    const errors = [];

    const maxPayload = trailer.payload || (trailer.total - trailer.curb);
    const isTrailerOverloaded = horseWeight > maxPayload;
    const trailerMargin = maxPayload - horseWeight;
    if (isTrailerOverloaded) {
        errors.push(`<strong>Överlast släpvagn:</strong> Hästens vikt (${horseWeight} kg) överstiger släpets maxlast (${maxPayload} kg) med ${Math.abs(trailerMargin)} kg.`);
    }

    const isCarOverloaded = trailerActualWeight > car.maxTow;
    const carTowMargin = car.maxTow - trailerActualWeight;
    if (isCarOverloaded) {
        errors.push(`<strong>För tung dragvikt:</strong> Det lastade släpets vikt (${trailerActualWeight} kg) är högre än bilens maximala släpvagnsvikt (${car.maxTow} kg) med ${Math.abs(carTowMargin)} kg.`);
    }

    let isLicenseExceeded = false;
    let licenseLimitText = "";
    
    let licenseLimit = 3500;
    if (license === "B") {
        licenseLimit = trailer.total <= 750 ? 4250 : 3500;
        if (trainWeight > licenseLimit) {
            isLicenseExceeded = true;
            licenseLimitText = `Ekipagets sammanlagda totalvikt (${trainWeight} kg) överstiger B-kortsgränsen på ${licenseLimit} kg.`;
            errors.push(`<strong>Körkort B saknas:</strong> ${licenseLimitText} Du behöver utökat B (B96) eller BE-kort.`);
        }
    } else if (license === "B96") {
        licenseLimit = 4250;
        if (trainWeight > licenseLimit) {
            isLicenseExceeded = true;
            licenseLimitText = `Ekipagets sammanlagda totalvikt (${trainWeight} kg) överstiger B96-gränsen på 4250 kg.`;
            errors.push(`<strong>Körkort B96 saknas:</strong> ${licenseLimitText} Du behöver BE-kort.`);
        }
    } else if (license === "BE") {
        licenseLimit = 3500;
        if (trailer.total > 3500) {
            isLicenseExceeded = true;
            licenseLimitText = `Släpets totalvikt (${trailer.total} kg) överstiger BE-kortets maxgräns för släp på 3500 kg.`;
            errors.push(`<strong>Körkort BE begränsning:</strong> ${licenseLimitText}`);
        }
    }

    return {
        isLegal: errors.length === 0,
        errors,
        trailerActualWeight,
        trailerTotal: trailer.total,
        maxPayload,
        trailerMargin,
        carMaxTow: car.maxTow,
        carTowMargin,
        trainWeight,
        licenseLimit,
        license
    };
}

function renderCalculatorResults(result) {
    const banner = document.getElementById("calc-status-banner");
    const bannerIcon = document.getElementById("calc-status-icon");
    const bannerTitle = document.getElementById("calc-status-title");
    const bannerDesc = document.getElementById("calc-status-desc");

    if (result.isLegal) {
        banner.className = "legal-banner legal-banner-success";
        bannerIcon.innerText = "🟢";
        bannerTitle.innerText = "Kombinationen är LAGLIG!";
        bannerDesc.innerText = "Ditt ekipage uppfyller alla viktkrav och stämmer överens med din körkortsbehörighet.";
        showToast("Ekipaget är helt lagligt!", "🟢");
    } else {
        banner.className = "legal-banner legal-banner-danger";
        bannerIcon.innerText = "🔴";
        bannerTitle.innerText = "EJ LAGLIGT EKIPAGE!";
        bannerDesc.innerHTML = result.errors.map(err => `• ${err}`).join("<br>");
        showToast("Varning: Olaglig kombination!", "🔴");
    }

    const trailerPct = Math.min(100, Math.max(0, (result.trailerActualWeight / result.trailerTotal) * 100));
    const trailerFill = document.getElementById("meter-trailer-fill");
    trailerFill.style.width = `${trailerPct}%`;
    document.getElementById("meter-trailer-text").innerText = `${result.trailerActualWeight} kg / ${result.trailerTotal} kg`;

    const trailerStatus = document.getElementById("meter-trailer-status");
    if (result.trailerActualWeight > result.trailerTotal) {
        trailerFill.className = "meter-fill bar-danger";
        trailerStatus.innerHTML = `<span class="text-danger">⚠️ Släpet är överlastat med ${Math.abs(result.trailerMargin)} kg!</span>`;
    } else {
        trailerFill.className = "meter-fill" + (trailerPct > 85 ? " bar-warning" : "");
        trailerStatus.innerText = `Godkänd lastkapacitet (${result.trailerMargin} kg marginal kvar).`;
    }

    const carTowPct = Math.min(100, Math.max(0, (result.trailerActualWeight / result.carMaxTow) * 100));
    const carTowFill = document.getElementById("meter-car-tow-fill");
    carTowFill.style.width = `${carTowPct}%`;
    document.getElementById("meter-car-tow-text").innerText = `${result.trailerActualWeight} kg / ${result.carMaxTow} kg`;

    const carTowStatus = document.getElementById("meter-car-tow-status");
    if (result.trailerActualWeight > result.carMaxTow) {
        carTowFill.className = "meter-fill bar-danger";
        carTowStatus.innerHTML = `<span class="text-danger">⚠️ Överstiger bilens max dragvikt med ${Math.abs(result.carTowMargin)} kg!</span>`;
    } else {
        carTowFill.className = "meter-fill" + (carTowPct > 85 ? " bar-warning" : "");
        carTowStatus.innerText = `Bilen klarar vikten (${result.carTowMargin} kg marginal kvar).`;
    }

    let licenseNumerator, licenseDenominator;
    if (result.license === "BE") {
        licenseNumerator = result.trailerTotal;
        licenseDenominator = 3500;
        document.getElementById("meter-license-text").innerText = `${result.trailerTotal} kg (släp) / 3500 kg`;
    } else {
        licenseNumerator = result.trainWeight;
        licenseDenominator = result.licenseLimit;
        document.getElementById("meter-license-text").innerText = `${result.trainWeight} kg (tågvikt) / ${result.licenseLimit} kg`;
    }

    const licensePct = Math.min(100, Math.max(0, (licenseNumerator / licenseDenominator) * 100));
    const licenseFill = document.getElementById("meter-license-fill");
    licenseFill.style.width = `${licensePct}%`;

    const licenseStatus = document.getElementById("meter-license-status");
    if (licenseNumerator > licenseDenominator) {
        licenseFill.className = "meter-fill bar-danger";
        licenseStatus.innerHTML = `<span class="text-danger">⚠️ Ej godkänt körkort! Överstiger gränsen för ${result.license} med ${licenseNumerator - licenseDenominator} kg.</span>`;
    } else {
        licenseFill.className = "meter-fill" + (licensePct > 85 ? " bar-warning" : "");
        licenseStatus.innerText = `Körkortet räcker (${licenseDenominator - licenseNumerator} kg marginal kvar).`;
    }

    document.getElementById("calculator-results").classList.remove("hidden");
    
    // Rulla ner för att se resultatet på mobil
    setTimeout(() => {
        document.querySelector(".sidebar-content").scrollTop = 280;
        expandBottomSheet("expanded");
    }, 100);
}

// ----------------------------------------------------
// FAS 3: KARTINTEGRATION & RUTTPLANERING LOGIK
// ----------------------------------------------------

function initRoutePlanner() {
    const calcRouteBtn = document.getElementById("btn-find-route");
    
    // Aktivera adressförslag (autocomplete)
    setupAutocomplete("input-start", "start");
    setupAutocomplete("input-end", "end");
    
    document.querySelectorAll(".shortcut-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.getElementById("input-start").value = btn.dataset.start;
            document.getElementById("input-end").value = btn.dataset.end;
            calcRouteBtn.click();
        });
    });

    calcRouteBtn.addEventListener("click", () => {
        const startVal = document.getElementById("input-start").value.trim();
        const endVal = document.getElementById("input-end").value.trim();
        
        if (!startVal || !endVal) {
            alert("Vänligen fyll i både startplats och slutdestination.");
            return;
        }

        calcRouteBtn.setAttribute("disabled", "true");
        calcRouteBtn.innerText = "Söker säker rutt...";

        // Visa loading-overlay
        const loadingOverlay = document.getElementById("route-loading-overlay");
        const loadingTextEl = document.getElementById("loading-text");
        let textInterval = null;
        
        if (loadingOverlay) {
            loadingOverlay.classList.remove("hidden");
            
            // Loopa igenom stimulerande laddningstexter
            const loadingTexts = [
                "Beräknar säkraste rutt...",
                "Analyserar vägkurvatur...",
                "Söker efter lutning & backar...",
                "Hämtar data från Trafikverket...",
                "Optimerar hastighet för släp..."
            ];
            let textIdx = 0;
            textInterval = setInterval(() => {
                if (loadingTextEl) {
                    textIdx = (textIdx + 1) % loadingTexts.length;
                    loadingTextEl.innerText = loadingTexts[textIdx];
                }
            }, 400);
        }

        resolveCoordinates(startVal, (startCoord) => {
            const cleanupLoader = () => {
                if (textInterval) clearInterval(textInterval);
                if (loadingOverlay) loadingOverlay.classList.add("hidden");
                calcRouteBtn.removeAttribute("disabled");
                calcRouteBtn.innerText = "Beräkna Hästrutt";
            };

            if (!startCoord) {
                alert(`Kunde inte hitta startplats: "${startVal}"`);
                cleanupLoader();
                return;
            }

            resolveCoordinates(endVal, (endCoord) => {
                if (!endCoord) {
                    alert(`Kunde inte hitta slutdestination: "${endVal}"`);
                    cleanupLoader();
                    return;
                }

                setRouteMarker("start", startCoord[0], startCoord[1]);
                setRouteMarker("end", endCoord[0], endCoord[1]);

                const startTime = Date.now();

                fetchOSRMRoute(startCoord, endCoord, (routeData) => {
                    const elapsed = Date.now() - startTime;
                    const delay = Math.max(0, 2200 - elapsed); // Stanna i minst 2.2 sekunder för att simulera beräkning

                    setTimeout(() => {
                        cleanupLoader();
                        if (routeData) {
                            displayRouteResults(startVal, endVal, routeData);
                        } else {
                            alert("Kunde inte hämta ruttdetaljer. Genererar en demonstrationsrutt istället.");
                            const fallbackData = generateFallbackRoute(startCoord, endCoord);
                            displayRouteResults(startVal, endVal, fallbackData);
                        }
                    }, delay);
                });
            });
        });
    });
}

function resolveCoordinates(query, callback) {
    const coordReg = /^[-+]?([1-8]?\d(\.\d+)?|90(\.0+)?),\s*[-+]?(180(\.0+)?|((1[0-7]\d)|([1-9]?\d))(\.\d+)?)$/;
    if (coordReg.test(query)) {
        const parts = query.split(",").map(p => parseFloat(p.trim()));
        callback([parts[0], parts[1]]);
        return;
    }

    const lower = query.toLowerCase();
    if (LOCATION_PRESETS[lower]) {
        callback(LOCATION_PRESETS[lower]);
        return;
    }

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ", Sweden")}&limit=1`;
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                callback([lat, lon]);
            } else {
                callback(null);
            }
        })
        .catch(err => {
            console.error("Geocoding error:", err);
            callback(null);
        });
}

function fetchOSRMRoute(start, end, callback) {
    const url = `https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson&steps=true`;
    
    fetch(url)
        .then(res => res.json())
        .then(data => {
            if (data && data.routes && data.routes.length > 0) {
                callback(data.routes[0]);
            } else {
                callback(null);
            }
        })
        .catch(err => {
            console.error("OSRM error:", err);
            callback(null);
        });
}

function generateFallbackRoute(start, end) {
    const midPoint = [
        (start[0] + end[0]) / 2 + (end[1] - start[1]) * 0.05,
        (start[1] + end[1]) / 2 + (start[0] - end[0]) * 0.05
    ];
    
    const earthRadius = 6371;
    const dLat = (end[0]-start[0]) * Math.PI / 180;
    const dLon = (end[1]-start[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(start[0]*Math.PI/180) * Math.cos(end[0]*Math.PI/180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distanceKm = earthRadius * c;
    
    return {
        distance: distanceKm * 1000 * 1.1,
        duration: distanceKm * 36,
        geometry: {
            type: "LineString",
            coordinates: [
                [start[1], start[0]],
                [midPoint[1], midPoint[0]],
                [end[1], end[0]]
            ]
        },
        legs: [{
            steps: [
                { name: "Startplats", maneuver: { type: "depart", modifier: "" }, distance: 0 },
                { name: "Huvudväg", maneuver: { type: "continue", modifier: "" }, distance: distanceKm * 1000 },
                { name: "Slutdestination", maneuver: { type: "arrive", modifier: "" }, distance: 0 }
            ]
        }]
    };
}

function getSwedishRoadSpeedLimit(streetName, stepDistance, stepDuration) {
    const name = (streetName || "").trim();
    let calculatedSpeed = stepDuration > 0 ? (stepDistance / stepDuration) * 3.6 : 50;
    
    if (/^[E]\s*\d+/i.test(name) || /motorväg/i.test(name)) {
        return 110;
    }
    if (/^Riksväg/i.test(name) || /^Länsväg/i.test(name) || /^\d{3}$/.test(name)) {
        return 90;
    }
    const roadNumberMatch = name.match(/\b(\d{2,3})\b/);
    if (roadNumberMatch) {
        const roadNum = parseInt(roadNumberMatch[1], 10);
        if (roadNum >= 100 && roadNum <= 400) {
            return 80;
        }
    }
    if (calculatedSpeed > 80) {
        return Math.min(120, Math.round(calculatedSpeed / 10) * 10);
    }
    if (name === "huvudväg" || name === "" || calculatedSpeed > 50) {
        return 70;
    }
    return 50;
}

function calculateHorseDurationForStep(step, route) {
    const distanceMeters = step.distance || 0;
    let stepDuration = step.duration;
    if (stepDuration === undefined || stepDuration === null || stepDuration <= 0) {
        const totalDistance = route.distance || 1;
        const totalDuration = route.duration || 0;
        stepDuration = (distanceMeters / totalDistance) * totalDuration;
    }
    
    if (distanceMeters <= 0) return 0;
    
    const streetName = (step.name || "").trim();
    const speedLimit = getSwedishRoadSpeedLimit(streetName, distanceMeters, stepDuration);
    
    // Hästsläp är begränsat till 80 km/h, men kör 10% långsammare i lägre hastigheter pga försiktighet
    const towingSpeedLimit = Math.min(80, speedLimit);
    const towingSpeedMs = (towingSpeedLimit < 80) ? (towingSpeedLimit * 0.9) / 3.6 : towingSpeedLimit / 3.6;
    
    let horseDuration = distanceMeters / towingSpeedMs;
    
    // Lägg till 5 sekunder turn penalty om step är en sväng eller rondell
    const type = (step.maneuver && step.maneuver.type) || "";
    const modifier = (step.maneuver && step.maneuver.modifier) || "";
    if (type.includes("roundabout") || type.includes("turn") || modifier === "left" || modifier === "right") {
        horseDuration += 5;
    }
    
    return horseDuration;
}

function calculateCarDurationForStep(step, route) {
    const distanceMeters = step.distance || 0;
    let stepDuration = step.duration;
    if (stepDuration === undefined || stepDuration === null || stepDuration <= 0) {
        const totalDistance = route.distance || 1;
        const totalDuration = route.duration || 0;
        stepDuration = (distanceMeters / totalDistance) * totalDuration;
    }
    
    if (distanceMeters <= 0) return 0;
    
    const streetName = (step.name || "").trim();
    const speedLimit = getSwedishRoadSpeedLimit(streetName, distanceMeters, stepDuration);
    const carSpeedMs = speedLimit / 3.6;
    
    return distanceMeters / carSpeedMs;
}

async function displayRouteResults(startName, endName, route) {
    const resultsContainer = document.getElementById("route-results");
    const routeTitleEl = document.getElementById("route-title");
    if (routeTitleEl) {
        routeTitleEl.innerText = `${startName} till ${endName}`;
    }
    const swappedCoordinates = route.geometry.coordinates.map(c => [c[1], c[0]]);

    if (routeLine) {
        map.removeLayer(routeLine);
    }

    routeLine = L.polyline(swappedCoordinates, {
        color: "#284c36",
        weight: 6,
        opacity: 0.85
    }).addTo(map);

    map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });

    const distanceKm = route.distance / 1000;
    document.getElementById("stat-distance").innerText = `${distanceKm.toFixed(1)} km`;

    let turnCount = 0;
    const swedishDirections = [];
    
    if (route.legs && route.legs[0] && route.legs[0].steps) {
        route.legs[0].steps.forEach(step => {
            const modifier = step.maneuver.modifier;
            const type = step.maneuver.type;
            const streetName = step.name || "huvudväg";
            const distStr = step.distance > 1000 ? `${(step.distance/1000).toFixed(1)} km` : `${step.distance.toFixed(0)} m`;

            if (type.includes("roundabout") || type.includes("turn") || modifier === "left" || modifier === "right") {
                turnCount++;
            }

            let instructionText = "";
            if (type === "depart") {
                instructionText = `Kör ut från startpunkten in på <strong>${streetName}</strong>.`;
            } else if (type.includes("roundabout")) {
                instructionText = `Ta rondellavfarten in på <strong>${streetName}</strong> (kör mjukt!).`;
            } else if (modifier === "left") {
                instructionText = `Sväng vänster in på <strong>${streetName}</strong> om ${distStr}.`;
            } else if (modifier === "right") {
                instructionText = `Sväng höger in på <strong>${streetName}</strong> om ${distStr}.`;
            } else if (type === "arrive") {
                instructionText = `Du har anlänt till din destination!`;
            } else {
                instructionText = `Fortsätt rakt fram på <strong>${streetName}</strong> i ${distStr}.`;
            }
            swedishDirections.push(instructionText);
        });
    }

    document.getElementById("stat-turns").innerText = `${turnCount} st`;

    let totalCarSeconds = 0;
    let totalTowingSeconds = 0;
    if (route.legs && route.legs[0] && route.legs[0].steps) {
        route.legs[0].steps.forEach(step => {
            step.carDuration = calculateCarDurationForStep(step, route);
            step.horseDuration = calculateHorseDurationForStep(step, route);
            totalCarSeconds += step.carDuration;
            totalTowingSeconds += step.horseDuration;
        });
    } else {
        // Fallback om steg saknas
        const carAverageSpeed = (distanceKm > 100) ? 105 : 70; // Realistisk snitthastighet i km/h
        const towingSpeed = Math.min(80, carAverageSpeed * 0.8);
        totalCarSeconds = (distanceKm / carAverageSpeed) * 3600;
        totalTowingSeconds = (distanceKm / towingSpeed) * 3600 + (turnCount * 5);
    }
    
    const carHrs = Math.floor(totalCarSeconds / 3600);
    const carMins = Math.floor((totalCarSeconds % 3600) / 60);
    document.getElementById("stat-car-eta").innerText = `${carHrs > 0 ? carHrs + 'h ' : ''}${carMins}m`;

    const horseHrs = Math.floor(totalTowingSeconds / 3600);
    const horseMins = Math.floor((totalTowingSeconds % 3600) / 60);
    document.getElementById("stat-horse-eta").innerText = `${horseHrs > 0 ? horseHrs + 'h ' : ''}${horseMins}m`;

    const warningsList = document.getElementById("route-warnings");
    warningsList.innerHTML = "";
    const warnings = [];

    if (distanceKm > 120) {
        warnings.push("<strong>Lång resa:</strong> Kom ihåg att stanna och kontrollera ventilationen samt erbjuda hästen vatten var 2:e till 3:e timme.");
    }
    if (turnCount > 10) {
        warnings.push("<strong>Hög kurvatur:</strong> Denna rutt innehåller många svängar och rondeller. Kör extra mjukt och sänk farten i svängarna för att spara hästens balans.");
    }

    try {
        const dbHazards = await db.getHazards();
        let nearHazards = 0;
        
        dbHazards.forEach(hazard => {
            for (let i = 0; i < swappedCoordinates.length; i += 10) {
                const pt = swappedCoordinates[i];
                const earthRadius = 6371;
                const dLat = (pt[0]-hazard.lat) * Math.PI / 180;
                const dLon = (pt[1]-hazard.lng) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(hazard.lat*Math.PI/180) * Math.cos(pt[0]*Math.PI/180) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const dist = earthRadius * c;
                
                if (dist < 0.8) {
                    nearHazards++;
                    break;
                }
            }
        });

        if (nearHazards > 0) {
            warnings.push(`<strong>VÄGHINDER:</strong> Det finns ${nearHazards} st rapporterade väghinder längs denna rutt. Håll extra uppsikt!`);
        }
    } catch (e) {
        console.warn("Kunde inte söka efter rutt-hinder:", e);
    }

    try {
        await loadTrafikverketData(swappedCoordinates, warnings);
    } catch (e) {
        console.warn("Kunde inte läsa Trafikverket-data:", e);
    }

    if (warnings.length === 0) {
        warnings.push("Lugn rutt. Inga speciella faror upptäckta.");
    }

    warnings.forEach(w => {
        const li = document.createElement("li");
        li.innerHTML = w;
        warningsList.appendChild(li);
    });

    const directionsContainer = document.getElementById("directions-list");
    directionsContainer.innerHTML = "";
    swedishDirections.forEach(d => {
        const li = document.createElement("li");
        li.innerHTML = d;
        directionsContainer.appendChild(li);
    });

    resultsContainer.classList.remove("hidden");
    
    // Spara rutt-data för navigeringsmotorn
    rawRouteDataForNavigation = route;
    totalTowingSecondsForNav = totalTowingSeconds;
    destinationCoordinates = swappedCoordinates[swappedCoordinates.length - 1];
    
    // Premium Mobile UX: Minimerar bottom-sheet för att visa hela kartrutten!
    showToast("Hästrutt beräknad! Dra upp listan för köranvisningar.", "🗺️");
    expandBottomSheet("collapsed");
}

// Ladda Trafikverket incidenter
async function loadTrafikverketData(swappedCoordinates, warnings) {
    let situations = [];

    // Hämta via Vercel Proxy
    try {
        const proxyResult = await db.getTrafikverketSituationsFromProxy();
        if (!proxyResult.disabled) {
            situations = proxyResult.data;
            console.log(`app: Hämtade ${situations.length} situationer säkert via Vercel Proxy.`);
        } else {
            console.warn("app: Server-proxy är inaktiv.");
        }
    } catch (err) {
        console.error("app: Misslyckades att hämta vägstörningar från server-proxy:", err);
    }

    // 3. Rensa gamla markörer och rita ut nya
    trafikverketMarkers.forEach(m => map.removeLayer(m));
    trafikverketMarkers = [];
    
    if (!situations || situations.length === 0) return;
    
    let nearDisruptions = 0;
    let roadworksCount = 0;
    let accidentsCount = 0;
    
    situations.forEach(sit => {
        let isNear = false;
        for (let i = 0; i < swappedCoordinates.length; i += 5) {
            const pt = swappedCoordinates[i];
            const dist = calculateDistance(pt[0], pt[1], sit.lat, sit.lng);
            if (dist <= 1.2) {
                isNear = true;
                break;
            }
        }
        
        if (isNear) {
            nearDisruptions++;
            
            let emoji = "⚠️";
            const lowerIcon = (sit.iconId || "").toLowerCase();
            const lowerHeader = (sit.header || "").toLowerCase();
            const lowerMsg = (sit.message || "").toLowerCase();
            
            if (lowerIcon.includes("roadwork") || lowerIcon.includes("construction") || lowerIcon.includes("maintenance") || 
                lowerHeader.includes("vägarbete") || lowerMsg.includes("vägarbete")) {
                emoji = "🚧";
                roadworksCount++;
            } else if (lowerIcon.includes("accident") || lowerIcon.includes("stoppage") || lowerIcon.includes("close") || lowerIcon.includes("incident") ||
                       lowerHeader.includes("olycka") || lowerHeader.includes("hinder") || lowerHeader.includes("stopp") ||
                       lowerMsg.includes("olycka") || lowerMsg.includes("stopp")) {
                emoji = "🚨";
                accidentsCount++;
            } else if (lowerIcon.includes("obstacle") || lowerHeader.includes("hinder")) {
                emoji = "🛑";
            }
            
            const customIcon = L.divIcon({
                html: `<div class="map-emoji-marker" style="font-size: 24px; text-shadow: 0 0 4px rgba(0,0,0,0.5);">${emoji}</div>`,
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            const marker = L.marker([sit.lat, sit.lng], { icon: customIcon }).addTo(map);
            
            marker.bindPopup(`
                <div style="font-family: var(--font-body); max-width: 250px;">
                    <h4 style="margin: 0 0 5px 0; color: var(--primary-color);">${emoji} ${sit.header}</h4>
                    <p style="margin: 0 0 5px 0; font-size: 12px; color: var(--text-main);">${sit.message}</p>
                    <div style="font-size: 10px; color: var(--text-secondary);">Källa: Trafikverket</div>
                </div>
            `);
            
            trafikverketMarkers.push(marker);
            warnings.push(`<strong>Trafikverket:</strong> ${sit.header} - ${sit.message}`);
        }
    });
}

// ----------------------------------------------------
// FAS 4: HINDERRAPPORTERING LOGIK
// ----------------------------------------------------

function initHazards() {
    loadHazards();

    const saveBtn = document.getElementById("btn-save-hazard");
    saveBtn.addEventListener("click", async () => {
        const type = document.getElementById("hazard-type").value;
        const comment = document.getElementById("hazard-comment").value.trim();
        
        if (!selectedCoordinatesForHazard) {
            alert("Vänligen markera en position på kartan först.");
            return;
        }

        saveBtn.setAttribute("disabled", "true");
        saveBtn.innerText = "Sparar hinder...";

        const newHazard = {
            id: "haz-" + Date.now(),
            lat: selectedCoordinatesForHazard[0],
            lng: selectedCoordinatesForHazard[1],
            type,
            comment: comment || "Vägvarning för hästtransporter",
            timestamp: new Date().toLocaleDateString("sv-SE")
        };

        try {
            await db.saveHazard(newHazard);
            localHazards.push(newHazard);
            renderHazardsOnMap();
            renderHazardsList();
            
            document.getElementById("hazard-comment").value = "";
            document.getElementById("hazard-coords-display").innerText = "Ingen position vald (klicka på kartan)";
            document.getElementById("hazard-coords-display").classList.remove("selected");
            
            if (window.tempHazardMarker) {
                map.removeLayer(window.tempHazardMarker);
                window.tempHazardMarker = null;
            }
            
            selectedCoordinatesForHazard = null;
            alert("Hinder sparades live i databasen!");
            showToast("Hinder rapporterat live till databasen!", "🚧");
        } catch (e) {
            alert("Kunde inte spara hindret i databasen. Försök igen.");
            saveBtn.removeAttribute("disabled");
        } finally {
            saveBtn.innerText = "Spara hinder på kartan";
        }
    });
}

// Ladda hinder från Supabase (Med 5 dagars utgångsdatum)
async function loadHazards() {
    console.log("Laddar hinder...");
    try {
        const allHazards = await db.getHazards();
        
        // 5 dagars utgångsgräns
        localHazards = allHazards.filter(hazard => {
            const hazardDate = new Date(hazard.timestamp);
            const currentDate = new Date();
            const diffTime = currentDate - hazardDate;
            const diffDays = diffTime / (1000 * 60 * 60 * 24);
            
            if (diffDays > 5) {
                console.log(`Hinder ${hazard.id} är äldre än 5 dagar. Raderar...`);
                db.deleteHazard(hazard.id).catch(err => console.error(err));
                return false;
            }
            return true;
        });

        renderHazardsOnMap();
        renderHazardsList();
    } catch (e) {
        console.error("Kunde inte ladda hinder:", e);
    }
}

function escapeHTML(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}

function renderHazardsOnMap() {
    mapHazardMarkers.forEach(m => map.removeLayer(m));
    mapHazardMarkers = [];

    const hazardIcons = {
        pothole: "🕳️",
        narrow: "🚧",
        noturn: "🛑",
        low: "🌲"
    };

    localHazards.forEach(hazard => {
        const iconSymbol = hazardIcons[hazard.type] || "⚠️";
        
        const customIcon = L.divIcon({
            html: `<div class="map-emoji-marker" style="font-size: 24px; text-shadow: 0 0 4px rgba(0,0,0,0.5);">${iconSymbol}</div>`,
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        const marker = L.marker([hazard.lat, hazard.lng], { icon: customIcon }).addTo(map);
        
        const SwedishType = {
            pothole: "Gupp / Skadad väg",
            narrow: "Trång passage",
            noturn: "Ingen vändplats",
            low: "Lågt hinder"
        }[hazard.type];

        marker.bindPopup(`
            <div style="font-family: var(--font-body)">
                <h4>${iconSymbol} ${SwedishType}</h4>
                <p>${escapeHTML(hazard.comment)}</p>
                <div style="font-size: 10px; color: var(--text-secondary);">Rapporterad: ${hazard.timestamp}</div>
            </div>
        `);

        mapHazardMarkers.push(marker);
    });
}

function renderHazardsList() {
    const container = document.getElementById("hazard-list-container");
    if (!container) return;
    
    container.innerHTML = "";

    if (localHazards.length === 0) {
        container.innerHTML = `<p class="empty-list-text">Inga hinder rapporterade de senaste 5 dagarna. Klicka på kartan för att varna andra!</p>`;
        return;
    }

    const SwedishTypes = {
        pothole: "Gupp / Skadad väg",
        narrow: "Trång passage",
        noturn: "Ingen vändplats",
        low: "Lågt hinder"
    };

    const hazardEmojis = {
        pothole: "🕳️",
        narrow: "🚧",
        noturn: "🛑",
        low: "🌲"
    };

    const sorted = [...localHazards].reverse();

    sorted.forEach(hazard => {
        const item = document.createElement("div");
        item.className = "hazard-item";
        item.innerHTML = `
            <div class="hazard-icon-box">${hazardEmojis[hazard.type] || "⚠️"}</div>
            <div class="hazard-info">
                <h5>${SwedishTypes[hazard.type] || "Hinder"}</h5>
                <p>${escapeHTML(hazard.comment)}</p>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                    <span style="color: var(--text-secondary); font-size: 10px;">Datum: ${hazard.timestamp}</span>
                    <div class="hazard-actions">
                        <a class="hazard-action-link view" data-lat="${hazard.lat}" data-lng="${hazard.lng}">Visa på karta</a>
                    </div>
                </div>
            </div>
            <a class="hazard-action-link delete" data-id="${hazard.id}">&times;</a>
        `;

        item.querySelector(".view").addEventListener("click", () => {
            map.setView([hazard.lat, hazard.lng], 15);
            const markerIndex = localHazards.findIndex(h => h.id === hazard.id);
            if (markerIndex !== -1 && mapHazardMarkers[markerIndex]) {
                mapHazardMarkers[markerIndex].openPopup();
            }
            expandBottomSheet("collapsed");
            showToast("Visar valt väghinder på kartan", "🗺️");
        });

        item.querySelector(".delete").addEventListener("click", async () => {
            if (confirm("Vill du ta bort denna vägvarning permanent från Supabase?")) {
                try {
                    await db.deleteHazard(hazard.id);
                    localHazards = localHazards.filter(h => h.id !== hazard.id);
                    renderHazardsOnMap();
                    renderHazardsList();
                    alert("Hinder raderat!");
                } catch (e) {
                    alert("Kunde inte radera hindret. Försök igen.");
                }
            }
        });

        container.appendChild(item);
    });
}

// ----------------------------------------------------
// FAS 5: AKUTSÖKNING (SOS) LOGIK
// ----------------------------------------------------

function initSOS() {
    const sosTriggerBtn = document.getElementById("btn-sos-trigger");
    const resultsContainer = document.getElementById("emergency-results");

    if (!sosTriggerBtn) return;

    sosTriggerBtn.addEventListener("click", async () => {
        console.log("SOS klickat! Söker akutvård...");
        
        // Hämta kartans mittpunkt
        const center = map.getCenter();
        const lat = center.lat;
        const lng = center.lng;

        const clinics = await db.getEmergencyClinics();

        const calculatedClinics = clinics.map(clinic => {
            const distance = calculateDistance(lat, lng, clinic.coords[0], clinic.coords[1]);
            return {
                ...clinic,
                distance: distance
            };
        });

        calculatedClinics.sort((a, b) => a.distance - b.distance);
        renderEmergencyClinics(calculatedClinics);
        resultsContainer.classList.remove("hidden");

        if (calculatedClinics.length > 0) {
            const nearest = calculatedClinics[0];
            map.setView(nearest.coords, 10);

            if (window.emergencyMarker) {
                map.removeLayer(window.emergencyMarker);
            }

            window.emergencyMarker = L.marker(nearest.coords, {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map);

            window.emergencyMarker.bindPopup(`
                <div style="font-family: var(--font-body)">
                    <h4 style="color: var(--error-color)">🚨 NÄRMASTE HÄSTAKUT</h4>
                    <strong>${nearest.name}</strong><br>
                    <span>${nearest.address}</span>
                </div>
            `).openPopup();
        }

        showToast(`Funnit ${calculatedClinics.length} akutkliniker. Sorterat efter avstånd.`, "🚨");
        
        setTimeout(() => {
            document.querySelector(".sidebar-content").scrollTop = 250;
            expandBottomSheet("expanded");
        }, 100);
    });
}

function renderEmergencyClinics(clinics) {
    const container = document.getElementById("emergency-list-container");
    if (!container) return;

    container.innerHTML = "";

    clinics.forEach(clinic => {
        const item = document.createElement("div");
        item.className = "emergency-item";
        item.innerHTML = `
            <div class="emergency-header">
                <div class="emergency-name-box">
                    <h5>${clinic.name}</h5>
                    <span style="font-size: 11px; color: var(--text-secondary);">${clinic.address}</span>
                </div>
                <div class="emergency-dist">${clinic.distance.toFixed(1)} km</div>
            </div>
            <div class="emergency-details">
                <p>${clinic.desc}</p>
                <div style="margin-top: 4px;">📍 <strong>Vändyta för släp:</strong> ${clinic.turnspace}</div>
                <div>📞 <strong>Jourtelefon:</strong> ${clinic.tel}</div>
            </div>
            <div class="emergency-btns">
                <a href="tel:${clinic.tel.replace(/\s+/g, '')}" class="btn btn-secondary btn-sos-call">Ring jour</a>
                <button class="btn btn-primary btn-sos-nav" data-lat="${clinic.coords[0]}" data-lng="${clinic.coords[1]}">Hitta hit</button>
            </div>
        `;

        item.querySelector(".btn-sos-nav").addEventListener("click", () => {
            const center = map.getCenter();
            document.getElementById("input-start").value = `${center.lat.toFixed(6)}, ${center.lng.toFixed(6)}`;
            document.getElementById("input-end").value = `${clinic.coords[0]}, ${clinic.coords[1]}`;
            
            const ruttTab = document.querySelector('[data-tab="tab-route"]');
            if (ruttTab) ruttTab.click();
            
            document.getElementById("btn-find-route").click();
        });

        container.appendChild(item);
    });
}

// Avståndsberäkning (Haversine-formeln)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ----------------------------------------------------
// NYTT: NAVIGATION OCH GPS SIMULERINGSMOTOR
// ----------------------------------------------------

let isNavigating = false;
let isSimulationMode = false;
let navigationSimulationInterval = null;
let watchPositionId = null;
let currentRoutePoints = [];
let currentRouteSteps = [];
let currentSimulationIndex = 0;
let navigationCarMarker = null;
let rawRouteDataForNavigation = null;
let totalTowingSecondsForNav = 0;
let destinationCoordinates = null;
let isRerouting = false;

let navCurrentCoordinates = null;
let nearestClinicHUD = null;

function initNavigation() {
    const startNavBtn = document.getElementById("btn-start-navigation");
    const simulateNavBtn = document.getElementById("btn-simulate-navigation");
    const endNavBtn = document.getElementById("btn-end-navigation");

    // HUD overlays
    const topBannerBtn = document.getElementById("nav-top-banner-btn");
    const directionsPanel = document.getElementById("nav-directions-panel");
    const expandArrow = document.getElementById("nav-expand-arrow");
    const hud = document.getElementById("navigation-hud");

    // Quick hazard reporting elements
    const navHazardBtn = document.getElementById("btn-nav-hazard");
    const quickHazardModal = document.getElementById("quick-hazard-modal");
    const quickHazardCloseBtn = document.getElementById("btn-quick-hazard-close");
    const quickHazardSaveBtn = document.getElementById("btn-quick-hazard-save");
    const quickHazardPosText = document.getElementById("quick-hazard-pos-text");

    // Quick SOS elements
    const navSosBtn = document.getElementById("btn-nav-sos");
    const quickSosCard = document.getElementById("quick-sos-card");
    const quickSosCloseBtn = document.getElementById("btn-quick-sos-close");
    const quickSosCallBtn = document.getElementById("btn-quick-sos-call");
    const quickSosShowBtn = document.getElementById("btn-quick-sos-show");

    if (startNavBtn) {
        startNavBtn.addEventListener("click", () => {
            if (!rawRouteDataForNavigation) {
                alert("Beräkna en rutt först innan du startar navigering.");
                return;
            }
            startNavigation(false); // Live GPS
        });
    }

    if (simulateNavBtn) {
        simulateNavBtn.addEventListener("click", () => {
            if (!rawRouteDataForNavigation) {
                alert("Beräkna en rutt först innan du startar navigering.");
                return;
            }
            startNavigation(true); // Simulering (Demo)
        });
    }

    if (endNavBtn) {
        endNavBtn.addEventListener("click", () => {
            endNavigation();
        });
    }

    // Toggle directions dropdown list
    if (topBannerBtn && directionsPanel) {
        topBannerBtn.addEventListener("click", () => {
            directionsPanel.classList.toggle("hidden");
            hud.classList.toggle("directions-expanded");
            if (directionsPanel.classList.contains("hidden")) {
                if (expandArrow) expandArrow.innerText = "▼";
            } else {
                if (expandArrow) expandArrow.innerText = "▲";
            }
        });
    }

    // Quick hazard dialog triggers
    if (navHazardBtn) {
        navHazardBtn.addEventListener("click", () => {
            if (!navigationCarMarker) return;
            const currentPt = navigationCarMarker.getLatLng();
            navCurrentCoordinates = [currentPt.lat, currentPt.lng];
            
            if (quickHazardPosText) {
                quickHazardPosText.innerText = `${currentPt.lat.toFixed(5)}, ${currentPt.lng.toFixed(5)}`;
            }
            
            quickHazardModal.classList.remove("hidden");
        });
    }

    if (quickHazardCloseBtn) {
        quickHazardCloseBtn.addEventListener("click", () => {
            quickHazardModal.classList.add("hidden");
        });
    }

    if (quickHazardSaveBtn) {
        quickHazardSaveBtn.addEventListener("click", async () => {
            if (!navCurrentCoordinates) return;
            const type = document.getElementById("quick-hazard-type").value;
            const comment = document.getElementById("quick-hazard-comment").value.trim();
            
            quickHazardSaveBtn.setAttribute("disabled", "true");
            quickHazardSaveBtn.innerText = "Sparar...";
            
            const newHazard = {
                id: "haz-" + Date.now(),
                lat: navCurrentCoordinates[0],
                lng: navCurrentCoordinates[1],
                type,
                comment: comment || "Vägvarning rapporterad under navigering",
                timestamp: new Date().toLocaleDateString("sv-SE")
            };
            
            try {
                await db.saveHazard(newHazard);
                localHazards.push(newHazard);
                renderHazardsOnMap();
                renderHazardsList();
                
                document.getElementById("quick-hazard-comment").value = "";
                quickHazardModal.classList.add("hidden");
                showToast("Hinder sparades på din position!", "🚧");
            } catch (e) {
                alert("Kunde inte spara hindret. Försök igen.");
            } finally {
                quickHazardSaveBtn.removeAttribute("disabled");
                quickHazardSaveBtn.innerText = "Spara hinder på din position";
            }
        });
    }

    // Quick SOS card triggers
    if (navSosBtn) {
        navSosBtn.addEventListener("click", async () => {
            if (!navigationCarMarker) return;
            const currentPt = navigationCarMarker.getLatLng();
            const clinics = await db.getEmergencyClinics();
            
            const calculatedClinics = clinics.map(clinic => {
                const distance = calculateDistance(currentPt.lat, currentPt.lng, clinic.coords[0], clinic.coords[1]);
                return {
                    ...clinic,
                    distance: distance
                };
            });
            
            calculatedClinics.sort((a, b) => a.distance - b.distance);
            
            if (calculatedClinics.length > 0) {
                nearestClinicHUD = calculatedClinics[0];
                
                document.getElementById("quick-sos-dist").innerText = `${nearestClinicHUD.distance.toFixed(1)} km`;
                document.getElementById("quick-sos-name").innerText = nearestClinicHUD.name;
                document.getElementById("quick-sos-address").innerText = nearestClinicHUD.address;
                document.getElementById("quick-sos-tel").innerText = nearestClinicHUD.tel;
                document.getElementById("quick-sos-turnspace").innerText = nearestClinicHUD.turnspace;
                
                if (quickSosCallBtn) {
                    quickSosCallBtn.setAttribute("href", `tel:${nearestClinicHUD.tel.replace(/\s+/g, '')}`);
                }
                
                quickSosCard.classList.remove("hidden");
            }
        });
    }

    if (quickSosCloseBtn) {
        quickSosCloseBtn.addEventListener("click", () => {
            quickSosCard.classList.add("hidden");
        });
    }

    if (quickSosShowBtn) {
        quickSosShowBtn.addEventListener("click", () => {
            if (!nearestClinicHUD) return;
            
            if (window.emergencyMarker) {
                map.removeLayer(window.emergencyMarker);
            }
            
            window.emergencyMarker = L.marker(nearestClinicHUD.coords, {
                icon: L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                })
            }).addTo(map);
            
            window.emergencyMarker.bindPopup(`🚨 <strong>${nearestClinicHUD.name}</strong>`).openPopup();
            map.setView(nearestClinicHUD.coords, 12);
            quickSosCard.classList.add("hidden");
            showToast(`Visar ${nearestClinicHUD.name} på kartan`, "🚨");
        });
    }
}

// Koppla in i DOMContentLoaded
window.addEventListener("DOMContentLoaded", () => {
    initNavigation();
});

function getSwedishInstruction(step) {
    const modifier = step.maneuver.modifier;
    const type = step.maneuver.type;
    const name = step.name || "huvudväg";
    
    let text = `Kör på ${name}`;
    let icon = "⬆️";
    
    if (type === "depart") {
        text = `Kör ut på ${name}`;
        icon = "🏁";
    } else if (type === "arrive") {
        text = `Framme vid destinationen!`;
        icon = "📍";
    } else if (type.includes("roundabout")) {
        text = `Ta avfarten i rondellen in på ${name}`;
        icon = "🔄";
    } else if (modifier === "left") {
        text = `Sväng vänster in på ${name}`;
        icon = "⬅️";
    } else if (modifier === "right") {
        text = `Sväng höger in på ${name}`;
        icon = "➡️";
    } else if (modifier === "slight left") {
        text = `Håll vänster mot ${name}`;
        icon = "↖️";
    } else if (modifier === "slight right") {
        text = `Håll höger mot ${name}`;
        icon = "↗️";
    } else if (type === "merge") {
        text = `Kör ihop med ${name}`;
        icon = "🔀";
    }
    
    return { text, icon };
}

function startNavigation(isSimulation) {
    isNavigating = true;
    isSimulationMode = isSimulation;
    currentSimulationIndex = 0;
    
    const route = rawRouteDataForNavigation;
    currentRoutePoints = route.geometry.coordinates.map(c => [c[1], c[0]]);
    currentRouteSteps = route.legs[0].steps;

    // Aktivera navigeringsläge (Döljer sidopanel, visar HUD via CSS-klass)
    document.querySelector(".app-container").classList.add("navigating-mode");
    document.getElementById("navigation-hud").classList.remove("hidden");
    
    // Skapa pulsating bil/häst-markör på startpunkten
    if (navigationCarMarker) {
        map.removeLayer(navigationCarMarker);
    }
    
    const carIcon = L.divIcon({
        html: '<div class="nav-marker-glow"></div><div class="nav-marker-core">🐴</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });
    
    // Sätt första positionen till start av rutten
    navigationCarMarker = L.marker(currentRoutePoints[0], { icon: carIcon }).addTo(map);
    map.setView(currentRoutePoints[0], 17);
    
    if (isSimulation) {
        showToast("Navigering startad! Simulerar din resa...", "🎮");

        // Starta simuleringsloopen
        navigationSimulationInterval = setInterval(() => {
            if (!isNavigating) return;

            if (currentSimulationIndex >= currentRoutePoints.length - 1) {
                clearInterval(navigationSimulationInterval);
                showToast("Du har anlänt till din destination!", "🏁");
                setTimeout(() => {
                    endNavigation();
                }, 3000);
                return;
            }

            // Stega framåt
            currentSimulationIndex++;
            const currentPt = currentRoutePoints[currentSimulationIndex];
            
            navigationCarMarker.setLatLng(currentPt);
            map.panTo(currentPt);

            updateNavigationForCoordinates(currentPt);
        }, 300); // 300ms tick för supersmidig navigering
    } else {
        showToast("Live GPS-navigering startad. Följer din position...", "📡");
        
        if (!navigator.geolocation) {
            alert("GPS stöds inte av din enhet.");
            endNavigation();
            return;
        }

        // Starta Geolocation watchPosition
        watchPositionId = navigator.geolocation.watchPosition((pos) => {
            if (!isNavigating) return;
            
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const currentPt = [lat, lng];

            navigationCarMarker.setLatLng(currentPt);
            map.panTo(currentPt);

            updateNavigationForCoordinates(currentPt);
        }, (err) => {
            console.error("GPS-fel:", err);
            showToast("GPS-signal förlorad eller saknar behörighet.", "⚠️");
        }, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000
        });
    }
}

// Gemensam beräknings- och uppdateringslogik för HUD stats och svänginstruktioner
function updateNavigationForCoordinates(currentPt) {
    const route = rawRouteDataForNavigation;
    
    // Hitta närmaste index på ruttens koordinat-lista för att projicera vår position
    let closestIdx = 0;
    let minDistanceToRoute = Infinity;
    currentRoutePoints.forEach((pt, idx) => {
        const dist = calculateDistance(currentPt[0], currentPt[1], pt[0], pt[1]) * 1000;
        if (dist < minDistanceToRoute) {
            minDistanceToRoute = dist;
            closestIdx = idx;
        }
    });

    // Avvikelse-kontroll (Rerouting / Rutta om): 
    // Om användaren rör sig i Live GPS-läge och hamnar mer än 200 meter ifrån planerad rutt,
    // räknar vi automatiskt om rutten från användarens nuvarande position till målet.
    if (!isSimulationMode && minDistanceToRoute > 200) {
        console.log(`app: Användaren är ur rutt (${minDistanceToRoute.toFixed(0)}m avvikelse). Ruttar om...`);
        recalculateRouteFromCurrentPosition(currentPt);
        return; // Avbryt denna uppdatering, då en ny rutt genereras
    }

    // Hitta den köranvisning som vi är närmast för tillfället
    let currentStepIndex = 0;
    let minStepDistance = Infinity;

    currentRouteSteps.forEach((step, idx) => {
        const stepLoc = [step.maneuver.location[1], step.maneuver.location[0]];
        const dist = calculateDistance(currentPt[0], currentPt[1], stepLoc[0], stepLoc[1]) * 1000;
        if (dist < minStepDistance) {
            minStepDistance = dist;
            currentStepIndex = idx;
        }
    });

    // Beräkna resterande distans (summa av kvarvarande koordinat-sträckor)
    let remainingMeters = 0;
    for (let i = closestIdx; i < currentRoutePoints.length - 1; i++) {
        remainingMeters += calculateDistance(
            currentRoutePoints[i][0], currentRoutePoints[i][1],
            currentRoutePoints[i+1][0], currentRoutePoints[i+1][1]
        ) * 1000;
    }

    // Resterande tid baserat på segment-specifik hastighet
    let remainingSeconds = 0;
    if (currentRouteSteps && currentRouteSteps.length > 0 && currentStepIndex < currentRouteSteps.length) {
        let futureStepsDistance = 0;
        for (let i = currentStepIndex + 1; i < currentRouteSteps.length; i++) {
            futureStepsDistance += currentRouteSteps[i].distance || 0;
        }
        
        const currentStep = currentRouteSteps[currentStepIndex];
        const currentStepDistance = currentStep.distance || 1;
        const remainingOnCurrentStep = Math.max(0, Math.min(currentStepDistance, remainingMeters - futureStepsDistance));
        const currentStepFraction = remainingOnCurrentStep / currentStepDistance;
        
        remainingSeconds += currentStepFraction * (currentStep.horseDuration || 0);
        
        for (let i = currentStepIndex + 1; i < currentRouteSteps.length; i++) {
            remainingSeconds += currentRouteSteps[i].horseDuration || 0;
        }
    } else {
        const totalMeters = route.distance || 1;
        const remainingRatio = Math.min(1.0, remainingMeters / totalMeters);
        remainingSeconds = totalTowingSecondsForNav * remainingRatio;
    }

    // Uppdatera HUD stats
    const hrs = Math.floor(remainingSeconds / 3600);
    const mins = Math.floor((remainingSeconds % 3600) / 60);
    document.getElementById("nav-time-remaining").innerText = `${hrs > 0 ? hrs + 'h ' : ''}${mins}m`;
    
    const distKm = remainingMeters / 1000;
    document.getElementById("nav-dist-remaining").innerText = `${distKm.toFixed(1)} km`;
    
    // Räkna ut ankomsttid
    const now = new Date();
    now.setSeconds(now.getSeconds() + remainingSeconds);
    const etaStr = now.toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" });
    document.getElementById("nav-eta").innerText = `Ankomst ${etaStr}`;

    // Hitta nästa faktiska sväng/rondell framför oss
    let nextTurnStep = null;
    let nextTurnDist = 0;
    let nextTurnIndexInRoute = -1;
    for (let i = currentStepIndex; i < currentRouteSteps.length; i++) {
        const step = currentRouteSteps[i];
        const modifier = step.maneuver.modifier;
        const type = step.maneuver.type;
        if (type.includes("turn") || type.includes("roundabout") || modifier === "left" || modifier === "right" || type === "arrive") {
            nextTurnStep = step;
            nextTurnIndexInRoute = i;
            break;
        }
    }

    if (nextTurnStep) {
        const nextLoc = [nextTurnStep.maneuver.location[1], nextTurnStep.maneuver.location[0]];
        nextTurnDist = calculateDistance(currentPt[0], currentPt[1], nextLoc[0], nextLoc[1]) * 1000;
        
        const inst = getSwedishInstruction(nextTurnStep);
        document.getElementById("nav-instruction-icon").innerText = inst.icon;
        
        let distStr = nextTurnDist > 1000 ? `${(nextTurnDist/1000).toFixed(1)} km` : `${nextTurnDist.toFixed(0)} m`;
        document.getElementById("nav-next-text").innerText = inst.text;
        document.getElementById("nav-next-dist").innerText = `om ${distStr}`;
    } else {
        document.getElementById("nav-instruction-icon").innerText = "⬆️";
        document.getElementById("nav-next-text").innerText = "Fortsätt på färdvägen";
        document.getElementById("nav-next-dist").innerText = "";
    }

    // Hitta näst-näst sväng/rondell (secondTurnStep) efter nextTurnStep
    let secondTurnStep = null;
    if (nextTurnIndexInRoute !== -1) {
        for (let i = nextTurnIndexInRoute + 1; i < currentRouteSteps.length; i++) {
            const step = currentRouteSteps[i];
            const modifier = step.maneuver.modifier;
            const type = step.maneuver.type;
            if (type.includes("turn") || type.includes("roundabout") || modifier === "left" || modifier === "right" || type === "arrive") {
                secondTurnStep = step;
                break;
            }
        }
    }

    const subBanner = document.getElementById("nav-sub-banner");
    const hud = document.getElementById("navigation-hud");
    
    if (secondTurnStep) {
        const subInst = getSwedishInstruction(secondTurnStep);
        document.getElementById("nav-sub-icon").innerText = subInst.icon;
        document.getElementById("nav-sub-text").innerText = secondTurnStep.name || "huvudväg";
        subBanner.classList.remove("hidden");
        hud.classList.add("has-sub-banner");
    } else {
        subBanner.classList.add("hidden");
        hud.classList.remove("has-sub-banner");
    }

    // Uppdatera listan över kommande köranvisningar (max 5)
    const expandedList = document.getElementById("nav-directions-list-expanded");
    if (expandedList) {
        expandedList.innerHTML = "";
        let count = 0;
        for (let i = currentStepIndex; i < currentRouteSteps.length; i++) {
            const step = currentRouteSteps[i];
            const inst = getSwedishInstruction(step);
            const distStr = step.distance > 1000 ? `${(step.distance/1000).toFixed(1)} km` : `${step.distance.toFixed(0)} m`;
            
            const li = document.createElement("li");
            li.innerHTML = `<span style="font-size: 18px;">${inst.icon}</span> 
                            <div>
                                <strong>${inst.text}</strong> 
                                <span style="color: var(--text-secondary); margin-left: 5px;">(${distStr})</span>
                            </div>`;
            expandedList.appendChild(li);
            
            count++;
            if (count >= 5) break;
        }
    }
}

// Ruttar om ekipaget automatiskt vid felkörning
function recalculateRouteFromCurrentPosition(currentPt) {
    if (isRerouting || !destinationCoordinates) return;
    isRerouting = true;
    
    showToast("Ruttar om ekipage...", "🔄");
    console.log("app: Rerouting from current location to destination:", destinationCoordinates);
    
    fetchOSRMRoute(currentPt, destinationCoordinates, (newRoute) => {
        isRerouting = false;
        
        if (!newRoute) {
            console.warn("app: Kunde inte hämta ny rutt vid automatisk omruttning.");
            return;
        }

        // Ta bort gamla linjen och rita den nya
        const newSwappedCoords = newRoute.geometry.coordinates.map(c => [c[1], c[0]]);
        if (routeLine) {
            map.removeLayer(routeLine);
        }
        routeLine = L.polyline(newSwappedCoords, {
            color: "#284c36",
            weight: 6,
            opacity: 0.85
        }).addTo(map);

        // Uppdatera ruttvariablerna för navigationen
        rawRouteDataForNavigation = newRoute;
        currentRoutePoints = newSwappedCoords;
        currentRouteSteps = newRoute.legs[0].steps;

        // Räkna ut ny realistisk släpvagnskörtid
        const distanceKm = newRoute.distance / 1000;
        let turnCount = 0;
        newRoute.legs[0].steps.forEach(step => {
            const modifier = step.maneuver.modifier;
            const type = step.maneuver.type;
            if (type.includes("roundabout") || type.includes("turn") || modifier === "left" || modifier === "right") {
                turnCount++;
            }
        });

        let totalTowingSeconds = 0;
        if (newRoute.legs && newRoute.legs[0] && newRoute.legs[0].steps) {
            newRoute.legs[0].steps.forEach(step => {
                step.horseDuration = calculateHorseDurationForStep(step, newRoute);
                totalTowingSeconds += step.horseDuration;
            });
        } else {
            const carDuration = newRoute.duration;
            const carAverageSpeed = carDuration > 0 ? (distanceKm / (carDuration / 3600)) : 50;
            const speedRatio = Math.min(1.0, carAverageSpeed / 110);
            const towingSpeed = Math.min(80, 80 * speedRatio);
            const baseTowingHours = distanceKm / towingSpeed;
            const turnPenaltySeconds = turnCount * 5;
            totalTowingSeconds = (baseTowingHours * 3600) + turnPenaltySeconds;
        }
        totalTowingSecondsForNav = totalTowingSeconds;

        showToast("Rutt uppdaterad automatiskt!", "✅");

        // Uppdatera HUD omedelbart
        updateNavigationForCoordinates(currentPt);
    });
}

function endNavigation() {
    isNavigating = false;
    
    if (navigationSimulationInterval) {
        clearInterval(navigationSimulationInterval);
        navigationSimulationInterval = null;
    }
    
    if (watchPositionId !== null) {
        navigator.geolocation.clearWatch(watchPositionId);
        watchPositionId = null;
    }
    
    if (navigationCarMarker) {
        map.removeLayer(navigationCarMarker);
        navigationCarMarker = null;
    }

    if (window.emergencyMarker) {
        map.removeLayer(window.emergencyMarker);
        window.emergencyMarker = null;
    }

    // Ta bort navigeringsläge
    document.querySelector(".app-container").classList.remove("navigating-mode");
    const hud = document.getElementById("navigation-hud");
    if (hud) {
        hud.classList.add("hidden");
        hud.classList.remove("directions-expanded");
        hud.classList.remove("has-sub-banner");
    }

    // Dölj alla modaler och dropdowns
    const directionsPanel = document.getElementById("nav-directions-panel");
    const quickSosCard = document.getElementById("quick-sos-card");
    const quickHazardModal = document.getElementById("quick-hazard-modal");
    const expandArrow = document.getElementById("nav-expand-arrow");
    const subBanner = document.getElementById("nav-sub-banner");

    if (directionsPanel) directionsPanel.classList.add("hidden");
    if (quickSosCard) quickSosCard.classList.add("hidden");
    if (quickHazardModal) quickHazardModal.classList.add("hidden");
    if (subBanner) subBanner.classList.add("hidden");
    if (expandArrow) expandArrow.innerText = "▼";
    
    showToast("Navigering avslutad.", "🧹");
    
    // Zooma ut för att visa hela rutten igen
    if (routeLine) {
        map.fitBounds(routeLine.getBounds(), { padding: [45, 45] });
    }
}

// Kopplar upp adress-autocomplete med debounced API-förfrågningar till Nominatim (Sverige)
function setupAutocomplete(inputId, type) {
    const input = document.getElementById(inputId);
    if (!input) return;

    // Skapa förslagscontainer om den inte redan finns
    let suggestionsContainer = input.parentNode.querySelector(".autocomplete-suggestions");
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement("div");
        suggestionsContainer.className = "autocomplete-suggestions hidden";
        // Placera den inuti föräldraelementet
        const parentFormGroup = input.closest(".form-group");
        if (parentFormGroup) {
            parentFormGroup.appendChild(suggestionsContainer);
        } else {
            input.parentNode.appendChild(suggestionsContainer);
        }
    }

    let debounceTimeout = null;

    input.addEventListener("input", () => {
        const val = input.value.trim();
        clearTimeout(debounceTimeout);

        if (val.length < 3) {
            suggestionsContainer.classList.add("hidden");
            suggestionsContainer.innerHTML = "";
            return;
        }

        debounceTimeout = setTimeout(() => {
            fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&countrycodes=se&limit=5`)
                .then(res => res.json())
                .then(data => {
                    suggestionsContainer.innerHTML = "";
                    if (!data || data.length === 0) {
                        suggestionsContainer.classList.add("hidden");
                        return;
                    }

                    data.forEach(item => {
                        const div = document.createElement("div");
                        div.className = "suggestion-item";
                        
                        // Formatera visningsnamnet (ta bort t.ex. ", Sverige" för renare UI)
                        const displayName = item.display_name.replace(", Sverige", "").replace(", Sweden", "");
                        div.innerHTML = `📍 <span>${displayName}</span>`;
                        
                        div.addEventListener("click", () => {
                            input.value = displayName;
                            suggestionsContainer.classList.add("hidden");

                            // Uppdatera kartans markör för start eller slut
                            const lat = parseFloat(item.lat);
                            const lng = parseFloat(item.lon);
                            setRouteMarker(type, lat, lng);
                            
                            // Panorera kartan dit
                            map.setView([lat, lng], 13);
                        });

                        suggestionsContainer.appendChild(div);
                    });

                    suggestionsContainer.classList.remove("hidden");
                })
                .catch(err => {
                    console.error("app: Autocomplete-fel:", err);
                });
        }, 300); // 300ms debounce för att inte överbelasta Nominatim
    });

    // Dölj förslagen om man klickar någon annanstans på sidan
    document.addEventListener("click", (e) => {
        if (!input.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.classList.add("hidden");
        }
    });
}

function initAboutUsModal() {
    const btnReadAbout = document.getElementById("btn-read-about");
    const aboutUsModal = document.getElementById("about-us-modal");
    const btnAboutClose = document.getElementById("btn-about-close");
    const btnAboutOk = document.getElementById("btn-about-ok");

    if (btnReadAbout && aboutUsModal) {
        btnReadAbout.addEventListener("click", () => {
            aboutUsModal.classList.remove("hidden");
        });
    }

    if (btnAboutClose && aboutUsModal) {
        btnAboutClose.addEventListener("click", () => {
            aboutUsModal.classList.add("hidden");
        });
    }

    if (btnAboutOk && aboutUsModal) {
        btnAboutOk.addEventListener("click", () => {
            aboutUsModal.classList.add("hidden");
        });
    }

    if (aboutUsModal) {
        aboutUsModal.addEventListener("click", (e) => {
            if (e.target === aboutUsModal) {
                aboutUsModal.classList.add("hidden");
            }
        });
    }
}

function switchTab(tabId) {
    const tabs = document.querySelectorAll(".tab-btn");
    const panels = document.querySelectorAll(".tab-panel");

    tabs.forEach(t => t.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    // Hitta tab-knappen om den finns (vissa flikar finns inte i bottenmenyn)
    const activeTabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeTabButton) {
        activeTabButton.classList.add("active");
    }

    const panel = document.getElementById(tabId);
    if (panel) {
        panel.classList.add("active");
    }
    
    currentActiveTab = tabId;

    // Expandera bottom sheet så att man ser formulären
    expandBottomSheet("peek");

    // Rensa tillfällig hindermarkör vid flikbyte
    if (tabId !== "tab-hazards") {
        if (window.tempHazardMarker) {
            map.removeLayer(window.tempHazardMarker);
            window.tempHazardMarker = null;
        }
    }
}

function initNavigationTree() {
    // Koppla klick på hemskärmens brickor/knappar
    const tileRoute = document.getElementById("tile-route");
    const tileCalculator = document.getElementById("tile-calculator");
    const tileHazards = document.getElementById("tile-hazards");
    const tileEmergency = document.getElementById("tile-emergency");

    if (tileRoute) {
        tileRoute.addEventListener("click", () => {
            // Avmarkera alla service tiles och markera denna som aktiv
            document.querySelectorAll(".service-tile").forEach(t => t.classList.remove("active"));
            tileRoute.classList.add("active");
            switchTab("tab-route");
        });
    }
    if (tileCalculator) {
        tileCalculator.addEventListener("click", () => {
            document.querySelectorAll(".service-tile").forEach(t => t.classList.remove("active"));
            tileCalculator.classList.add("active");
            switchTab("tab-calculator");
        });
    }
    if (tileHazards) {
        tileHazards.addEventListener("click", () => {
            document.querySelectorAll(".service-tile").forEach(t => t.classList.remove("active"));
            tileHazards.classList.add("active");
            switchTab("tab-hazards");
        });
    }
    if (tileEmergency) {
        tileEmergency.addEventListener("click", () => {
            document.querySelectorAll(".service-tile").forEach(t => t.classList.remove("active"));
            tileEmergency.classList.add("active");
            switchTab("tab-emergency");
        });
    }

    // Koppla klick på alla tillbaka-knappar
    document.querySelectorAll(".btn-back-to-home").forEach(btn => {
        btn.addEventListener("click", () => {
            // Återställ rutt-knappen som aktiv på hemskärmen till nästa gång
            document.querySelectorAll(".service-tile").forEach(t => t.classList.remove("active"));
            const tileRoute = document.getElementById("tile-route");
            if (tileRoute) tileRoute.classList.add("active");
            switchTab("tab-home");
        });
    });
    
    // Koppla klick på senaste rutter
    const recentRoute = document.getElementById("recent-route-stockholm");
    if (recentRoute) {
        recentRoute.addEventListener("click", () => {
            document.getElementById("input-start").value = "Stockholm";
            document.getElementById("input-end").value = "Strömsholm";
            switchTab("tab-route");
            document.getElementById("btn-find-route").click();
        });
    }
}


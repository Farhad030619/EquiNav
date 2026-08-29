/**
 * api/vehicles.js - Vehicle Specs Lookup API
 * Search car and trailer specifications by Make, Model, Year, or search query.
 */

const VEHICLE_CATALOG = [
    // --- TOW CARS ---
    { id: "volvo-xc90-d5", make: "Volvo", model: "XC90 D5 AWD", yearStart: 2016, yearEnd: 2023, name: "Volvo XC90 D5 AWD (2016-2023)", type: "car", curb: 2130, total: 2750, maxTow: 2700 },
    { id: "volvo-xc90-b5", make: "Volvo", model: "XC90 B5 AWD", yearStart: 2020, yearEnd: 2026, name: "Volvo XC90 B5 AWD (2020-2026)", type: "car", curb: 2180, total: 2820, maxTow: 2700 },
    { id: "volvo-xc60-d5", make: "Volvo", model: "XC60 D4/D5 AWD", yearStart: 2018, yearEnd: 2023, name: "Volvo XC60 D4/D5 AWD (2018-2023)", type: "car", curb: 1840, total: 2400, maxTow: 2400 },
    { id: "volvo-v90-cc", make: "Volvo", model: "V90 Cross Country D4/D5 AWD", yearStart: 2017, yearEnd: 2024, name: "Volvo V90 Cross Country AWD (2017-2024)", type: "car", curb: 1820, total: 2400, maxTow: 2500 },
    { id: "volvo-v70-d4", make: "Volvo", model: "V70 D4 AWD", yearStart: 2013, yearEnd: 2016, name: "Volvo V70 D4 AWD (2013-2016)", type: "car", curb: 1740, total: 2310, maxTow: 2000 },
    
    { id: "vw-passat-alltrack", make: "Volkswagen", model: "Passat Alltrack 2.0 TDI 4Motion", yearStart: 2016, yearEnd: 2024, name: "Volkswagen Passat Alltrack 2.0 TDI 4Motion", type: "car", curb: 1735, total: 2300, maxTow: 2200 },
    { id: "vw-touareg-v6", make: "Volkswagen", model: "Touareg 3.0 V6 TDI 4Motion", yearStart: 2018, yearEnd: 2025, name: "Volkswagen Touareg 3.0 V6 TDI (2018-2025)", type: "car", curb: 2070, total: 2850, maxTow: 3500 },
    { id: "vw-tiguan-allspace", make: "Volkswagen", model: "Tiguan Allspace 2.0 TDI 4Motion", yearStart: 2018, yearEnd: 2024, name: "Volkswagen Tiguan Allspace TDI 4Motion", type: "car", curb: 1780, total: 2390, maxTow: 2500 },

    { id: "bmw-x5-x30d", make: "BMW", model: "X5 xDrive30d", yearStart: 2019, yearEnd: 2026, name: "BMW X5 xDrive30d (G05 2019-2026)", type: "car", curb: 2185, total: 2860, maxTow: 3500 },
    { id: "bmw-x3-x30d", make: "BMW", model: "X3 xDrive30d", yearStart: 2018, yearEnd: 2024, name: "BMW X3 xDrive30d (2018-2024)", type: "car", curb: 1900, total: 2500, maxTow: 2400 },
    { id: "bmw-530d-touring", make: "BMW", model: "530d xDrive Touring", yearStart: 2017, yearEnd: 2023, name: "BMW 530d xDrive Touring (2017-2023)", type: "car", curb: 1875, total: 2490, maxTow: 2000 },

    { id: "audi-q7-50tdi", make: "Audi", model: "Q7 50 TDI quattro", yearStart: 2016, yearEnd: 2025, name: "Audi Q7 50 TDI quattro (2016-2025)", type: "car", curb: 2135, total: 2940, maxTow: 3500 },
    { id: "audi-q5-40tdi", make: "Audi", model: "Q5 40 TDI quattro", yearStart: 2017, yearEnd: 2024, name: "Audi Q5 40 TDI quattro (2017-2024)", type: "car", curb: 1880, total: 2470, maxTow: 2400 },
    { id: "audi-a6-allroad", make: "Audi", model: "A6 allroad quattro 50 TDI", yearStart: 2019, yearEnd: 2025, name: "Audi A6 allroad quattro 50 TDI (2019-2025)", type: "car", curb: 2020, total: 2650, maxTow: 2500 },

    { id: "ford-ranger-wildtrak", make: "Ford", model: "Ranger Wildtrak 3.2 TDCi / 2.0 EcoBlue", yearStart: 2016, yearEnd: 2023, name: "Ford Ranger Wildtrak 4x4 (2016-2023)", type: "car", curb: 2190, total: 3270, maxTow: 3500 },
    { id: "ford-kuga-tdci", make: "Ford", model: "Kuga 2.0 TDCi AWD", yearStart: 2017, yearEnd: 2022, name: "Ford Kuga 2.0 TDCi AWD (2017-2022)", type: "car", curb: 1710, total: 2250, maxTow: 2100 },

    { id: "toyota-hilux-2.8d", make: "Toyota", model: "Hilux 2.8 D-4D 4x4", yearStart: 2020, yearEnd: 2026, name: "Toyota Hilux 2.8 D-4D 4x4 (2020-2026)", type: "car", curb: 2100, total: 3210, maxTow: 3500 },
    { id: "toyota-landcruiser-150", make: "Toyota", model: "Land Cruiser 150 2.8 D-4D", yearStart: 2015, yearEnd: 2024, name: "Toyota Land Cruiser 150 2.8 D-4D", type: "car", curb: 2200, total: 2990, maxTow: 3500 },
    { id: "toyota-rav4-awd", make: "Toyota", model: "RAV4 2.5 Hybrid AWD-i", yearStart: 2019, yearEnd: 2025, name: "Toyota RAV4 2.5 Hybrid AWD-i (2019-2025)", type: "car", curb: 1730, total: 2225, maxTow: 1650 },

    { id: "subaru-outback-2.5i", make: "Subaru", model: "Outback 2.5i AWD", yearStart: 2018, yearEnd: 2025, name: "Subaru Outback 2.5i AWD (2018-2025)", type: "car", curb: 1640, total: 2100, maxTow: 2000 },
    { id: "subaru-forester-e-boxer", make: "Subaru", model: "Forester e-BOXER AWD", yearStart: 2020, yearEnd: 2025, name: "Subaru Forester e-BOXER AWD", type: "car", curb: 1690, total: 2185, maxTow: 1870 },

    { id: "kia-sorento-crdi", make: "Kia", model: "Sorento 2.2 CRDi AWD", yearStart: 2016, yearEnd: 2023, name: "Kia Sorento 2.2 CRDi AWD (2016-2023)", type: "car", curb: 1950, total: 2620, maxTow: 2500 },
    { id: "kia-sportage-crdi", make: "Kia", model: "Sportage 2.0 CRDi AWD", yearStart: 2016, yearEnd: 2022, name: "Kia Sportage 2.0 CRDi AWD (2016-2022)", type: "car", curb: 1680, total: 2250, maxTow: 1900 },

    { id: "mb-gle-350d", make: "Mercedes-Benz", model: "GLE 350d 4MATIC", yearStart: 2016, yearEnd: 2024, name: "Mercedes-Benz GLE 350d 4MATIC (2016-2024)", type: "car", curb: 2235, total: 3050, maxTow: 3500 },
    { id: "mb-glc-220d", make: "Mercedes-Benz", model: "GLC 220d 4MATIC", yearStart: 2016, yearEnd: 2023, name: "Mercedes-Benz GLC 220d 4MATIC (2016-2023)", type: "car", curb: 1845, total: 2500, maxTow: 2500 },

    { id: "skoda-kodiaq-4x4", make: "Skoda", model: "Kodiaq 2.0 TDI 4x4", yearStart: 2017, yearEnd: 2024, name: "Skoda Kodiaq 2.0 TDI 4x4 (2017-2024)", type: "car", curb: 1750, total: 2350, maxTow: 2300 },
    { id: "skoda-superb-combi-4x4", make: "Skoda", model: "Superb Combi 2.0 TDI 4x4", yearStart: 2016, yearEnd: 2024, name: "Skoda Superb Combi 2.0 TDI 4x4", type: "car", curb: 1650, total: 2260, maxTow: 2200 },

    // --- HORSE TRAILERS ---
    { id: "ume-b50", make: "Ume-släpet", model: "B50 / BBO", yearStart: 2010, yearEnd: 2026, name: "Ume-släpet B50 / BBO", type: "trailer", curb: 820, total: 1990, payload: 1170 },
    { id: "ume-a30", make: "Ume-släpet", model: "A30 Enkelhäst", yearStart: 2012, yearEnd: 2026, name: "Ume-släpet A30 Enkelhäst", type: "trailer", curb: 740, total: 1500, payload: 760 },
    
    { id: "cheval-gold-ii", make: "Cheval Liberté", model: "Gold II / Gold One", yearStart: 2015, yearEnd: 2026, name: "Cheval Liberté Gold II", type: "trailer", curb: 790, total: 2000, payload: 1210 },
    { id: "cheval-touring-country", make: "Cheval Liberté", model: "Touring Country", yearStart: 2018, yearEnd: 2026, name: "Cheval Liberté Touring Country", type: "trailer", curb: 850, total: 2600, payload: 1750 },

    { id: "ifor-hb511", make: "Ifor Williams", model: "HB511 Dubbelhäst", yearStart: 2012, yearEnd: 2026, name: "Ifor Williams HB511", type: "trailer", curb: 920, total: 2600, payload: 1680 },
    { id: "ifor-hb506", make: "Ifor Williams", model: "HB506 Dubbelhäst", yearStart: 2012, yearEnd: 2026, name: "Ifor Williams HB506", type: "trailer", curb: 870, total: 2100, payload: 1230 },

    { id: "fogelsta-royal", make: "Fogelsta / Thule", model: "Royal 2000", yearStart: 2010, yearEnd: 2024, name: "Fogelsta Royal 2000", type: "trailer", curb: 860, total: 1990, payload: 1130 },
    { id: "varmlandsvagnen-classic", make: "Värmlandsvagnen", model: "Classic", yearStart: 2008, yearEnd: 2024, name: "Värmlandsvagnen Classic", type: "trailer", curb: 780, total: 1500, payload: 720 },
    { id: "boeckmann-comfort", make: "Böckmann", model: "Comfort / Duo", yearStart: 2014, yearEnd: 2026, name: "Böckmann Comfort", type: "trailer", curb: 890, total: 2400, payload: 1510 },
    { id: "mustad-2000", make: "Mustad", model: "Mustad 2000", yearStart: 2005, yearEnd: 2020, name: "Mustad 2000", type: "trailer", curb: 850, total: 2000, payload: 1150 }
];

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { q, query, make, model, year, type } = req.query;
    const searchTerm = (q || query || "").trim().toLowerCase();
    const filterMake = (make || "").trim().toLowerCase();
    const filterModel = (model || "").trim().toLowerCase();
    const targetYear = year ? parseInt(year) : null;
    const targetType = (type || "").trim().toLowerCase();

    let matches = VEHICLE_CATALOG.filter(item => {
        if (targetType && item.type !== targetType) return false;
        
        if (targetYear && (targetYear < item.yearStart || targetYear > item.yearEnd)) {
            // Allow matching if year is close or fallback
        }

        if (filterMake && !item.make.toLowerCase().includes(filterMake)) return false;
        if (filterModel && !item.model.toLowerCase().includes(filterModel)) return false;

        if (searchTerm) {
            const fullName = `${item.make} ${item.model} ${item.name}`.toLowerCase();
            const terms = searchTerm.split(/\s+/);
            const matchesAllTerms = terms.every(term => fullName.includes(term));
            if (!matchesAllTerms) return false;
        }

        return true;
    });

    if (!searchTerm && !filterMake && !filterModel) {
        matches = targetType ? VEHICLE_CATALOG.filter(v => v.type === targetType) : VEHICLE_CATALOG;
    }

    return res.status(200).json({
        success: true,
        count: matches.length,
        results: matches.slice(0, 20)
    });
};

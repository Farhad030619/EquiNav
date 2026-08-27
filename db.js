/**
 * db.js - Databasabstraktionslager för Hästtransport-GPS
 * Ansluter till Supabase för fordonssökning och hinderrapportering.
 */

const supabaseUrl = 'https://jtamwhtisgvsxuaepkhg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp0YW13aHRpc2d2c3h1YWVwa2hnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5NzA5NjQsImV4cCI6MjA5OTU0Njk2NH0.k9gewtqGCNW6f_A3NWfkvUQBT8IZw07YxVetkdZpfcg';

// Initiera Supabase-klienten
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

const db = {
    // 1. Sök i bilregistret efter registreringsnummer
    async getCarSpecs(regNum) {
        console.log(`db: Söker bil med regnr: ${regNum}`);
        try {
            const { data, error } = await _supabase
                .from('vehicles')
                .select('*')
                .eq('reg_num', regNum.trim().toUpperCase())
                .eq('type', 'car')
                .single();

            if (error) {
                console.warn("db: Bilen hittades inte eller fel uppstod:", error.message);
                return null;
            }

            return {
                name: data.name,
                curb: data.curb_weight,
                total: data.total_weight,
                maxTow: data.max_tow_weight
            };
        } catch (e) {
            console.error("db: Nätverksfel vid bilsökning:", e);
            return null;
        }
    },

    // 2. Sök i släpvagnsregistret efter registreringsnummer
    async getTrailerSpecs(regNum) {
        console.log(`db: Söker släpvagn med regnr: ${regNum}`);
        try {
            const { data, error } = await _supabase
                .from('vehicles')
                .select('*')
                .eq('reg_num', regNum.trim().toUpperCase())
                .eq('type', 'trailer')
                .single();

            if (error) {
                console.warn("db: Släpet hittades inte eller fel uppstod:", error.message);
                return null;
            }

            return {
                name: data.name,
                curb: data.curb_weight,
                total: data.total_weight,
                payload: data.payload
            };
        } catch (e) {
            console.error("db: Nätverksfel vid släpsökning:", e);
            return null;
        }
    },

    // 2b. Sök bilmodell och år (API & lokal katalog)
    async searchCarByModel(query, year = null) {
        const q = (query || "").trim().toLowerCase();
        console.log(`db: Söker bilmodell '${q}' och år '${year}'`);
        
        try {
            const params = new URLSearchParams({ type: 'car', q });
            if (year) params.append('year', year);
            const res = await fetch(`/api/vehicles?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    return data.results;
                }
            }
        } catch (e) {
            // Nätverksfel / lokal fallback
        }

        const catalog = [
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

            { id: "audi-q7-50tdi", make: "Audi", model: "Q7 50 TDI quattro", yearStart: 2016, yearEnd: 2025, name: "Audi Q7 50 TDI quattro (2016-2025)", type: "car", curb: 2135, total: 2940, maxTow: 3500 },
            { id: "audi-q5-40tdi", make: "Audi", model: "Q5 40 TDI quattro", yearStart: 2017, yearEnd: 2024, name: "Audi Q5 40 TDI quattro (2017-2024)", type: "car", curb: 1880, total: 2470, maxTow: 2400 },

            { id: "ford-ranger-wildtrak", make: "Ford", model: "Ranger Wildtrak 4x4", yearStart: 2016, yearEnd: 2023, name: "Ford Ranger Wildtrak 4x4 (2016-2023)", type: "car", curb: 2190, total: 3270, maxTow: 3500 },
            { id: "toyota-hilux-2.8d", make: "Toyota", model: "Hilux 2.8 D-4D 4x4", yearStart: 2020, yearEnd: 2026, name: "Toyota Hilux 2.8 D-4D 4x4 (2020-2026)", type: "car", curb: 2100, total: 3210, maxTow: 3500 },
            { id: "subaru-outback-2.5i", make: "Subaru", model: "Outback 2.5i AWD", yearStart: 2018, yearEnd: 2025, name: "Subaru Outback 2.5i AWD (2018-2025)", type: "car", curb: 1640, total: 2100, maxTow: 2000 },
            { id: "kia-sorento-crdi", make: "Kia", model: "Sorento 2.2 CRDi AWD", yearStart: 2016, yearEnd: 2023, name: "Kia Sorento 2.2 CRDi AWD (2016-2023)", type: "car", curb: 1950, total: 2620, maxTow: 2500 },
            { id: "mb-gle-350d", make: "Mercedes-Benz", model: "GLE 350d 4MATIC", yearStart: 2016, yearEnd: 2024, name: "Mercedes-Benz GLE 350d 4MATIC (2016-2024)", type: "car", curb: 2235, total: 3050, maxTow: 3500 },
            { id: "skoda-kodiaq-4x4", make: "Skoda", model: "Kodiaq 2.0 TDI 4x4", yearStart: 2017, yearEnd: 2024, name: "Skoda Kodiaq 2.0 TDI 4x4 (2017-2024)", type: "car", curb: 1750, total: 2350, maxTow: 2300 }
        ];

        const terms = q.split(/\s+/).filter(Boolean);
        const yNum = year ? parseInt(year) : null;

        return catalog.filter(car => {
            if (yNum && (yNum < car.yearStart || yNum > car.yearEnd)) return false;
            if (terms.length === 0) return true;
            const fullText = `${car.make} ${car.model} ${car.name}`.toLowerCase();
            return terms.every(t => fullText.includes(t));
        });
    },

    // 2c. Sök släpmodell (API & lokal katalog)
    async searchTrailerByModel(query) {
        const q = (query || "").trim().toLowerCase();
        console.log(`db: Söker släpmodell '${q}'`);

        try {
            const params = new URLSearchParams({ type: 'trailer', q });
            const res = await fetch(`/api/vehicles?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                if (data.results && data.results.length > 0) {
                    return data.results;
                }
            }
        } catch (e) {}

        const catalog = [
            { id: "ume-b50", make: "Ume-släpet", model: "B50 / BBO", name: "Ume-släpet B50 / BBO", type: "trailer", curb: 820, total: 1990, payload: 1170 },
            { id: "ume-a30", make: "Ume-släpet", model: "A30 Enkelhäst", name: "Ume-släpet A30 Enkelhäst", type: "trailer", curb: 740, total: 1500, payload: 760 },
            { id: "cheval-gold-ii", make: "Cheval Liberté", model: "Gold II", name: "Cheval Liberté Gold II", type: "trailer", curb: 790, total: 2000, payload: 1210 },
            { id: "cheval-touring-country", make: "Cheval Liberté", model: "Touring Country", name: "Cheval Liberté Touring Country", type: "trailer", curb: 850, total: 2600, payload: 1750 },
            { id: "ifor-hb511", make: "Ifor Williams", model: "HB511", name: "Ifor Williams HB511", type: "trailer", curb: 920, total: 2600, payload: 1680 },
            { id: "fogelsta-royal", make: "Fogelsta", model: "Royal 2000", name: "Fogelsta Royal 2000", type: "trailer", curb: 860, total: 1990, payload: 1130 },
            { id: "varmlandsvagnen-classic", make: "Värmlandsvagnen", model: "Classic", name: "Värmlandsvagnen Classic", type: "trailer", curb: 780, total: 1500, payload: 720 },
            { id: "boeckmann-comfort", make: "Böckmann", model: "Comfort", name: "Böckmann Comfort", type: "trailer", curb: 890, total: 2400, payload: 1510 }
        ];

        const terms = q.split(/\s+/).filter(Boolean);
        return catalog.filter(t => {
            if (terms.length === 0) return true;
            const fullText = `${t.make} ${t.model} ${t.name}`.toLowerCase();
            return terms.every(term => fullText.includes(term));
        });
    },

    // 3. Hämta alla användarrapporterade hinder
    async getHazards() {
        console.log("db: Hämtar hinder från Supabase...");
        try {
            const { data, error } = await _supabase
                .from('hazards')
                .select('*')
                .order('timestamp', { ascending: false });

            if (error) {
                console.error("db: Kunde inte hämta hinder:", error.message);
                return [];
            }
            return data;
        } catch (e) {
            console.error("db: Nätverksfel vid hämtning av hinder:", e);
            return [];
        }
    },

    // 4. Spara ett nytt hinder på kartan
    async saveHazard(hazard) {
        console.log("db: Sparar hinder till Supabase...", hazard);
        try {
            const { data, error } = await _supabase
                .from('hazards')
                .insert([hazard]);

            if (error) {
                console.error("db: Fel vid sparande av hinder:", error.message);
                throw new Error(error.message);
            }
            return data;
        } catch (e) {
            console.error("db: Nätverksfel vid sparande:", e);
            throw e;
        }
    },

    // 5. Ta bort ett hinder
    async deleteHazard(id) {
        console.log(`db: Tar bort hinder med ID: ${id}`);
        try {
            const { error } = await _supabase
                .from('hazards')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("db: Fel vid radering av hinder:", error.message);
                throw new Error(error.message);
            }
        } catch (e) {
            console.error("db: Nätverksfel vid radering:", e);
            throw e;
        }
    },

    // 6. Djursjukhus och jourveterinärer (Statiskt för MVP, men Promise-baserad)
    async getEmergencyClinics() {
        return [
            {
                name: "Strömsholm Hästakuten (Evidensia Djursjukhus)",
                coords: [59.5235, 16.2625],
                tel: "0220-452 00",
                address: "Djursjukhusvägen 11, Strömsholm",
                desc: "Dygnet runt-öppet hästsjukhus med full operationsberedskap och jour.",
                turnspace: "Ja, mycket god vändyta (rondell och breda grusplaner)."
            },
            {
                name: "Mälaren Hästklinik (Sigtuna)",
                coords: [59.6178, 17.7212],
                tel: "08-592 540 10",
                address: "Hargs Gård, Sigtuna",
                desc: "Akutmottagning för häst med modern vårdavdelning och specialistkompetens.",
                turnspace: "Ja, bred uppfart med rundgång för enkelt möte och vändning."
            },
            {
                name: "Universitetsdjursjukhuset SLU (Uppsala)",
                coords: [59.8164, 17.6622],
                tel: "018-67 21 00",
                address: "Ulls väg 29, Uppsala",
                desc: "Sveriges enda universitetsdjursjukhus. Akut hästmottagning öppen dygnet runt.",
                turnspace: "Ja, anpassat för tunga fordon, rymliga parkeringsytor för hästtransport."
            },
            {
                name: "Evidensia Specialisthästsjukhuset Helsingborg",
                coords: [56.0792, 12.7303],
                tel: "042-16 80 00",
                address: "Garnisonsgatan 19, Helsingborg",
                desc: "Södra Sveriges största hästakut. Kirurgi, medicin och dygnet runt-övervakning.",
                turnspace: "Ja, stor inhägnad gårdsplan med generösa vändplatser."
            },
            {
                name: "Hallands Djursjukhus (Slöinge)",
                coords: [56.8488, 12.6934],
                tel: "0346-486 00",
                address: "Djursjukhusvägen 12, Slöinge",
                desc: "Välutrustat hästlasarett med akutjour. Fullt utrustade operationssalar.",
                turnspace: "Ja, specialparkeringar för släp samt enkelt att vända."
            },
            {
                name: "Täby Hästklinik",
                coords: [59.4891, 18.0612],
                tel: "08-756 80 55",
                address: "Täby Galoppväg, Täby",
                desc: "Klinik som erbjuder dagsjour och akuta undersökningar.",
                turnspace: "Ja, beläget på tävlingsområde med obegränsat utrymme för släp."
            }
        ];
    },

    // Hämta vägavvikelser via Vercel-serverless proxy
    async getTrafikverketSituationsFromProxy() {
        console.log("db: Hämtar vägstörningar från Vercel Proxy...");
        try {
            const response = await fetch("/api/traffic");
            if (!response.ok) {
                // Om 444, 404 osv (t.ex. vid lokal körning med python http.server)
                return { disabled: true, data: [] };
            }
            const data = await response.json();
            
            if (data.disabled) {
                console.warn("db: Serverns API-nyckel saknas (inte konfigurerad på Vercel).");
                return { disabled: true, data: [] };
            }
            
            if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
                const situations = data.RESPONSE.RESULT[0].Situation || [];
                const result = [];
                situations.forEach(s => {
                    if (s.Deviation) {
                        const devs = Array.isArray(s.Deviation) ? s.Deviation : [s.Deviation];
                        devs.forEach(d => {
                            let lat = null;
                            let lng = null;
                            let geomStr = null;
                            if (d.Geometry && d.Geometry.WGS84) {
                                geomStr = d.Geometry.WGS84;
                            } else if (s.Geometry && s.Geometry.WGS84) {
                                geomStr = s.Geometry.WGS84;
                            }
                            
                            if (geomStr) {
                                const match = geomStr.match(/\(\s*([^\s]+)\s+([^\s,\)]+)/);
                                if (match) {
                                    lng = parseFloat(match[1]);
                                    lat = parseFloat(match[2]);
                                }
                            }
                            
                            if (lat !== null && lng !== null) {
                                result.push({
                                    id: d.Id || s.Id,
                                    header: d.Header || "Trafikstörning",
                                    message: d.Message || "Ingen beskrivning tillgänglig.",
                                    lat: lat,
                                    lng: lng,
                                    startTime: d.StartTime,
                                    endTime: d.EndTime,
                                    iconId: d.IconId || "warning"
                                });
                            }
                        });
                    }
                });
                return { disabled: false, data: result };
            }
            return { disabled: false, data: [] };
        } catch (e) {
            console.warn("db: Misslyckades att hämta från proxy (detta är normalt under lokal utveckling):", e.message);
            return { disabled: true, data: [] };
        }
    },

    // Sök efter vägavvikelser och situationer hos Trafikverket
    async getTrafikverketSituations(apiKey) {
        if (!apiKey) return [];
        console.log("db: Hämtar vägstörningar från Trafikverket...");
        const url = "https://api.trafikinfo.trafikverket.se/v2/data.json";
        const body = `
        <REQUEST>
            <LOGIN authenticationkey="${apiKey}" />
            <QUERY objecttype="Situation" schemaversion="1.5">
                <FILTER>
                    <EQ name="Deviation.ManagedCause" value="true" />
                </FILTER>
            </QUERY>
        </REQUEST>`;
        
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "text/xml"
                },
                body: body
            });
            const data = await response.json();
            
            if (data && data.RESPONSE && data.RESPONSE.RESULT && data.RESPONSE.RESULT[0]) {
                const situations = data.RESPONSE.RESULT[0].Situation || [];
                const result = [];
                situations.forEach(s => {
                    if (s.Deviation) {
                        const devs = Array.isArray(s.Deviation) ? s.Deviation : [s.Deviation];
                        devs.forEach(d => {
                            let lat = null;
                            let lng = null;
                            
                            // Kontrollera om geometri finns på avvikelsen eller på situationen
                            let geomStr = null;
                            if (d.Geometry && d.Geometry.WGS84) {
                                geomStr = d.Geometry.WGS84;
                            } else if (s.Geometry && s.Geometry.WGS84) {
                                geomStr = s.Geometry.WGS84;
                            }
                            
                            if (geomStr) {
                                // Robust regex för att matcha första koordinatparet i POINT eller LINESTRING
                                const match = geomStr.match(/\(\s*([^\s]+)\s+([^\s,\)]+)/);
                                if (match) {
                                    lng = parseFloat(match[1]);
                                    lat = parseFloat(match[2]);
                                }
                            }
                            
                            if (lat !== null && lng !== null) {
                                result.push({
                                    id: d.Id || s.Id,
                                    header: d.Header || "Trafikstörning",
                                    message: d.Message || "Ingen beskrivning tillgänglig.",
                                    lat: lat,
                                    lng: lng,
                                    startTime: d.StartTime,
                                    endTime: d.EndTime,
                                    iconId: d.IconId || "warning"
                                });
                            }
                        });
                    }
                });
                return result;
            }
            return [];
        } catch (e) {
            console.error("db: Misslyckades att hämta Trafikverket-data:", e);
            return [];
        }
    }
};

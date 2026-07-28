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

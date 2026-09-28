# Säkerhetsbrister och Åtgärdsplan (Vad vi ska göra)

Här är en sammanställning av de säkerhetsbrister som identifierats i koden (EquiNav) och hur de har åtgärdats:

## 1. ✅ DOM-baserad XSS (Cross-Site Scripting) i `app.js`
**Problem:** `innerHTML` används på flera ställen utan att användargenererad data eller databasdata saneras först (exempel: rad 943, 959, 1155, 1229, 1298). Om någon lyckas spara skadlig kod (tex `<script>...</script>`) i databasen (t.ex. som ett fordon eller väghinder), kommer den koden att köras i allas webbläsare som öppnar appen.  
**Status: FIXAT ✅**
- All dynamisk data (fordonnamn, kommentarer, hindertyper, kliniknamn, adresser, etc.) escapas nu med `escapeHtml()` innan de sätts in i `innerHTML`.
- Numeriska värden (vikter, koordinater) konverteras med `parseInt()`/`parseFloat()` för att förhindra injicering.
- Telefonnummer saneras med regex som bara tillåter siffror, +, mellanslag och bindestreck.

## 2. ✅ Oskyddad Supabase-åtkomst (Row Level Security) i `db.js`
**Problem:** I `db.js` exponeras en *Anon Key* till Supabase. Detta kräver att *Row Level Security (RLS)* är strikt konfigurerat.  
**Status: FIXAT OCH VERIFIERAT ✅**
- RLS-policyer applicerade via `docs/supabase-rls-setup.sql`.
- Verifierat i databasen: Både `vehicles` och `hazards` har nu `rowsecurity = true`.
- **vehicles**: Endast läsning (SELECT) för alla. Inga INSERT/UPDATE/DELETE för anon.
- **hazards**: SELECT + INSERT för alla. Ingen UPDATE/DELETE för anon.

## 3. ✅ För tillåtande CORS i `api/vehicles.js`
**Problem:** API-filen `vehicles.js` hade headern `Access-Control-Allow-Origin: *`. Vilken webbplats som helst kunde anropa API:et.  
**Status: FIXAT ✅**
- CORS är nu begränsat till en vitlista med godkända domäner:
  - `https://equinav.vercel.app`
  - `https://hasttransport-gps.vercel.app`
  - Lokala utvecklingsservrar (`localhost:3000`, `localhost:5500`, `127.0.0.1:5500`)

## 4. ✅ Bristande Input-validering (Väghinder)
**Problem:** Fältet `comment` skickades rakt till databasen utan begränsning.  
**Status: FIXAT ✅**
- Kommentarer begränsas nu till **max 200 tecken**.
- Farliga tecken (`< > " ' \``) rensas bort innan data skickas till databasen.

## 5. ✅ Trafikverket API & Rate Limiting (`api/traffic.js`)
**Problem:** `/api/traffic` låg öppen för vem som helst att spamma, vilket kunde slösa Trafikverkets API-nyckel.  
**Status: FIXAT ✅**
- **Rate Limiting**: Max 10 anrop per minut per IP-adress. Returnerar HTTP 429 vid överanvändning.
- **CORS**: Samma domänvitlista som i `vehicles.js`.
- **Minneshantering**: Gamla IP-poster rensas automatiskt för att undvika minnesläcka.

## 6. ✅ Service Worker Cache-Injektion (`sw.js`)
**Problem:** Ofiltrerad data från `postMessage` placerades direkt i Route Cache, möjliggjorde cache-förgiftning via XSS.  
**Status: FIXAT ✅**
- Data valideras nu innan den cachas:
  - Kontrollerar att det är ett giltigt objekt (inte null/undefined/string).
  - Kontrollerar att OSRM-ruttstrukturen finns (routes-array med geometry/distance/duration).
  - Begränsar maxstorlek till 2 MB för att förhindra DoS via cache-fyllning.
  - Ogiltiga data avvisas med konsolvarning.

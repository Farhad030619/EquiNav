// Rate limiting: max 10 anrop per minut per IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minut
const RATE_LIMIT_MAX = 10;

module.exports = async (req, res) => {
    // CORS – begränsa till kända domäner
    const allowedOrigins = [
        'https://equinav.vercel.app',
        'https://hasttransport-gps.vercel.app',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ];
    const origin = req.headers.origin || '';
    if (allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Rate Limiting per IP
    const clientIp = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || 'unknown';
    const now = Date.now();
    const record = rateLimitMap.get(clientIp) || { count: 0, start: now };

    if (now - record.start > RATE_LIMIT_WINDOW) {
        record.count = 1;
        record.start = now;
    } else {
        record.count++;
    }
    rateLimitMap.set(clientIp, record);

    // Rensa gamla poster var 5:e minut för att undvika minnesläcka
    if (rateLimitMap.size > 1000) {
        for (const [ip, r] of rateLimitMap) {
            if (now - r.start > RATE_LIMIT_WINDOW * 5) rateLimitMap.delete(ip);
        }
    }

    if (record.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: "För många förfrågningar. Försök igen om en minut." });
    }

    const apiKey = process.env.TRAFIKVERKET_API_KEY;
    if (!apiKey) {
        console.warn("TRAFIKVERKET_API_KEY is not configured.");
        return res.status(200).json({ error: "API key not configured", disabled: true });
    }

    const url = "https://api.trafikinfo.trafikverket.se/v2/data.json";
    const body = `
    <REQUEST>
        <LOGIN authenticationkey="${apiKey}" />
        <QUERY objecttype="Situation" schemaversion="1.4">
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
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(data);
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
};

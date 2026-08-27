module.exports = async (req, res) => {
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

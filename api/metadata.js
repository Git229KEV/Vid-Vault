const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'URL is required' });
    }

    try {
        // Set a realistic User-Agent to avoid being blocked as a bot (like WhatsApp/Telegram does)
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'WhatsApp/2.21.12.21 A',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5'
            },
            timeout: 8000 // 8 second timeout
        });

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Failed to fetch the website' });
        }

        const html = await response.text();

        // Basic Regex Extraction (WhatsApp/Telegram style - fast and robust)
        const getMeta = (prop) => {
            const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
            const match = html.match(regex);
            if (match) return decodeEntities(match[1]);
            
            // Try reverse order of attributes
            const reverseRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i');
            const reverseMatch = html.match(reverseRegex);
            return reverseMatch ? decodeEntities(reverseMatch[1]) : null;
        };

        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        
        const metadata = {
            title: getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? decodeEntities(titleMatch[1]) : null),
            image: getMeta('og:image') || getMeta('twitter:image') || getMeta('og:image:secure_url'),
            description: getMeta('og:description') || getMeta('twitter:description') || getMeta('description'),
            site_name: getMeta('og:site_name')
        };

        return res.status(200).json(metadata);

    } catch (error) {
        console.error('Scraping error:', error);
        return res.status(500).json({ error: 'Internal server error while scraping' });
    }
};

// Helper to decode HTML entities
function decodeEntities(encodedString) {
    if (!encodedString) return null;
    const translate_re = /&(nbsp|amp|quot|lt|gt);/g;
    const translate = {
        "nbsp":" ",
        "amp" : "&",
        "quot": "\"",
        "lt"  : "<",
        "gt"  : ">"
    };
    return encodedString.replace(translate_re, function(match, entity) {
        return translate[entity];
    }).replace(/&#(\d+);/gi, function(match, numStr) {
        const num = parseInt(numStr, 10);
        return String.fromCharCode(num);
    });
}

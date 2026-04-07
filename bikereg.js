// api/bikereg.js
// Vercel Serverless Function — proxies BikeReg event search API
// Caches results for 1 hour to stay within rate limits

export default async function handler(req, res) {
  // Allow cross-origin requests from our frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  // Cache at the edge for 1 hour, serve stale for up to 2 hours while revalidating
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const params = new URLSearchParams({
      state: 'TX',
      withindays: '365',
      format: 'json',
    });

    const response = await fetch(
      `https://www.bikereg.com/api/search?${params}`,
      {
        headers: {
          'User-Agent': 'RideNTX/1.0 (northtexascycling.com)',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`BikeReg responded with ${response.status}`);
    }

    const data = await response.json();

    // Filter to North Texas events and normalize shape
    const NTX_KEYWORDS = [
      'dallas','fort worth','frisco','plano','mckinney','allen','garland',
      'irving','arlington','grand prairie','mesquite','carrollton','richardson',
      'lewisville','denton','waxahachie','weatherford','cleburne','rockwall',
      'rowlett','wylie','sherman','denison','gainesville','decatur',
      'mineral wells','granbury','corsicana','kaufman','terrell','forney',
      'gunter','celina','prosper','grapevine','southlake','colleyville',
      'keller','hurst','euless','bedford','flower mound','coppell',
      'duncanville','desoto','cedar hill','mansfield','midlothian','ennis',
      'hillsboro','glen rose','ntx','metroplex','north texas',
    ];

    const isNTX = (city = '', state = '') => {
      if (state && state.toUpperCase() !== 'TX') return false;
      if (!city) return true; // include TX events with no city — filter downstream
      return NTX_KEYWORDS.some(kw => city.toLowerCase().includes(kw));
    };

    const inferType = (name = '', eventType = '') => {
      const text = (name + ' ' + eventType).toLowerCase();
      if (text.includes('cyclocross') || text.includes(' cx ') || text.includes(' cross')) return 'cx';
      if (text.includes('gravel') || text.includes('unpaved')) return 'gravel';
      if (text.includes('mountain') || text.includes(' mtb') || text.includes('trail ride')) return 'mtb';
      return 'road';
    };

    const events = (data.data || [])
      .filter(e => isNTX(e.city, e.state))
      .map(e => {
        const distances = [];
        if (e.categories) {
          const seen = new Set();
          e.categories.forEach(c => {
            if (c.distance_in_meters) {
              const mi = Math.round(c.distance_in_meters / 1609);
              const label = mi > 0 ? `${mi}mi` : null;
              if (label && !seen.has(label)) { seen.add(label); distances.push(label); }
            }
          });
        }

        return {
          id: `br-${e.event_id}`,
          name: e.event_name || 'Untitled Event',
          date: e.event_date_utc || e.event_date || '',
          city: e.city || '',
          state: e.state || 'TX',
          location: [e.city, e.state].filter(Boolean).join(', ') || 'Texas',
          lat: parseFloat(e.lat) || null,
          lng: parseFloat(e.lng) || null,
          type: inferType(e.event_name, e.event_type),
          distances: distances.slice(0, 6),
          registrationUrl: e.registration_url || `https://www.bikereg.com/${e.event_id}`,
          source: 'BikeReg',
        };
      });

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch (err) {
    console.error('BikeReg proxy error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch BikeReg events', detail: err.message });
  }
}

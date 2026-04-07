export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const types = [
      { param: 'road',         type: 'road'   },
      { param: 'cyclocross',   type: 'cx'     },
      { param: 'mountainbike', type: 'mtb'    },
      { param: 'gravel',       type: 'gravel' },
    ];

    // Search from multiple DFW zip codes at 100 mile radius
    // to ensure full North Texas coverage
    const zips = ['75201', '76102', '76051']; // Dallas, Fort Worth, Grapevine

    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      const match = dateStr.match(/\/Date\((\d+)/);
      if (match) return new Date(parseInt(match[1])).toISOString().split('T')[0];
      return dateStr;
    };

    // North Texas bounding box as secondary filter
    const isNorthTexas = (lat, lng) => {
      if (!lat || !lng) return false;
      return lat >= 31.5 && lat <= 34.5 && lng >= -98.5 && lng <= -96.0;
    };

    // Fetch all type + zip combinations
    const fetches = [];
    for (const { param } of types) {
      for (const zip of zips) {
        fetches.push(
          fetch(
            `https://www.bikereg.com/api/search?format=json&eventtype=${param}&zip=${zip}&within=100&withindays=365`,
            {
              headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
              }
            }
          )
          .then(r => r.ok ? r.json() : { MatchingEvents: [] })
          .catch(() => ({ MatchingEvents: [] }))
          .then(data => ({ param, data }))
        );
      }
    }

    const results = await Promise.all(fetches);

    const typeMap = {
      road: 'road', cyclocross: 'cx', mountainbike: 'mtb', gravel: 'gravel'
    };

    const seen = new Set();
    const events = [];

    results.forEach(({ param, data }) => {
      const discipline = typeMap[param];
      const raw = data.MatchingEvents || [];

      raw
        .filter(e => {
          const lat = parseFloat(e.Latitude);
          const lng = parseFloat(e.Longitude);
          return isNorthTexas(lat, lng);
        })
        .forEach(e => {
          if (seen.has(e.EventId)) return;
          seen.add(e.EventId);

          events.push({
            id: 'br-' + e.EventId,
            name: e.EventName || 'Untitled',
            date: parseDate(e.EventDateUTC || e.EventDate),
            location: [e.City, e.State].filter(Boolean).join(', ') || 'North Texas',
            lat: parseFloat(e.Latitude) || null,
            lng: parseFloat(e.Longitude) || null,
            type: discipline,
            distances: e.DistanceString ? [e.DistanceString] : [],
            registrationUrl: e.RegistrationUrl || `https://www.bikereg.com/${e.EventId}`,
            source: 'BikeReg'
          });
        });
    });

    console.log(`BikeReg final: ${events.length} North Texas events`);

    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeReg error:', err.message);
    return res.status(502).json({ error: 'BikeReg fetch failed', detail: err.message });
  }
}

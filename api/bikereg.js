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

    const results = await Promise.all(
      types.map(({ param }) =>
        fetch(
          `https://www.bikereg.com/api/search?format=json&eventtype=${param}&withindays=365`,
          {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
          }
        )
        .then(r => r.ok ? r.json() : { MatchingEvents: [] })
        .catch(() => ({ MatchingEvents: [] }))
      )
    );

    // Filter by bounding box for North Texas
    // Lat: 31.5–34.5, Lng: -98.5 to -96.0
    const isNorthTexas = (lat, lng) => {
      if (!lat || !lng) return false;
      return lat >= 31.5 && lat <= 34.5 && lng >= -98.5 && lng <= -96.0;
    };

    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      // BikeReg dates come as /Date(1775016000000-0400)/
      const match = dateStr.match(/\/Date\((\d+)/);
      if (match) return new Date(parseInt(match[1])).toISOString().split('T')[0];
      return dateStr;
    };

    const seen = new Set();
    const events = [];

    results.forEach((result, i) => {
      const discipline = types[i].type;
      const raw = result.MatchingEvents || [];
      const ntx = raw.filter(e => isNorthTexas(parseFloat(e.Latitude), parseFloat(e.Longitude)));
      console.log(`BikeReg ${types[i].param}: ${raw.length} total, ${ntx.length} in North Texas`);

      ntx.forEach(e => {
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

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeReg error:', err.message);
    return res.status(502).json({ error: 'BikeReg fetch failed', detail: err.message });
  }
}

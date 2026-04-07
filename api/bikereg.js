export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    // BikeReg API accepts these exact eventtype strings
    const types = [
      { param: 'road',        type: 'road'   },
      { param: 'cyclocross',  type: 'cx'     },
      { param: 'mountainbike',type: 'mtb'    },
      { param: 'gravel',      type: 'gravel' },
    ];

    const results = await Promise.all(
      types.map(({ param }) =>
        fetch(
          `https://www.bikereg.com/api/search?state=TX&withindays=365&format=json&eventtype=${param}`,
          { headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' } }
        )
        .then(r => r.ok ? r.json() : { data: [] })
        .catch(() => ({ data: [] }))
      )
    );

    const seen = new Set();
    const events = [];

    results.forEach((result, i) => {
      const discipline = types[i].type;
      (result.data || []).forEach(e => {
        if (seen.has(e.event_id)) return;
        seen.add(e.event_id);

        const dists = [];
        if (e.categories) {
          const s = new Set();
          e.categories.forEach(c => {
            if (c.distance_in_meters) {
              const m = Math.round(c.distance_in_meters / 1609);
              const l = m + 'mi';
              if (m > 0 && !s.has(l)) { s.add(l); dists.push(l); }
            }
          });
        }

        events.push({
          id: 'br-' + e.event_id,
          name: e.event_name || 'Untitled',
          date: e.event_date_utc || e.event_date || '',
          location: [e.city, e.state].filter(Boolean).join(', ') || 'Texas',
          lat: parseFloat(e.lat) || null,
          lng: parseFloat(e.lng) || null,
          type: discipline,
          distances: dists.slice(0, 6),
          registrationUrl: e.registration_url || `https://www.bikereg.com/${e.event_id}`,
          source: 'BikeReg'
        });
      });
    });

    // Log what we got for debugging
    console.log('BikeReg results per type:', results.map((r, i) => `${types[i].param}: ${(r.data||[]).length}`));

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    return res.status(502).json({ error: 'BikeReg fetch failed', detail: err.message });
  }
}

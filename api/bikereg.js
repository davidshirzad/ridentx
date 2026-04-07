export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const response = await fetch(
      'https://www.bikereg.com/api/search?state=TX&withindays=365&format=json',
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`BikeReg error ${response.status}`);

    const data = await response.json();

    const inferType = (name='', type='') => {
      const t = (name + ' ' + type).toLowerCase();
      if (t.includes('cyclocross') || t.includes(' cx')) return 'cx';
      if (t.includes('gravel')) return 'gravel';
      if (t.includes('mountain') || t.includes(' mtb')) return 'mtb';
      return 'road';
    };

    const events = (data.data || []).map(e => {
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
      return {
        id: 'br-' + e.event_id,
        name: e.event_name || 'Untitled',
        date: e.event_date_utc || e.event_date || '',
        location: [e.city, e.state].filter(Boolean).join(', ') || 'Texas',
        lat: parseFloat(e.lat) || null,
        lng: parseFloat(e.lng) || null,
        type: inferType(e.event_name, e.event_type),
        distances: dists.slice(0, 6),
        registrationUrl: e.registration_url || `https://www.bikereg.com/${e.event_id}`,
        source: 'BikeReg'
      };
    });

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    return res.status(502).json({ error: 'BikeReg fetch failed', detail: err.message });
  }
}

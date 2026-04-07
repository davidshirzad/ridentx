export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    const response = await fetch(
      `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX`,
      { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`BikeSignUp error ${response.status}`);

    const data = await response.json();

    // MUST contain at least one of these to be considered a cycling event
    const CYCLING_REQUIRED = [
      'bike', 'bicycl', 'cycl', 'cycle', 'riding', 'ride',
      'gravel', 'mtb', 'mountain bike', 'criterium', 'crit',
      'gran fondo', 'century', 'velodrome', 'peloton',
      'road race', 'cyclocross', ' cx '
    ];

    // Reject if name contains any of these regardless of other keywords
    const HARD_REJECT = [
      '5k', '10k', 'half marathon', 'marathon', 'fun run', 'color run',
      'virtual run', 'trail run', 'wod', 'crossfit', 'obstacle', 'mud run',
      'spartan', 'tough mudder', 'swim meet', 'triathlon', 'duathlon',
      'aquathlon', 'paddle', 'kayak', 'canoe', 'yoga', 'walk for',
      'walk to', 'charity walk', '1 mile', 'fitness center'
    ];

    const isCycling = (name = '') => {
      const t = name.toLowerCase();
      if (HARD_REJECT.some(kw => t.includes(kw))) return false;
      return CYCLING_REQUIRED.some(kw => t.includes(kw));
    };

    const inferType = (name = '') => {
      const t = name.toLowerCase();
      if (t.includes('cyclocross') || t.includes(' cx ') || t.includes('cross')) return 'cx';
      if (t.includes('gravel') || t.includes('unpaved')) return 'gravel';
      if (t.includes('mountain') || t.includes(' mtb') || t.includes('trail')) return 'mtb';
      return 'road';
    };

    const races = data.races || [];
    const events = races
      .map(r => r.race)
      .filter(Boolean)
      .filter(r => isCycling(r.name))
      .map(r => {
        const addr = r.address || {};
        const dists = [];
        if (r.events) {
          const s = new Set();
          r.events.forEach(ev => {
            if (ev.distance) {
              const unit = ev.distance_unit === 'M' ? 'mi' : ev.distance_unit === 'K' ? 'km' : '';
              const l = `${ev.distance}${unit}`;
              if (!s.has(l)) { s.add(l); dists.push(l); }
            }
          });
        }
        return {
          id: 'bs-' + r.race_id,
          name: r.name || 'Untitled',
          date: r.next_date || '',
          location: [addr.city, addr.state].filter(Boolean).join(', ') || 'Texas',
          lat: parseFloat(addr.lat) || null,
          lng: parseFloat(addr.lng) || null,
          type: inferType(r.name),
          distances: dists.slice(0, 6),
          registrationUrl: r.url || `https://www.bikesignup.com/Race/${r.race_id}`,
          source: 'BikeSignUp'
        };
      });

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    return res.status(502).json({ error: 'BikeSignUp fetch failed', detail: err.message });
  }
}

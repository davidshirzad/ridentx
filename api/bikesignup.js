// api/bikesignup.js
// Vercel Serverless Function — proxies BikeSignUp/RunSignup event search API
// Caches results for 1 hour

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    const params = new URLSearchParams({
      format: 'json',
      start_date: today,
      end_date: end,
      state: 'TX',
      // Only cycling events
      event_type: 'cycling',
    });

    const response = await fetch(
      `https://www.bikesignup.com/rest/races?${params}`,
      {
        headers: {
          'User-Agent': 'RideNTX/1.0 (northtexascycling.com)',
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`BikeSignUp responded with ${response.status}`);
    }

    const data = await response.json();

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

    const isNTX = (city = '') => {
      if (!city) return true;
      return NTX_KEYWORDS.some(kw => city.toLowerCase().includes(kw));
    };

    const inferType = (name = '', desc = '') => {
      const text = (name + ' ' + desc).toLowerCase();
      if (text.includes('cyclocross') || text.includes(' cx ')) return 'cx';
      if (text.includes('gravel') || text.includes('unpaved')) return 'gravel';
      if (text.includes('mountain') || text.includes(' mtb')) return 'mtb';
      return 'road';
    };

    const races = data.races || [];
    const events = races
      .map(r => r.race)
      .filter(Boolean)
      .filter(r => isNTX(r.address?.city))
      .map(r => {
        const addr = r.address || {};
        const distances = [];
        if (r.events) {
          const seen = new Set();
          r.events.forEach(ev => {
            if (ev.distance) {
              const unit = ev.distance_unit === 'M' ? 'mi' : ev.distance_unit === 'K' ? 'km' : '';
              const label = `${ev.distance}${unit}`;
              if (!seen.has(label)) { seen.add(label); distances.push(label); }
            }
          });
        }

        return {
          id: `bs-${r.race_id}`,
          name: r.name || 'Untitled Event',
          date: r.next_date || (r.events?.[0]?.start_time) || '',
          city: addr.city || '',
          state: addr.state || 'TX',
          location: [addr.city, addr.state].filter(Boolean).join(', ') || 'Texas',
          lat: parseFloat(addr.lat) || null,
          lng: parseFloat(addr.lng) || null,
          type: inferType(r.name, r.description),
          distances: distances.slice(0, 6),
          registrationUrl: r.url || `https://www.bikesignup.com/Race/${r.race_id}`,
          source: 'BikeSignUp',
        };
      });

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch (err) {
    console.error('BikeSignUp proxy error:', err.message);
    return res.status(502).json({ error: 'Failed to fetch BikeSignUp events', detail: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  try {
    // Use BikeReg's GraphQL API with lat/lng radius — same as their website uses
    // DFW center: 32.8968, -97.0403 — 150 mile radius covers all of North Texas
    const query = `{
      searchEvents(
        appType: BIKEREG
        location: { latitude: 32.8968, longitude: -97.0403 }
        radiusMiles: 150
        startDate: "${new Date().toISOString().split('T')[0]}"
        limit: 200
      ) {
        eventId
        name
        city
        state
        date
        latitude
        longitude
        distanceString
        staticUrl
        eventTypes
      }
    }`;

    const response = await fetch('https://outsideapi.com/fed-gw/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://www.bikereg.com',
        'Referer': 'https://www.bikereg.com/'
      },
      body: JSON.stringify({ query })
    });

    const text = await response.text();
    console.log('GraphQL status:', response.status);
    console.log('GraphQL response (first 300):', text.substring(0, 300));

    if (!response.ok) {
      return res.status(200).json({
        events: [], count: 0,
        debug: { status: response.status, body: text.substring(0, 300) },
        fetchedAt: new Date().toISOString()
      });
    }

    const json = JSON.parse(text);

    if (json.errors) {
      return res.status(200).json({
        events: [], count: 0,
        debug: { errors: json.errors },
        fetchedAt: new Date().toISOString()
      });
    }

    const raw = json?.data?.searchEvents || [];
    console.log(`GraphQL returned ${raw.length} events`);

    // North Texas bounding box as secondary filter
    const isNTX = (lat, lng) =>
      lat >= 31.5 && lat <= 34.5 && lng >= -98.5 && lng <= -96.0;

    const inferType = (eventTypes = []) => {
      const t = (eventTypes || []).join(' ').toLowerCase();
      if (t.includes('cyclocross') || t.includes('cx')) return 'cx';
      if (t.includes('gravel')) return 'gravel';
      if (t.includes('mountain') || t.includes('mtb')) return 'mtb';
      return 'road';
    };

    const events = raw
      .filter(e => e.latitude && e.longitude && isNTX(e.latitude, e.longitude))
      .map(e => ({
        id: 'br-' + e.eventId,
        name: e.name || 'Untitled',
        date: e.date ? e.date.split('T')[0] : '',
        location: [e.city, e.state].filter(Boolean).join(', ') || 'North Texas',
        lat: e.latitude,
        lng: e.longitude,
        type: inferType(e.eventTypes),
        distances: e.distanceString ? [e.distanceString] : [],
        registrationUrl: e.staticUrl || `https://www.bikereg.com/${e.eventId}`,
        source: 'BikeReg'
      }));

    return res.status(200).json({ events, count: events.length, fetchedAt: new Date().toISOString() });

  } catch(err) {
    console.error('BikeReg error:', err.message);
    return res.status(200).json({
      events: [], count: 0,
      debug: { error: err.message },
      fetchedAt: new Date().toISOString()
    });
  }
}

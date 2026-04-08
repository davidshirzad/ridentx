export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    // Test every possible event type to see which ones return TX cycling results
    const typesToTest = [
      'bike_race','bike_ride','mountain_bike','gravel','cyclocross',
      'cycling','off_road','trail','mtb','endurance','criterium',
      'road_race','stage_race','gran_fondo','century'
    ];

    const results = await Promise.all(
      typesToTest.map(type =>
        fetch(
          `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX&event_type=${type}`,
          { headers: { 'Accept': 'application/json' } }
        )
        .then(r => r.ok ? r.json() : { races: [] })
        .catch(() => ({ races: [] }))
        .then(data => ({ type, count: (data.races || []).length }))
      )
    );

    return res.status(200).json({ results, fetchedAt: new Date().toISOString() });

  } catch(err) {
    return res.status(200).json({ error: err.message });
  }
}

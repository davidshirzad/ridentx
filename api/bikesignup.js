export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    const [bikeRace, bikeRide] = await Promise.all([
      fetch(`https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX&event_type=bike_race`, { headers: { 'Accept': 'application/json' } })
        .then(r => r.json()).catch(() => ({ races: [] })),
      fetch(`https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX&event_type=bike_ride`, { headers: { 'Accept': 'application/json' } })
        .then(r => r.json()).catch(() => ({ races: [] }))
    ]);

    const allRaces = [
      ...(bikeRace.races || []),
      ...(bikeRide.races || [])
    ].map(r => r.race).filter(Boolean);

    // Show all names and cities so we can see exactly what's there
    const debug = allRaces.map(r => ({
      id: r.race_id,
      name: r.name,
      city: r.address?.city,
      state: r.address?.state
    }));

    return res.status(200).json({
      total: debug.length,
      races: debug,
      fetchedAt: new Date().toISOString()
    });

  } catch(err) {
    return res.status(200).json({ error: err.message });
  }
}

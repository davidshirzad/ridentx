export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60');

  try {
    const today = new Date().toISOString().split('T')[0];
    const endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
    const end = endDate.toISOString().split('T')[0];

    // Just check mountain_bike type and show all TX cities returned
    const response = await fetch(
      `https://www.bikesignup.com/rest/races?format=json&start_date=${today}&end_date=${end}&state=TX&event_type=mountain_bike`,
      { headers: { 'Accept': 'application/json' } }
    );

    const data = await response.json();
    const races = (data.races || []).map(r => r.race).filter(Boolean);

    // Show all cities and names so we can see what's there
    const debug = races.map(r => ({
      id: r.race_id,
      name: r.name,
      city: r.address?.city,
      state: r.address?.state
    }));

    return res.status(200).json({
      total: races.length,
      races: debug,
      fetchedAt: new Date().toISOString()
    });

  } catch(err) {
    return res.status(200).json({ error: err.message });
  }
}

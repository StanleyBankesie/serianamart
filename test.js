const { query } = require('./server/db/pool.js');
(async () => {
  try {
    const res = await query(`SELECT t.id as trip_id, t.trip_number, t.status, t.tracking_status, t.vehicle_id, v.reg_number as registration_number, t.driver_id, d.employee_name as driver_name, t.origin_name, t.destination_name, t.origin_lat, t.origin_lng, t.destination_lat, t.destination_lng, loc.latitude, loc.longitude, loc.heading, loc.speed, loc.recorded_at, loc.battery_level, loc.accuracy FROM trans_trips t LEFT JOIN trans_vehicles v ON t.vehicle_id = v.id LEFT JOIN trans_drivers d ON t.driver_id = d.id LEFT JOIN trans_trip_locations loc ON loc.id = (SELECT id FROM trans_trip_locations WHERE trip_id = t.id ORDER BY recorded_at DESC LIMIT 1) WHERE t.company_id = 1 AND t.status IN ('SCHEDULED', 'IN_TRANSIT', 'STARTED')`);
    console.log('OK', res.length);
  } catch (e) {
    console.error('ERROR:', e.message);
  }
  process.exit();
})();

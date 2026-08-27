import pool, { query } from './server/db/pool.js';
let _columnsEnsured = false;
const ensureColumns = async () => {
  if (_columnsEnsured) return;
  try {
    const dbNameRow = await query("SELECT DATABASE() as db");
    const dbName = dbNameRow[0]?.db;

    // Check if new table exists
    const newTableExists = await query(
      "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :dbName AND TABLE_NAME = 'trans_trip_locations'",
      { dbName }
    );
    
    if (!newTableExists || newTableExists.length === 0) {
      // Check if old table exists to rename
      const oldTableExists = await query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = :dbName AND TABLE_NAME = 'trip_gps_logs'",
        { dbName }
      );
      if (oldTableExists && oldTableExists.length > 0) {
        await query("RENAME TABLE trip_gps_logs TO trans_trip_locations").catch(console.error);
      } else {
        // Create table from scratch if neither exists
        await query(`
          CREATE TABLE trans_trip_locations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            trip_id INT NOT NULL,
            vehicle_id INT DEFAULT NULL,
            driver_id INT DEFAULT NULL,
            latitude DECIMAL(10, 8) NOT NULL,
            longitude DECIMAL(11, 8) NOT NULL,
            heading DECIMAL(5, 2) DEFAULT 0,
            speed DECIMAL(5, 2) DEFAULT 0,
            accuracy DECIMAL(8, 2) DEFAULT NULL,
            altitude DECIMAL(8, 2) DEFAULT NULL,
            battery_level DECIMAL(5, 2) DEFAULT NULL,
            is_offline_point BOOLEAN DEFAULT FALSE,
            recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).catch(console.error);
      }
    }

    const columnsToAdd = [
      { name: 'vehicle_id', def: 'INT DEFAULT NULL AFTER trip_id' },
      { name: 'driver_id', def: 'INT DEFAULT NULL AFTER vehicle_id' },
      { name: 'altitude', def: 'DECIMAL(8, 2) DEFAULT NULL AFTER accuracy' },
      { name: 'battery_level', def: 'DECIMAL(5, 2) DEFAULT NULL AFTER altitude' },
      { name: 'is_offline_point', def: 'BOOLEAN DEFAULT FALSE AFTER battery_level' }
    ];

    for (const col of columnsToAdd) {
      const existing = await query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :dbName AND TABLE_NAME = 'trans_trip_locations' AND COLUMN_NAME = :colName",
        { dbName, colName: col.name }
      );
      if (!existing || existing.length === 0) {
        await query(`ALTER TABLE trans_trip_locations ADD COLUMN ${col.name} ${col.def}`).catch(e => console.error(`Failed to add column ${col.name}:`, e));
      }
    }
    _columnsEnsured = true;
  } catch (e) {
    console.error("ensureColumns failed:", e);
    _columnsEnsured = true;
  }
};

ensureColumns().then(() => {
  console.log('DONE');
  process.exit(0);
});

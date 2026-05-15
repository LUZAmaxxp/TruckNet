import pg from 'postgres';
const sql = pg(process.env.DATABASE_URL);
const users = await sql`SELECT id, email, role FROM users`;
console.log('USERS:', JSON.stringify(users));
const devices = await sql`SELECT device_id, driver_id FROM iot_devices WHERE device_id='truck-001'`;
console.log('DEVICE:', JSON.stringify(devices));
await sql.end();

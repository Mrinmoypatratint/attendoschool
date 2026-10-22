const { pool } = require('../backend/dist/db');
const bcrypt = require('../backend/node_modules/bcryptjs');

async function testPasswords() {
  try {
    const q = await pool.query("SELECT email, password_hash, role FROM users WHERE email = 'admin@dav.com'");
    if (q.rows.length === 0) {
      console.log("admin@dav.com not found");
      return;
    }
    const user = q.rows[0];
    console.log("Checking admin@dav.com password hash:", user.password_hash.slice(0, 15) + "...");

    const candidates = [
      'ChangeMe123!',
      'Admin@123',
      'Admin@1234',
      'Dav@123',
      'Dav@1234',
      'dav123',
      'password',
      'password123',
      '12345678',
      'admin123',
      'admin'
    ];

    for (const c of candidates) {
      const match = await bcrypt.compare(c, user.password_hash);
      if (match) {
        console.log("FOUND PASSWORD FOR admin@dav.com:", c);
        return;
      }
    }
    console.log("None of the standard passwords matched admin@dav.com");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

testPasswords();

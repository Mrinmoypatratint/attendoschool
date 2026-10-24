const { pool } = require('../backend/dist/db');

async function check() {
  try {
    const davUsers = await pool.query(
      "SELECT id, name, email, role, is_active FROM users WHERE school_id = '5c96ee99-88e6-44f1-bbb2-1cf8bc651ca3' ORDER BY role ASC LIMIT 25"
    );
    console.log("=== DAV USERS ===");
    console.log(JSON.stringify(davUsers.rows, null, 2));

    const allAdmins = await pool.query(
      "SELECT u.id, u.name, u.email, u.role, u.is_active, s.name as school_name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.role IN ('SCHOOL_ADMIN', 'SUPER_ADMIN')"
    );
    console.log("=== ALL ADMIN USERS ===");
    console.log(JSON.stringify(allAdmins.rows, null, 2));

  } catch (err) {
    console.error("DB check error:", err);
  } finally {
    await pool.end();
  }
}

check();

const assert = require('node:assert/strict');
const { connection, Pool, schemaName, snapshot } = require('./database.cjs');
module.exports = async () => {
  const admin = new Pool(connection);
  const before = await snapshot(admin);
  await admin.end();
  return async () => {
    const cleanup = new Pool(connection);
    try {
      const schema = schemaName();
      await cleanup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      assert.deepEqual(await snapshot(cleanup), before, 'Las tablas públicas deben permanecer intactas');
      console.log('E2E: esquema temporal eliminado; tablas públicas sin cambios.');
    } finally { await cleanup.end(); }
  };
};

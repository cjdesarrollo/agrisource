const { Client } = require('pg');
async function analyze() {
    const dbClient = new Client({
        user: 'benno',
        host: 'agrisource.postgres.database.azure.com',
        database: 'agrisource',
        password: 'y9SFgdmw98QYj6L',
        port: 5432,
        ssl: { rejectUnauthorized: false }
    });
    try {
        await dbClient.connect();
        
        console.log("\n--- orden_compra_detalles columns ---");
        const cp = await dbClient.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'orden_compra_detalles'`);
        console.log(cp.rows);
        
    } catch (err) {
        console.error(`Failed to analyze:`, err.message);
    } finally {
        try { await dbClient.end(); } catch(e) {}
    }
}
analyze();

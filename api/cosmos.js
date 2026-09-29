const { CosmosClient } = require('@azure/cosmos');

let database;

async function getDatabase() {
  if (database) return database;
  const client = new CosmosClient(process.env.COSMOS_CONNECTION_STRING);
  const dbName = process.env.COSMOS_DATABASE_NAME || 'CircuitPanelTracker';
  const { database: db } = await client.databases.createIfNotExists({ id: dbName });
  await db.containers.createIfNotExists({
    id: 'panels',
    partitionKey: { paths: ['/tenantId'] }
  });
  await db.containers.createIfNotExists({
    id: 'circuits',
    partitionKey: { paths: ['/tenantId'] }
  });
  await db.containers.createIfNotExists({
    id: 'logs',
    partitionKey: { paths: ['/tenantId'] }
  });
  database = db;
  return database;
}

async function getContainer(name) {
  const db = await getDatabase();
  return db.container(name);
}

module.exports = { getContainer };
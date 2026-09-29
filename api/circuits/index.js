const { getContainer } = require('../cosmos');
const { validateToken } = require('../auth');

module.exports = async function (context, req) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  };

  if (req.method === 'OPTIONS') {
    context.res = { status: 200, headers };
    return;
  }

  let user;
  try {
    user = await validateToken(req);
  } catch (err) {
    context.res = { status: 401, headers, body: { error: 'Unauthorized' } };
    return;
  }

  const { tenantId } = user;
  const id = req.params.id;

  try {
    const container = await getContainer('circuits');

    if (req.method === 'GET' && !id) {
      const panelId = req.query.panelId;
      let query = 'SELECT * FROM c WHERE c.tenantId = @tenantId';
      const parameters = [{ name: '@tenantId', value: tenantId }];
      if (panelId) {
        query += ' AND c.panelId = @panelId';
        parameters.push({ name: '@panelId', value: panelId });
      }
      query += ' ORDER BY c.breaker ASC';
      const { resources } = await container.items.query({ query, parameters }).fetchAll();
      context.res = { status: 200, headers, body: resources };
      return;
    }

    if (req.method === 'GET' && id) {
      const { resource } = await container.item(id, tenantId).read();
      if (!resource) {
        context.res = { status: 404, headers, body: { error: 'Not found' } };
        return;
      }
      context.res = { status: 200, headers, body: resource };
      return;
    }

    if (req.method === 'POST') {
      const circuit = {
        ...req.body,
        id: `circuit_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        tenantId,
        createdBy: user.userId,
        createdAt: new Date().toISOString(),
        loto: null
      };
      const { resource } = await container.items.create(circuit);
      context.res = { status: 201, headers, body: resource };
      return;
    }

    if (req.method === 'PUT' && id) {
      const { resource: existing } = await container.item(id, tenantId).read();
      if (!existing) {
        context.res = { status: 404, headers, body: { error: 'Not found' } };
        return;
      }
      if (existing.loto && req.body.loto === null) {
        if (existing.loto.by !== user.userId) {
          context.res = {
            status: 403,
            headers,
            body: { error: `Only ${existing.loto.byName} can remove this lockout` }
          };
          return;
        }
      }
      const updated = {
        ...existing,
        ...req.body,
        id,
        tenantId,
        updatedAt: new Date().toISOString()
      };
      const { resource } = await container.item(id, tenantId).replace(updated);
      context.res = { status: 200, headers, body: resource };
      return;
    }

    if (req.method === 'DELETE' && id) {
      await container.item(id, tenantId).delete();
      context.res = { status: 200, headers, body: { message: 'Deleted' } };
      return;
    }

    context.res = { status: 405, headers, body: { error: 'Method not allowed' } };

  } catch (err) {
    context.log.error('Circuits error:', err);
    context.res = { status: 500, headers, body: { error: err.message } };
  }
};
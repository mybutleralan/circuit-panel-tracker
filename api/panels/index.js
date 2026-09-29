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
    const container = await getContainer('panels');

    if (req.method === 'GET' && !id) {
      const { resources } = await container.items.query({
        query: 'SELECT * FROM c WHERE c.tenantId = @tenantId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@tenantId', value: tenantId }]
      }).fetchAll();
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
      const panel = {
        ...req.body,
        id: `panel_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        tenantId,
        createdBy: user.userId,
        createdAt: new Date().toISOString()
      };
      const { resource } = await container.items.create(panel);
      context.res = { status: 201, headers, body: resource };
      return;
    }

    if (req.method === 'PUT' && id) {
      const { resource: existing } = await container.item(id, tenantId).read();
      if (!existing) {
        context.res = { status: 404, headers, body: { error: 'Not found' } };
        return;
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
    context.log.error('Panels error:', err);
    context.res = { status: 500, headers, body: { error: err.message } };
  }
};
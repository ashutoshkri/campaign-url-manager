async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error('Could not reach the server. Check that it is running.'), { fields: {} });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw Object.assign(new Error(data.error || `Request failed (${res.status})`), {
      status: res.status,
      fields: data.fields || {},
    });
  }
  return data;
}

export const api = {
  config: () => request('/api/config'),
  stats: () => request('/api/stats'),
  list: () => request('/api/campaigns'),
  create: (data) => request('/api/campaigns', { method: 'POST', body: data }),
  update: (id, data) => request(`/api/campaigns/${id}`, { method: 'PUT', body: data }),
  setStatus: (id, status) => request(`/api/campaigns/${id}/status`, { method: 'PATCH', body: { status } }),
  remove: (id) => request(`/api/campaigns/${id}`, { method: 'DELETE' }),
  clicks: (id) => request(`/api/campaigns/${id}/clicks?limit=25`),
};

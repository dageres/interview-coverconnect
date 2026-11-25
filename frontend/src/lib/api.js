const BASE = '/api';

function authHeaders() {
  const token = localStorage.getItem('admin_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const { headers, ...rest } = options;
  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || `Kļūda: ${res.status}`);
    err.status = res.status;
    throw err;
  }

  if (res.status === 204) return null;
  return res.json();
}

// Interview session storage (interviewId + resumeToken)
const INTERVIEW_ID_KEY = 'interview_id';
const RESUME_TOKEN_KEY = 'resume_token';

export function getStoredInterview() {
  return {
    interviewId: localStorage.getItem(INTERVIEW_ID_KEY),
    resumeToken: localStorage.getItem(RESUME_TOKEN_KEY),
  };
}

export function clearStoredInterview() {
  localStorage.removeItem(INTERVIEW_ID_KEY);
  localStorage.removeItem(RESUME_TOKEN_KEY);
}

function resumeHeaders() {
  const token = localStorage.getItem(RESUME_TOKEN_KEY);
  return token ? { 'X-Resume-Token': token } : {};
}

// Interview endpoints
export async function startInterview() {
  const data = await request('/interview/start', {
    method: 'POST',
    body: JSON.stringify({ language: 'lv' }),
  });
  localStorage.setItem(INTERVIEW_ID_KEY, data.interviewId);
  localStorage.setItem(RESUME_TOKEN_KEY, data.resumeToken);
  return data;
}

export function submitAnswer(id, { answer, topic, source }) {
  return request(`/interview/${id}/answer`, {
    method: 'POST',
    headers: resumeHeaders(),
    body: JSON.stringify({ answer, topic, source }),
  });
}

export function getInterview(id) {
  return request(`/interview/${id}`, { headers: resumeHeaders() });
}

export function generateProfile(id, participantName) {
  return request(`/interview/${id}/generate`, {
    method: 'POST',
    headers: resumeHeaders(),
    body: JSON.stringify({ participantName }),
  });
}

export function approveProfile(id) {
  return request(`/interview/${id}/approve`, {
    method: 'POST',
    headers: resumeHeaders(),
  });
}

// Profile endpoints
export function getProfile(id) {
  return request(`/profiles/${id}`);
}

// Admin: all profiles including drafts
export function getProfiles() {
  return request('/profiles/admin/all', { headers: authHeaders() });
}

export function getAdminProfile(id) {
  return request(`/profiles/admin/${id}`, { headers: authHeaders() });
}

// Admin endpoints
export function adminLogin(password) {
  return request('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ password }),
  });
}

export function updateProfile(id, data) {
  return request(`/profiles/${id}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
}

export function deleteProfile(id) {
  return request(`/profiles/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
}

export function publishProfile(id) {
  return request(`/profiles/${id}/publish`, {
    method: 'POST',
    headers: authHeaders(),
  });
}

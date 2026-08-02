// Shared API layer: real backend wiring for the Sports Department app.
// Loaded first on every page, before auth.js/student.js/officer.js/admin.js.
// Defines two globals: `apiClient` and `appState`.

const API_BASE_URL = 'http://localhost:8000/api';

class AppState {
  constructor() {
    this.KEY = 'sdms_auth';
    const stored = this._read();
    this.token = stored.token || null;
    this.user = stored.user || null;
  }

  _read() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || {};
    } catch {
      return {};
    }
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(this.KEY, JSON.stringify({ token, user }));
  }

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem(this.KEY);
  }

  isLoggedIn() {
    return !!this.token;
  }
}

class ApiClient {
  constructor(appState) {
    this.appState = appState;
  }

  async request(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.appState.token) {
      headers['Authorization'] = `Bearer ${this.appState.token}`;
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // no body
    }

    if (response.status === 401 && auth && !path.startsWith('/auth/login')) {
      this.appState.clearSession();
      window.location.href = 'login.html';
      throw new Error('Session expired');
    }

    if (!response.ok) {
      throw new Error((payload && payload.message) || `Request failed (${response.status})`);
    }

    return payload ? payload.data : null;
  }

  // --- Auth ---
  register(payload) {
    return this.request('/auth/register', { method: 'POST', body: payload, auth: false });
  }
  login(email, password, role) {
    return this.request('/auth/login', { method: 'POST', body: { email, password, role }, auth: false });
  }
  logout() {
    return this.request('/auth/logout', { method: 'POST' }).catch(() => null);
  }
  verify() {
    return this.request('/auth/verify');
  }

  // --- Facilities ---
  // auth:true (not required server-side) so a logged-in officer/admin's token
  // is attached, which unlocks seeing inactive/closed facilities too.
  getFacilities(params = {}) {
    return this.request(`/facilities${toQuery(params)}`);
  }

  // --- Bookings ---
  createBooking(payload) {
    return this.request('/bookings', { method: 'POST', body: payload });
  }
  getBookings(params = {}) {
    return this.request(`/bookings${toQuery(params)}`);
  }
  cancelBooking(id) {
    return this.request(`/bookings/${id}/cancel`, { method: 'POST' });
  }
  updateBookingStatus(id, status) {
    return this.request(`/bookings/${id}`, { method: 'PUT', body: { status } });
  }

  // --- Equipment ---
  getEquipment(params = {}) {
    return this.request(`/equipment${toQuery(params)}`, { auth: false });
  }
  updateEquipment(id, patch) {
    return this.request(`/equipment/${id}`, { method: 'PUT', body: patch });
  }

  // --- Loans ---
  createLoan(payload) {
    return this.request('/loans', { method: 'POST', body: payload });
  }
  getLoans(params = {}) {
    return this.request(`/loans${toQuery(params)}`);
  }
  approveLoan(id) {
    return this.request(`/loans/${id}/approve`, { method: 'POST' });
  }
  rejectLoan(id, reason) {
    return this.request(`/loans/${id}/reject`, { method: 'POST', body: { reason } });
  }
  returnLoan(id) {
    return this.request(`/loans/${id}/return`, { method: 'POST' });
  }

  // --- Time slots ---
  getTimeSlots(facilityId) {
    return this.request(`/time-slots${facilityId ? `?facility=${facilityId}` : ''}`, { auth: false });
  }
  createTimeSlot(payload) {
    return this.request('/time-slots', { method: 'POST', body: payload });
  }
  deleteTimeSlot(id) {
    return this.request(`/time-slots/${id}`, { method: 'DELETE' });
  }

  // --- Users ---
  getMe() {
    return this.request('/users/me');
  }
  getUsers(role) {
    return this.request(`/users${role ? `?role=${role}` : ''}`);
  }
  updateUser(id, patch) {
    return this.request(`/users/${id}`, { method: 'PUT', body: patch });
  }
  updateUserRole(id, role) {
    return this.request(`/users/${id}/role`, { method: 'PUT', body: { role } });
  }
  changePassword(currentPassword, newPassword) {
    return this.request('/users/change-password', { method: 'POST', body: { currentPassword, newPassword } });
  }

  // --- Notifications ---
  getNotifications() {
    return this.request('/notifications');
  }
  markNotificationAsRead(id) {
    return this.request(`/notifications/${id}/read`, { method: 'POST' });
  }
  markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', { method: 'POST' });
  }
  sendBroadcastNotification(payload) {
    return this.request('/notifications', { method: 'POST', body: payload });
  }

  // --- Complaints ---
  getComplaints(status) {
    return this.request(`/complaints${status ? `?status=${status}` : ''}`);
  }
  submitComplaint(payload) {
    return this.request('/complaints', { method: 'POST', body: payload });
  }
  resolveComplaint(id, status) {
    return this.request(`/complaints/${id}`, { method: 'PUT', body: { status } });
  }

  // --- Analytics ---
  getAnalytics(from, to) {
    return this.request(`/analytics${toQuery({ from, to })}`);
  }

  // --- Reports ---
  generateReport(type, from, to) {
    return this.request('/reports/generate', { method: 'POST', body: { type, from, to } });
  }

  async downloadReport(type, format, from, to) {
    const query = toQuery({ type, format, from, to });
    const response = await fetch(`${API_BASE_URL}/reports/export${query}`, {
      headers: this.appState.token ? { Authorization: `Bearer ${this.appState.token}` } : {},
    });
    if (!response.ok) {
      let message = `Download failed (${response.status})`;
      try {
        const payload = await response.json();
        if (payload && payload.message) message = payload.message;
      } catch {
        // binary/non-JSON error body, ignore
      }
      throw new Error(message);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${type}-report.${format}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}

function toQuery(params) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return '';
  return `?${new URLSearchParams(entries).toString()}`;
}

const appState = new AppState();
const apiClient = new ApiClient(appState);

// Generic modal close wiring shared by every page: any element with
// [data-close-modal="someId"] closes #someId, and clicking the overlay
// background (outside the modal box) closes it too.
function closeModal(modal) {
  if (!modal) return;
  modal.classList.remove('active');
  modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(document.getElementById(btn.dataset.closeModal)));
  });
  document.querySelectorAll('.modal-overlay, .modal, .booking-modal').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(overlay);
    });
  });
});

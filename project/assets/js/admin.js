// Admin pages wiring, backed by apiClient/appState (api.js).

document.addEventListener('DOMContentLoaded', () => {
  initializeSidebar();
  initializeNotificationBell();
  displayUsername();

  loadAdminDashboard();
  loadUsers();
  wireAddUserButton();
  loadRoleAssignment();
  wireBroadcastForm();
  loadAnalytics();
  wireAnalyticsPeriod();
  wireReportControls();
  wireSettingsPasswordButton();
  wireInertSettingsForms();
});

function initializeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('sidebarToggle');
  if (!sidebar || !toggle) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
}

function initializeNotificationBell() {
  const bell = document.getElementById('notifBell');
  if (!bell) return;
  bell.addEventListener('click', () => {
    window.location.href = 'admin-notifications.html';
  });
}

function displayUsername() {
  const name = (appState.user && appState.user.name) || 'Administrator';
  const el = document.getElementById('topbarUsername');
  if (el) el.textContent = name;
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
}

function statusPillClass(status) {
  if (['confirmed', 'approved', 'returned'].includes(status)) return 'status-pill--available';
  if (['pending', 'checked_out'].includes(status)) return 'status-pill--pending';
  return 'status-pill--booked';
}

// --- Dashboard ---

async function loadAdminDashboard() {
  const el = document.getElementById('totalStudents');
  if (!el) return;

  try {
    const [users, facilities, equipment, bookings, loans, complaints] = await Promise.all([
      apiClient.getUsers(),
      apiClient.getFacilities(),
      apiClient.getEquipment(),
      apiClient.getBookings(),
      apiClient.getLoans(),
      apiClient.getComplaints(),
    ]);

    set('totalStudents', users.filter(u => u.role === 'student').length);
    set('totalOfficers', users.filter(u => u.role === 'officer').length);
    set('totalFacilities', facilities.length);
    set('totalEquipment', equipment.length);
    set('totalBookings', bookings.length);
    set('totalLoans', loans.length);
    set('pendingComplaints', complaints.filter(c => c.status === 'open').length);
    set('pendingApprovals', bookings.filter(b => b.status === 'pending').length + loans.filter(l => l.status === 'pending').length);

    const notifCount = document.getElementById('notifCount');
    if (notifCount) {
      const notifications = await apiClient.getNotifications();
      notifCount.textContent = notifications.filter(n => !n.is_read).length;
    }

    const usersBody = document.getElementById('recentUsersBody');
    if (usersBody) {
      const recentUsers = [...users].sort((a, b) => b.id - a.id).slice(0, 4);
      usersBody.innerHTML = recentUsers.length
        ? recentUsers.map(u => `
            <tr>
              <td>${u.name}</td>
              <td>${statusLabel(u.role)}</td>
              <td><span class="status-pill status-pill--available">Active</span></td>
            </tr>
          `).join('')
        : '<tr><td colspan="3">No users yet.</td></tr>';
    }

    const bookingsBody = document.getElementById('recentBookingsBody');
    if (bookingsBody) {
      const recentBookings = bookings.slice(0, 3);
      bookingsBody.innerHTML = recentBookings.length
        ? recentBookings.map(b => `
            <tr>
              <td>${b.student_name}</td>
              <td>${b.facility_name}</td>
              <td><span class="status-pill ${statusPillClass(b.status)}">${statusLabel(b.status)}</span></td>
            </tr>
          `).join('')
        : '<tr><td colspan="3">No bookings yet.</td></tr>';
    }

    const loansBody = document.getElementById('recentLoansBody');
    if (loansBody) {
      const recentLoans = loans.slice(0, 3);
      loansBody.innerHTML = recentLoans.length
        ? recentLoans.map(l => `
            <tr>
              <td>${l.equipment_name}</td>
              <td>${l.student_name}</td>
              <td><span class="status-pill ${statusPillClass(l.status)}">${statusLabel(l.status)}</span></td>
            </tr>
          `).join('')
        : '<tr><td colspan="3">No equipment requests yet.</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load admin dashboard stats:', err);
  }
}

// --- Manage users ---

async function loadUsers() {
  const body = document.getElementById('usersBody');
  if (!body) return;

  try {
    const users = await apiClient.getUsers();

    set('statTotalUsers', users.length);
    set('statTotalStudentsMU', users.filter(u => u.role === 'student').length);
    set('statTotalOfficersMU', users.filter(u => u.role === 'officer').length);
    set('statTotalAdminsMU', users.filter(u => u.role === 'admin').length);

    function render(list) {
      body.innerHTML = list.length
        ? list.map(u => `
            <tr class="user-row" data-role="${u.role}">
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>${statusLabel(u.role)}</td>
              <td><span class="status-pill status-pill--available">Active</span></td>
              <td><a class="btn btn--outline btn--sm" href="assign-roles.html">Manage Role</a></td>
            </tr>
          `).join('')
        : '<tr><td colspan="5">No users found.</td></tr>';
    }

    render(users);

    const search = document.getElementById('userSearch');
    if (search) {
      search.addEventListener('input', () => {
        const value = search.value.toLowerCase();
        render(users.filter(u => u.name.toLowerCase().includes(value) || u.email.toLowerCase().includes(value)));
      });
    }

    document.querySelectorAll('#userRoleFilters .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#userRoleFilters .chip').forEach(c => c.classList.remove('chip--active'));
        chip.classList.add('chip--active');
        const role = chip.dataset.role;
        render(role === 'all' ? users : users.filter(u => u.role === role));
      });
    });
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function wireAddUserButton() {
  const btn = document.getElementById('addUserBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    alert('There is no admin-side user creation in this demo — new accounts are created via the public registration page.');
  });
}

// --- Assign roles ---

async function loadRoleAssignment() {
  const select = document.getElementById('selectedUser');
  if (!select) return;

  try {
    const users = await apiClient.getUsers();
    select.innerHTML = users.map(u => `<option value="${u.id}" data-role="${u.role}">${u.name} (${u.email})</option>`).join('');

    const currentRoleInput = document.getElementById('currentRole');
    const updateCurrentRole = () => {
      const selectedOption = select.options[select.selectedIndex];
      if (currentRoleInput && selectedOption) currentRoleInput.value = statusLabel(selectedOption.dataset.role);
    };
    select.addEventListener('change', updateCurrentRole);
    updateCurrentRole();

    const roleAssignmentsBody = document.getElementById('roleAssignmentsBody');
    function renderAssignments(list) {
      if (!roleAssignmentsBody) return;
      roleAssignmentsBody.innerHTML = list.length
        ? list.map(u => `
            <tr class="role-row">
              <td>${u.name}</td>
              <td>${u.email}</td>
              <td>${statusLabel(u.role)}</td>
              <td><span class="status-pill status-pill--available">Active</span></td>
              <td>${new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="5">No users found.</td></tr>';
    }
    renderAssignments(users);

    const roleSearch = document.getElementById('roleSearch');
    if (roleSearch) {
      roleSearch.addEventListener('input', () => {
        const value = roleSearch.value.toLowerCase();
        renderAssignments(users.filter(u => u.name.toLowerCase().includes(value) || u.email.toLowerCase().includes(value)));
      });
    }

    const form = document.getElementById('roleForm');
    if (form) {
      form.addEventListener('submit', async e => {
        e.preventDefault();
        const errorEl = document.getElementById('roleAssignError');
        try {
          await apiClient.updateUserRole(select.value, document.getElementById('newRole').value);
          loadRoleAssignment();
          if (errorEl) { errorEl.textContent = 'Role updated.'; errorEl.classList.add('visible'); }
        } catch (err) {
          if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
          else alert(err.message);
        }
      });
    }
  } catch (err) {
    console.error('Failed to load role assignment data:', err);
  }
}

// --- Broadcast notifications ---

function wireBroadcastForm() {
  const form = document.getElementById('notificationForm');
  if (!form || !document.getElementById('notificationAudience')) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const statusEl = document.getElementById('notificationStatus');
    const title = document.getElementById('notificationTitle').value;
    const audience = document.getElementById('notificationAudience').value;
    const message = document.getElementById('notificationMessage').value;

    try {
      await apiClient.sendBroadcastNotification({ audience, message: `${title}: ${message}` });
      form.reset();
      if (statusEl) statusEl.textContent = 'Notification sent.';
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message;
      else alert(err.message);
    }
  });
}

// --- Analytics ---

function periodToRange(period) {
  const to = new Date();
  const from = new Date();
  if (period === 'monthly') from.setMonth(from.getMonth() - 1);
  else if (period === 'quarterly') from.setMonth(from.getMonth() - 3);
  else if (period === 'yearly') from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

async function loadAnalytics(period = 'monthly') {
  const el = document.getElementById('studentsCount');
  if (!el) return;

  try {
    const { from, to } = periodToRange(period);
    const [stats, facilities] = await Promise.all([apiClient.getAnalytics(from, to), apiClient.getFacilities()]);
    set('studentsCount', stats.total_students);
    set('bookingCount', stats.total_bookings);
    set('loanCount', stats.active_loans);
    set('facilityCount', facilities.length);
  } catch (err) {
    console.error('Failed to load analytics:', err);
  }
}

function wireAnalyticsPeriod() {
  const select = document.getElementById('analyticsPeriod');
  if (!select) return;
  select.addEventListener('change', () => loadAnalytics(select.value));
}

// --- Reports ---

function periodSelectToRange(period) {
  const to = new Date();
  const from = new Date();
  if (period === 'week') from.setDate(from.getDate() - 7);
  else if (period === 'month') from.setMonth(from.getMonth() - 1);
  else if (period === 'quarter') from.setMonth(from.getMonth() - 3);
  else if (period === 'year') from.setFullYear(from.getFullYear() - 1);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function wireReportControls() {
  const generateBtn = document.getElementById('generateReportBtn');
  if (!generateBtn) return;

  const typeSelect = document.getElementById('reportType');
  const periodSelect = document.getElementById('reportPeriod');
  const head = document.getElementById('reportResultsHead');
  const body = document.getElementById('reportResultsBody');
  const errorEl = document.getElementById('reportError');

  async function generate() {
    const { from, to } = periodSelectToRange(periodSelect.value);
    try {
      const rows = await apiClient.generateReport(typeSelect.value, from, to);
      if (!rows.length) {
        head.innerHTML = '';
        body.innerHTML = '<tr><td>No data for the selected range.</td></tr>';
        return;
      }
      const columns = Object.keys(rows[0]);
      head.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
      body.innerHTML = rows.map(row => `<tr>${columns.map(c => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`).join('');
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
      else alert(err.message);
    }
  }

  document.getElementById('reportForm')?.addEventListener('submit', e => {
    e.preventDefault();
    generate();
  });

  document.getElementById('exportPDF')?.addEventListener('click', () => {
    const { from, to } = periodSelectToRange(periodSelect.value);
    apiClient.downloadReport(typeSelect.value, 'pdf', from, to).catch(err => alert(err.message));
  });
  document.getElementById('exportExcel')?.addEventListener('click', () => {
    const { from, to } = periodSelectToRange(periodSelect.value);
    apiClient.downloadReport(typeSelect.value, 'xlsx', from, to).catch(err => alert(err.message));
  });
  document.getElementById('printReport')?.addEventListener('click', () => window.print());
}

// --- Settings ---

// System settings / booking rules / notification preferences / backup-restore
// have no backend support (no such data to persist) — prevent the default
// full-page form submit and say so plainly instead of faking a save.
function wireInertSettingsForms() {
  ['systemForm', 'bookingForm'].forEach(id => {
    const form = document.getElementById(id);
    if (!form || form.querySelector('#notificationAudience')) return; // skip the real broadcast form
    form.addEventListener('submit', e => {
      e.preventDefault();
      alert('This setting is not available in the demo backend.');
    });
  });

  const settingsNotificationForm = document.getElementById('notificationForm');
  if (settingsNotificationForm && !settingsNotificationForm.querySelector('#notificationAudience')) {
    settingsNotificationForm.addEventListener('submit', e => {
      e.preventDefault();
      alert('This setting is not available in the demo backend.');
    });
  }

  ['backupBtn', 'restoreBtn', 'logoutDevicesBtn'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => {
      alert('This action is not available in the demo backend.');
    });
  });
}

function wireSettingsPasswordButton() {
  const btn = document.getElementById('changePasswordBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const currentPassword = prompt('Enter your current password:');
    if (!currentPassword) return;
    const newPassword = prompt('Enter new administrator password:');
    if (!newPassword) return;

    try {
      await apiClient.changePassword(currentPassword, newPassword);
      alert('Password changed successfully.');
    } catch (err) {
      alert(err.message);
    }
  });
}

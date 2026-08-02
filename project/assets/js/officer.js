// Officer pages wiring, backed by apiClient/appState (api.js).

document.addEventListener('DOMContentLoaded', () => {
  initializeSidebar();
  initializeNotificationBell();
  displayUsername();
  initializeModalOpeners();
  initializeTableSearch();

  loadOfficerDashboard();
  loadBookingRequests();
  loadLoanRequests();
  loadEquipmentInventory();
  wireEquipmentForm();
  loadFacilities();
  wireFacilityForm();
  loadComplaints();
  loadOfficerNotifications();
  wireMarkAllRead();
  loadReportStats();
  wireReportControls();
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
    window.location.href = 'officer-notifications.html';
  });
}

function displayUsername() {
  const name = (appState.user && appState.user.name) || 'Sports Officer';
  const el = document.getElementById('topbarUsername');
  if (el) el.textContent = name;
}

function initializeModalOpeners() {
  document.querySelectorAll('[data-open-modal]').forEach(button => {
    button.addEventListener('click', () => {
      const modal = document.getElementById(button.dataset.openModal);
      if (modal) modal.classList.add('active');
    });
  });
}

function initializeTableSearch() {
  document.querySelectorAll('.search-box input, input[type="search"]').forEach(search => {
    search.addEventListener('input', () => {
      const filter = search.value.toLowerCase();
      const table = search.closest('.toolbar-card')?.nextElementSibling?.querySelector('tbody')
        || document.querySelector('.table-card tbody');
      if (!table) return;
      table.querySelectorAll('tr').forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(filter) ? '' : 'none';
      });
    });
  });
}

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
}

function statusPillClass(status) {
  if (['confirmed', 'approved', 'returned', 'resolved'].includes(status)) return 'status-pill--available';
  if (['pending', 'checked_out', 'open', 'in_progress'].includes(status)) return 'status-pill--pending';
  return 'status-pill--booked';
}

// --- Dashboard ---

async function loadOfficerDashboard() {
  const totalBookingsEl = document.getElementById('totalBookings');
  if (!totalBookingsEl) return;

  try {
    const [bookings, loans, complaints, equipment, facilities] = await Promise.all([
      apiClient.getBookings(),
      apiClient.getLoans(),
      apiClient.getComplaints(),
      apiClient.getEquipment(),
      apiClient.getFacilities(),
    ]);

    const today = new Date().toISOString().slice(0, 10);

    set('totalBookings', bookings.length);
    set('approvedBookings', bookings.filter(b => b.status === 'confirmed').length);
    set('pendingBookings', bookings.filter(b => b.status === 'pending').length);
    set('pendingLoans', loans.filter(l => l.status === 'pending').length);
    set('todayBookings', bookings.filter(b => b.date === today).length);
    set('openComplaints', complaints.filter(c => c.status === 'open').length);
    set('availableEquipment', equipment.reduce((sum, e) => sum + e.available_quantity, 0));
    set('totalFacilities', facilities.length);
  } catch (err) {
    console.error('Failed to load officer dashboard stats:', err);
  }
}

function set(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// --- Booking requests ---

async function loadBookingRequests() {
  const body = document.getElementById('bookingRequestsBody');
  if (!body) return;

  try {
    const bookings = await apiClient.getBookings();
    body.innerHTML = bookings.length
      ? bookings.map(b => `
          <tr class="booking-row">
            <td>${b.student_name}</td>
            <td>${b.facility_name}</td>
            <td>${b.date}</td>
            <td>${b.start_time} - ${b.end_time}</td>
            <td><span class="status-pill ${statusPillClass(b.status)}">${statusLabel(b.status)}</span></td>
            <td>${
              b.status === 'pending'
                ? `<button class="btn btn--primary btn--sm" data-approve-booking="${b.id}">Approve</button>
                   <button class="btn btn--outline-danger btn--sm" data-reject-booking="${b.id}">Reject</button>`
                : ''
            }</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6">No booking requests.</td></tr>';

    body.querySelectorAll('[data-approve-booking]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.updateBookingStatus(btn.dataset.approveBooking, 'confirmed');
          loadBookingRequests();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
    body.querySelectorAll('[data-reject-booking]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.updateBookingStatus(btn.dataset.rejectBooking, 'cancelled');
          loadBookingRequests();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
  } catch (err) {
    console.error('Failed to load booking requests:', err);
  }
}

// --- Loan requests ---

async function loadLoanRequests() {
  const body = document.getElementById('loanRequestsBody');
  if (!body) return;

  try {
    const loans = await apiClient.getLoans();
    body.innerHTML = loans.length
      ? loans.map(l => `
          <tr class="loan-row">
            <td>${l.student_name}</td>
            <td>${l.equipment_name}</td>
            <td>${l.quantity}</td>
            <td>${l.due_at || '-'}</td>
            <td><span class="status-pill ${statusPillClass(l.status)}">${statusLabel(l.status)}</span></td>
            <td>${
              l.status === 'pending'
                ? `<button class="btn btn--primary btn--sm" data-approve-loan="${l.id}">Approve</button>
                   <button class="btn btn--outline-danger btn--sm" data-reject-loan="${l.id}">Reject</button>`
                : ['approved', 'checked_out'].includes(l.status)
                ? `<button class="btn btn--outline btn--sm" data-return-loan="${l.id}">Mark Returned</button>`
                : ''
            }</td>
          </tr>
        `).join('')
      : '<tr><td colspan="6">No loan requests.</td></tr>';

    body.querySelectorAll('[data-approve-loan]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.approveLoan(btn.dataset.approveLoan);
          loadLoanRequests();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
    body.querySelectorAll('[data-reject-loan]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.rejectLoan(btn.dataset.rejectLoan);
          loadLoanRequests();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
    body.querySelectorAll('[data-return-loan]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.returnLoan(btn.dataset.returnLoan);
          loadLoanRequests();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
  } catch (err) {
    console.error('Failed to load loan requests:', err);
  }
}

// --- Equipment inventory ---

async function loadEquipmentInventory() {
  const body = document.getElementById('equipmentInventoryBody');
  if (!body) return;

  try {
    const equipment = await apiClient.getEquipment();
    body.innerHTML = equipment.length
      ? equipment.map(e => `
          <tr>
            <td>${e.name}</td>
            <td>${e.category}</td>
            <td>${e.available_quantity} / ${e.total_quantity}</td>
            <td><span class="status-pill ${e.status === 'in_stock' ? 'status-pill--available' : e.status === 'low_stock' ? 'status-pill--pending' : 'status-pill--booked'}">${statusLabel(e.status)}</span></td>
            <td><button class="btn btn--outline btn--sm" data-edit-equipment="${e.id}" data-total="${e.total_quantity}" data-available="${e.available_quantity}">Edit</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="5">No equipment yet.</td></tr>';

    body.querySelectorAll('[data-edit-equipment]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const onLoan = Number(btn.dataset.total) - Number(btn.dataset.available);
        const input = prompt('New total quantity:', btn.dataset.total);
        if (input === null) return;
        const newTotal = parseInt(input, 10);
        if (!Number.isFinite(newTotal) || newTotal < onLoan) {
          alert(`Total quantity must be a number >= ${onLoan} (currently on loan).`);
          return;
        }
        try {
          await apiClient.updateEquipment(btn.dataset.editEquipment, {
            total_quantity: newTotal,
            available_quantity: newTotal - onLoan,
          });
          loadEquipmentInventory();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
  } catch (err) {
    console.error('Failed to load equipment inventory:', err);
  }
}

function wireEquipmentForm() {
  const form = document.getElementById('equipmentForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('equipmentError');
    const quantity = parseInt(document.getElementById('equipmentQuantity').value, 10);

    try {
      await apiClient.request('/equipment', {
        method: 'POST',
        body: {
          name: document.getElementById('equipmentName').value,
          category: document.getElementById('equipmentCategory').value,
          total_quantity: quantity,
        },
      });
      form.reset();
      closeModal(document.getElementById('equipmentModal'));
      loadEquipmentInventory();
      loadOfficerDashboard();
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
      else alert(err.message);
    }
  });
}

// --- Facilities ---

async function loadFacilities() {
  const body = document.getElementById('facilitiesBody');
  if (!body) return;

  try {
    const facilities = await apiClient.getFacilities();
    body.innerHTML = facilities.length
      ? facilities.map(f => `
          <tr>
            <td>${f.name}</td>
            <td>${f.capacity || '-'}</td>
            <td><span class="status-pill ${f.is_active ? 'status-pill--available' : 'status-pill--booked'}">${f.is_active ? 'Available' : 'Closed'}</span></td>
            <td><button class="btn btn--outline btn--sm" data-toggle-facility="${f.id}" data-active="${f.is_active}">${f.is_active ? 'Close' : 'Reopen'}</button></td>
          </tr>
        `).join('')
      : '<tr><td colspan="4">No facilities yet.</td></tr>';

    // Deleting a facility is admin-only server-side (see backend/src/routes/facilities.routes.js);
    // officers can only open/close it, which is what "Manage Facilities" actually needs day to day.
    body.querySelectorAll('[data-toggle-facility]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.request(`/facilities/${btn.dataset.toggleFacility}`, {
            method: 'PUT',
            body: { is_active: btn.dataset.active === '1' ? 0 : 1 },
          });
          loadFacilities();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
  } catch (err) {
    console.error('Failed to load facilities:', err);
  }
}

function wireFacilityForm() {
  const form = document.getElementById('facilityForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('facilityError');

    try {
      await apiClient.request('/facilities', {
        method: 'POST',
        body: {
          name: document.getElementById('facilityName').value,
          category: document.getElementById('facilityCategory').value,
          capacity: parseInt(document.getElementById('facilityCapacity').value, 10) || null,
          description: document.getElementById('facilityDescription').value || null,
        },
      });
      form.reset();
      closeModal(document.getElementById('facilityModal'));
      loadFacilities();
      loadOfficerDashboard();
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
      else alert(err.message);
    }
  });
}

// --- Complaints ---

async function loadComplaints() {
  const body = document.getElementById('complaintsBody');
  if (!body) return;

  try {
    const complaints = await apiClient.getComplaints();
    body.innerHTML = complaints.length
      ? complaints.map(c => `
          <tr>
            <td>${c.student_name}</td>
            <td>${c.subject}</td>
            <td>${new Date(c.created_at).toLocaleDateString()}</td>
            <td><span class="status-pill ${statusPillClass(c.status)}">${statusLabel(c.status)}</span></td>
            <td>${
              c.status !== 'resolved'
                ? `<button class="btn btn--primary btn--sm" data-resolve-complaint="${c.id}">Resolve</button>`
                : ''
            }</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5">No complaints.</td></tr>';

    body.querySelectorAll('[data-resolve-complaint]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.resolveComplaint(btn.dataset.resolveComplaint, 'resolved');
          loadComplaints();
          loadOfficerDashboard();
        } catch (err) { alert(err.message); }
      });
    });
  } catch (err) {
    console.error('Failed to load complaints:', err);
  }
}

// --- Officer notifications ---

async function loadOfficerNotifications() {
  const body = document.getElementById('officerNotificationsBody');
  if (!body) return;

  try {
    const notifications = await apiClient.getNotifications();
    set('notificationCount', notifications.filter(n => !n.is_read).length);
    const notifCount = document.getElementById('notifCount');
    if (notifCount) notifCount.textContent = notifications.filter(n => !n.is_read).length;

    body.innerHTML = notifications.length
      ? notifications.map(n => `
          <tr>
            <td>${n.message}</td>
            <td>${n.type.charAt(0).toUpperCase() + n.type.slice(1)}</td>
            <td>${new Date(n.created_at).toLocaleString()}</td>
            <td><span class="status-pill ${n.is_read ? 'status-pill--available' : 'status-pill--pending'}">${n.is_read ? 'Read' : 'New'}</span></td>
          </tr>
        `).join('')
      : '<tr><td colspan="4">No notifications.</td></tr>';
  } catch (err) {
    console.error('Failed to load notifications:', err);
  }
}

function wireMarkAllRead() {
  const btn = document.getElementById('markAllRead');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try {
      await apiClient.markAllNotificationsAsRead();
      loadOfficerNotifications();
    } catch (err) {
      alert(err.message);
    }
  });
}

// --- Reports ---

async function loadReportStats() {
  const el = document.getElementById('reportTotalBookings');
  if (!el) return;

  try {
    const [bookings, loans, facilities, complaints] = await Promise.all([
      apiClient.getBookings(),
      apiClient.getLoans(),
      apiClient.getFacilities(),
      apiClient.getComplaints(),
    ]);
    set('reportTotalBookings', bookings.length);
    set('reportTotalLoans', loans.length);
    set('reportTotalFacilities', facilities.length);
    set('reportTotalComplaints', complaints.length);
  } catch (err) {
    console.error('Failed to load report stats:', err);
  }
}

function wireReportControls() {
  const generateBtn = document.getElementById('generateReportBtn');
  if (!generateBtn) return;

  const typeSelect = document.getElementById('reportTypeSelect');
  const fromInput = document.getElementById('reportFrom');
  const toInput = document.getElementById('reportTo');
  const head = document.getElementById('reportResultsHead');
  const body = document.getElementById('reportResultsBody');

  generateBtn.addEventListener('click', async () => {
    try {
      const rows = await apiClient.generateReport(typeSelect.value, fromInput.value, toInput.value);
      if (!rows.length) {
        head.innerHTML = '';
        body.innerHTML = '<tr><td>No data for the selected range.</td></tr>';
        return;
      }
      const columns = Object.keys(rows[0]);
      head.innerHTML = `<tr>${columns.map(c => `<th>${c}</th>`).join('')}</tr>`;
      body.innerHTML = rows.map(row => `<tr>${columns.map(c => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`).join('');
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
    apiClient.downloadReport(typeSelect.value, 'pdf', fromInput.value, toInput.value).catch(err => alert(err.message));
  });
  document.getElementById('exportExcelBtn')?.addEventListener('click', () => {
    apiClient.downloadReport(typeSelect.value, 'xlsx', fromInput.value, toInput.value).catch(err => alert(err.message));
  });
}

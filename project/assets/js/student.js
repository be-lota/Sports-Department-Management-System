// Student dashboard/facilities/equipment/profile wiring, backed by apiClient/appState (api.js).

document.addEventListener('DOMContentLoaded', () => {
  initializeSidebar();
  initializeNotificationBell();
  displayUsername();

  loadDashboard();
  initializeFacilityFilters();
  loadMyBookings();
  wireBookingModal();

  initializeEquipmentModal();
  initializeEquipmentSearch();
  loadMyLoans();
  wireLoanForm();

  populateProfile();
  wireEditProfileForm();
  wireChangePasswordForm();
  wireComplaintForm();
});

function initializeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  if (!sidebar || !sidebarToggle) return;
  sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('collapsed'));
}

function initializeNotificationBell() {
  const notificationBtn = document.getElementById('notifBell');
  if (!notificationBtn) return;
  notificationBtn.addEventListener('click', () => {
    window.location.href = 'notifications.html';
  });
}

function displayUsername() {
  const name = (appState.user && appState.user.name) || 'Student';
  const topbarName = document.getElementById('topbarUsername');
  const welcomeName = document.getElementById('welcomeUsername');
  if (topbarName) topbarName.textContent = name;
  if (welcomeName) welcomeName.textContent = name;
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

async function loadDashboard() {
  const statTotalBookings = document.getElementById('statTotalBookings');
  if (!statTotalBookings) return; // not on this page

  try {
    const [bookings, loans, notifications] = await Promise.all([
      apiClient.getBookings(),
      apiClient.getLoans(),
      apiClient.getNotifications(),
    ]);

    statTotalBookings.textContent = bookings.length;
    document.getElementById('statEquipmentBorrowed').textContent =
      loans.filter(l => ['approved', 'checked_out'].includes(l.status)).length;
    document.getElementById('statPendingRequests').textContent =
      bookings.filter(b => b.status === 'pending').length + loans.filter(l => l.status === 'pending').length;
    document.getElementById('statUnreadNotifications').textContent =
      notifications.filter(n => !n.is_read).length;

    const notifCount = document.getElementById('notifCount');
    if (notifCount) notifCount.textContent = notifications.filter(n => !n.is_read).length;

    const upcomingBody = document.getElementById('upcomingBookingsBody');
    if (upcomingBody) {
      const upcoming = bookings.filter(b => b.status !== 'cancelled').slice(0, 5);
      upcomingBody.innerHTML = upcoming.length
        ? upcoming.map(b => `
            <tr>
              <td>${b.facility_name}</td>
              <td>${b.date}</td>
              <td>${b.start_time} - ${b.end_time}</td>
              <td><span class="status-pill ${statusPillClass(b.status)}">${statusLabel(b.status)}</span></td>
            </tr>
          `).join('')
        : '<tr><td colspan="4">No bookings yet.</td></tr>';
    }

    const loansBody = document.getElementById('recentLoansBody');
    if (loansBody) {
      const recent = loans.slice(0, 5);
      loansBody.innerHTML = recent.length
        ? recent.map(l => `
            <tr>
              <td>${l.equipment_name}</td>
              <td>${l.quantity}</td>
              <td><span class="status-pill ${statusPillClass(l.status)}">${statusLabel(l.status)}</span></td>
              <td>${l.due_at || '-'}</td>
            </tr>
          `).join('')
        : '<tr><td colspan="4">No equipment loans yet.</td></tr>';
    }
  } catch (err) {
    console.error('Failed to load dashboard data:', err);
  }
}

// --- Facilities / booking ---

function initializeFacilityFilters() {
  const search = document.getElementById('facilitySearch');
  const buttons = document.querySelectorAll('.filter-btn');
  const cards = document.querySelectorAll('.facility-card');
  if (!cards.length) return;

  buttons.forEach(button => {
    button.addEventListener('click', function () {
      buttons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      cards.forEach(card => {
        card.style.display = filter === 'all' || card.dataset.category === filter ? 'block' : 'none';
      });
    });
  });

  if (search) {
    search.addEventListener('input', function () {
      const value = this.value.toLowerCase();
      cards.forEach(card => {
        const title = card.querySelector('h3').textContent.toLowerCase();
        card.style.display = title.includes(value) ? 'block' : 'none';
      });
    });
  }
}

function wireBookingModal() {
  const bookingModal = document.getElementById('bookingModal');
  if (!bookingModal) return;

  const facilityTitle = document.getElementById('facilityTitle');
  const bookingForm = document.getElementById('bookingForm');
  let selectedFacility = null;

  document.querySelectorAll('.book-facility-btn').forEach(button => {
    button.addEventListener('click', function () {
      selectedFacility = this.dataset.facility;
      facilityTitle.textContent = 'Book ' + selectedFacility;
      const errorEl = document.getElementById('bookingError');
      if (errorEl) { errorEl.textContent = ''; errorEl.classList.remove('visible'); }
      bookingModal.style.display = 'flex';
    });
  });

  if (bookingForm) {
    bookingForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const date = document.getElementById('bookingDate').value;
      const time = document.getElementById('bookingTime').value;
      const errorEl = document.getElementById('bookingError');

      try {
        await apiClient.createBooking({ facility: selectedFacility, date, time });
        bookingModal.style.display = 'none';
        bookingForm.reset();
        loadMyBookings();
        loadDashboard();
      } catch (err) {
        if (errorEl) {
          errorEl.textContent = err.message;
          errorEl.classList.add('visible');
        } else {
          alert(err.message);
        }
      }
    });
  }
}

async function loadMyBookings() {
  const body = document.getElementById('myBookingsBody');
  if (!body) return;

  try {
    const bookings = await apiClient.getBookings();
    body.innerHTML = bookings.length
      ? bookings.map(b => `
          <tr>
            <td>${b.facility_name}</td>
            <td>${b.date}</td>
            <td>${b.start_time} - ${b.end_time}</td>
            <td><span class="status-pill ${statusPillClass(b.status)}">${statusLabel(b.status)}</span></td>
            <td>${
              ['pending', 'confirmed'].includes(b.status)
                ? `<button class="btn btn--outline-danger btn--sm" data-cancel-booking="${b.id}">Cancel</button>`
                : `<button class="btn btn--disabled btn--sm" disabled>Cancel</button>`
            }</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5">You have no bookings yet.</td></tr>';

    body.querySelectorAll('[data-cancel-booking]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiClient.cancelBooking(btn.dataset.cancelBooking);
          loadMyBookings();
          loadDashboard();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch (err) {
    console.error('Failed to load bookings:', err);
  }
}

// --- Equipment / loans ---

function initializeEquipmentModal() {
  const loanModal = document.getElementById('loanModal');
  if (!loanModal) return;

  const loanEquipmentField = document.getElementById('loanEquipmentField');
  const modalEquipmentName = document.getElementById('modalEquipmentName');
  const racketSection = document.getElementById('racketOptions');
  const jerseySection = document.getElementById('jerseyOptions');
  const sizeSection = document.getElementById('sizeSection');

  document.querySelectorAll('[data-equipment]').forEach(button => {
    button.addEventListener('click', function () {
      const equipment = this.dataset.equipment;
      loanEquipmentField.value = equipment;
      modalEquipmentName.textContent = equipment;

      racketSection.style.display = 'none';
      jerseySection.style.display = 'none';
      sizeSection.style.display = 'none';

      if (equipment === 'Rackets') racketSection.style.display = 'block';
      if (equipment === 'Team Jerseys') {
        jerseySection.style.display = 'block';
        sizeSection.style.display = 'block';
      }

      loanModal.style.display = 'flex';
    });
  });
}

function wireLoanForm() {
  const loanForm = document.getElementById('loanForm');
  if (!loanForm) return;

  loanForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const sizeSection = document.getElementById('sizeSection');
    const quantity = parseInt(document.getElementById('loanQuantity').value, 10) || 0;

    if (sizeSection.style.display === 'block') {
      const totalSizes =
        (parseInt(document.getElementById('sizeS').value, 10) || 0) +
        (parseInt(document.getElementById('sizeM').value, 10) || 0) +
        (parseInt(document.getElementById('sizeL').value, 10) || 0) +
        (parseInt(document.getElementById('sizeXL').value, 10) || 0) +
        (parseInt(document.getElementById('sizeXXL').value, 10) || 0);

      if (quantity !== totalSizes) {
        alert('The total jersey sizes must equal the quantity requested.');
        return;
      }
    }

    const equipment = document.getElementById('loanEquipmentField').value;

    try {
      await apiClient.createLoan({ equipment, quantity });
      document.getElementById('loanModal').style.display = 'none';
      loanForm.reset();
      loadMyLoans();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  });
}

async function loadMyLoans() {
  const body = document.getElementById('myLoansBody');
  if (!body) return;

  try {
    const loans = await apiClient.getLoans();
    body.innerHTML = loans.length
      ? loans.map(l => `
          <tr>
            <td>${l.equipment_name}</td>
            <td>${l.quantity}</td>
            <td><span class="status-pill ${statusPillClass(l.status)}">${statusLabel(l.status)}</span></td>
            <td>${l.due_at || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="4">You have no equipment loans yet.</td></tr>';
  } catch (err) {
    console.error('Failed to load loans:', err);
  }
}

function initializeEquipmentSearch() {
  const searchInput = document.getElementById('equipmentSearch');
  if (!searchInput) return;
  const cards = document.querySelectorAll('#equipmentGrid .facility-card');

  searchInput.addEventListener('input', function () {
    const searchText = this.value.toLowerCase();
    cards.forEach(card => {
      const title = card.querySelector('h3').textContent.toLowerCase();
      card.style.display = title.includes(searchText) ? 'block' : 'none';
    });
  });
}

// --- Profile ---

function populateProfile() {
  const nameEl = document.getElementById('profileFullName');
  if (!nameEl || !appState.user) return;

  const user = appState.user;
  nameEl.textContent = user.name;
  document.getElementById('profileRoleTag').textContent = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  document.getElementById('profileEmail').textContent = user.email;

  const form = document.getElementById('editProfileForm');
  if (form) {
    form.elements['name'].value = user.name;
    form.elements['email'].value = user.email;
  }
}

function wireEditProfileForm() {
  const form = document.getElementById('editProfileForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('profileError');
    try {
      const updated = await apiClient.updateUser(appState.user.id, { name: form.elements['name'].value });
      appState.setSession(appState.token, updated);
      populateProfile();
      displayUsername();
      if (errorEl) { errorEl.textContent = 'Profile updated.'; errorEl.classList.add('visible'); }
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
      else alert(err.message);
    }
  });
}

function wireChangePasswordForm() {
  const form = document.getElementById('changePasswordForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const errorEl = document.getElementById('passwordError');
    const currentPassword = form.elements['currentPassword'].value;
    const newPassword = form.elements['newPassword'].value;
    const confirmPassword = form.elements['confirmPassword'].value;

    if (newPassword !== confirmPassword) {
      if (errorEl) { errorEl.textContent = 'New passwords do not match.'; errorEl.classList.add('visible'); }
      return;
    }

    try {
      await apiClient.changePassword(currentPassword, newPassword);
      form.reset();
      if (errorEl) { errorEl.textContent = 'Password updated.'; errorEl.classList.add('visible'); }
    } catch (err) {
      if (errorEl) { errorEl.textContent = err.message; errorEl.classList.add('visible'); }
      else alert(err.message);
    }
  });
}

function wireComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    const statusEl = document.getElementById('complaintStatus');
    try {
      await apiClient.submitComplaint({
        subject: form.elements['subject'].value,
        message: form.elements['message'].value,
      });
      form.reset();
      if (statusEl) statusEl.textContent = 'Complaint submitted. The sports office will follow up.';
    } catch (err) {
      if (statusEl) statusEl.textContent = err.message;
    }
  });
}

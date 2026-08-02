// Real login/register/logout/route-guard, backed by apiClient/appState (api.js).

function showAuthError(message) {
  const el = document.getElementById('authError');
  if (!el) {
    alert(message);
    return;
  }
  el.textContent = message;
  el.classList.add('visible');
}

function clearAuthError() {
  const el = document.getElementById('authError');
  if (el) {
    el.textContent = '';
    el.classList.remove('visible');
  }
}

function dashboardForRole(role) {
  if (role === 'officer') return 'officer-dashboard.html';
  if (role === 'admin') return 'admin-dashboard.html';
  return 'Studentdashboard.html';
}

// --- Registration ---

const registerForm = document.getElementById('registerForm');

if (registerForm) {
  registerForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAuthError();

    const firstName = document.getElementById('firstName').value.trim();
    const lastName = document.getElementById('lastName').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (password !== confirmPassword) {
      showAuthError('Passwords do not match.');
      return;
    }

    try {
      await apiClient.register({
        name: `${firstName} ${lastName}`.trim(),
        email,
        password,
        role: 'student',
      });
      registerForm.reset();
      window.location.href = 'login.html';
    } catch (err) {
      showAuthError(err.message);
    }
  });
}

// --- Login ---

const loginForm = document.getElementById('loginForm');

if (loginForm) {
  const emailInput = document.getElementById('email');
  const rememberMeInput = document.getElementById('rememberMe');

  const savedEmail = localStorage.getItem('rememberedEmail');
  if (savedEmail && emailInput) {
    emailInput.value = savedEmail;
    if (rememberMeInput) rememberMeInput.checked = true;
  }

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    clearAuthError();

    const email = emailInput.value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;

    if (!email || !password) {
      showAuthError('Please enter your email and password.');
      return;
    }
    if (!role) {
      showAuthError('Please select your role.');
      return;
    }

    try {
      const { token, user } = await apiClient.login(email, password, role);
      appState.setSession(token, user);

      if (rememberMeInput && rememberMeInput.checked) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      window.location.href = dashboardForRole(user.role);
    } catch (err) {
      showAuthError(err.message);
    }
  });
}

// --- Password show/hide ---

const passwordInput = document.getElementById('password');
const togglePassword = document.getElementById('togglePassword');

if (passwordInput && togglePassword) {
  togglePassword.addEventListener('click', function () {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      togglePassword.classList.remove('fa-eye');
      togglePassword.classList.add('fa-eye-slash');
    } else {
      passwordInput.type = 'password';
      togglePassword.classList.remove('fa-eye-slash');
      togglePassword.classList.add('fa-eye');
    }
  });
}

// --- Logout ---

document.querySelectorAll('.sidebar-link--logout').forEach(function (button) {
  button.addEventListener('click', async function (e) {
    e.preventDefault();
    await apiClient.logout();
    appState.clearSession();
    window.location.href = 'login.html';
  });
});

// --- Route guard ---

const PUBLIC_PAGES = ['index.html', 'login.html', 'register.html', ''];

function requiredRoleForPage(page) {
  if (page === 'studentdashboard.html' || ['facilities.html', 'equipment.html'].includes(page)) return 'student';
  if (
    page.startsWith('officer-') ||
    ['booking-requests.html', 'loan-requests.html', 'equipment-inventory.html', 'manage-facilities.html', 'complaints.html'].includes(page)
  ) {
    return 'officer';
  }
  if (
    page.startsWith('admin-') ||
    ['analytics.html', 'assign-roles.html', 'manage-users.html', 'settings.html'].includes(page)
  ) {
    return 'admin';
  }
  return null; // shared pages (notifications.html, profile.html, reports.html) — any logged-in role
}

(function routeGuard() {
  const page = window.location.pathname.split('/').pop().toLowerCase();
  if (PUBLIC_PAGES.includes(page)) return;

  if (!appState.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }

  const requiredRole = requiredRoleForPage(page);
  if (requiredRole && appState.user.role !== requiredRole) {
    window.location.href = dashboardForRole(appState.user.role);
  }
})();

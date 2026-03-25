const API_URL = "http://localhost:3000/api";
let authToken = null;
let currentUser = null;

let editingIndex = null;

// -------------------- ROUTES --------------------
const routes = {
    '#/': 'home-page',
    '#/login': 'login-page',
    '#/register': 'register-page',
    '#/profile': 'profile-page',
    '#/requests': 'my-requests-page',
    '#/employees': 'employees-page',
    '#/accounts': 'accounts-page',
    '#/departments': 'departments-page',
    '#/verify-email': 'verify-email-page'
};

// -------------------- UTILITY --------------------
function showToast(message, type = "success") {
    const toastEl = document.getElementById("app-toast");
    const toastMsg = document.getElementById("toast-message");

    toastMsg.textContent = message;

    // Set color
    toastEl.classList.remove("bg-success", "bg-danger", "bg-warning", "bg-info");

    if (type === "success") toastEl.classList.add("bg-success");
    if (type === "error") toastEl.classList.add("bg-danger");
    if (type === "warning") toastEl.classList.add("bg-warning");
    if (type === "info") toastEl.classList.add("bg-info");

    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// Helper to show one page and hide the rest
// -------------------- SPA ROUTING --------------------
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(pageId);
    if (page) page.classList.add('active');
}
// Navigation helper
function navigateTo(hash) {
    if (window.location.hash !== hash) window.location.hash = hash;
    else handleRouting();
}
// Routing handler
function handleRouting() {
    const hash = window.location.hash || '#/';
    const pageId = routes[hash] || 'home-page';

    // Protected routes
    const protectedRoutes = ['#/profile', '#/requests'];
    const adminRoutes = ['#/employees', '#/accounts', '#/departments'];

    if (!currentUser && protectedRoutes.includes(hash)) return navigateTo('#/login');
    if ((currentUser?.role !== 'admin') && adminRoutes.includes(hash)) return navigateTo('#/');

    // Show page
    showPage(pageId);

    // Hide welcome section if not home
    const welcome = document.getElementById('welcome-section');
    if (welcome) welcome.classList.toggle('d-none', hash !== '#/');

    // Dynamic page loading
    if (hash === '#/profile') populateProfilePage();
    if (hash === '#/verify-email') loadVerifyEmailPage();
    if (hash === '#/login') {
        showVerifiedMessage();

        const loginForm = document.getElementById('login-form');
        if (loginForm) loginForm.reset();

        const err = document.getElementById('login-error');
        if (err) err.textContent = '';
    }
    if (hash === '#/departments') loadDepartmentsPage();
    if (hash === '#/employees') loadEmployeesPage();
    if (hash === '#/requests') loadRequestsPage();
}

// -------------------- AUTH --------------------
function updateNavbarUsername() {
    const usernameSpan = document.getElementById('username-display');
    if (!usernameSpan) return;

    if (!currentUser) { usernameSpan.textContent = 'User'; return;}
    
    usernameSpan.textContent = currentUser.username || "User";
}

function setAuthState(isAuth, user = null) {
    currentUser = isAuth ? user : null;

    document.body.classList.toggle('authenticated', isAuth);
    document.body.classList.toggle('not-authenticated', !isAuth);
    document.body.classList.toggle('is-admin', isAuth && user?.role === 'admin');

    updateNavbarUsername();
}

document.getElementById('login-form')?.addEventListener('submit', async function(e) {
    e.preventDefault();

    const username = e.target.username.value.trim(); // or username
    const password = e.target.password.value;

    try {
        const res = await fetch(`${API_URL}/login`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || "Login failed", "error");
            return;
        }

        // ✅ Save token
        authToken = data.token;

        // OPTIONAL: persist session
        sessionStorage.setItem("token", authToken);

        currentUser = data.user;

        setAuthState(true, currentUser);
        updateUIByRole();

        showToast("Login successful!");
        navigateTo('#/profile');

    } catch (err) {
        console.error("LOGIN ERROR:", err);
        showToast("Server error: " + err.message, "error");
    }
});

// -------------------- LOGOUT --------------------
function logout() {
    sessionStorage.removeItem("token");
    localStorage.removeItem('showVerifiedMsg'); // Clear verified message
    setAuthState(false);
    
    // Clear login form
    const loginForm = document.getElementById('login-form');
    if (loginForm) loginForm.reset();

    // Clear register form
    const registerForm = document.getElementById('register-form');
    if (registerForm) registerForm.reset();

    // Hide verified message in DOM
    const verifiedMsg = document.getElementById("verified-msg");
    if (verifiedMsg) {
        verifiedMsg.style.display = "none";
        verifiedMsg.textContent = "";
    }
    navigateTo('#/');
}
document.getElementById('logout-btn')?.addEventListener('click', logout);

// -------------------- REGISTER --------------------
document.getElementById("register-form")?.addEventListener("submit", async function(e) {
    e.preventDefault();

    const firstName = document.getElementById("register-firstname").value.trim();
    const lastName = document.getElementById("register-lastname").value.trim();
    const username = document.getElementById("register-email").value.trim(); // using email as username
    const password = document.getElementById("register-password").value;

    // Frontend validation (still good)
    if (!isValidEmail(username)) {
        showToast("Please enter a valid email address.", "warning");
        return;
    }

    try {
        const res = await fetch("http://localhost:3000/api/register", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || "Registration failed", "error");
            return;
        }

        showToast("✅ Registered successfully!");

        // Clear form
        document.getElementById("register-form").reset();

        navigateTo("#/login");

    } catch (err) {
        showToast("Server error. Try again.", "error");
    }
});

function isValidEmail(email) {
    // Basic regex: must have something@something.something
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// -------------------- PROFILE --------------------
function populateProfilePage() {
    if (!currentUser) return navigateTo('#/login');

    const container = document.getElementById('profile-container');
    if (!container) return;

    let name;

    if (currentUser.firstName && currentUser.lastName) {
        const fullName = `${currentUser.firstName} ${currentUser.lastName}`;
        name = capitalizeWords(fullName);
    } else if (currentUser.role === 'admin') {
        name = 'Admin User';
    } else {
        name = 'User';
    }

    // Generate initials for avatar
    const initials = name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase();

    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="profile-avatar mx-auto mb-3">
                ${initials}
            </div>
            <h4 class="fw-bold mb-1">${name}</h4>
            <span class="badge ${currentUser.role === 'admin' ? 'bg-danger' : 'bg-secondary'}">
                ${currentUser.role}
            </span>
        </div>
        <hr>
        <div class="profile-info">
            <div class="mb-3">
                <label class="form-label text-muted small">Email</label>
                <div class="fw-semibold">${currentUser.email}</div>
            </div>

            <div class="mb-3">
                <label class="form-label text-muted small">Role</label>
                <div class="fw-semibold">${currentUser.role}</div>
            </div>
        </div>
        <div class="d-grid gap-2 mt-4">
            <button id="edit-profile-btn" class="btn btn-primary">
                Edit Profile
            </button>
        </div>
    `;
    const editBtn = document.getElementById("edit-profile-btn");
    editBtn?.addEventListener("click", enableProfileEdit);
}

function enableProfileEdit() {
    const container = document.getElementById("profile-container");
    if (!container || !currentUser) return;

    container.innerHTML = `
        <div class="text-center mb-4">
            <div class="profile-avatar mx-auto mb-3">
                ${currentUser.firstName[0].toUpperCase()}${currentUser.lastName[0].toUpperCase()}
            </div>

            <div class="mb-3">
                <label class="form-label">First Name</label>
                <input type="text" id="edit-firstname" class="form-control"
                       value="${currentUser.firstName}">
            </div>

            <div class="mb-3">
                <label class="form-label">Last Name</label>
                <input type="text" id="edit-lastname" class="form-control"
                       value="${currentUser.lastName}">
            </div>

            <span class="badge ${currentUser.role === 'admin' ? 'bg-danger' : 'bg-secondary'}">
                ${currentUser.role}
            </span>
        </div>

        <hr>

        <div class="profile-info">
            <div class="mb-3">
                <label class="form-label text-muted small">Email</label>
                <div class="fw-semibold">${currentUser.email}</div>
            </div>

            <div class="mb-3">
                <label class="form-label text-muted small">Role</label>
                <div class="fw-semibold">${currentUser.role}</div>
            </div>
        </div>

        <div class="d-grid gap-2 mt-4">
            <button id="save-profile-btn" class="btn btn-success">
                Save Changes
            </button>
            <button id="cancel-profile-btn" class="btn btn-secondary">
                Cancel
            </button>
        </div>
    `;

    attachProfileEditEvents();
}

function attachProfileEditEvents() {
    const saveBtn = document.getElementById("save-profile-btn");
    const cancelBtn = document.getElementById("cancel-profile-btn");

    saveBtn?.addEventListener("click", async () => {
        const newFirst = document.getElementById("edit-firstname").value.trim();
        const newLast = document.getElementById("edit-lastname").value.trim();

        if (!newFirst || !newLast) {
            showToast("Name fields cannot be empty.", "warning");
            return;
        }

        try {
            const res = await fetch(`${API_URL}/profile`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ firstName: newFirst, lastName: newLast })
            });

            const data = await res.json();

            if (!res.ok) {
                showToast(data.error || "Failed to update profile", "error");
                return;
            }

            // ✅ Update currentUser locally so UI reflects changes
            currentUser.firstName = newFirst;
            currentUser.lastName = newLast;

            showToast("✅ Profile updated successfully!", "success");

            updateNavbarUsername();   // refresh navbar name
            populateProfilePage();    // reload profile page

        } catch (err) {
            console.error(err);
            showToast("Server error. Please try again.", "error");
        }
    });

    cancelBtn?.addEventListener("click", () => {
        populateProfilePage(); // revert back
    });
}

document.getElementById("go-to-login-btn")?.addEventListener("click", function() {
    localStorage.setItem("showVerifiedMsg", "true");
    navigateTo("#/login");
});

// -------------------- CANCEL BUTTONS --------------------
document.getElementById('login-cancel-btn')?.addEventListener('click', () => navigateTo('#/'));
document.getElementById('register-cancel-btn')?.addEventListener('click', () => navigateTo('#/'));

window.addEventListener('hashchange', handleRouting);

// -------------------- INIT --------------------
window.addEventListener('load', () => {

    // ✅ NEW: Load token instead of localStorage db
    const savedToken = sessionStorage.getItem("token");

    if (savedToken) {
        authToken = savedToken;

        try {
            const payload = JSON.parse(atob(authToken.split('.')[1]));
            currentUser = payload;

            setAuthState(true, currentUser);
            updateUIByRole();

        } catch {
            console.error("Invalid token");
            sessionStorage.removeItem("token");
        }
    }

    // ✅ KEEP this (your existing logic)
    document.getElementById('brand-link')?.addEventListener('click', function(e) {
        if (currentUser) {
            e.preventDefault();
            navigateTo('#/profile');
        }
    });

    // ✅ KEEP routing
    handleRouting();
});

function capitalizeWords(text) {
    if (!text) return '';
    return text
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// -------------------- ACCOUNTS --------------------
async function renderAccountsTable() {
    const tbody = document.getElementById("accounts-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    try {
        const res = await fetch(`${API_URL}/users`, {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        const users = await res.json();

        if (!res.ok) {
            showToast("Failed to load users", "error");
            return;
        }

        users.forEach((user) => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${capitalizeWords(user.firstName + " " + user.lastName)}</td>
                <td>${user.email}</td>
                <td>${user.role}</td>
                <td>${user.verified ? "✅" : "❌"}</td>
                <td>
                    <button class="btn btn-sm btn-primary edit-btn" data-id="${user.id}">Edit</button>
                    <button class="btn btn-sm btn-warning reset-btn" data-id="${user.id}">Reset PW</button>
                    <button class="btn btn-sm btn-danger delete-btn" data-id="${user.id}">Delete</button>
                </td>
            `;

            tbody.appendChild(tr);
        });

        attachAccountActions(); // keep this

    } catch (err) {
        showToast("Server error", "error");
    }
}

async function updateAccount(userId, updatedData) {
    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(updatedData)
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || "Update failed", "error");
            return;
        }

        showToast("Updated successfully!");
        renderAccountsTable();

    } catch {
        showToast("Server error", "error");
    }
}

async function createAccount(accountData) {
    try {
        const res = await fetch(`${API_URL}/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`
            },
            body: JSON.stringify(accountData)
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || "Failed to create account", "error");
            return;
        }

        showToast("Account created successfully!");
    } catch {
        showToast("Server error", "error");
    }
}

document.getElementById("account-form")?.addEventListener("submit", async function(e) {
    e.preventDefault();

    const firstName = document.getElementById("first-name").value.trim();
    const lastName = document.getElementById("last-name").value.trim();
    const email = document.getElementById("email").value.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
        showToast("Please enter a valid email address.", "warning");
        return;
    }

    const role = document.getElementById("role").value;
    const verified = document.getElementById("verified").checked;
    let password = document.getElementById("password")?.value;

    // ✅ validate password for new account
    if (editingIndex === null && (!password || password.length < 6)) {
        showToast("Password must be at least 6 characters long!", "warning");
        return;
    }

    const accountData = { firstName, lastName, email, password, role, verified };

    if (editingIndex !== null) {
        // Update existing user
        const userId = editingIndex;
        await updateAccount(userId, accountData);
        editingIndex = null;
    } else {
        // Create new user
        await createAccount(accountData); // you’ll need to write this API function
    }

    // Hide and reset form
    const form = document.getElementById("account-form");
    form.classList.add("d-none");
    form.querySelector("form").reset();

    // Refresh table
    renderAccountsTable();
});

// Show the modal
async function resetPassword(userId) {
    const modal = document.getElementById("passwordModal");
    const modalEmail = document.getElementById("modal-user-email");
    const form = document.getElementById("passwordModalForm");
    const newPwInput = document.getElementById("new-password");
    const confirmPwInput = document.getElementById("confirm-password");

    // Fetch user
    const res = await fetch(`${API_URL}/users/${userId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
    });
    const user = await res.json();

    modalEmail.textContent = `Enter new password for ${user.email} (min 6 chars)`;
    newPwInput.value = "";
    confirmPwInput.value = "";

    modal.style.display = "flex";

    document.getElementById("cancelPassword").onclick = () => modal.style.display = "none";

    form.onsubmit = async (e) => {
        e.preventDefault();
        const newPw = newPwInput.value.trim();
        const confirmPw = confirmPwInput.value.trim();

        if (newPw.length < 6) return showToast("Password must be at least 6 characters.", "warning");
        if (newPw !== confirmPw) return showToast("Passwords do not match.", "warning");

        const updateRes = await fetch(`${API_URL}/users/${userId}/password`, {
            method: "PUT",
            headers: { 
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}` 
            },
            body: JSON.stringify({ password: newPw })
        });

        const data = await updateRes.json();

        if (!updateRes.ok) return showToast(data.error || "Failed to reset password", "error");

        modal.style.display = "none";
        showToast("Reset password successfully!", "success");
        renderAccountsTable();
    };
}

async function deleteAccount(userId) {
    try {
        const res = await fetch(`${API_URL}/users/${userId}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || "Delete failed", "error");
            return;
        }

        showToast("Deleted successfully!");
        renderAccountsTable(); // refresh table

    } catch {
        showToast("Server error", "error");
    }
}

function attachAccountActions() {
    document.querySelectorAll(".edit-btn").forEach(btn =>
        btn.addEventListener("click", () => editAccount(btn.dataset.id))
    );
    document.querySelectorAll(".reset-btn").forEach(btn =>
        btn.addEventListener("click", () => resetPassword(btn.dataset.id))
    );
    document.querySelectorAll(".delete-btn").forEach(btn =>
        btn.addEventListener("click", () => deleteAccount(btn.dataset.id))
    );
}

function editAccount(userId) {
    editingIndex = userId;

    // You need to get user from table or API
    // easiest: fetch all users again OR store them globally

    fetch(`${API_URL}/users`, {
        headers: {
            Authorization: `Bearer ${authToken}`
        }
    })
    .then(res => res.json())
    .then(users => {
        const user = users.find(u => u.id == userId);
        if (!user) return;

        document.getElementById("first-name").value = user.firstName;
        document.getElementById("last-name").value = user.lastName;
        document.getElementById("email").value = user.email;
        document.getElementById("role").value = user.role;
        document.getElementById("verified").checked = user.verified;

        const form = document.getElementById("account-form");
        form.classList.remove("d-none");
        form.scrollIntoView({ behavior: "smooth" });

        form.dataset.editing = "true";
        form.querySelector("#password").disabled = true;
    });
}

document.getElementById("add-account-btn").addEventListener("click", () => {
    const form = document.getElementById("account-form");
    form.classList.remove("d-none"); // show form
    form.scrollIntoView({ behavior: "smooth" }); // scroll to form

    const passwordInput = form.querySelector("#password"); // get password field
    passwordInput.disabled = false; // enable typing when adding
    passwordInput.value = ""; // optional: clear previous value

    // If you have an "Edit" flag, make sure to set it to false
    form.dataset.editing = "false";
});

document.getElementById("cancel-account-btn")?.addEventListener("click", () => {
    const form = document.getElementById("account-form");
    if (!form) return;

    form.classList.add("d-none"); // hide the form
    form.querySelector("form").reset(); // clear all input fields
    editingIndex = null; // reset editing state
});

async function openAccountForm(mode, userId = null) {
    const form = document.getElementById("account-form");
    const passwordField = document.getElementById("user-password");
    const submitBtn = document.getElementById("account-submit");

    if (mode === "add") {
        form.reset(); // clear previous values
        passwordField.disabled = false; // allow typing
        submitBtn.textContent = "Add Account";
    } else if (mode === "edit" && userId) {
        try {
            const res = await fetch(`${API_URL}/users/${userId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });
            const user = await res.json();

            if (!res.ok || !user) {
                showToast("Failed to load user data", "error");
                return;
            }

            document.getElementById("user-email").value = user.email;
            document.getElementById("user-name").value = `${user.firstName} ${user.lastName}`;
            passwordField.value = "********"; // hide password
            passwordField.disabled = true; // prevent editing
            submitBtn.textContent = "Save Changes";

        } catch (err) {
            console.error(err);
            showToast("Server error. Try again.", "error");
            return;
        }
    }

    form.dataset.mode = mode;
    form.dataset.userId = userId; // store id for saving edits
    form.classList.remove("d-none");
    form.scrollIntoView({ behavior: "smooth" });
}
// -------------------- DEPARTMENTS --------------------
const API_DEPTS = `${API_URL}/departments`;

async function loadDepartmentsPage() {
    try {
        const res = await fetch(API_DEPTS, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const departments = await res.json();

        renderDepartmentsTable(departments); // pass API data 
    } catch (err) {
        showToast("Failed to load departments", "error");
    }
}

function renderDepartmentsTable(departments) {
    const tbody = document.querySelector("#departments-table tbody");
    tbody.innerHTML = "";

    departments.forEach(dept => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${dept.name}</td>
            <td>${dept.description || ""}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm edit-dept-btn" data-id="${dept.id}">Edit</button>
                <button class="btn btn-outline-danger btn-sm delete-dept-btn" data-id="${dept.id}">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    attachDepartmentActions(departments);
}

function attachDepartmentActions(departments) {
    document.querySelectorAll(".edit-dept-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const deptId = btn.dataset.id;
            showToast("Edit department API not implemented yet");
        })
    );

    document.querySelectorAll(".delete-dept-btn").forEach(btn =>
        btn.addEventListener("click", async () => {
            const deptId = btn.dataset.id;
            if (!confirm("Delete this department?")) return;

            await fetch(`${API_DEPTS}/${deptId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${authToken}` }
            });

            showToast("Deleted successfully!");
            loadDepartmentsPage();
        })
    );
}

// "+ Add Department" button
document.getElementById('add-department-btn')?.addEventListener('click', () => {
    showToast('Add department not implemented');
});



// -------------------- EMPLOYEES --------------------
async function populateDepartmentDropdown() {
    const select = document.getElementById("emp-department");
    select.innerHTML = "";

    try {
        const res = await fetch(`${API_URL}/departments`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const departments = await res.json();

        if (!res.ok) throw new Error("Failed to load departments");

        departments.forEach(dept => {
            const option = document.createElement("option");
            option.value = dept.id;
            option.textContent = dept.name;
            select.appendChild(option);
        });

    } catch (err) {
        console.error(err);
        showToast("Failed to load departments", "error");
    }
}

function showEmployeeForm() {
  populateDepartmentDropdown();
  document.getElementById("employee-form-card").classList.remove("d-none");
}

function hideEmployeeForm() {
  document.getElementById("employee-form-card").classList.add("d-none");
  document.getElementById("employee-form").reset();
}

document.getElementById("employee-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const empId = document.getElementById("emp-id").value.trim();
  const inputEmail = document.getElementById("emp-email").value.trim();
  const position = document.getElementById("emp-position").value.trim();
  const departmentId = document.getElementById("emp-department").value;
  const hireDate = document.getElementById("emp-hiredate").value;

  if (!empId || !inputEmail || !position || !departmentId || !hireDate) {
    showToast("Please fill in all required fields.", "warning");
    return;
  }

  // Prepare payload
  const newEmployee = {
    id: empId,
    email: inputEmail, // backend can resolve user ID from email
    departmentId,
    position,
    hireDate
  };

  try {
    const res = await fetch(`${API_EMPLOYEES}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify(newEmployee)
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || "Failed to add employee.", "error");
      return;
    }

    showToast("✅ Employee added successfully!", "success");

    hideEmployeeForm();
    loadEmployeesPage(); // reload table from API

  } catch (err) {
    console.error(err);
    showToast("Server error. Please try again.", "error");
  }
});

const API_EMPLOYEES = `${API_URL}/employees`;

async function loadEmployeesPage() {
    try {
        const res = await fetch(API_EMPLOYEES, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const employees = await res.json();
        renderEmployeesTable(employees);
        populateDepartmentDropdown(); // also fetch departments via API
    } catch {
        showToast("Failed to load employees", "error");
    }
}

function renderEmployeesTable(employees) {
    const tbody = document.querySelector("#employees-table tbody");
    tbody.innerHTML = "";

    if (!employees.length) return document.getElementById("no-employees").classList.remove("d-none");

    document.getElementById("no-employees").classList.add("d-none");

    employees.forEach(emp => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${emp.id}</td>
            <td>${emp.userEmail}</td>
            <td>${emp.position}</td>
            <td>${emp.departmentName}</td>
            <td><button class="btn btn-sm btn-danger delete-btn">Delete</button></td>
        `;
        tbody.appendChild(tr);

        tr.querySelector(".delete-btn").addEventListener("click", async () => {
            if (!confirm("Delete this employee?")) return;

            await fetch(`${API_EMPLOYEES}/${emp.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${authToken}` }
            });

            showToast("Deleted successfully!");
            loadEmployeesPage();
        });
    });
}

function confirmDeleteEmployee(empId, userEmail) {
    const tbody = document.querySelector("#employees-table tbody");
    const rows = Array.from(tbody.querySelectorAll("tr"));
    const row = rows.find(r => r.querySelector("td").textContent == empId);
    if (!row) return;

    // Replace last cell with confirmation buttons
    const confirmRow = row.querySelector("td:last-child");
    confirmRow.innerHTML = `
        <span class="text-danger">Are you sure you want to delete <strong>${userEmail}</strong>?</span>
        <button class="btn btn-sm btn-danger ms-2" id="confirm-yes">Yes</button>
        <button class="btn btn-sm btn-secondary ms-1" id="confirm-no">No</button>
    `;

    // Yes button
    confirmRow.querySelector("#confirm-yes").addEventListener("click", async () => {
        try {
            const res = await fetch(`${API_EMPLOYEES}/${empId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${authToken}` }
            });

            if (!res.ok) throw new Error("Delete failed");

            showToast("Deleted successfully!", "warning");
            loadEmployeesPage(); // refresh table from API
        } catch (err) {
            console.error(err);
            showToast("Failed to delete employee", "error");
        }
    });

    // No button
    confirmRow.querySelector("#confirm-no").addEventListener("click", () => {
        loadEmployeesPage(); // just re-render table
    });
}

async function seedDefaultDepartments() {
    try {
        const res = await fetch(`${API_DEPTS}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const departments = await res.json();

        if (departments.length === 0) {
            // Create default departments
            const defaults = [
                { id: 'dept1', name: 'Engineering' },
                { id: 'dept2', name: 'HR' }
            ];

            for (const dept of defaults) {
                await fetch(`${API_DEPTS}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${authToken}`
                    },
                    body: JSON.stringify(dept)
                });
            }
        }
    } catch (err) {
        console.error(err);
        showToast("Failed to seed departments", "error");
    }
}

// -------------------- REQUESTS --------------------
async function loadRequestsPage() {
    try {
        const res = await fetch(API_REQUESTS, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        const allRequests = await res.json();

        const requestsToShow = currentUser.role === "admin"
            ? allRequests
            : allRequests.filter(r => r.employeeEmail === currentUser.email);

        renderRequestsTable(requestsToShow, currentUser.role === "admin");
    } catch {
        showToast("Failed to load requests", "error");
    }
}

const API_REQUESTS = `${API_URL}/requests`;

document.addEventListener("change", async function(e) {
    if (e.target.classList.contains("status-select")) {
        const requestId = e.target.dataset.id; // use request id, not index
        const newStatus = e.target.value;

        try {
            const res = await fetch(`${API_REQUESTS}/${requestId}`, {
                method: "PATCH", // or PUT depending on your API
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error("Failed to update status");

            showToast("Status updated successfully!", "success");
            loadRequestsPage(); // reload table from API
        } catch (err) {
            console.error(err);
            showToast("Error updating status", "error");
        }
    }
});

document.addEventListener("click", async function(e) {
    if (e.target.classList.contains("edit-status-btn")) {
        const requestId = e.target.dataset.id;

        const newStatus = prompt(
            "Enter new status: Pending, Approved, or Rejected"
        );
        if (!newStatus) return;

        const validStatuses = ["Pending", "Approved", "Rejected"];

        if (!validStatuses.includes(newStatus)) {
            showToast("Invalid status. Please type exactly: Pending, Approved, or Rejected.");
            return;
        }

        try {
            const res = await fetch(`${API_REQUESTS}/${requestId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) throw new Error("Failed to update status");

            showToast("Status updated successfully!", "success");
            loadRequestsPage();
        } catch (err) {
            console.error(err);
            showToast("Error updating status", "error");
        }
    }
});

function getStatusBadge(status) {
    if (status === "Pending") return `<span class="badge bg-warning text-dark">Pending</span>`;
    if (status === "Approved") return `<span class="badge bg-success">Approved</span>`;
    if (status === "Rejected") return `<span class="badge bg-danger">Rejected</span>`;
    return status;
}

document.getElementById("add-item-btn")?.addEventListener("click", () => {
    const container = document.getElementById("request-items");

    const div = document.createElement("div");
    div.className = "d-flex mb-2 request-item";

    div.innerHTML = `
        <input type="text" class="form-control me-2 item-name" placeholder="Item Name">
        <input type="number" class="form-control me-2 item-qty" placeholder="Qty" min="1">
        <button type="button" class="btn btn-danger btn-sm remove-item">×</button>
    `;

    container.appendChild(div);
});

document.getElementById("request-items")?.addEventListener("click", function(e) {
    if (e.target.classList.contains("remove-item")) {
        e.target.closest(".request-item").remove();
    }
});

document.getElementById("new-request-btn").addEventListener("click", function() {
    const modalEl = document.getElementById("new-request-modal");
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    requestTypeSelect.value = "Equipment"; // default
    renderRequestFields("Equipment");
});

// Submit new request
document.getElementById("request-form")?.addEventListener("submit", async function(e) {
    e.preventDefault();
    const type = document.getElementById("request-type").value;
    let items = getRequestItemsFromForm(type);

    const newRequest = { type, items, status: "Pending", employeeEmail: currentUser.email };

    await fetch(API_REQUESTS, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify(newRequest)
    });

    showToast("Request submitted!");
    loadRequestsPage();
});

const requestTypeSelect = document.getElementById("request-type");
const requestItemsContainer = document.getElementById("request-items");

requestTypeSelect.addEventListener("change", function() {
    const type = this.value;
    renderRequestFields(type);
});

function renderRequestFields(type) {
    const container = document.getElementById("request-items");

    container.innerHTML = ""; // clear old fields

    if (type === "Leave") {
        container.innerHTML = `
            <div class="mb-2">
                <label>Start Date</label>
                <input type="date" class="form-control" id="leave-start" required>
            </div>
            <div class="mb-2">
                <label>End Date</label>
                <input type="date" class="form-control" id="leave-end" required>
            </div>
            <div class="mb-2">
                <label>Reason</label>
                <input type="text" class="form-control" id="leave-reason" placeholder="Reason" required>
            </div>
        `;
        document.getElementById("add-item-btn").style.display = "none";
    } else {
        // Equipment/Resources
        container.innerHTML = `
            <div class="d-flex mb-2 request-item">
                <input type="text" class="form-control me-2 item-name" placeholder="Item Name" required>
                <input type="number" class="form-control me-2 item-qty" placeholder="Qty" min="1" required>
                <button type="button" class="btn btn-danger btn-sm remove-item">×</button>
            </div>
        `;
        document.getElementById("add-item-btn").style.display = "inline-block";
    }
}

function renderRequestsTable(requests, isAdmin = false) {
    const tbody = document.getElementById("requests-table-body");
    tbody.innerHTML = "";

    requests.forEach((req) => {
        const tr = document.createElement("tr");

        // Format items if it's an array
        const itemsDisplay = Array.isArray(req.items)
            ? req.items.map(i => `${i.name} x${i.qty}`).join(", ")
            : req.items;

        tr.innerHTML = `
            <td>${req.date}</td>
            ${isAdmin ? `<td>${req.employeeEmail}</td>` : ""}
            <td>${req.type}</td>
            <td>${itemsDisplay}</td>
            <td>${getStatusBadge(req.status)}</td>
            ${isAdmin ? `<td><button class="btn btn-sm btn-danger delete-btn" data-id="${req.id}">Delete</button></td>` : ""}
        `;

        tbody.appendChild(tr);

        // Delete button logic via API
        if (isAdmin) {
            const deleteBtn = tr.querySelector(".delete-btn");
            deleteBtn.addEventListener("click", async () => {
                if (!confirm("Are you sure you want to delete this request?")) return;

                try {
                    const res = await fetch(`${API_REQUESTS}/${req.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${authToken}` }
                    });

                    if (!res.ok) throw new Error("Failed to delete request");

                    showToast("Request deleted successfully!", "warning");
                    loadRequestsPage(); // reload table from API
                } catch (err) {
                    console.error(err);
                    showToast("Failed to delete request", "error");
                }
            });
        }
    });
}

function renderLeaveRequestsTable(leaveRequests, isAdmin = false) {
    const tbody = document.getElementById("leave-requests-table-body");
    tbody.innerHTML = "";

    leaveRequests.forEach((req) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${req.dateSubmitted}</td>
            ${isAdmin ? `<td>${req.employeeEmail}</td>` : ""}
            <td>${req.startDate}</td>
            <td>${req.endDate}</td>
            <td>${req.reason}</td>
            <td>${getStatusBadge(req.status)}</td>
            ${isAdmin ? `<td><button class="btn btn-sm btn-danger delete-btn" data-id="${req.id}">Delete</button></td>` : ""}
        `;

        tbody.appendChild(tr);

        if (isAdmin) {
            const deleteBtn = tr.querySelector(".delete-btn");
            deleteBtn.addEventListener("click", async () => {
                if (!confirm("Are you sure you want to delete this leave request?")) return;

                try {
                    const res = await fetch(`${API_REQUESTS}/${req.id}`, {
                        method: "DELETE",
                        headers: { Authorization: `Bearer ${authToken}` }
                    });

                    if (!res.ok) throw new Error("Failed to delete leave request");

                    showToast("Leave request deleted successfully!", "warning");
                    loadRequestsPage(); // reload table from API
                } catch (err) {
                    console.error(err);
                    showToast("Failed to delete leave request", "error");
                }
            });
        }
    });
}

async function loadAdminDashboard() {
    try {
        const res = await fetch("http://localhost:3000/api/admin/dashboard", {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error, "error");
            return;
        }

        console.log(data);

        // OPTIONAL: display in UI
        const container = document.getElementById("admin-dashboard");
        if (container) {
            container.innerHTML = `
                <h3>${data.message}</h3>
                <p>${data.data}</p>
            `;
        }

    } catch (err) {
        showToast("Failed to load admin dashboard", "error");
    }
}

function updateUIByRole() {
    if (!currentUser) return;

    // Example buttons/sections
    const adminDashboardBtn = document.getElementById('admin-dashboard-btn');
    const addEmployeeBtn = document.getElementById('add-employee-btn');
    const addAccountBtn = document.getElementById('add-account-btn');

    const isAdmin = currentUser.role === 'admin';

    // Show/hide admin-only buttons
    if (adminDashboardBtn) adminDashboardBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (addEmployeeBtn) addEmployeeBtn.style.display = isAdmin ? 'inline-block' : 'none';
    if (addAccountBtn) addAccountBtn.style.display = isAdmin ? 'inline-block' : 'none';

    document.querySelectorAll('.delete-btn').forEach(btn => {
    const isAdminOnly = btn.dataset.adminOnly === "true";
    if (!currentUser || (isAdminOnly && currentUser.role !== 'admin')) {
        btn.style.display = 'none';
    }
    });
}
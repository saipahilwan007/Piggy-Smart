// ==========================================
// PiggySmart Full-Stack Client Logic
// ==========================================

// Application State
let state = {
  token: localStorage.getItem('piggy_token') || null,
  username: localStorage.getItem('piggy_username') || null,
  savings: [],
  monthlyGoal: 1000,
  currency: '$'
};

// UI Section Elements
const authScreen = document.getElementById('auth-screen');
const appContainer = document.getElementById('app-container');

// Auth DOM elements
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authBtnText = document.getElementById('btn-text');
const authToggleLink = document.getElementById('auth-toggle-link');
const authAlert = document.getElementById('auth-alert');

// Dashboard DOM elements
const displayUsername = document.getElementById('display-username');
const logoutBtn = document.getElementById('logout-btn');
const totalSavedEl = document.getElementById('total-saved-amount');
const goalAmountEl = document.getElementById('goal-amount-display');
const progressCircle = document.getElementById('progress-circle');
const progressPercentEl = document.getElementById('progress-percentage');
const progressStatusEl = document.getElementById('progress-status-text');
const currencySelect = document.getElementById('currency-select');

// Goal edit components
const editGoalBtn = document.getElementById('edit-goal-btn');
const goalEditPanel = document.getElementById('goal-edit-panel');
const goalInput = document.getElementById('goal-input');
const saveGoalBtn = document.getElementById('save-goal-btn');

// Form components
const savingsForm = document.getElementById('savings-form');
const savingAmountInput = document.getElementById('saving-amount');
const savingCategoryInput = document.getElementById('saving-category');
const savingDateInput = document.getElementById('saving-date');
const savingNoteInput = document.getElementById('saving-note');
const currencySymbols = document.querySelectorAll('.currency-symbol');

// Ledger components
const ledgerBody = document.getElementById('ledger-body');
const clearAllBtn = document.getElementById('clear-all-btn');
const exportBtn = document.getElementById('export-btn');
const exportMenu = document.getElementById('export-menu');
const exportCsvBtn = document.getElementById('export-csv-btn');
const exportJsonBtn = document.getElementById('export-json-btn');
const exportTxtBtn = document.getElementById('export-txt-btn');

// Calculator components
const calcMonthlyInput = document.getElementById('calc-monthly');
const calcInterestInput = document.getElementById('calc-interest');
const calcYearsInput = document.getElementById('calc-years');
const depositRange = document.getElementById('deposit-range');
const interestRange = document.getElementById('interest-range');
const sliderValDeposit = document.getElementById('slider-val-deposit');
const sliderValInterest = document.getElementById('slider-val-interest');

const calcPrincipalEl = document.getElementById('calc-result-principal');
const calcTotalEl = document.getElementById('calc-result-total');
const calcInterestEl = document.getElementById('calc-result-interest');

// Milestone elements
const msStarter = document.getElementById('ms-starter');
const msHalfway = document.getElementById('ms-halfway');
const msComplete = document.getElementById('ms-complete');
const savingsGradeEl = document.getElementById('savings-grade');

// Global Chart variables
let categoryChart = null;
let isRegisterMode = false;

// Initialize app
async function init() {
  console.log("init() called. Current token:", state.token);
  // Setup SVG circle properties
  const radius = progressCircle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;

  // Default date to today
  savingDateInput.value = new Date().toISOString().split('T')[0];

  setupEventListeners();

  if (state.token) {
    // Attempt to retrieve profile settings/savings to verify session integrity
    const success = await loadUserData();
    if (success) {
      showDashboardView();
    } else {
      logout();
    }
  } else {
    showAuthView();
  }

  // Calculate local projections regardless of auth state
  calculateProjections();
}

// UI Toggle between Auth screen and Main Dashboard
function showAuthView() {
  appContainer.classList.add('hidden');
  authScreen.classList.remove('hidden');
  resetAuthForm();
}

function showDashboardView() {
  authScreen.classList.add('hidden');
  appContainer.classList.remove('hidden');
  displayUsername.textContent = state.username;
  render();
}

function resetAuthForm() {
  authUsernameInput.value = '';
  authPasswordInput.value = '';
  hideAlert();
}

// API Helper - authenticated fetch wrapper
async function apiCall(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const config = { method, headers };
  if (body) {
    config.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(endpoint, config);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }
    return { data, success: true };
  } catch (err) {
    return { error: err.message, success: false };
  }
}

// Load settings and savings database details
async function loadUserData() {
  const settingsRes = await apiCall('/api/settings');
  if (!settingsRes.success) return false;

  state.monthlyGoal = settingsRes.data.monthly_goal;
  state.currency = settingsRes.data.currency;

  const savingsRes = await apiCall('/api/savings');
  if (!savingsRes.success) return false;

  state.savings = savingsRes.data;

  // Sync inputs
  currencySelect.value = state.currency;
  goalInput.value = state.monthlyGoal;
  updateCurrencySymbolDisplays();

  return true;
}

// Set up UI Event Handlers
function setupEventListeners() {
  console.log("setupEventListeners() called.");
  // Toggle registration mode
  authToggleLink.addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    hideAlert();
    if (isRegisterMode) {
      authTitle.textContent = "Create Account";
      authSubtitle.textContent = "Sign up to track and plan your savings";
      authBtnText.textContent = "Sign Up";
      authToggleLink.textContent = "Log In";
      document.getElementById('auth-toggle-text').childNodes[0].textContent = "Already have an account? ";
    } else {
      authTitle.textContent = "Welcome Back";
      authSubtitle.textContent = "Login to access your saving tracker";
      authBtnText.textContent = "Sign In";
      authToggleLink.textContent = "Sign Up";
      document.getElementById('auth-toggle-text').childNodes[0].textContent = "Don't have an account? ";
    }
  });

  // Auth form submit
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;

    if (!username || !password) return;

    const endpoint = isRegisterMode ? '/api/auth/register' : '/api/auth/login';
    const payload = { username, password };

    authSubmitBtn.disabled = true;
    const res = await apiCall(endpoint, 'POST', payload);
    authSubmitBtn.disabled = false;

    if (res.success) {
      if (isRegisterMode) {
        showAlert('Registration successful! Logging you in...', 'success');
        // Auto login after registration
        isRegisterMode = false;
        authForm.dispatchEvent(new Event('submit'));
      } else {
        state.token = res.data.token;
        state.username = res.data.username;
        localStorage.setItem('piggy_token', state.token);
        localStorage.setItem('piggy_username', state.username);
        
        await loadUserData();
        showDashboardView();
      }
    } else {
      showAlert(res.error, 'error');
    }
  });

  // Logout button
  logoutBtn.addEventListener('click', logout);

  // Settings change API integration
  currencySelect.addEventListener('change', async (e) => {
    const prevCurrency = state.currency;
    state.currency = e.target.value;
    updateCurrencySymbolDisplays();

    const res = await apiCall('/api/settings', 'POST', {
      monthly_goal: state.monthlyGoal,
      currency: state.currency
    });

    if (res.success) {
      render();
      calculateProjections();
    } else {
      state.currency = prevCurrency;
      currencySelect.value = prevCurrency;
      updateCurrencySymbolDisplays();
      alert('Failed to update currency settings.');
    }
  });

  // Save Goal
  saveGoalBtn.addEventListener('click', async () => {
    const val = parseFloat(goalInput.value);
    if (isNaN(val) || val <= 0) {
      alert('Please enter a valid savings goal amount.');
      return;
    }

    const prevGoal = state.monthlyGoal;
    state.monthlyGoal = val;

    const res = await apiCall('/api/settings', 'POST', {
      monthly_goal: state.monthlyGoal,
      currency: state.currency
    });

    if (res.success) {
      goalEditPanel.classList.add('hidden');
      render();
    } else {
      state.monthlyGoal = prevGoal;
      goalInput.value = prevGoal;
      alert('Failed to update saving goal.');
    }
  });

  // Enable Enter key on Goal input
  goalInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveGoalBtn.click();
    }
  });

  editGoalBtn.addEventListener('click', () => {
    goalInput.value = state.monthlyGoal; // Pre-populate with current goal
    goalEditPanel.classList.toggle('hidden');
    goalInput.focus();
  });

  // Add savings logs
  savingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = savingsForm.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;

    const amount = parseFloat(savingAmountInput.value);
    const category = savingCategoryInput.value;
    const date = savingDateInput.value;
    const note = savingNoteInput.value.trim() || 'Savings';

    if (amount <= 0) {
      alert('Please enter a valid positive amount.');
      return;
    }

    const payload = {
      id: Date.now().toString(),
      amount,
      category,
      date,
      note
    };

    submitBtn.disabled = true;
    const res = await apiCall('/api/savings', 'POST', payload);
    submitBtn.disabled = false;

    if (res.success) {
      state.savings.push(payload);
      render();
      
      // Reset input
      savingAmountInput.value = '';
      savingNoteInput.value = '';
      savingDateInput.value = new Date().toISOString().split('T')[0];
    } else {
      alert(`Error logging savings: ${res.error}`);
    }
  });

  // Clear all logs
  clearAllBtn.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to clear your savings ledger? This deletes all records permanently from the server.")) return;

    // Sequential deletes for simplicity
    let failed = false;
    for (const entry of state.savings) {
      const res = await apiCall(`/api/savings/${entry.id}`, 'DELETE');
      if (!res.success) failed = true;
    }

    if (failed) {
      alert("Some entries failed to delete. Reloading database...");
    }
    
    await loadUserData();
    render();
  });

  // Sliders for dynamic math projections
  depositRange.addEventListener('input', (e) => {
    calcMonthlyInput.value = e.target.value;
    calculateProjections();
  });

  calcMonthlyInput.addEventListener('input', (e) => {
    depositRange.value = e.target.value;
    calculateProjections();
  });

  interestRange.addEventListener('input', (e) => {
    calcInterestInput.value = e.target.value;
    calculateProjections();
  });

  calcInterestInput.addEventListener('input', (e) => {
    interestRange.value = e.target.value;
    calculateProjections();
  });

  calcYearsInput.addEventListener('input', calculateProjections);

  // Toggle export dropdown visibility
  exportBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.classList.toggle('hidden');
  });

  // Hide menu on document click
  document.addEventListener('click', () => {
    exportMenu.classList.add('hidden');
  });

  // CSV Export
  exportCsvBtn.addEventListener('click', () => {
    if (state.savings.length === 0) {
      alert("No savings entries to export.");
      return;
    }
    let csvContent = "Date,Category,Description,Amount\n";
    state.savings.forEach(entry => {
      const escapedNote = `"${entry.note.replace(/"/g, '""')}"`;
      csvContent += `${entry.date},"${entry.category}",${escapedNote},${entry.amount}\n`;
    });
    downloadFile(csvContent, "text/csv", "piggysmart_ledger.csv");
  });

  // JSON Export
  exportJsonBtn.addEventListener('click', () => {
    if (state.savings.length === 0) {
      alert("No savings entries to export.");
      return;
    }
    const cleanLogs = state.savings.map(entry => ({
      date: entry.date,
      category: entry.category,
      description: entry.note,
      amount: entry.amount
    }));
    const jsonContent = JSON.stringify(cleanLogs, null, 2);
    downloadFile(jsonContent, "application/json", "piggysmart_ledger.json");
  });

  // TXT Export
  exportTxtBtn.addEventListener('click', () => {
    if (state.savings.length === 0) {
      alert("No savings entries to export.");
      return;
    }
    const total = state.savings.reduce((sum, entry) => sum + entry.amount, 0);
    
    let txtContent = `==================================================
              PIGGYSMART SAVINGS LEDGER
==================================================
User:          ${state.username}
Monthly Goal:  ${state.currency}${state.monthlyGoal.toFixed(2)}
Total Saved:   ${state.currency}${total.toFixed(2)}
Report Date:   ${new Date().toLocaleDateString()}
==================================================

`;

    txtContent += `Date         | Category             | Description          | Amount\n`;
    txtContent += `-------------|----------------------|----------------------|-------------\n`;

    const sorted = [...state.savings].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    sorted.forEach(entry => {
      const formattedDate = new Date(entry.date).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      
      const dateCol = formattedDate.padEnd(12);
      const catCol = entry.category.substring(0, 20).padEnd(20);
      const noteCol = entry.note.substring(0, 20).padEnd(20);
      const amtCol = `${state.currency}${entry.amount.toFixed(2)}`.padStart(11);
      
      txtContent += `${dateCol} | ${catCol} | ${noteCol} | ${amtCol}\n`;
    });

    txtContent += `==================================================\n`;
    downloadFile(txtContent, "text/plain", "piggysmart_ledger.txt");
  });
}

// Logout script
function logout() {
  state.token = null;
  state.username = null;
  state.savings = [];
  localStorage.removeItem('piggy_token');
  localStorage.removeItem('piggy_username');
  showAuthView();
}

// Alert notifications
function showAlert(message, type) {
  authAlert.textContent = message;
  authAlert.className = `auth-alert ${type}`;
}

function hideAlert() {
  authAlert.className = 'auth-alert hidden';
  authAlert.textContent = '';
}

// Update currency symbols across input overlay displays
function updateCurrencySymbolDisplays() {
  currencySymbols.forEach(el => {
    el.textContent = state.currency;
  });
}

// Render values and dashboard charts
function render() {
  const total = state.savings.reduce((sum, entry) => sum + entry.amount, 0);

  totalSavedEl.textContent = formatCurrency(total);
  goalAmountEl.textContent = formatCurrency(state.monthlyGoal);

  // Math Percent calculations
  const progressPercent = state.monthlyGoal > 0 ? (total / state.monthlyGoal) * 100 : 0;
  const roundedPercent = Math.min(Math.round(progressPercent), 999);
  
  progressPercentEl.textContent = `${roundedPercent}%`;
  progressStatusEl.textContent = `${formatCurrency(total)} of ${formatCurrency(state.monthlyGoal)}`;

  // SVG circular progression offsets
  const radius = progressCircle.r.baseVal.value;
  const circumference = radius * 2 * Math.PI;
  const offsetPercent = Math.min(progressPercent, 100);
  const offset = circumference - (offsetPercent / 100) * circumference;
  progressCircle.style.strokeDashoffset = offset;

  renderLedger();
  renderMilestones(progressPercent);
  renderChart();
}

// Format currency
function formatCurrency(amount) {
  return `${state.currency}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Render savings entries in table
function renderLedger() {
  const sortedSavings = [...state.savings].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (sortedSavings.length === 0) {
    ledgerBody.innerHTML = `
      <tr class="empty-state-row">
        <td colspan="5" class="text-center text-muted">
          <i class="fa-solid fa-receipt empty-icon"></i>
          <p>No savings logged yet. Start saving today!</p>
        </td>
      </tr>
    `;
    return;
  }

  ledgerBody.innerHTML = sortedSavings.map(entry => {
    const formattedDate = new Date(entry.date).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });

    return `
      <tr>
        <td>${formattedDate}</td>
        <td><span class="category-badge">${entry.category}</span></td>
        <td class="text-muted">${escapeHTML(entry.note)}</td>
        <td class="text-right font-medium">${formatCurrency(entry.amount)}</td>
        <td class="text-center">
          <button class="delete-btn" onclick="deleteEntry('${entry.id}')" title="Delete Entry">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Delete log entry API integration (declared globally for inline click handlers)
window.deleteEntry = async function(id) {
  const res = await apiCall(`/api/savings/${id}`, 'DELETE');
  if (res.success) {
    state.savings = state.savings.filter(entry => entry.id !== id);
    render();
  } else {
    alert(`Failed to delete saving: ${res.error}`);
  }
};

// Character escaping
function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Milestones Rendering
function renderMilestones(percent) {
  const loggedAny = state.savings.length > 0;
  const isHalfway = percent >= 50;
  const isComplete = percent >= 100;

  msStarter.className = `milestone-item ${loggedAny ? 'achieved' : ''}`;
  msStarter.querySelector('i').className = loggedAny ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle-check';

  msHalfway.className = `milestone-item ${isHalfway ? 'achieved' : ''}`;
  msHalfway.querySelector('i').className = isHalfway ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle-check';

  msComplete.className = `milestone-item ${isComplete ? 'achieved' : ''}`;
  msComplete.querySelector('i').className = isComplete ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle-check';

  // Savings Performance Grade
  let grade = "C";
  let gradeColor = "#f59e0b"; // Warning amber

  if (percent === 0) {
    grade = "D";
    gradeColor = "#ef4444"; // Red
  } else if (percent >= 100) {
    grade = "A+";
    gradeColor = "#10b981"; // Emerald
  } else if (percent >= 80) {
    grade = "A";
    gradeColor = "#10b981";
  } else if (percent >= 50) {
    grade = "B";
    gradeColor = "#3b82f6"; // Blue
  }

  savingsGradeEl.textContent = grade;
  savingsGradeEl.style.background = `linear-gradient(135deg, ${gradeColor}, #ffffff)`;
  savingsGradeEl.style.webkitBackgroundClip = 'text';
  savingsGradeEl.style.backgroundClip = 'text';
  savingsGradeEl.style.webkitTextFillColor = 'transparent';
}

// Category charts
function getSavingsByCategory() {
  const categories = {};
  state.savings.forEach(entry => {
    categories[entry.category] = (categories[entry.category] || 0) + entry.amount;
  });
  return categories;
}

function renderChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const catData = getSavingsByCategory();
  const labels = Object.keys(catData);
  const data = Object.values(catData);

  const isEmpty = labels.length === 0;
  const finalLabels = isEmpty ? ["No Savings Logged"] : labels;
  const finalData = isEmpty ? [1] : data;
  const finalColors = isEmpty 
    ? ["rgba(255, 255, 255, 0.05)"] 
    : [
        '#8b5cf6', // Emergency
        '#3b82f6', // Retirement
        '#10b981', // Travel
        '#f59e0b', // Gadgets
        '#ec4899', // Investments
        '#14b8a6'  // General Savings
      ];

  if (categoryChart) {
    categoryChart.data.labels = finalLabels;
    categoryChart.data.datasets[0].data = finalData;
    categoryChart.data.datasets[0].backgroundColor = finalColors;
    categoryChart.options.plugins.tooltip.enabled = !isEmpty;
    categoryChart.update();
  } else {
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: finalLabels,
        datasets: [{
          data: finalData,
          backgroundColor: finalColors,
          borderWidth: 2,
          borderColor: '#111827',
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: !isEmpty,
            callbacks: {
              label: function(context) {
                const value = context.raw;
                if (isEmpty) return "No Savings";
                return ` ${context.label}: ${state.currency}${value.toFixed(2)}`;
              }
            }
          }
        },
        cutout: '75%'
      }
    });
  }
}

// Projections compound logic
function calculateProjections() {
  const monthlyDeposit = parseFloat(calcMonthlyInput.value) || 0;
  const annualRate = parseFloat(calcInterestInput.value) || 0;
  const years = parseInt(calcYearsInput.value) || 0;

  // Sync range sliders visually
  sliderValDeposit.textContent = `${state.currency}${monthlyDeposit}`;
  sliderValInterest.textContent = `${annualRate}%`;

  const totalMonths = years * 12;
  const monthlyRate = (annualRate / 100) / 12;

  let totalValue = 0;
  let totalPrincipal = monthlyDeposit * totalMonths;

  if (monthlyRate > 0) {
    totalValue = monthlyDeposit * ((Math.pow(1 + monthlyRate, totalMonths) - 1) / monthlyRate);
  } else {
    totalValue = totalPrincipal;
  }

  const interestEarned = Math.max(totalValue - totalPrincipal, 0);

  calcPrincipalEl.textContent = formatCurrency(totalPrincipal);
  calcTotalEl.textContent = formatCurrency(totalValue);
  calcInterestEl.textContent = formatCurrency(interestEarned);
}

// Dynamic download trigger helper
function downloadFile(content, mimeType, filename) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Start Application on load
document.addEventListener('DOMContentLoaded', init);

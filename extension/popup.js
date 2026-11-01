// LifeSynch AI Chrome Extension Popup Logic
const API_BASE_URL = 'http://localhost:5000/api/v1';
const DASHBOARD_URL = 'http://localhost:5173';
const TOKEN_KEY = 'lifesynch_auth_token';

// State
let authToken = null;
let currentUser = null;
let chatHistory = [];
let allTasks = [];

// DOM Elements
const loadingState = document.getElementById('loading-state');
const unauthView = document.getElementById('unauth-view');
const authView = document.getElementById('auth-view');
const userGreeting = document.getElementById('user-greeting');
const todayContainer = document.getElementById('today-items-container');
const upcomingContainer = document.getElementById('upcoming-items-container');
const badgeTodayCount = document.getElementById('badge-today-count');
const btnToggleUpcoming = document.getElementById('btn-toggle-upcoming');
const chatMessages = document.getElementById('chat-messages');
const assistantInput = document.getElementById('assistant-input');
const btnSendQuestion = document.getElementById('btn-send-question');
const btnRefresh = document.getElementById('btn-refresh');
const btnOpenDashboard = document.getElementById('btn-open-dashboard');
const linkDashboardFooter = document.getElementById('link-dashboard-footer');
const btnSigninGoogle = document.getElementById('btn-signin-google');
const btnSyncTab = document.getElementById('btn-sync-tab');

// Utility: Storage get/set that works in extension or browser context
async function getStoredToken() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    const data = await chrome.storage.local.get([TOKEN_KEY]);
    if (data && data[TOKEN_KEY]) return data[TOKEN_KEY];
  }
  return localStorage.getItem(TOKEN_KEY);
}

async function setStoredToken(token) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.set({ [TOKEN_KEY]: token });
  }
  localStorage.setItem(TOKEN_KEY, token);
}

async function clearStoredToken() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    await chrome.storage.local.remove([TOKEN_KEY]);
  }
  localStorage.removeItem(TOKEN_KEY);
}

// Utility: Try to grab token from open LifeSynch tab
async function syncTokenFromTab() {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({ url: ['http://localhost:5173/*', 'http://localhost:3000/*'] });
      if (tabs && tabs.length > 0 && chrome.scripting) {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => localStorage.getItem('lifesynch_auth_token')
        });
        const token = results?.[0]?.result;
        if (token) {
          await setStoredToken(token);
          return token;
        }
      }
    } catch (e) {
      console.warn('Tab sync unavailable:', e);
    }
  }
  return null;
}

// Formatters
function getGreeting(name) {
  const hour = new Date().getHours();
  let greet = 'Good morning';
  if (hour >= 12 && hour < 17) greet = 'Good afternoon';
  else if (hour >= 17 || hour < 5) greet = 'Good evening';
  return name ? `${greet}, ${name.split(' ')[0]} 👋` : `${greet} 👋`;
}

function formatDueTime(dueDate, dueTime) {
  if (!dueDate) return 'No deadline';
  const today = new Date().toISOString().split('T')[0];
  const isToday = dueDate.startsWith(today);

  if (dueTime) {
    const [hStr, mStr] = dueTime.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const timeFormatted = `${h}:${m} ${ampm}`;
    return isToday ? `Due ${timeFormatted}` : `Due ${dueDate} · ${timeFormatted}`;
  }

  return isToday ? 'Due today' : `Due ${dueDate}`;
}

// API Calls
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearStoredToken();
      authToken = null;
      showUnauthView();
      throw new Error('Authentication expired. Please sign in again.');
    }
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.message || `Request failed with status ${response.status}`);
  }

  return response.json();
}

// Initializer
async function init() {
  showLoading(true);

  authToken = await getStoredToken();
  if (!authToken) {
    authToken = await syncTokenFromTab();
  }

  if (!authToken) {
    showLoading(false);
    showUnauthView();
    return;
  }

  try {
    const userRes = await apiRequest('/auth/me');
    if (userRes.data) {
      currentUser = userRes.data;
      userGreeting.textContent = getGreeting(currentUser.name);
      await loadResponsibilities();
      showAuthView();
    } else {
      showUnauthView();
    }
  } catch (err) {
    console.error('Init error:', err);
    showUnauthView();
  } finally {
    showLoading(false);
  }
}

// Load & Render Responsibilities
async function loadResponsibilities() {
  try {
    const res = await apiRequest('/tasks');
    allTasks = res.data || [];
    renderTasks(allTasks);
  } catch (err) {
    console.error('Failed to load tasks:', err);
  }
}

function renderTasks(tasks) {
  const todayStr = new Date().toISOString().split('T')[0];

  // Filter tasks for Today's attention:
  // 1. Status is DUE_TODAY or dueDate is today
  // 2. Or high-priority active tasks
  const todayItems = tasks.filter(t => 
    t.status === 'DUE_TODAY' || 
    (t.dueDate && t.dueDate.startsWith(todayStr)) ||
    (t.priority === 'high' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
  );

  const upcomingItems = tasks.filter(t => 
    !todayItems.some(item => item.id === t.id) &&
    t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
  );

  badgeTodayCount.textContent = `${todayItems.length} item${todayItems.length !== 1 ? 's' : ''}`;

  // Render Today's items
  if (todayItems.length === 0) {
    todayContainer.innerHTML = '<div class="empty-tasks">No tasks due today. You are caught up! 🎉</div>';
  } else {
    todayContainer.innerHTML = todayItems.map(renderTaskCard).join('');
  }

  // Render Upcoming items
  if (upcomingItems.length === 0) {
    upcomingContainer.innerHTML = '<div class="empty-tasks">No upcoming tasks.</div>';
  } else {
    upcomingContainer.innerHTML = upcomingItems.map(renderTaskCard).join('');
  }
}

function renderTaskCard(task) {
  const priorityClass = task.priority || 'medium';
  const priorityDot = priorityClass === 'high' ? '🔴' : priorityClass === 'low' ? '🟢' : '🟠';
  const dueFormatted = formatDueTime(task.dueDate, task.dueTime);
  const source = task.sourceDisplay || task.source || 'LifeSynch';

  return `
    <div class="task-item">
      <div class="task-header">
        <div class="task-title">${escapeHtml(task.title)}</div>
        <span class="priority-badge ${priorityClass}">${priorityDot} ${priorityClass}</span>
      </div>
      <div class="task-meta">
        <span class="task-due">${dueFormatted}</span>
        <span class="task-source">${escapeHtml(source)}</span>
      </div>
    </div>
  `;
}

// Assistant Chat
async function sendAssistantQuestion(question) {
  const q = (question || assistantInput.value).trim();
  if (!q) return;

  assistantInput.value = '';
  btnSendQuestion.disabled = true;

  // Clear initial placeholder if first message
  const placeholder = chatMessages.querySelector('.chat-placeholder');
  if (placeholder) placeholder.remove();

  // Append user bubble
  appendChatBubble('user', q);
  chatHistory.push({ role: 'user', content: q });

  // Append temporary loading assistant bubble
  const loadingBubble = appendChatBubble('assistant', 'Thinking...');

  try {
    const res = await apiRequest('/assistant/ask', {
      method: 'POST',
      body: JSON.stringify({
        question: q,
        history: chatHistory.slice(-6)
      })
    });

    const answer = res.data?.answer || 'Information is unavailable in your synced accounts.';
    loadingBubble.innerHTML = formatAssistantAnswer(answer);
    chatHistory.push({ role: 'assistant', content: answer });
  } catch (err) {
    loadingBubble.textContent = err.message || 'Could not retrieve assistant response.';
  } finally {
    btnSendQuestion.disabled = false;
    assistantInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

function appendChatBubble(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${role}`;
  if (role === 'assistant') {
    bubble.innerHTML = formatAssistantAnswer(text);
  } else {
    bubble.textContent = text;
  }
  chatMessages.appendChild(bubble);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return bubble;
}

function formatAssistantAnswer(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br/>');
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// UI State Toggles
function showLoading(show) {
  loadingState.classList.toggle('hidden', !show);
  if (show) {
    unauthView.classList.add('hidden');
    authView.classList.add('hidden');
  }
}

function showUnauthView() {
  unauthView.classList.remove('hidden');
  authView.classList.add('hidden');
  loadingState.classList.add('hidden');
}

function showAuthView() {
  authView.classList.remove('hidden');
  unauthView.classList.add('hidden');
  loadingState.classList.add('hidden');
}

// Event Listeners
btnToggleUpcoming.addEventListener('click', () => {
  const isHidden = upcomingContainer.classList.contains('hidden');
  upcomingContainer.classList.toggle('hidden', !isHidden);
  btnToggleUpcoming.textContent = isHidden ? 'Hide' : 'Show';
});

btnSendQuestion.addEventListener('click', () => sendAssistantQuestion());

assistantInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    sendAssistantQuestion();
  }
});

// Suggestion chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const q = chip.getAttribute('data-q');
    sendAssistantQuestion(q);
  });
});

btnRefresh.addEventListener('click', async () => {
  btnRefresh.style.transform = 'rotate(180deg)';
  setTimeout(() => { btnRefresh.style.transform = 'none'; }, 300);
  if (authToken) {
    await loadResponsibilities();
  } else {
    await init();
  }
});

const openDashboard = () => {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
    chrome.tabs.create({ url: DASHBOARD_URL });
  } else {
    window.open(DASHBOARD_URL, '_blank');
  }
};

btnOpenDashboard.addEventListener('click', openDashboard);
linkDashboardFooter.addEventListener('click', (e) => {
  e.preventDefault();
  openDashboard();
});

btnSigninGoogle.addEventListener('click', openDashboard);

btnSyncTab.addEventListener('click', async () => {
  showLoading(true);
  const token = await syncTokenFromTab();
  if (token) {
    authToken = token;
    await init();
  } else {
    showLoading(false);
    alert('Please open http://localhost:5173 and make sure you are signed in.');
  }
});

// Start
document.addEventListener('DOMContentLoaded', init);

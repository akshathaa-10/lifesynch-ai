// LifeSynch AI - In-Page Overlay Content Script
(() => {
  if (window.__LIFESYNCH_INJECTED__) return;
  window.__LIFESYNCH_INJECTED__ = true;

  const API_BASE_URL = 'http://localhost:5000/api/v1';
  const DASHBOARD_URL = 'http://localhost:5173';
  let authToken = null;
  let overlayOpen = false;
  let chatHistory = [];

  // Helper: Get token from chrome.storage
  function fetchToken() {
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['lifesynch_auth_token'], (res) => {
          resolve(res?.lifesynch_auth_token || null);
        });
      } else {
        resolve(null);
      }
    });
  }

  // Inject Badge
  const badge = document.createElement('div');
  badge.id = 'lifesynch-overlay-badge';
  badge.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
    <span>LifeSynch AI</span>
  `;
  document.body.appendChild(badge);

  // Inject Overlay Container
  const container = document.createElement('div');
  container.id = 'lifesynch-overlay-container';
  container.className = 'hidden';
  container.innerHTML = `
    <div class="ls-overlay-header">
      <div class="ls-overlay-brand">
        <div class="ls-overlay-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
        <div>
          <h3 class="ls-overlay-title">LifeSynch AI</h3>
          <p id="ls-user-greet" class="ls-overlay-subtitle">Your personal assistant</p>
        </div>
      </div>
      <div class="ls-overlay-actions">
        <button id="ls-btn-dashboard" class="ls-overlay-btn" title="Open full dashboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/>
          </svg>
        </button>
        <button id="ls-btn-close" class="ls-overlay-btn" title="Close overlay">✕</button>
      </div>
    </div>

    <div id="ls-overlay-content" class="ls-overlay-body">
      <!-- Loading or content rendered here -->
    </div>

    <div class="ls-overlay-footer">
      <input type="text" id="ls-input-ask" class="ls-overlay-input" placeholder="Ask LifeSynch..." autocomplete="off" />
      <button id="ls-btn-send" class="ls-overlay-send" title="Send question">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  `;
  document.body.appendChild(container);

  // Toggle overlay
  badge.addEventListener('click', async () => {
    overlayOpen = !overlayOpen;
    container.classList.toggle('hidden', !overlayOpen);
    if (overlayOpen) {
      await refreshData();
    }
  });

  const btnClose = container.querySelector('#ls-btn-close');
  btnClose.addEventListener('click', () => {
    overlayOpen = false;
    container.classList.add('hidden');
  });

  const btnDash = container.querySelector('#ls-btn-dashboard');
  btnDash.addEventListener('click', () => {
    window.open(DASHBOARD_URL, '_blank');
  });

  const inputAsk = container.querySelector('#ls-input-ask');
  const btnSend = container.querySelector('#ls-btn-send');

  btnSend.addEventListener('click', () => submitQuestion());
  inputAsk.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitQuestion();
    }
  });

  async function apiCall(endpoint, method = 'GET', body = null) {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: body ? JSON.stringify(body) : null
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }
    return res.json();
  }

  async function refreshData() {
    authToken = await fetchToken();
    const contentArea = container.querySelector('#ls-overlay-content');
    const greetElem = container.querySelector('#ls-user-greet');

    if (!authToken) {
      contentArea.innerHTML = `
        <div class="ls-unauth-box">
          <div class="ls-unauth-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h4 class="ls-unauth-heading">Sign in to LifeSynch</h4>
          <p class="ls-unauth-desc">Connect with your LifeSynch account to see your real tasks and chat with your assistant.</p>
          <button id="ls-btn-signin" class="ls-primary-btn">Sign in to LifeSynch</button>
        </div>
      `;
      contentArea.querySelector('#ls-btn-signin')?.addEventListener('click', () => {
        window.open(DASHBOARD_URL, '_blank');
      });
      return;
    }

    contentArea.innerHTML = `<div style="text-align:center; padding:20px; color:#94a3b8; font-size:12px;">Loading obligations...</div>`;

    try {
      const [userRes, tasksRes] = await Promise.all([
        apiCall('/auth/me'),
        apiCall('/tasks')
      ]);

      const user = userRes.data;
      if (user && user.name) {
        greetElem.textContent = `Hello, ${user.name.split(' ')[0]} 👋`;
      }

      const tasks = tasksRes.data || [];
      renderOverlayBody(contentArea, tasks);
    } catch (err) {
      contentArea.innerHTML = `<div style="color:#ef4444; font-size:12px; text-align:center; padding:16px;">Failed to load data. Please make sure you are signed in.</div>`;
    }
  }

  function renderOverlayBody(contentArea, tasks) {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => 
      t.status === 'DUE_TODAY' || 
      (t.dueDate && t.dueDate.startsWith(todayStr)) ||
      (t.priority === 'high' && t.status !== 'COMPLETED' && t.status !== 'CANCELLED')
    );

    let tasksHtml = '';
    if (todayTasks.length === 0) {
      tasksHtml = `<div style="color:#94a3b8; font-size:12px; padding:6px 0;">No urgent responsibilities today! 🎉</div>`;
    } else {
      tasksHtml = todayTasks.map(t => {
        const p = t.priority || 'medium';
        const pDot = p === 'high' ? '🔴' : p === 'low' ? '🟢' : '🟠';
        const badgeClass = `ls-badge-${p}`;
        let due = 'No deadline';
        if (t.dueDate) {
          due = t.dueTime ? `Due ${t.dueTime}` : `Due today`;
        }
        return `
          <div class="ls-task-card">
            <div class="ls-task-header">
              <span class="ls-task-title">${escapeStr(t.title)}</span>
              <span class="${badgeClass}">${pDot} ${p}</span>
            </div>
            <div class="ls-task-meta">
              <span>${due}</span>
              <span>•</span>
              <span>${escapeStr(t.sourceDisplay || t.source || 'LifeSynch')}</span>
            </div>
          </div>
        `;
      }).join('');
    }

    contentArea.innerHTML = `
      <div>
        <div class="ls-section-title">Today's attention</div>
        ${tasksHtml}
      </div>

      <div style="margin-top: 10px;">
        <div class="ls-section-title">Ask Assistant</div>
        <div class="ls-chips-bar">
          <button class="ls-chip" data-q="What should I focus on today?">Focus today</button>
          <button class="ls-chip" data-q="What is my highest priority responsibility?">Top priority</button>
          <button class="ls-chip" data-q="What is due tomorrow?">Due tomorrow</button>
        </div>
      </div>

      <div id="ls-chat-history" class="ls-chat-history"></div>
    `;

    // Hook chips
    contentArea.querySelectorAll('.ls-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.getAttribute('data-q');
        inputAsk.value = q;
        submitQuestion();
      });
    });

    renderChatHistory();
  }

  function renderChatHistory() {
    const chatContainer = container.querySelector('#ls-chat-history');
    if (!chatContainer) return;
    if (chatHistory.length === 0) {
      chatContainer.innerHTML = `<div style="color:#64748b; font-size:11px; text-align:center; padding:8px;">Ask about your schedule or responsibilities.</div>`;
      return;
    }

    chatContainer.innerHTML = chatHistory.map(msg => `
      <div class="ls-chat-bubble ${msg.role}">
        ${escapeStr(msg.content).replace(/\n/g, '<br/>')}
      </div>
    `).join('');
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  async function submitQuestion() {
    const text = inputAsk.value.trim();
    if (!text) return;
    inputAsk.value = '';

    chatHistory.push({ role: 'user', content: text });
    renderChatHistory();

    chatHistory.push({ role: 'assistant', content: 'Thinking...' });
    renderChatHistory();

    try {
      const res = await apiCall('/assistant/ask', 'POST', {
        question: text,
        history: chatHistory.slice(-6)
      });
      const answer = res.data?.answer || 'Information is unavailable in your synced accounts.';
      chatHistory[chatHistory.length - 1] = { role: 'assistant', content: answer };
    } catch (err) {
      chatHistory[chatHistory.length - 1] = { role: 'assistant', content: 'Failed to retrieve response from LifeSynch assistant.' };
    }
    renderChatHistory();
  }

  function escapeStr(s) {
    if (!s) return '';
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();

// LifeSynch AI Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[LifeSynch AI] Extension installed successfully.');
});

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_TOKEN') {
    chrome.storage.local.get(['lifesynch_auth_token'], (result) => {
      sendResponse({ token: result.lifesynch_auth_token || null });
    });
    return true; // Keep message channel open for async response
  }
  
  if (request.type === 'SET_TOKEN') {
    chrome.storage.local.set({ lifesynch_auth_token: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

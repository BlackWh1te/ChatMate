// Background service worker
chrome.runtime.onInstalled.addListener(function() {
  console.log('ChatMate installed');

  // Set default settings
  try {
    chrome.storage.local.set({
      ollamaUrl: 'http://localhost:11434',
      modelName: 'llama3',
      history: [],
      templates: [],
      feedbackHistory: []
    });
  } catch (e) {
    console.error('Failed to set default settings:', e);
  }

  // Create context menu
  chrome.contextMenus.create({
    id: 'ollama-generate',
    title: 'Generate AI Response',
    contexts: ['selection']
  });

  chrome.contextMenus.create({
    id: 'ollama-open',
    title: 'Open ChatMate',
    contexts: ['all']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId === 'ollama-generate' && info.selectionText) {
    // Store selected text and open popup
    try {
      chrome.storage.local.set({pendingText: info.selectionText}, function() {
        chrome.action.openPopup();
      });
    } catch (e) {
      console.error('Failed to store pending text:', e);
      chrome.action.openPopup();
    }
  } else if (info.menuItemId === 'ollama-open') {
    chrome.action.openPopup();
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(function(command) {
  if (command === 'generate-response') {
    // Get selected text from active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (!tabs || !tabs[0] || !tabs[0].id) return;
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelectedText'}, function(response) {
        if (chrome.runtime.lastError) {
          console.error('[ChatMate] sendMessage failed:', chrome.runtime.lastError.message);
          return;
        }
        if (response && response.text) {
          try {
            chrome.storage.local.set({pendingText: response.text}, function() {
              chrome.action.openPopup();
            });
          } catch (e) {
            console.error('Failed to store pending text:', e);
            chrome.action.openPopup();
          }
        }
      });
    });
  }
});

// Listen for messages from popup/settings
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPendingText') {
    try {
      chrome.storage.local.get(['pendingText'], function(result) {
        sendResponse({text: result.pendingText || ''});
        // Clear pending text after reading
        try {
          chrome.storage.local.remove('pendingText');
        } catch (e) {
          console.error('Failed to clear pending text:', e);
        }
      });
    } catch (e) {
      console.error('Failed to get pending text:', e);
      sendResponse({text: ''});
    }
    return true; // Keep channel open for async response
  }

  if (request.action === 'detectModels') {
    detectModelsFromBackground(request.url).then(result => {
      sendResponse(result);
    }).catch(err => {
      sendResponse({error: err.message});
    });
    return true;
  }
});

async function detectModelsFromBackground(url) {
  console.log('[ChatMate] Detecting models from:', url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const normalizedUrl = (url || '').replace(/\/$/, '');
    const res = await fetch(`${normalizedUrl}/api/tags`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = data.models || [];
    const modelNames = models.map(m => m.name || m.model).filter(Boolean);
    console.log('[ChatMate] Found models:', modelNames);
    return {models: modelNames};
  } catch (err) {
    clearTimeout(timeoutId);
    console.error('[ChatMate] Model detection failed:', err.message);
    throw err;
  }
}

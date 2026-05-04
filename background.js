// Background service worker
chrome.runtime.onInstalled.addListener(function() {
  console.log('ChatMate installed');

  // Set default settings
  chrome.storage.local.set({
    ollamaUrl: 'http://localhost:11434',
    modelName: 'llama3',
    history: [],
    templates: [],
    feedbackHistory: []
  });

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
    chrome.storage.local.set({pendingText: info.selectionText}, function() {
      chrome.action.openPopup();
    });
  } else if (info.menuItemId === 'ollama-open') {
    chrome.action.openPopup();
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(function(command) {
  if (command === 'generate-response') {
    // Get selected text from active tab
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelectedText'}, function(response) {
        if (response && response.text) {
          chrome.storage.local.set({pendingText: response.text}, function() {
            chrome.action.openPopup();
          });
        }
      });
    });
  }
});

// Listen for messages from popup/settings
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPendingText') {
    chrome.storage.local.get(['pendingText'], function(result) {
      sendResponse({text: result.pendingText || ''});
      // Clear pending text after reading
      chrome.storage.local.remove('pendingText');
    });
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
    const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
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

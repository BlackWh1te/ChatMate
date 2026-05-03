// Background service worker
chrome.runtime.onInstalled.addListener(function() {
  console.log('ChatMate installed');

  // Set default settings
  chrome.storage.local.set({
    ollamaUrl: 'http://localhost:11434',
    modelName: 'llama2',
    history: [],
    templates: [
      {
        id: 1,
        name: 'Professional',
        prompt: 'Write a professional, polite, and business-appropriate response'
      },
      {
        id: 2,
        name: 'Casual',
        prompt: 'Write a friendly, casual, and conversational response'
      },
      {
        id: 3,
        name: 'Formal',
        prompt: 'Write a formal, respectful, and dignified response'
      },
      {
        id: 4,
        name: 'Concise',
        prompt: 'Write a brief, to-the-point, and concise response'
      },
      {
        id: 5,
        name: 'Empathetic',
        prompt: 'Write a warm, understanding, and empathetic response'
      }
    ]
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

// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getPendingText') {
    chrome.storage.local.get(['pendingText'], function(result) {
      sendResponse({text: result.pendingText || ''});
      // Clear pending text after reading
      chrome.storage.local.remove('pendingText');
    });
    return true; // Keep channel open for async response
  }
});

// Content script for text selection and paste support

// Get selected text
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'getSelectedText') {
    const selectedText = window.getSelection().toString().trim();
    sendResponse({text: selectedText});
    return true;
  }

  if (request.action === 'insertText') {
    const inserted = insertTextIntoActiveElement(request.text);
    sendResponse({success: inserted});
    return true;
  }
});

function insertTextIntoActiveElement(text) {
  const activeElement = document.activeElement;

  // Try common chat input selectors for major sites
  const selectors = [
    // Generic contenteditable
    '[contenteditable="true"]:focus',
    '[contenteditable=""]:focus',
    // Facebook
    '[role="textbox"]',
    // WhatsApp Web
    'div[data-testid="conversation-compose-box-input"]',
    'div[data-tab="1"]',
    // Slack
    '[data-qa="message_input"]',
    // Discord
    'div[role="textbox"]',
    // LinkedIn
    'div.msg-form__contenteditable',
    // Twitter/X
    '[data-testid="tweetTextarea_0"]',
    // Telegram Web
    '.composer_rich_textarea',
    // Instagram
    'textarea[placeholder]',
    // Generic inputs
    'textarea:focus',
    'input[type="text"]:focus'
  ];

  // First try the focused element
  if (activeElement) {
    if (activeElement.isContentEditable || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      insertIntoElement(activeElement, text);
      return true;
    }
  }

  // Try to find chat inputs on the page
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      if (isVisible(el)) {
        insertIntoElement(el, text);
        return true;
      }
    }
  }

  return false;
}

function isVisible(el) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && rect.top >= 0 && rect.bottom <= window.innerHeight;
}

function insertIntoElement(element, text) {
  if (element.isContentEditable) {
    // For contenteditable elements (Facebook, LinkedIn, etc.)
    element.focus();

    // Try to use execCommand for better compatibility
    const selection = window.getSelection();
    const range = document.createRange();

    // Clear selection and insert
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    document.execCommand('insertText', false, text);

    // Trigger input events
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    // For standard input elements
    const start = element.selectionStart || element.value.length;
    const end = element.selectionEnd || element.value.length;
    const value = element.value;

    element.value = value.substring(0, start) + text + value.substring(end);
    element.selectionStart = element.selectionEnd = start + text.length;

    // Trigger events
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.focus();
  }
}

// Also listen for double-click to extract message context
let lastSelectedText = '';
document.addEventListener('selectionchange', function() {
  const selection = window.getSelection().toString().trim();
  if (selection && selection !== lastSelectedText) {
    lastSelectedText = selection;
  }
});

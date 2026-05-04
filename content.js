// Content script for text selection, paste support, and context extraction

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

  if (request.action === 'getPageContext') {
    const context = extractPageContext(request.maxLength || 4000);
    sendResponse({context: context});
    return true;
  }
});

function extractPageContext(maxLength) {
  // Try to find the main content area
  const selectors = [
    'article', 'main', '[role="main"]',
    '.content', '.post-content', '.entry-content',
    '.message', '.chat-message', '.conversation',
    '#content', '.article-body', '.story-body'
  ];

  let content = '';

  // Try main content selectors first
  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el) {
      content = cleanText(el.innerText);
      if (content.length > 200) break;
    }
  }

  // Fallback: get body text minus nav/footer/scripts
  if (!content || content.length < 200) {
    const clone = document.body.cloneNode(true);

    // Remove non-content elements
    const removeSelectors = [
      'script', 'style', 'nav', 'header', 'footer',
      'aside', '.sidebar', '.menu', '.navigation',
      '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
      '.ads', '.advertisement', '.cookie-banner', '.modal'
    ];

    for (const sel of removeSelectors) {
      const els = clone.querySelectorAll(sel);
      els.forEach(e => e.remove());
    }

    content = cleanText(clone.innerText);
  }

  // Truncate if too long
  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '... [truncated]';
  }

  return {
    url: window.location.href,
    title: document.title,
    text: content,
    length: content.length
  };
}

function cleanText(text) {
  return text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function insertTextIntoActiveElement(text) {
  const activeElement = document.activeElement;

  const selectors = [
    '[contenteditable="true"]:focus',
    '[contenteditable=""]:focus',
    '[role="textbox"]',
    'div[data-testid="conversation-compose-box-input"]',
    'div[data-tab="1"]',
    '[data-qa="message_input"]',
    'div[role="textbox"]',
    'div.msg-form__contenteditable',
    '[data-testid="tweetTextarea_0"]',
    '.composer_rich_textarea',
    'textarea[placeholder]',
    'textarea:focus',
    'input[type="text"]:focus'
  ];

  if (activeElement) {
    if (activeElement.isContentEditable || activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
      insertIntoElement(activeElement, text);
      return true;
    }
  }

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
    element.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand('insertText', false, text);
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
    const start = element.selectionStart || element.value.length;
    const end = element.selectionEnd || element.value.length;
    const value = element.value;
    element.value = value.substring(0, start) + text + value.substring(end);
    element.selectionStart = element.selectionEnd = start + text.length;
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.focus();
  }
}

// Track last selected text
let lastSelectedText = '';
document.addEventListener('selectionchange', function() {
  const selection = window.getSelection().toString().trim();
  if (selection && selection !== lastSelectedText) {
    lastSelectedText = selection;
  }
});

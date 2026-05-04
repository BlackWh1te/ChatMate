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
  // Detect Reddit and use specialized extraction
  if (isReddit()) {
    return extractRedditContext(maxLength);
  }

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

function isReddit() {
  return window.location.hostname.includes('reddit.com');
}

function extractRedditContext(maxLength) {
  const parts = [];

  // --- POST TITLE ---
  const titleSelectors = [
    'h1[data-testid="post-title"]',
    'h1._eYtD2XCVieq6emjKBH3m',
    'a.title',
    'h1'
  ];
  for (const sel of titleSelectors) {
    const el = document.querySelector(sel);
    if (el) {
      parts.push('[POST TITLE]\n' + cleanText(el.innerText));
      break;
    }
  }

  // --- POST BODY (self-posts) ---
  const bodySelectors = [
    '[data-testid="post-content"]',
    '.usertext-body .md',
    'div[data-click-id="text"]',
    '.expando .usertext-body'
  ];
  for (const sel of bodySelectors) {
    const el = document.querySelector(sel);
    if (el) {
      const body = cleanText(el.innerText);
      if (body.length > 10) {
        parts.push('[POST BODY]\n' + body);
        break;
      }
    }
  }

  // --- COMMENTS ---
  const commentData = [];

  // New Reddit comment selectors
  const newComments = document.querySelectorAll('[data-testid="comment"]');
  if (newComments.length > 0) {
    newComments.forEach((comment, i) => {
      const authorEl = comment.querySelector('[data-testid="comment_author_link"]');
      const bodyEl = comment.querySelector('[data-testid="comment-content"]');
      if (bodyEl) {
        commentData.push({
          author: authorEl ? authorEl.innerText : 'unknown',
          body: cleanText(bodyEl.innerText),
          index: i + 1
        });
      }
    });
  }

  // Old Reddit comment selectors (fallback)
  if (commentData.length === 0) {
    const oldComments = document.querySelectorAll('.comment, .entry');
    oldComments.forEach((comment, i) => {
      const authorEl = comment.querySelector('.author');
      const bodyEl = comment.querySelector('.usertext-body .md');
      if (bodyEl) {
        commentData.push({
          author: authorEl ? authorEl.innerText : 'unknown',
          body: cleanText(bodyEl.innerText),
          index: i + 1
        });
      }
    });
  }

  // Add comments to parts (top 20 most relevant)
  if (commentData.length > 0) {
    parts.push('[COMMENTS]');
    commentData.slice(0, 20).forEach(c => {
      parts.push(`Comment #${c.index} by u/${c.author}:\n${c.body}`);
    });
    if (commentData.length > 20) {
      parts.push(`... and ${commentData.length - 20} more comments`);
    }
  }

  let content = parts.join('\n\n');

  // Truncate intelligently: keep post info, truncate comments if needed
  if (content.length > maxLength) {
    // Try to keep post title + body, truncate comments
    const postEnd = content.indexOf('[COMMENTS]');
    if (postEnd > 0 && postEnd < maxLength) {
      const roomForComments = maxLength - postEnd - 50;
      const commentsText = content.substring(postEnd);
      const truncatedComments = commentsText.substring(0, roomForComments);
      content = content.substring(0, postEnd) + '\n\n' + truncatedComments + '\n... [truncated]';
    } else {
      content = content.substring(0, maxLength) + '... [truncated]';
    }
  }

  return {
    url: window.location.href,
    title: document.title,
    text: content,
    length: content.length,
    platform: 'reddit',
    commentCount: commentData.length
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

// --- ChatMate Sidebar Injection ---
(function initSidebar() {
  // Don't inject in iframes (nested contexts cause issues)
  if (window.self !== window.top) return;
  // Don't double-inject
  if (document.getElementById('chatmate-sidebar-container')) return;

  const SIDEBAR_WIDTH = 440;
  const SIDEBAR_ZINDEX = 2147483647;

  // Create sidebar container
  const container = document.createElement('div');
  container.id = 'chatmate-sidebar-container';
  container.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: ${SIDEBAR_WIDTH}px;
    height: 100vh;
    z-index: ${SIDEBAR_ZINDEX};
    background: transparent;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    transform: translateX(0);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  const iframe = document.createElement('iframe');
  iframe.id = 'chatmate-sidebar-iframe';
  iframe.src = chrome.runtime.getURL('sidebar.html');
  iframe.allow = 'clipboard-read; clipboard-write';
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    background: #fff;
    display: block;
  `;

  container.appendChild(iframe);

  // Create toggle button (always visible)
  const toggle = document.createElement('div');
  toggle.id = 'chatmate-sidebar-toggle';
  toggle.innerHTML = '💬';
  toggle.title = 'Toggle ChatMate sidebar';
  toggle.style.cssText = `
    position: fixed;
    top: 100px;
    right: ${SIDEBAR_WIDTH}px;
    width: 36px;
    height: 40px;
    z-index: ${SIDEBAR_ZINDEX - 1};
    background: #0d6efd;
    color: #fff;
    border-radius: 6px 0 0 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 18px;
    box-shadow: -2px 2px 6px rgba(0,0,0,0.2);
    transition: right 0.3s ease;
    user-select: none;
  `;

  // Append to page
  document.body.appendChild(container);
  document.body.appendChild(toggle);

  // Visibility state
  let visible = true;
  chrome.storage.local.get(['sidebarVisible'], function(result) {
    if (result.sidebarVisible === false) {
      visible = false;
      container.style.transform = `translateX(100%)`;
      toggle.style.right = '0';
    }
  });

  // Toggle handler
  toggle.addEventListener('click', function() {
    visible = !visible;
    if (visible) {
      container.style.transform = 'translateX(0)';
      toggle.style.right = SIDEBAR_WIDTH + 'px';
    } else {
      container.style.transform = 'translateX(100%)';
      toggle.style.right = '0';
    }
    chrome.storage.local.set({sidebarVisible: visible});
  });

  // Listen for messages from sidebar iframe (popup.html running inside)
  window.addEventListener('message', function(event) {
    // Only respond to our sidebar iframe
    if (!iframe.contentWindow) return;
    if (event.source !== iframe.contentWindow) {
      // Could be from nested iframe (popup.html inside sidebar.html)
      // Check if event.source is a descendant of our iframe
      try {
        let src = event.source;
        while (src && src !== iframe.contentWindow) {
          src = src.parent;
          if (src === window) return; // reached top, not our iframe
        }
        if (!src) return;
      } catch (e) {
        // Cross-origin access error means it's not our iframe
        return;
      }
    }

    const msg = event.data;
    if (!msg || !msg._chatmate) return;

    let result = null;
    if (msg.action === 'getSelectedText') {
      result = {text: window.getSelection().toString().trim()};
    } else if (msg.action === 'getPageContext') {
      result = {context: extractPageContext(msg.maxLength || 4000)};
    } else if (msg.action === 'insertText') {
      result = {success: insertTextIntoActiveElement(msg.text)};
    }

    // Send response back to the source iframe
    if (event.source && event.source.postMessage) {
      event.source.postMessage({
        _chatmateResponse: true,
        _id: msg._id,
        result: result
      }, '*');
    }
  });

  // Also handle direct toggle requests from sidebar wrapper
  window.addEventListener('message', function(event) {
    if (event.source !== iframe.contentWindow) return;
    const msg = event.data;
    if (msg && msg.action === 'toggleSidebar') {
      toggle.click();
    }
  });
})();

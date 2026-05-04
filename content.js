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
    const context = extractPageContext(request.maxLength || 4000, request.skipPromoted);
    sendResponse({context: context});
    return true;
  }
});

function extractPageContext(maxLength, skipPromoted) {
  const onReddit = isReddit();

  // Detect Reddit and use specialized extraction
  if (onReddit) {
    return extractRedditContext(maxLength, skipPromoted);
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

    // On Reddit, also strip promoted/sponsored posts if user opted in
    if (onReddit && skipPromoted) {
      removeSelectors.push(
        '[data-testid="ad-post"]', '.promotedlink',
        '[data-testid="promoted-post"]', '[data-adclicklocation]'
      );
    }

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

function extractRedditContext(maxLength, skipPromoted) {
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
      // Skip promoted post titles when user opted in
      if (skipPromoted && isPromotedElement(el)) continue;
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
      if (skipPromoted && isPromotedElement(el)) continue;
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
      if (skipPromoted && isPromotedElement(comment)) return;
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
      if (skipPromoted && isPromotedElement(comment)) return;
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

// Heuristic: check if an element or its ancestors are clearly a promoted/sponsored post
function isPromotedElement(el) {
  if (!el) return false;
  // Check element and up to 3 ancestors for promoted markers
  let current = el;
  for (let i = 0; i < 4 && current; i++) {
    // Check data-testid and class names
    const testId = current.getAttribute && current.getAttribute('data-testid');
    if (testId && /ad|promoted|sponsored/i.test(testId)) return true;
    const cls = current.className;
    if (typeof cls === 'string' && /promoted|sponsored|ad-post/i.test(cls)) return true;
    // Check for explicit "Promoted" text label near the element
    if (current.innerText && /promoted\s*$/i.test(current.innerText.trim().split('\n')[0])) return true;
    current = current.parentElement;
  }
  return false;
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
  const POPUP_URL = chrome.runtime.getURL('popup.html?mode=sidebar');

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

  let useShadowDOM = false;
  let iframe = null;
  let shadowHost = null;

  // Try iframe first (best isolation, but blocked by strict CSP on some sites)
  iframe = document.createElement('iframe');
  iframe.id = 'chatmate-sidebar-iframe';
  iframe.src = POPUP_URL;
  iframe.allow = 'clipboard-read; clipboard-write';
  iframe.referrerPolicy = 'no-referrer';
  iframe.credentialless = true;
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

  // Detect iframe load failure (blocked by CSP or Chrome security)
  let iframeReady = false;
  const iframeCheckTimeout = setTimeout(function() {
    if (!iframeReady) {
      switchToShadowDOM();
    }
  }, 5000);

  iframe.addEventListener('load', function() {
    iframeReady = true;
    clearTimeout(iframeCheckTimeout);
  });

  function switchToShadowDOM() {
    if (useShadowDOM) return;
    useShadowDOM = true;

    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }

    shadowHost = document.createElement('div');
    shadowHost.id = 'chatmate-shadow-host';
    shadowHost.style.cssText = 'width: 100%; height: 100%;';
    container.appendChild(shadowHost);

    const shadow = shadowHost.attachShadow({mode: 'open'});

    shadow.innerHTML = `
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        .fallback-sidebar {
          width: 100%;
          height: 100vh;
          background: #f8f9fa;
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          color: #212529;
        }
        .fallback-header {
          height: 36px;
          background: #0d6efd;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          font-size: 13px;
          font-weight: 600;
          flex-shrink: 0;
        }
        .fallback-header button {
          background: none;
          border: none;
          color: #fff;
          font-size: 16px;
          cursor: pointer;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        .fallback-header button:hover { background: rgba(255,255,255,0.2); }
        .fallback-body {
          flex: 1;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
        }
        .fallback-input {
          width: 100%;
          padding: 10px;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          font-family: inherit;
          font-size: 14px;
          resize: vertical;
          min-height: 80px;
        }
        .fallback-btn {
          background: #0d6efd;
          color: white;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        }
        .fallback-btn:hover { background: #0b5ed7; }
        .fallback-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .fallback-response {
          background: #f1f3f4;
          padding: 12px;
          border-radius: 8px;
          font-size: 14px;
          line-height: 1.6;
          white-space: pre-wrap;
          word-wrap: break-word;
          border: 1px solid #dee2e6;
          max-height: 300px;
          overflow-y: auto;
          display: none;
        }
        .fallback-response.show { display: block; }
        .fallback-error {
          background: #f8d7da;
          color: #721c24;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
          display: none;
          border: 1px solid rgba(220, 53, 69, 0.3);
        }
        .fallback-error.show { display: block; }
        .fallback-info {
          font-size: 12px;
          color: #6c757d;
          line-height: 1.5;
        }
        .fallback-actions {
          display: flex;
          gap: 8px;
        }
        .fallback-secondary {
          background: #f1f3f4;
          color: #212529;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          flex: 1;
        }
        .fallback-secondary:hover { background: #dee2e6; }
      </style>
      <div class="fallback-sidebar">
        <div class="fallback-header">
          <span>💬 ChatMate</span>
          <button id="fallback-close" title="Hide sidebar">✕</button>
        </div>
        <div class="fallback-body">
          <div class="fallback-info">
            <strong>Sidebar mode unavailable on this site.</strong><br>
            This website blocks embedded frames. Use the toolbar icon to open ChatMate in a popup, or type below to generate replies directly.
          </div>
          <textarea id="fallback-input" class="fallback-input" placeholder="What do you want to reply to?"></textarea>
          <button id="fallback-generate" class="fallback-btn">✨ Write a Reply</button>
          <div id="fallback-error" class="fallback-error"></div>
          <div id="fallback-response" class="fallback-response"></div>
          <div class="fallback-actions" id="fallback-actions" style="display: none;">
            <button id="fallback-copy" class="fallback-secondary">📋 Copy</button>
            <button id="fallback-paste" class="fallback-secondary">📥 Paste</button>
          </div>
        </div>
      </div>
    `;

    const fallbackInput = shadow.getElementById('fallback-input');
    const fallbackGenerate = shadow.getElementById('fallback-generate');
    const fallbackError = shadow.getElementById('fallback-error');
    const fallbackResponse = shadow.getElementById('fallback-response');
    const fallbackActions = shadow.getElementById('fallback-actions');
    const fallbackCopy = shadow.getElementById('fallback-copy');
    const fallbackPaste = shadow.getElementById('fallback-paste');
    const fallbackClose = shadow.getElementById('fallback-close');

    let fallbackSettings = null;
    let fallbackAbort = null;

    function showFallbackError(msg) {
      fallbackError.textContent = msg;
      fallbackError.classList.add('show');
    }
    function hideFallbackError() {
      fallbackError.classList.remove('show');
    }

    chrome.storage.local.get([
      'ollamaUrl', 'modelName', 'temperature', 'maxTokens',
      'templates', 'contextLimit', 'skipPromotedReddit'
    ], function(result) {
      fallbackSettings = {
        ollamaUrl: result.ollamaUrl,
        modelName: result.modelName || 'llama3',
        temperature: result.temperature || 0.7,
        maxTokens: result.maxTokens || 500,
        contextLimit: result.contextLimit || 4000,
        skipPromotedReddit: result.skipPromotedReddit !== false
      };
    });

    fallbackGenerate.addEventListener('click', async function() {
      if (fallbackGenerate.disabled) {
        if (fallbackAbort) fallbackAbort.abort();
        fallbackAbort = null;
        fallbackGenerate.disabled = false;
        fallbackGenerate.textContent = '✨ Write a Reply';
        return;
      }

      const text = fallbackInput.value.trim();
      if (!text) {
        showFallbackError('Type something first');
        return;
      }
      if (!fallbackSettings || !fallbackSettings.ollamaUrl) {
        showFallbackError('Open Settings and connect to your AI server');
        return;
      }

      hideFallbackError();
      fallbackGenerate.disabled = true;
      fallbackGenerate.textContent = '⚡ Thinking...';
      fallbackResponse.classList.remove('show');
      fallbackActions.style.display = 'none';
      fallbackResponse.textContent = '';

      fallbackAbort = new AbortController();

      let systemPrompt = 'You are a helpful friend. Write short, natural replies that sound like a real person texting. Use casual language, contractions, and occasional humor. Avoid corporate speak. Keep it under 3 sentences when possible.';
      const pageContext = extractPageContext(fallbackSettings.contextLimit, fallbackSettings.skipPromotedReddit);
      let userContent = '';
      if (pageContext && pageContext.text) {
        userContent += `Here is relevant context from the current page "${pageContext.title || ''}" (${pageContext.url || ''}):\n---\n${pageContext.text}\n---\n\n`;
      }
      userContent += `My question:\n${text}\n\nPlease answer based on the text above.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ];

      try {
        const res = await fetch(`${fallbackSettings.ollamaUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: fallbackSettings.modelName,
            messages: messages,
            stream: false,
            options: {
              temperature: fallbackSettings.temperature,
              num_predict: fallbackSettings.maxTokens
            }
          }),
          signal: fallbackAbort.signal
        });

        if (!res.ok) {
          throw new Error(`Ollama error: ${res.status}`);
        }
        const data = await res.json();
        const reply = data.message?.content || data.response || '';
        fallbackResponse.textContent = reply;
        fallbackResponse.classList.add('show');
        fallbackActions.style.display = 'flex';
      } catch (err) {
        if (err.name !== 'AbortError') {
          showFallbackError(err.message);
        }
      } finally {
        fallbackGenerate.disabled = false;
        fallbackGenerate.textContent = '✨ Write a Reply';
        fallbackAbort = null;
      }
    });

    fallbackCopy.addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(fallbackResponse.textContent);
      } catch (e) {}
    });

    fallbackPaste.addEventListener('click', function() {
      const inserted = insertTextIntoActiveElement(fallbackResponse.textContent);
      if (!inserted) {
        navigator.clipboard.writeText(fallbackResponse.textContent);
      }
    });

    fallbackClose.addEventListener('click', function() {
      toggle.click();
    });
  }

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
    if (useShadowDOM) return;
    if (!iframe || !iframe.contentWindow) return;
    if (event.source !== iframe.contentWindow) return;

    const msg = event.data;
    if (!msg || !msg._chatmate) return;

    let result = null;
    if (msg.action === 'getSelectedText') {
      result = {text: window.getSelection().toString().trim()};
    } else if (msg.action === 'getPageContext') {
      result = {context: extractPageContext(msg.maxLength || 4000, msg.skipPromoted)};
    } else if (msg.action === 'insertText') {
      result = {success: insertTextIntoActiveElement(msg.text)};
    }

    if (event.source && event.source.postMessage) {
      event.source.postMessage({
        _chatmateResponse: true,
        _id: msg._id,
        result: result
      }, '*');
    }
  });

  // Handle sidebar toggle requests from popup.html
  window.addEventListener('message', function(event) {
    if (useShadowDOM) return;
    if (!iframe || !iframe.contentWindow) return;
    if (event.source !== iframe.contentWindow) return;
    const msg = event.data;
    if (msg && msg.action === 'toggleSidebar') {
      toggle.click();
    }
  });
})();

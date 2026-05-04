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

  // --- IMAGES (generic pages) ---
  const images = extractGenericImages();

  return {
    url: window.location.href,
    title: document.title,
    text: content,
    length: content.length,
    images: images
  };
}

// Extract images from non-Reddit pages (up to 3, filtered for quality)
function extractGenericImages() {
  const candidates = [];
  const main = document.querySelector('article, main, [role="main"], .content, .post-content, .entry-content');
  const scope = main || document.body;
  const imgs = scope.querySelectorAll('img');
  imgs.forEach(img => {
    addImageCandidate(candidates, img);
  });

  // Also check CSS background-images on large divs inside main content
  if (main) {
    const divs = main.querySelectorAll('div');
    divs.forEach(div => {
      const style = window.getComputedStyle(div);
      const bg = style.backgroundImage;
      if (bg && bg.startsWith('url(') && bg !== 'none') {
        const url = bg.slice(4, -1).replace(/["']/g, '');
        const rect = div.getBoundingClientRect();
        if (rect.width >= 200 && rect.height >= 200) {
          candidates.push({
            el: null,
            url: url,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            area: rect.width * rect.height,
            alt: ''
          });
        }
      }
    });
  }

  // Deduplicate by URL and sort by size
  const seen = new Set();
  const unique = candidates.filter(c => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
  unique.sort((a, b) => (b.area || 0) - (a.area || 0));

  // For generic pages we only have URLs (no base64 from canvas since images may be cross-origin)
  return unique.slice(0, 3).map(c => ({
    url: c.url,
    base64: c.el ? imageToBase64(c.el) : null,
    alt: c.alt || '',
    width: c.width,
    height: c.height
  }));
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
  // Try multiple strategies to find comments, newest to oldest Reddit DOM variants
  const commentData = [];
  const seenAuthors = new Set(); // dedupe safeguard

  // Strategy 1: New Reddit data-testid comments (most common)
  const newComments = document.querySelectorAll('[data-testid="comment"]');
  if (newComments.length > 0) {
    newComments.forEach((comment, i) => {
      if (skipPromoted && isPromotedElement(comment)) return;
      // Use :scope > to avoid matching nested child comments' elements
      const authorEl = comment.querySelector(':scope > div [data-testid="comment_author_link"], :scope [data-testid="comment_author_link"]');
      // Try multiple content selectors — Reddit changes these often
      const bodyEl = comment.querySelector('[data-testid="comment-content"]')
        || comment.querySelector('[data-click-id="text"]')
        || comment.querySelector('.md')
        || comment.querySelector('[slot="comment"]')
        || comment.querySelector('div[data-testid="comment"] > div > div');
      if (bodyEl) {
        const author = cleanAuthor(authorEl ? authorEl.innerText : '');
        const body = cleanText(bodyEl.innerText);
        // Avoid duplicates (same author + same first 60 chars)
        const sig = (author + '|' + body.substring(0, 60)).toLowerCase();
        if (seenAuthors.has(sig)) return;
        seenAuthors.add(sig);
        commentData.push({ author: author || 'unknown', body, index: i + 1 });
      }
    });
  }

  // Strategy 2: shreddit-comment web component (Reddit's newer design system)
  if (commentData.length === 0) {
    const shredditComments = document.querySelectorAll('shreddit-comment');
    shredditComments.forEach((comment, i) => {
      if (skipPromoted && isPromotedElement(comment)) return;
      // Author might be in an anchor or span near the top
      const authorEl = comment.querySelector('a[href^="/user/"], a[href^="/u/"], .author-name, [data-testid="comment_author_link"]');
      // Content might be in a specific slot or child div
      const bodyEl = comment.querySelector('[slot="comment"], .comment-body, [data-testid="comment-content"], .md');
      if (bodyEl) {
        const author = cleanAuthor(authorEl ? (authorEl.getAttribute('href') || authorEl.innerText) : '');
        const body = cleanText(bodyEl.innerText);
        const sig = (author + '|' + body.substring(0, 60)).toLowerCase();
        if (seenAuthors.has(sig)) return;
        seenAuthors.add(sig);
        commentData.push({ author: author || 'unknown', body, index: i + 1 });
      }
    });
  }

  // Strategy 3: Old Reddit / RES fallback
  if (commentData.length === 0) {
    const oldComments = document.querySelectorAll('.comment, .entry');
    oldComments.forEach((comment, i) => {
      if (skipPromoted && isPromotedElement(comment)) return;
      const authorEl = comment.querySelector('.author');
      const bodyEl = comment.querySelector('.usertext-body .md');
      if (bodyEl) {
        const author = cleanAuthor(authorEl ? authorEl.innerText : '');
        const body = cleanText(bodyEl.innerText);
        const sig = (author + '|' + body.substring(0, 60)).toLowerCase();
        if (seenAuthors.has(sig)) return;
        seenAuthors.add(sig);
        commentData.push({ author: author || 'unknown', body, index: i + 1 });
      }
    });
  }

  // Strategy 4: Last resort — grab any element that looks like a comment tree item
  if (commentData.length === 0) {
    const treeItems = document.querySelectorAll('[class*="comment"], [class*="Comment"]');
    treeItems.forEach((el, i) => {
      if (skipPromoted && isPromotedElement(el)) return;
      // Skip very small elements (likely icons, buttons)
      if (el.innerText.length < 30) return;
      const text = cleanText(el.innerText);
      // Try to extract author from nearby links
      const authorEl = el.querySelector('a[href*="/user/"], a[href*="/u/"]');
      const author = cleanAuthor(authorEl ? (authorEl.getAttribute('href') || authorEl.innerText) : '');
      const sig = (author + '|' + text.substring(0, 60)).toLowerCase();
      if (seenAuthors.has(sig)) return;
      seenAuthors.add(sig);
      commentData.push({ author: author || 'unknown', body: text, index: i + 1 });
    });
  }

  // Add comments to parts
  if (commentData.length > 0) {
    parts.push('[COMMENTS]');
    commentData.slice(0, 30).forEach(c => {
      parts.push(`Comment #${c.index} by u/${c.author}:\n${c.body}`);
    });
    if (commentData.length > 30) {
      parts.push(`... and ${commentData.length - 30} more comments`);
    }
  }

  let content = parts.join('\n\n');

  // Truncate intelligently: keep post info, truncate comments if needed
  if (content.length > maxLength) {
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

  // --- IMAGES ---
  const images = extractRedditImages(skipPromoted);

  // Build debug info for the popup
  const debugAuthors = commentData.slice(0, 10).map(c => c.author);

  return {
    url: window.location.href,
    title: document.title,
    text: content,
    length: content.length,
    platform: 'reddit',
    commentCount: commentData.length,
    images: images,
    debug: {
      strategiesTried: [
        newComments.length > 0 ? `data-testid="comment": ${newComments.length} found` : 'data-testid="comment": 0',
        document.querySelectorAll('shreddit-comment').length > 0 ? `shreddit-comment: ${document.querySelectorAll('shreddit-comment').length} found` : 'shreddit-comment: 0',
        document.querySelectorAll('.comment').length > 0 ? `class="comment": ${document.querySelectorAll('.comment').length} found` : 'class="comment": 0'
      ],
      extractedAuthors: debugAuthors,
      finalCount: commentData.length
    }
  };
}

// Clean author name: remove "OP", "MOD", timestamps, and extra whitespace
function cleanAuthor(raw) {
  if (!raw) return '';
  let name = raw.toString().trim();
  // Remove "u/" prefix if present from href attributes
  name = name.replace(/^\/?u\//, '');
  // Remove "OP" or "MOD" badges that appear next to usernames
  name = name.replace(/\s*(OP|MOD)\s*$/i, '');
  // Remove common trailing text like "• 2h ago"
  name = name.replace(/\s+[•·]\s+.*$/, '');
  // Clean whitespace
  name = name.replace(/\s+/g, ' ').trim();
  return name;
}

// Extract image URLs from a Reddit post (up to 3, filtered for quality)
function extractRedditImages(skipPromoted) {
  const candidates = [];

  // New Reddit: main post images
  const postContent = document.querySelector('[data-testid="post-content"]');
  if (postContent) {
    const imgs = postContent.querySelectorAll('img');
    imgs.forEach(img => {
      if (skipPromoted && isPromotedElement(img)) return;
      addImageCandidate(candidates, img);
    });
  }

  // Old Reddit: thumbnail / expando images
  const oldPost = document.querySelector('.thing');
  if (oldPost) {
    const thumb = oldPost.querySelector('.thumbnail img');
    if (thumb) addImageCandidate(candidates, thumb);
    const expandoImgs = oldPost.querySelectorAll('.expando img');
    expandoImgs.forEach(img => addImageCandidate(candidates, img));
  }

  // New Reddit: standalone post image (when post is just an image)
  const mediaImgs = document.querySelectorAll('img[src*="i.redd.it"], img[src*="preview.redd.it"]');
  mediaImgs.forEach(img => {
    if (skipPromoted && isPromotedElement(img)) return;
    addImageCandidate(candidates, img);
  });

  // Inline images in post body / comments (markdown-rendered)
  const inlineImgs = document.querySelectorAll('.md img, [data-testid="comment-content"] img');
  inlineImgs.forEach(img => {
    if (skipPromoted && isPromotedElement(img)) return;
    addImageCandidate(candidates, img);
  });

  // Deduplicate by URL and sort by size (largest first)
  const seen = new Set();
  const unique = candidates.filter(c => {
    if (!c.url || seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });
  unique.sort((a, b) => (b.area || 0) - (a.area || 0));

  // Take top 3 and try to convert to base64
  return unique.slice(0, 3).map(c => {
    const base64 = imageToBase64(c.el);
    return {
      url: c.url,
      base64: base64,
      alt: c.alt || '',
      width: c.width,
      height: c.height
    };
  });
}

function addImageCandidate(list, img) {
  const url = getImageUrl(img);
  if (!url) return;
  const w = img.naturalWidth || img.width || 0;
  const h = img.naturalHeight || img.height || 0;
  // Skip tiny icons, avatars, tracking pixels
  if (w < 100 || h < 100) return;
  // Skip likely ads / sponsored overlays
  if (img.closest('.ads, .advertisement, [data-testid="ad-post"]')) return;
  list.push({
    el: img,
    url: url,
    width: w,
    height: h,
    area: w * h,
    alt: img.alt || img.getAttribute('aria-label') || ''
  });
}

function getImageUrl(img) {
  const src = img.currentSrc || img.src;
  if (!src) return null;
  // Skip data URIs (already handled) and SVG icons
  if (src.startsWith('data:') || src.endsWith('.svg')) return null;
  // Convert preview.redd.it thumbnails to higher-res if possible
  if (src.includes('preview.redd.it')) {
    // Try to get full resolution by removing size suffixes like ?width=...
    try {
      const url = new URL(src);
      url.searchParams.delete('width');
      url.searchParams.delete('height');
      return url.toString();
    } catch (e) {
      return src;
    }
  }
  return src;
}

// Try to convert an <img> element to base64 JPEG via canvas.
// Returns null if the image isn't loaded or CORS taints the canvas.
function imageToBase64(img, maxDim = 1024, quality = 0.85) {
  try {
    if (!img.complete) return null;
    let w = img.naturalWidth || 0;
    let h = img.naturalHeight || 0;
    if (!w || !h) return null;
    // Resize if too large
    if (w > maxDim || h > maxDim) {
      const scale = Math.min(maxDim / w, maxDim / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    // Strip the data:image/jpeg;base64, prefix
    return dataUrl.replace(/^data:image\/jpeg;base64,/, '');
  } catch (e) {
    // CORS taint or other error
    return null;
  }
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
  if (window.self !== window.top) return;
  if (document.getElementById('chatmate-sidebar-container')) return;

  const SIDEBAR_WIDTH = 440;
  const SIDEBAR_MARGIN = 12;
  const SIDEBAR_ZINDEX = 2147483647;
  const POPUP_URL = chrome.runtime.getURL('popup.html?mode=sidebar');

  const COLORS = {
    light: { btn: '#4f46e5', btnGlow: 'rgba(79,70,229,0.35)', containerBg: '#ffffff' },
    dark: { btn: '#818cf8', btnGlow: 'rgba(129,140,248,0.4)', containerBg: '#1a1a2e' }
  };

  let expanded = true;
  let useShadowDOM = false;
  let iframe = null;
  let shadowHost = null;

  // --- Container (expanded sidebar) ---
  const container = document.createElement('div');
  container.id = 'chatmate-sidebar-container';
  container.style.cssText = `
    position: fixed;
    top: ${SIDEBAR_MARGIN}px;
    right: ${SIDEBAR_MARGIN}px;
    bottom: ${SIDEBAR_MARGIN}px;
    width: ${SIDEBAR_WIDTH}px;
    z-index: ${SIDEBAR_ZINDEX};
    border-radius: 16px 0 0 16px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
    border: 1px solid rgba(0,0,0,0.06);
    background: rgba(255,255,255,0.98);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.25s ease;
    transform: translateX(0);
    opacity: 1;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  `;

  // --- Iframe ---
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
    background: transparent;
    display: block;
  `;
  container.appendChild(iframe);

  // Inject pulse animation for floating button
  const pulseStyle = document.createElement('style');
  pulseStyle.textContent = `
    @keyframes chatmate-pulse {
      0%, 100% { box-shadow: 0 4px 16px rgba(79,70,229,0.35), 0 0 0 0 rgba(79,70,229,0.3); }
      50% { box-shadow: 0 4px 20px rgba(79,70,229,0.45), 0 0 0 10px rgba(79,70,229,0); }
    }
    @keyframes chatmate-pulse-dark {
      0%, 100% { box-shadow: 0 4px 16px rgba(129,140,248,0.4), 0 0 0 0 rgba(129,140,248,0.3); }
      50% { box-shadow: 0 4px 20px rgba(129,140,248,0.5), 0 0 0 10px rgba(129,140,248,0); }
    }
  `;
  document.head.appendChild(pulseStyle);

  // --- Minimized floating button ---
  const miniBtn = document.createElement('div');
  miniBtn.id = 'chatmate-mini-btn';
  miniBtn.title = 'Open ChatMate';
  miniBtn.innerHTML = '💬';
  miniBtn.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    width: 50px;
    height: 50px;
    z-index: ${SIDEBAR_ZINDEX};
    background: ${COLORS.light.btn};
    color: #fff;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 22px;
    box-shadow: 0 4px 16px ${COLORS.light.btnGlow};
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    opacity: 0;
    pointer-events: none;
    transform: scale(0.8);
    user-select: none;
    animation: chatmate-pulse 2.5s ease-in-out infinite;
    border: 2px solid rgba(255,255,255,0.15);
  `;

  // Tooltip for mini button
  const miniTooltip = document.createElement('div');
  miniTooltip.id = 'chatmate-mini-tooltip';
  miniTooltip.textContent = 'ChatMate';
  miniTooltip.style.cssText = `
    position: fixed;
    top: 100px;
    right: 78px;
    z-index: ${SIDEBAR_ZINDEX};
    background: rgba(30,30,45,0.85);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    color: #fff;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.2s ease, transform 0.2s ease;
    transform: translateX(4px);
    user-select: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    font-weight: 600;
    letter-spacing: 0.2px;
  `;

  miniBtn.addEventListener('mouseenter', () => {
    miniTooltip.style.opacity = '1';
    miniTooltip.style.transform = 'translateX(0)';
    miniBtn.style.transform = 'scale(1.08)';
    miniBtn.style.animation = 'none';
  });
  miniBtn.addEventListener('mouseleave', () => {
    miniTooltip.style.opacity = '0';
    miniTooltip.style.transform = 'translateX(4px)';
    miniBtn.style.transform = 'scale(1)';
    const isDark = container.style.background === COLORS.dark.containerBg;
    miniBtn.style.animation = isDark ? 'chatmate-pulse-dark 2.5s ease-in-out infinite' : 'chatmate-pulse 2.5s ease-in-out infinite';
  });

  document.body.appendChild(container);
  document.body.appendChild(miniBtn);
  document.body.appendChild(miniTooltip);

  // --- Dark mode theming ---
  function applySidebarTheme(theme) {
    const isDark = theme === 'dark';
    const c = isDark ? COLORS.dark : COLORS.light;
    container.style.background = isDark ? 'rgba(26,26,46,0.98)' : 'rgba(255,255,255,0.98)';
    container.style.borderColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    container.style.boxShadow = isDark
      ? '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.2)'
      : '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)';
    miniBtn.style.background = c.btn;
    miniBtn.style.boxShadow = `0 4px 16px ${c.btnGlow}`;
    miniBtn.style.animation = isDark ? 'chatmate-pulse-dark 2.5s ease-in-out infinite' : 'chatmate-pulse 2.5s ease-in-out infinite';
  }

  // Listen for theme changes from popup
  chrome.storage.onChanged.addListener(function(changes, area) {
    if (area === 'local' && changes.theme) {
      applySidebarTheme(changes.theme.newValue);
    }
  });

  // --- Minimize / Expand ---
  function minimizeSidebar() {
    expanded = false;
    container.style.transform = `translateX(calc(100% + ${SIDEBAR_MARGIN * 3}px))`;
    container.style.opacity = '0';
    miniBtn.style.opacity = '1';
    miniBtn.style.pointerEvents = 'auto';
    miniBtn.style.transform = 'scale(1)';
    chrome.storage.local.set({sidebarExpanded: false});
  }

  function expandSidebar() {
    expanded = true;
    container.style.transform = 'translateX(0)';
    container.style.opacity = '1';
    miniBtn.style.opacity = '0';
    miniBtn.style.pointerEvents = 'none';
    miniBtn.style.transform = 'scale(0.8)';
    miniTooltip.style.opacity = '0';
    chrome.storage.local.set({sidebarExpanded: true});
  }

  miniBtn.addEventListener('click', expandSidebar);

  // Detect iframe load failure
  let iframeReady = false;
  const iframeCheckTimeout = setTimeout(function() {
    if (!iframeReady) switchToShadowDOM();
  }, 5000);

  iframe.addEventListener('load', function() {
    iframeReady = true;
    clearTimeout(iframeCheckTimeout);
  });

  // --- Shadow DOM fallback ---
  function switchToShadowDOM() {
    if (useShadowDOM) return;
    useShadowDOM = true;
    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);

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
          height: 100%;
          background: var(--fb-bg, #f8f9fa);
          display: flex;
          flex-direction: column;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          color: var(--fb-text, #212529);
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
          background: none; border: none; color: #fff;
          font-size: 16px; cursor: pointer;
          width: 28px; height: 28px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 4px;
        }
        .fallback-header button:hover { background: rgba(255,255,255,0.2); }
        .fallback-body {
          flex: 1; padding: 16px;
          display: flex; flex-direction: column; gap: 12px;
          overflow-y: auto;
        }
        .fallback-input {
          width: 100%; padding: 10px;
          border: 1px solid var(--fb-border, #dee2e6);
          border-radius: 8px;
          font-family: inherit; font-size: 14px;
          resize: vertical; min-height: 80px;
          background: var(--fb-card, #fff);
          color: var(--fb-text, #212529);
        }
        .fallback-btn {
          background: #0d6efd; color: white;
          border: none; padding: 10px 16px;
          border-radius: 8px; cursor: pointer;
          font-size: 14px; font-weight: 500;
        }
        .fallback-btn:hover { background: #0b5ed7; }
        .fallback-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .fallback-response {
          background: var(--fb-response, #f1f3f4);
          padding: 12px; border-radius: 8px;
          font-size: 14px; line-height: 1.6;
          white-space: pre-wrap; word-wrap: break-word;
          border: 1px solid var(--fb-border, #dee2e6);
          max-height: 300px; overflow-y: auto;
          display: none; color: var(--fb-text, #212529);
        }
        .fallback-response.show { display: block; }
        .fallback-error {
          background: #f8d7da; color: #721c24;
          padding: 10px; border-radius: 8px;
          font-size: 13px; display: none;
          border: 1px solid rgba(220,53,69,0.3);
        }
        .fallback-error.show { display: block; }
        .fallback-info {
          font-size: 12px; color: var(--fb-muted, #6c757d); line-height: 1.5;
        }
        .fallback-actions { display: flex; gap: 8px; }
        .fallback-secondary {
          background: var(--fb-response, #f1f3f4);
          color: var(--fb-text, #212529);
          border: none; padding: 8px 12px;
          border-radius: 8px; cursor: pointer;
          font-size: 13px; flex: 1;
        }
        .fallback-secondary:hover { background: var(--fb-border, #dee2e6); }
      </style>
      <div class="fallback-sidebar" id="fb-root">
        <div class="fallback-header">
          <span>💬 ChatMate</span>
          <button id="fallback-minimize" title="Minimize sidebar">🗕</button>
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

    const fbRoot = shadow.getElementById('fb-root');
    const fallbackInput = shadow.getElementById('fallback-input');
    const fallbackGenerate = shadow.getElementById('fallback-generate');
    const fallbackError = shadow.getElementById('fallback-error');
    const fallbackResponse = shadow.getElementById('fallback-response');
    const fallbackActions = shadow.getElementById('fallback-actions');
    const fallbackCopy = shadow.getElementById('fallback-copy');
    const fallbackPaste = shadow.getElementById('fallback-paste');
    const fallbackMinimize = shadow.getElementById('fallback-minimize');

    let fallbackSettings = null;
    let fallbackAbort = null;

    function showFallbackError(msg) {
      fallbackError.textContent = msg;
      fallbackError.classList.add('show');
    }
    function hideFallbackError() {
      fallbackError.classList.remove('show');
    }

    function applyFallbackTheme(theme) {
      const isDark = theme === 'dark';
      if (isDark) {
        fbRoot.style.setProperty('--fb-bg', '#1a1a2e');
        fbRoot.style.setProperty('--fb-text', '#e0e0e0');
        fbRoot.style.setProperty('--fb-card', '#16213e');
        fbRoot.style.setProperty('--fb-border', '#0f3460');
        fbRoot.style.setProperty('--fb-response', '#0f3460');
        fbRoot.style.setProperty('--fb-muted', '#a0a0a0');
      } else {
        fbRoot.style.setProperty('--fb-bg', '#f8f9fa');
        fbRoot.style.setProperty('--fb-text', '#212529');
        fbRoot.style.setProperty('--fb-card', '#ffffff');
        fbRoot.style.setProperty('--fb-border', '#dee2e6');
        fbRoot.style.setProperty('--fb-response', '#f1f3f4');
        fbRoot.style.setProperty('--fb-muted', '#6c757d');
      }
    }

    // Build a Markdown formatting instruction from enabled Reddit formatting toggles.
    function buildFormattingInstruction(fmt) {
      if (!fmt) return '';
      const items = [];
      if (fmt.bold) items.push('bold (**text**)');
      if (fmt.italic) items.push('italic (*text*)');
      if (fmt.heading) items.push('headings (# ## ###)');
      if (fmt.bullet) items.push('bullet lists (* item)');
      if (fmt.numlist) items.push('numbered lists (1. item)');
      if (fmt.quote) items.push('quote blocks (> text)');
      if (fmt.inlinecode) items.push('inline code (`code`)');
      if (fmt.codeblock) items.push('code blocks (```code```)');
      if (fmt.table) items.push('tables (| col |)');
      if (items.length === 0) return '';
      return ' FORMATTING: When writing your Reddit reply, you MAY use the following Markdown styles where appropriate: ' + items.join(', ') + '. Do NOT use styles that are not listed here. Use formatting naturally — do not over-format.';
    }

    chrome.storage.local.get([
      'ollamaUrl', 'modelName', 'temperature', 'maxTokens',
      'templates', 'contextLimit', 'skipPromotedReddit', 'theme',
      'redditFormatting'
    ], function(result) {
      fallbackSettings = {
        ollamaUrl: result.ollamaUrl,
        modelName: result.modelName || '',
        temperature: result.temperature || 0.7,
        maxTokens: result.maxTokens || 500,
        contextLimit: result.contextLimit || 4000,
        skipPromotedReddit: result.skipPromotedReddit !== false,
        redditFormatting: result.redditFormatting || {}
      };
      applyFallbackTheme(result.theme || 'light');
    });

    chrome.storage.onChanged.addListener(function(changes, area) {
      if (area === 'local' && changes.theme) {
        applyFallbackTheme(changes.theme.newValue);
      }
    });

    fallbackMinimize.addEventListener('click', minimizeSidebar);

    fallbackGenerate.addEventListener('click', async function() {
      if (fallbackGenerate.disabled) {
        if (fallbackAbort) fallbackAbort.abort();
        fallbackAbort = null;
        fallbackGenerate.disabled = false;
        fallbackGenerate.textContent = '✨ Write a Reply';
        return;
      }

      const text = fallbackInput.value.trim();
      if (!text) { showFallbackError('Type something first'); return; }
      if (!fallbackSettings || !fallbackSettings.ollamaUrl) {
        showFallbackError('Open Settings and connect to your AI server'); return;
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

      // If on Reddit and formatting toggles are enabled, append formatting instruction
      if (pageContext && pageContext.platform === 'reddit' && fallbackSettings.redditFormatting) {
        const fmtInstr = buildFormattingInstruction(fallbackSettings.redditFormatting);
        if (fmtInstr) {
          systemPrompt += '\n\n' + fmtInstr;
        }
      }

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
        if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
        const data = await res.json();
        const reply = data.message?.content || data.response || '';
        fallbackResponse.textContent = reply;
        fallbackResponse.classList.add('show');
        fallbackActions.style.display = 'flex';
      } catch (err) {
        if (err.name !== 'AbortError') showFallbackError(err.message);
      } finally {
        fallbackGenerate.disabled = false;
        fallbackGenerate.textContent = '✨ Write a Reply';
        fallbackAbort = null;
      }
    });

    fallbackCopy.addEventListener('click', async function() {
      try { await navigator.clipboard.writeText(fallbackResponse.textContent); } catch (e) {}
    });

    fallbackPaste.addEventListener('click', function() {
      const inserted = insertTextIntoActiveElement(fallbackResponse.textContent);
      if (!inserted) navigator.clipboard.writeText(fallbackResponse.textContent);
    });
  }

  // --- Restore saved state ---
  chrome.storage.local.get(['sidebarExpanded', 'theme'], function(result) {
    applySidebarTheme(result.theme || 'light');
    if (result.sidebarExpanded === false) {
      expanded = false;
      container.style.transform = `translateX(calc(100% + ${SIDEBAR_MARGIN * 3}px))`;
      container.style.opacity = '0';
      miniBtn.style.opacity = '1';
      miniBtn.style.pointerEvents = 'auto';
      miniBtn.style.transform = 'scale(1)';
    }
  });

  // --- Message handlers ---
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
      event.source.postMessage({ _chatmateResponse: true, _id: msg._id, result: result }, '*');
    }
  });

  window.addEventListener('message', function(event) {
    if (useShadowDOM) return;
    if (!iframe || !iframe.contentWindow) return;
    if (event.source !== iframe.contentWindow) return;
    const msg = event.data;
    if (msg && msg.action === 'toggleSidebar') {
      expanded ? minimizeSidebar() : expandSidebar();
    }
  });
})();

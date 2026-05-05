document.addEventListener('DOMContentLoaded', function() {
  // Check if Chrome extension APIs are available
  function storageAvailable() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
  }

  // DOM Elements
  const inputText = document.getElementById('input-text');
  const templateSelect = document.getElementById('template-select');
  const generateBtn = document.getElementById('generate-btn');
  const loading = document.getElementById('loading');
  const loadingText = document.getElementById('loading-text');
  const error = document.getElementById('error');
  const responsesContainer = document.getElementById('responses-container');
  const variantSelector = document.getElementById('variant-selector');
  const responseCards = [
    document.getElementById('response-0'),
    document.getElementById('response-1'),
    document.getElementById('response-2')
  ];
  const copyBtn = document.getElementById('copy-btn');
  const clearBtn = document.getElementById('clear-btn');
  const pasteBtn = document.getElementById('paste-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const statusBadge = document.getElementById('status-badge');
  const footerInfo = document.getElementById('footer-info');
  const toast = document.getElementById('toast');
  const pagePreview = document.getElementById('page-preview');
  const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
  const topbarMinimizeBtn = document.getElementById('topbar-minimize-btn');
  const grabTextBtn = document.getElementById('grab-text-btn');
  const readPageBtn = document.getElementById('read-page-btn');
  const responsesEmpty = document.getElementById('responses-empty');
  const feedbackBar = document.getElementById('feedback-bar');
  const feedbackUp = document.getElementById('feedback-up');
  const feedbackDown = document.getElementById('feedback-down');
  const feedbackThanks = document.getElementById('feedback-thanks');

  // State
  let currentSettings = null;
  let currentTemplateId = '';
  let currentInput = '';
  let activeVariant = 0;
  let isGenerating = false;
  let abortController = null;
  let currentPageContext = null;
  let storedPageText = null;
  let storedPageImages = null;

  // Anti-hallucination guard: every prompt ends with this instruction
  const ON_TOPIC_GUARD = 'CRITICAL RULES: 1) You MUST use ONLY the provided text context above. Do NOT invent topics, facts, or platforms not in the text. 2) If the user asks you to reply to a specific Reddit user or comment, you MUST reply DIRECTLY to that comment and ONLY that comment. Do NOT reply to other commenters, do NOT summarize other people\'s comments, do NOT say "I agree with [other commenter]", do NOT mention other users at all. 3) Do NOT reply about Slack, Discord, email etiquette, social media, or other platforms unless the context EXPLICITLY mentions them. 4) If the context does not contain what the user is asking about, say so — do NOT guess or hallucinate. 5) Keep your reply focused and relevant to the specific comment you are replying to.';

  // Built-in high-quality templates that ship with the extension
  const BUILTIN_TEMPLATES = [
    { id: '__casual__', name: 'Casual', prompt: 'You are a helpful friend. Write short, natural replies that sound like a real person texting. Use casual language, contractions (it\'s, don\'t, gonna), and occasional humor. Avoid corporate speak, formal greetings, and sign-offs. Keep it under 3 sentences when possible. Match the energy of the message you are replying to. ' + ON_TOPIC_GUARD },
    { id: '__short__', name: 'Short & Sweet', prompt: 'Reply as briefly as possible while still being helpful. One or two sentences max. No fluff, no preamble, no "I hope this helps" endings. Get straight to the point. Sound like a busy person who values clarity. ' + ON_TOPIC_GUARD },
    { id: '__friendly__', name: 'Warm & Friendly', prompt: 'You are a warm, supportive friend. Use an encouraging, positive tone. Add a little personality — maybe an emoji or an exclamation point. Keep it genuine, not overly enthusiastic. Sound like someone who genuinely cares about the person they are talking to. ' + ON_TOPIC_GUARD },
    { id: '__witty__', name: 'Witty', prompt: 'You have a dry, clever sense of humor. Reply with a touch of wit or a light joke when appropriate. Keep it tasteful — never mean-spirited. Your replies should make the reader smile. Still be helpful and answer the question. ' + ON_TOPIC_GUARD },
    { id: '__professional__', name: 'Polished', prompt: 'You are a clear, articulate professional. Write concise, well-structured replies. Use proper grammar but avoid stiff corporate language. No "Dear Sir/Madam" or "Best regards." Just a straightforward, competent response that sounds like a smart colleague. ' + ON_TOPIC_GUARD },
    { id: '__copywriter__', name: 'Copywriter', prompt: 'You are a skilled copywriter. Write persuasive, engaging content that drives action. Use power words, emotional triggers, and clear calls-to-action. Keep sentences punchy and paragraphs short. Focus on benefits over features. Write in an active voice. Make every word count. ' + ON_TOPIC_GUARD },
    { id: '__sales__', name: 'Sales & Marketing', prompt: 'You are a sales professional. Write replies that build rapport, address objections, and guide toward a solution. Use a consultative approach — ask questions to understand needs. Be confident but not pushy. Focus on value and results. Keep it conversational and authentic. ' + ON_TOPIC_GUARD },
    { id: '__educational__', name: 'Educational', prompt: 'You are a patient teacher. Explain concepts clearly and simply. Use analogies and examples to make complex ideas understandable. Break down information into digestible chunks. Be encouraging and supportive. Avoid jargon unless you explain it. Check for understanding. ' + ON_TOPIC_GUARD },
    { id: '__debate__', name: 'Debate & Discuss', prompt: 'You are a thoughtful debater. Write constructive, well-reasoned responses that advance the discussion. Acknowledge valid points from others while presenting your perspective. Use evidence and logic, not just opinion. Be respectful even when disagreeing. Focus on finding common ground. ' + ON_TOPIC_GUARD },
    { id: '__support__', name: 'Customer Support', prompt: 'You are a helpful customer support agent. Write empathetic, solution-oriented responses. Acknowledge the user\'s frustration or concern first. Apologize sincerely when appropriate. Offer clear next steps or solutions. Be patient and understanding. Follow up to ensure resolution. ' + ON_TOPIC_GUARD },
    // Reddit-specific templates
    { id: '__reddit_helpful__', name: 'Reddit Helpful', prompt: 'You are a helpful Reddit community member. Write informative, constructive replies that add value to the discussion. Be concise but thorough. Cite sources or provide evidence when possible. Be respectful and follow Reddiquette. Avoid low-effort comments like "this" or "nice post". ' + ON_TOPIC_GUARD, reddit: true, redditFormatting: { bold: true, italic: true, quote: true, bullet: true, codeblock: true } },
    { id: '__reddit_tech__', name: 'Reddit Tech', prompt: 'You are a knowledgeable tech enthusiast. Write technical replies with accurate information. Use proper terminology but explain it clearly. Be helpful to beginners and advanced users alike. Focus on solving problems and sharing knowledge. Use code blocks for technical content. ' + ON_TOPIC_GUARD, reddit: true, redditFormatting: { bold: true, italic: true, codeblock: true, inlinecode: true, quote: true } },
    { id: '__reddit_explainer__', name: 'Reddit ELI5', prompt: 'You explain complex topics as if the reader is 5 years old. Use simple analogies, everyday examples, and plain language. Avoid jargon entirely. Break down concepts into the simplest possible terms. Be patient and encouraging. Make learning fun and accessible. ' + ON_TOPIC_GUARD, reddit: true, redditFormatting: { bold: true, italic: true, bullet: true } },
    { id: '__reddit_skeptical__', name: 'Reddit Skeptical', prompt: 'You are a critical thinker who asks probing questions. Challenge assumptions politely but firmly. Request evidence and sources. Point out logical fallacies or inconsistencies. Be respectful but don\'t accept claims at face value. Promote fact-based discussion. ' + ON_TOPIC_GUARD, reddit: true, redditFormatting: { bold: true, italic: true, quote: true } },
    { id: '__reddit_encouraging__', name: 'Reddit Encouraging', prompt: 'You are an encouraging Reddit community member. Write supportive, uplifting replies. Celebrate others\' achievements and efforts. Offer constructive feedback gently. Build people up rather than tearing them down. Use positive language and maybe an emoji. ' + ON_TOPIC_GUARD, reddit: true, redditFormatting: { bold: true, italic: true } },
    // Other platform-specific templates
    { id: '__linkedin_professional__', name: 'LinkedIn Professional', prompt: 'You are a LinkedIn professional. Write polished, career-focused replies. Be professional yet approachable. Highlight skills, experience, and achievements appropriately. Network professionally — offer to connect, share insights, or provide value. Avoid overly casual language. ' + ON_TOPIC_GUARD },
    { id: '__email_formal__', name: 'Email Formal', prompt: 'You write professional email correspondence. Use a formal but not stiff tone. Include proper salutations and closings. Be concise and clear. Structure emails logically with a clear subject line context. Address the recipient by name when possible. Proofread for grammar and tone. ' + ON_TOPIC_GUARD },
    { id: '__email_cold__', name: 'Email Cold Outreach', prompt: 'You write cold outreach emails that get responses. Personalize based on context. Research the recipient and mention something specific about them. Keep it under 150 words. Have a clear, low-friction call-to-action. Focus on how you can help them, not what you want. Be authentic and respectful of their time. ' + ON_TOPIC_GUARD },
    { id: '__twitter_viral__', name: 'Twitter/X Viral', prompt: 'You write engaging Twitter/X content. Keep it under 280 characters. Use hooks, questions, or controversial statements to drive engagement. Use relevant hashtags sparingly (2-3 max). Tag relevant accounts when appropriate. Write for retweets and replies. Make it shareable and memorable. ' + ON_TOPIC_GUARD },
    { id: '__github_coder__', name: 'GitHub Code Review', prompt: 'You are a helpful code reviewer. Write constructive feedback on code changes. Point out issues clearly and suggest improvements. Be specific and actionable. Acknowledge good work first. Explain why changes are needed. Be respectful of different coding styles. Focus on learning and improvement. ' + ON_TOPIC_GUARD }
  ];

  // Build a Markdown formatting instruction from enabled Reddit formatting toggles.
  // Only active when the page context indicates we are on Reddit.
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

  // Vision-capable Ollama model prefixes (checked case-insensitively)
  const VISION_MODELS = [
    'llava', 'bakllava', 'moondream',
    'llama3.2-vision', 'llama3.3-vision',
    'gemma3', 'qwen2-vl', 'qwen2.5-vl',
    'minicpm-v'
  ];

  function isVisionModel(name) {
    if (!name) return false;
    const lower = name.toLowerCase();
    return VISION_MODELS.some(v => lower.includes(v));
  }

  // Fetch an image from URL and convert to base64 (JPEG)
  async function fetchImageAsBase64(url, maxDim = 1024, quality = 0.85) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) return null;

      return new Promise((resolve) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(blob);
        img.onload = function() {
          let w = img.naturalWidth;
          let h = img.naturalHeight;
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
          URL.revokeObjectURL(objectUrl);
          resolve(dataUrl.replace(/^data:image\/jpeg;base64,/, ''));
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(null);
        };
        img.src = objectUrl;
      });
    } catch (e) {
      return null;
    }
  }

  // Resolve image data: use base64 from content script if available,
  // otherwise fetch from URL and convert.
  async function resolveImages(imageList) {
    if (!imageList || imageList.length === 0) return [];
    const results = [];
    for (const img of imageList.slice(0, 3)) {
      if (img.base64) {
        results.push(img.base64);
      } else if (img.url) {
        try {
          const fetched = await fetchImageAsBase64(img.url);
          if (fetched) results.push(fetched);
        } catch (e) {
          // Image fetch failed — skip it
        }
      }
    }
    return results;
  }

  // Sidebar mode detection (running inside iframe injected into web pages)
  const isSidebarMode = new URLSearchParams(window.location.search).get('mode') === 'sidebar';

  // Sidebar: communicate with host page via postMessage instead of chrome.tabs
  function sendMessageToActiveTab(message) {
    return new Promise((resolve) => {
      if (isSidebarMode) {
        const requestId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
        const handler = (event) => {
          if (event.source !== window.top) return;
          if (event.data && event.data._chatmateResponse && event.data._id === requestId) {
            window.removeEventListener('message', handler);
            resolve(event.data.result);
          }
        };
        window.addEventListener('message', handler);
        // Auto-remove listener after 10s to prevent leaks
        setTimeout(() => window.removeEventListener('message', handler), 10000);
        window.top.postMessage({...message, _chatmate: true, _id: requestId}, '*');
      } else {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (!tabs || !tabs[0] || !tabs[0].id) { resolve(null); return; }
          chrome.tabs.sendMessage(tabs[0].id, message, function(response) {
            if (chrome.runtime.lastError) {
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });
      }
    });
  }

  // Theme handling
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.title = theme === 'dark' ? 'Toggle light mode' : 'Toggle dark mode';
  }

  if (storageAvailable()) {
    try {
      chrome.storage.local.get(['theme'], function(result) {
        applyTheme(result.theme || 'light');
      });
    } catch (e) {
      applyTheme('light');
    }
  } else {
    applyTheme('light');
  }

  themeToggle.addEventListener('click', function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    try {
      if (storageAvailable()) {
        chrome.storage.local.set({theme: newTheme});
      }
    } catch (e) {
      // Extension context invalidated - ignore
    }
  });

  // Sidebar mode UI setup
  if (isSidebarMode) {
    document.documentElement.classList.add('sidebar-mode');
    if (sidebarCloseBtn) sidebarCloseBtn.style.display = 'inline-flex';
  }

  // Sidebar minimize buttons (both in header and topbar)
  function minimizeSidebar() {
    window.parent.postMessage({action: 'toggleSidebar'}, '*');
  }
  if (sidebarCloseBtn) {
    sidebarCloseBtn.addEventListener('click', minimizeSidebar);
  }
  if (topbarMinimizeBtn) {
    topbarMinimizeBtn.addEventListener('click', minimizeSidebar);
  }

  // Grab selected text from page
  if (grabTextBtn) {
    grabTextBtn.addEventListener('click', async function() {
      const response = await sendMessageToActiveTab({action: 'getSelectedText'});
      if (response && response.text) {
        inputText.value = response.text;
        showToast('Grabbed selected text', 'success');
      } else {
        showToast('No text selected on the page', 'info');
      }
    });
  }

  // Connection status
  async function checkConnection() {
    const settings = await getSettings();
    if (!settings.ollamaUrl) {
      setStatus('offline', 'Not configured');
      return;
    }

    setStatus('checking', 'Checking...');
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${settings.ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const modelCount = data.models ? data.models.length : 0;
      const vision = isVisionModel(settings.modelName) ? ' 👁️' : '';
      setStatus('online', `${modelCount} model${modelCount !== 1 ? 's' : ''}${vision}`);
    } catch (err) {
      setStatus('offline', 'Offline');
    }
  }

  function setStatus(type, text) {
    statusBadge.className = `status-badge status-${type}`;
    statusBadge.textContent = text;
  }

  // Load settings, templates, check connection
  if (storageAvailable()) {
    try {
      chrome.storage.local.get([
        'ollamaUrl', 'modelName', 'templates', 'streamingEnabled',
        'temperature', 'maxTokens'
      ], function(result) {
        currentSettings = {
          ollamaUrl: result.ollamaUrl,
          modelName: result.modelName || '',
          streamingEnabled: result.streamingEnabled !== false,
          temperature: result.temperature || 0.7,
          maxTokens: result.maxTokens || 500
        };

        if (!result.ollamaUrl) {
          showError('Open Settings and connect to your AI');
          generateBtn.disabled = true;
          setStatus('offline', 'Not configured');
        } else {
          checkConnection();
        }

        // Load built-in templates first, then custom ones
        const customTemplates = result.templates || [];
        [...BUILTIN_TEMPLATES, ...customTemplates].forEach(template => {
          const option = document.createElement('option');
          option.value = template.id;
          option.textContent = template.name + (template.reddit ? ' 🐱' : '');
          templateSelect.appendChild(option);
      });

      // Update variant buttons visibility (always 1 now)
      updateVariantButtons(1);
    });
    } catch (e) {
      showError('Extension context lost. Please reload the extension.');
      generateBtn.disabled = true;
      setStatus('offline', 'Not available');
    }
  } else {
    showError('Extension context lost. Please reload the extension.');
    generateBtn.disabled = true;
    setStatus('offline', 'Not available');
  }

  // Read Page button - extract page content for context
  if (readPageBtn) {
    readPageBtn.addEventListener('click', async function() {
      if (readPageBtn.disabled) return;
      readPageBtn.disabled = true;
      readPageBtn.classList.add('btn-reading');
      readPageBtn.innerHTML = '<span>📖</span> Reading<span class="thinking-text"></span>';
      await readPage();
      readPageBtn.disabled = false;
      readPageBtn.classList.remove('btn-reading');
      readPageBtn.innerHTML = '<span>📖</span> Read Page';
    });
  }

  // Restore previous responses (persist across popup closes)
  if (storageAvailable()) {
    try {
      chrome.storage.local.get(['lastResponses', 'lastActiveVariant', 'lastInput'], function(result) {
        if (result.lastResponses && result.lastResponses.length > 0) {
          const saved = result.lastResponses;
          let hasContent = false;
          saved.forEach((item, i) => {
            if (i < responseCards.length && item.text) {
              responseCards[i].textContent = item.text;
              if (!item.hasError) hasContent = true;
            }
          });
          if (hasContent) {
            showResponses(true);
            const active = result.lastActiveVariant || 0;
            setActiveVariant(active);
            updateActionButtons();
          }
          if (result.lastInput) {
            currentInput = result.lastInput;
          }
        }
      });
    } catch (e) {
      // Extension context invalidated - ignore
    }
  }

  function updateVariantButtons(count) {
    variantSelector.style.display = count > 1 ? 'flex' : 'none';
    const buttons = variantSelector.querySelectorAll('.tab-btn');
    buttons.forEach((btn, i) => {
      btn.style.display = i < count ? 'block' : 'none';
    });
  }

  function showResponses(show) {
    if (show) {
      responsesContainer.classList.add('show');
      if (responsesEmpty) responsesEmpty.style.display = 'none';
      if (feedbackBar) feedbackBar.classList.add('show');
      resetFeedbackUI();
    } else {
      responsesContainer.classList.remove('show');
      if (responsesEmpty) responsesEmpty.style.display = 'block';
      if (feedbackBar) feedbackBar.classList.remove('show');
    }
  }

  function resetFeedbackUI() {
    if (!feedbackUp || !feedbackDown) return;
    feedbackUp.classList.remove('selected');
    feedbackDown.classList.remove('selected');
    if (feedbackThanks) feedbackThanks.classList.remove('show');
  }

  function saveFeedback(variantIndex, rating) {
    const text = responseCards[variantIndex]?.textContent || '';
    const input = currentInput || '';
    const pageUrl = currentPageContext?.url || '';
    const model = currentSettings?.modelName || '';
    const entry = {
      rating: rating, // 'up' or 'down'
      input: input.substring(0, 500),
      output: text.substring(0, 1000),
      pageUrl: pageUrl,
      model: model,
      template: currentTemplateId || '__casual__',
      timestamp: Date.now()
    };
    try {
      if (storageAvailable()) {
        chrome.storage.local.get(['feedbackHistory'], function(result) {
          try {
            const history = result.feedbackHistory || [];
            history.unshift(entry);
            if (history.length > 200) history.pop();
            chrome.storage.local.set({ feedbackHistory: history });
          } catch (e) {
            // Extension context invalidated - ignore
          }
        });
      }
    } catch (e) {
      // Extension context invalidated - ignore
    }
  }

  // Check for pending text from context menu or keyboard shortcut (popup only)
  if (!isSidebarMode) {
    chrome.runtime.sendMessage({action: 'getPendingText'}, function(response) {
      if (response && response.text) {
        inputText.value = response.text;
      } else {
        sendMessageToActiveTab({action: 'getSelectedText'}).then(function(tabResponse) {
          if (tabResponse && tabResponse.text) {
            inputText.value = tabResponse.text;
          }
        });
      }
    });
  } else {
    // Sidebar mode: just grab selected text directly
    sendMessageToActiveTab({action: 'getSelectedText'}).then(function(tabResponse) {
      if (tabResponse && tabResponse.text) {
        inputText.value = tabResponse.text;
      }
    });
  }

  // Variant tabs
  variantSelector.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const variant = parseInt(this.dataset.variant);
      setActiveVariant(variant);
    });
  });

  function setActiveVariant(variant) {
    activeVariant = variant;
    variantSelector.querySelectorAll('.tab-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === variant);
    });
    responseCards.forEach((card, i) => {
      card.classList.toggle('active', i === variant);
    });
    updateActionButtons();
  }

  function updateActionButtons() {
    const hasContent = responseCards[activeVariant] && responseCards[activeVariant].textContent.length > 0;
    copyBtn.disabled = !hasContent;
    pasteBtn.disabled = !hasContent;
    if (regenerateBtn) regenerateBtn.disabled = !hasContent;
  }

  // Extract comment author list from Reddit context text for preview
  function extractAuthorList(contextText) {
    if (!contextText || !contextText.includes('Comment #')) return [];
    const authors = [];
    const pattern = /Comment #(\d+) by u\/([A-Za-z0-9_-]+):/g;
    let m;
    while ((m = pattern.exec(contextText)) !== null) {
      authors.push({ num: m[1], name: m[2] });
    }
    return authors;
  }

  // Read page function - extract page content for context
  async function readPage() {
    storedPageText = null;
    storedPageImages = null;
    pagePreview.classList.remove('show');

    try {
      const settings = await getSettings();
      const pageContext = await fetchPageContext(4000, true);
      if (pageContext && pageContext.text) {
        storedPageText = pageContext.text;
        storedPageImages = pageContext.images || null;
        const isReddit = pageContext.platform === 'reddit';
        const preview = pageContext.text.substring(0, 350);
        let header = `<strong>Page read (${pageContext.text.length.toLocaleString()} chars)`;
        if (isReddit && pageContext.commentCount) {
          header += ` — ${pageContext.commentCount} comments found`;
        }
        const imageCount = (pageContext.images || []).length;
        if (imageCount > 0) {
          header += ` — ${imageCount} image${imageCount > 1 ? 's' : ''} detected`;
        }
        header += `:</strong>`;

        let authorHint = '';
        let debugHint = '';
        if (isReddit && pageContext.commentCount) {
          const authors = extractAuthorList(pageContext.text);
          if (authors.length > 0) {
            const names = authors.slice(0, 8).map(a => `u/${a.name}`).join(', ');
            const more = authors.length > 8 ? ` +${authors.length - 8} more` : '';
            authorHint = `<div style="margin:6px 0;font-size:11px;color:var(--secondary-text);">Commenters: ${names}${more}</div>`;
          }
        }
        // Show debug info when Reddit extraction finds very few or no comments
        if (isReddit && pageContext.debug && pageContext.commentCount < 3) {
          const dbg = pageContext.debug;
          debugHint = `<div style="margin:8px 0;padding:6px 8px;background:var(--error-bg);border-radius:6px;font-size:11px;color:var(--error-text);border:1px solid var(--border-color);">
            <strong>⚠️ Comment extraction issue</strong><br>
            Strategies tried: ${dbg.strategiesTried.join(' · ')}<br>
            ${dbg.extractedAuthors.length > 0 ? `Found authors: ${dbg.extractedAuthors.slice(0,5).join(', ')}<br>` : 'No authors found.<br>'}
            <em>If this is wrong, try scrolling down to load more comments, then click Read Page again.</em>
          </div>`;
        }

        const hint = isReddit
          ? `<em>Ask about the post or reply to a commenter (e.g., "Reply to u/SomeUser", "What does comment #3 say?")</em>`
          : `<em>Now type your question below (e.g., "What was on page 210?")</em>`;
        pagePreview.innerHTML = `${header}<br>${authorHint}${debugHint}<br><pre style="white-space:pre-wrap;word-wrap:break-word;margin:0;font-family:inherit;font-size:12px;color:var(--text-color);">${preview}${pageContext.text.length > 350 ? '...' : ''}</pre><br>${hint}`;
        pagePreview.classList.add('show');
        const toastParts = [`Read ${pageContext.text.length.toLocaleString()} characters`];
        if (isReddit && pageContext.commentCount) toastParts.push(`${pageContext.commentCount} comments`);
        if (imageCount > 0) toastParts.push(`${imageCount} image${imageCount > 1 ? 's' : ''}`);
        // Warn if Reddit extraction found very few comments
        if (isReddit && pageContext.commentCount < 3) {
          showToast(toastParts.join(' • ') + ' — ⚠️ Few comments found. Scroll down and re-read if needed.', 'warning');
        } else {
          showToast(toastParts.join(' • '), 'success');
        }
        // Focus the input so user can type their question
        inputText.focus();
      } else {
        showError('Could not read this page. Try a different site.');
      }
    } catch (err) {
      showError('Failed to read page: ' + err.message);
    }
  }

  // Generate response
  generateBtn.addEventListener('click', async function() {
    if (isGenerating) {
      // Cancel current generation
      if (abortController) {
        abortController.abort();
      }
      resetGeneration();
      return;
    }

    const text = inputText.value.trim();
    if (!text) {
      showError('Type something first');
      return;
    }

    currentInput = text;
    currentTemplateId = templateSelect.value;

    // Auto-read page if user asks for a reply but hasn't read yet
    const hasReplyIntent = detectReplyIntent(text);
    if (hasReplyIntent && !storedPageText) {
      showToast('Reading page for context...', 'info');
      await readPage();
    }

    await generateResponses(text, currentTemplateId);
  });

  // Escape key cancels ongoing generation
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isGenerating && abortController) {
      abortController.abort();
      resetGeneration();
      showToast('Generation cancelled', 'info');
    }
  });

  async function fetchPageContext(maxLength, skipPromoted) {
    const response = await sendMessageToActiveTab({
      action: 'getPageContext',
      maxLength: maxLength || 4000,
      skipPromoted: skipPromoted
    });
    if (!response || !response.context) return null;
    return response.context;
  }

  // Detect if user input references a specific Reddit username (u/Name or Name)
  // Returns the matched username from context, or the input username if exact match found
  function findTargetUsername(input, contextText) {
    if (!input || !contextText || !contextText.includes('Comment #')) return null;
    // Look for u/Username pattern in input
    const match = input.match(/\bu\/([A-Za-z0-9_-]+)\b/);
    if (match) {
      // Try to find exact match in context first
      const exactMatch = findUsernameInContext(match[1], contextText, true);
      if (exactMatch) return exactMatch;
      return match[1]; // Return input username if no context match
    }
    // Fallback: find words in input that match comment authors (exact or prefix)
    const words = input.split(/\s+/);
    for (const word of words) {
      const clean = word.replace(/[^A-Za-z0-9_-]/g, '');
      if (clean.length >= 3) {
        const matched = findUsernameInContext(clean, contextText, false);
        if (matched) return matched;
      }
    }
    return null;
  }

  // Find a username in context, with exact or prefix matching
  function findUsernameInContext(searchName, contextText, exactOnly) {
    const authorPattern = /Comment #\d+ by u\/([A-Za-z0-9_-]+):/g;
    const authors = [];
    let m;
    while ((m = authorPattern.exec(contextText)) !== null) {
      authors.push(m[1]);
    }
    const searchLower = searchName.toLowerCase();
    // Try exact match first
    for (const author of authors) {
      if (author.toLowerCase() === searchLower) {
        return author; // Return the exact username from context
      }
    }
    // If not exact-only, try prefix match (e.g., "Kindly_Jump" matches "Kindly_Jump_7642")
    if (!exactOnly) {
      for (const author of authors) {
        if (author.toLowerCase().startsWith(searchLower)) {
          return author; // Return the matched username from context
        }
      }
    }
    return null;
  }

  // Extract the specific comment text for a given username from context
  function extractTargetComment(username, contextText) {
    const commentPattern = /Comment #\d+ by u\/([A-Za-z0-9_-]+):\n([\s\S]*?)(?=\n\nComment #|$)/g;
    let m;
    while ((m = commentPattern.exec(contextText)) !== null) {
      if (m[1].toLowerCase() === username.toLowerCase()) {
        return m[2].trim();
      }
    }
    return null;
  }

  // Detect if user is asking for a reply/response to a post/comment
  function detectReplyIntent(input) {
    if (!input) return false;
    const replyPatterns = [
      /\b(repl(?:y|ies|ied|ying)|respond|comment|answer)\b.*\b(post|thread|comment|this|above|it)\b/i,
      /\b(write|give|create|draft)\b.*\b(repl(?:y|y|ies)|comment|response)\b/i,
      /\b(short|quick|brief|simple)\b.*\b(repl(?:y|y|ies)|comment|answer)\b/i,
      /\bpost\s+a\s+comment\b/i,
      /\bsay\s+(?:in\s+)?reply\b/i,
      /\bwhat\s+(?:should|would|could)\s+i\s+say\b/i,
      /\bhow\s+(?:should|would|could)\s+i\s+reply\b/i,
      /\bhelp\s+me\s+reply\b/i,
      /\breply\s+to\s+(?:this|that|post|comment|them|him|her)\b/i,
      /\breply\s+to\b/i  // Simple "reply to"
    ];
    const lower = input.toLowerCase();
    return replyPatterns.some(p => p.test(lower));
  }

  // Build Ollama /api/chat messages array
  // Separates system instructions from user content for much better instruction-tuned model responses
  // images: array of base64 JPEG strings (for vision models)
  function buildMessages(systemPrompt, userInput, pageContext, refContents, explicitPageText, images) {
    const hasReplyIntent = detectReplyIntent(userInput);
    const hasPageContext = !!(explicitPageText || pageContext?.text);
    const isRedditContext = (pageContext?.platform === 'reddit') || (explicitPageText && explicitPageText.includes('[POST TITLE]'));

    // Modify system prompt when writing a reply to Reddit
    let systemContent = systemPrompt || 'You are a helpful assistant.';
    if (hasReplyIntent && isRedditContext && hasPageContext) {
      systemContent += '\n\nCRITICAL: You are writing a Reddit comment/reply. Output ONLY the comment text. Do NOT say "Here is a reply" or "I\'m happy to help". Do NOT explain your reasoning. Do NOT analyze the post. Just write what a real Reddit user would type. Keep it natural and authentic. Do NOT quote the original post in your reply unless specifically quoting to make a point.';
    }

    let userContent = '';
    if (refContents && refContents.length > 0) {
      userContent += 'Reference materials:';
      refContents.forEach((ref, i) => {
        userContent += `\n\n[${i + 1}] ${ref.label}:\n---\n${ref.text}\n---`;
      });
      userContent += '\n\n';
    }
    // Truncate page text to avoid overwhelming the model (max ~3000 chars leaves room for prompt)
    const MAX_PAGE_TEXT = 3000;
    let truncatedPageText = explicitPageText;
    if (truncatedPageText && truncatedPageText.length > MAX_PAGE_TEXT) {
      truncatedPageText = truncatedPageText.substring(0, MAX_PAGE_TEXT) + '\n... [truncated]';
    }
    let truncatedContextText = pageContext?.text;
    if (truncatedContextText && truncatedContextText.length > MAX_PAGE_TEXT) {
      truncatedContextText = truncatedContextText.substring(0, MAX_PAGE_TEXT) + '\n... [truncated]';
    }

    if (truncatedPageText) {
      if (pageContext && pageContext.platform === 'reddit') {
        userContent += `Here is a Reddit post with comments I am reading:\n---\n${truncatedPageText}\n---\n\n`;
      } else {
        userContent += `Here is the full text of the page I am reading:\n---\n${truncatedPageText}\n---\n\n`;
      }
    } else if (truncatedContextText) {
      userContent += `Here is relevant context from the current page "${pageContext.title || ''}" (${pageContext.url || ''}):\n---\n${truncatedContextText}\n---\n\n`;
    }
    if (images && images.length > 0) {
      userContent += `I have also included ${images.length} image${images.length > 1 ? 's' : ''} from the page. Please analyze the image${images.length > 1 ? 's' : ''} together with the text above and answer my question considering both.\n\n`;
    }

    // Check if user is asking about a specific Reddit commenter
    const targetAuthor = findTargetUsername(userInput, explicitPageText || (pageContext?.text || ''));
    let targetCommentText = null;
    if (targetAuthor) {
      targetCommentText = extractTargetComment(targetAuthor, explicitPageText || (pageContext?.text || ''));
      if (targetCommentText) {
        userContent += `=== TARGET COMMENT TO REPLY TO ===\n`;
        userContent += `Author: u/${targetAuthor}\n`;
        userContent += `Comment:\n${targetCommentText}\n`;
        userContent += `=== END TARGET COMMENT ===\n\n`;
        userContent += `CRITICAL INSTRUCTION: You are writing a Reddit reply DIRECTLY to u/${targetAuthor}'s comment above.\n\n`;
        userContent += `WHAT TO DO:\n`;
        userContent += `- Address the specific points u/${targetAuthor} made in their comment\n`;
        userContent += `- Quote or reference their exact words to show you read their comment\n`;
        userContent += `- Keep your reply focused on their comment only\n\n`;
        userContent += `WHAT NOT TO DO:\n`;
        userContent += `- Do NOT mention other commenters (e.g., "I agree with u/OtherUser")\n`;
        userContent += `- Do NOT summarize what other people said\n`;
        userContent += `- Do NOT reply to the original post author\n`;
        userContent += `- Do NOT write about unrelated topics or platforms\n`;
        userContent += `- Do NOT say "great point" about someone else's comment\n\n`;
      } else {
        userContent += `INSTRUCTION: The user wants you to reply to a comment by Reddit user "u/${targetAuthor}".\n`;
        userContent += `Search the provided Reddit context above for a comment authored by "u/${targetAuthor}".\n`;
        userContent += `If found, write your reply directly addressing what they said. Quote or reference their point.\n`;
        userContent += `Do NOT answer the original post. Do NOT write about unrelated platforms or topics.\n\n`;
      }
    }

    userContent += `My request:\n${userInput}\n\n`;
    if (targetAuthor) {
      userContent += `REMEMBER: Reply DIRECTLY to u/${targetAuthor}'s comment. If you cannot find their comment, say so. Do NOT invent content. Do NOT mention other users.`;
    } else if (hasReplyIntent && isRedditContext && hasPageContext) {
      userContent += `CRITICAL: Write a Reddit reply/comment to the post above. Output ONLY the comment text. No explanations. No analysis. No "Here is a reply". No quoting the original post. Just write what a real person would comment.`;
    } else {
      userContent += `Please answer based ONLY on the text provided above.`;
    }

    const msg = { role: 'user', content: userContent };
    if (images && images.length > 0) {
      msg.images = images;
    }
    return [
      { role: 'system', content: systemContent },
      msg
    ];
  }

  async function generateResponses(text, templateId) {
    isGenerating = true;
    abortController = new AbortController();
    generateBtn.classList.add('btn-thinking');
    generateBtn.innerHTML = '<span>⚡</span> Thinking<span class="thinking-text"></span>';
    generateBtn.style.background = 'var(--danger)';
    hideError();
    showResponses(false);
    responseCards.forEach(c => { c.textContent = ''; c.classList.remove('active'); });
    loading.classList.add('show');

    try {
      const settings = await getSettings();
      if (!settings.ollamaUrl) {
        throw new Error('Go to Settings and set up your AI server');
      }

      // Only use page context if user clicked Read Page
      currentPageContext = null;
      if (storedPageText) {
        // Re-fetch to get fresh images, but we already have the text
        currentPageContext = await fetchPageContext(4000, true);
      }

      // Collect images: from freshly fetched context, or from stored read-page data
      const rawImages = (currentPageContext && currentPageContext.images)
        ? currentPageContext.images
        : (storedPageImages || []);

      // Resolve images for vision model (fetch base64 if content script didn't provide it)
      let resolvedImages = [];
      const visionActive = isVisionModel(settings.modelName);
      if (visionActive && rawImages.length > 0) {
        resolvedImages = await resolveImages(rawImages);
      }

      // Get template prompt — use a strong default if no template selected
      let systemPrompt = BUILTIN_TEMPLATES[0].prompt; // Default to "Casual"
      let template = null;
      if (templateId) {
        const templates = await getTemplates();
        template = templates.find(t => t.id == templateId);
        if (template) systemPrompt = template.prompt;
      }

      // If template is Reddit-specific, use its formatting options
      if (template && template.reddit && template.redditFormatting) {
        const fmtInstr = buildFormattingInstruction(template.redditFormatting);
        if (fmtInstr) {
          systemPrompt += '\n\n' + fmtInstr;
        }
      }

      // Check if targeting a specific Reddit commenter - use lower temperature for more focused responses
      const targetAuthor = findTargetUsername(text, storedPageText || (currentPageContext?.text || ''));
      const baseTemp = settings.temperature || 0.7;
      // Lower temperature when targeting specific commenter to reduce hallucination and improve instruction following
      const adjustedBaseTemp = targetAuthor ? Math.min(baseTemp, 0.5) : baseTemp;

      const result = await generateSingleResponse(text, settings, systemPrompt, Math.min(adjustedBaseTemp, 1.5), 0, 1, currentPageContext, [], resolvedImages);

      // Show result
      if (result) {
        responseCards[0].textContent = cleanResponse(result);
        showResponses(true);
        setActiveVariant(0);
        await updateModelInfo(settings, currentPageContext);

        // Persist response across popup closes
        try {
          if (storageAvailable()) {
            const responsesToSave = [{
              text: responseCards[0].textContent,
              hasError: false
            }];
            chrome.storage.local.set({
              lastResponses: responsesToSave,
              lastActiveVariant: 0,
              lastInput: text
            });
          }
        } catch (e) {
          // Extension context invalidated - ignore
        }

        // Save to history
        saveToHistory(text, cleanResponse(result), settings.modelName);
      } else {
        responseCards[0].textContent = 'Failed to generate response';
        showResponses(true);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showError(err.message);
      }
    } finally {
      resetGeneration();
    }
  }

  function resetGeneration() {
    isGenerating = false;
    abortController = null;
    generateBtn.classList.remove('btn-thinking');
    generateBtn.innerHTML = '<span>⚡</span> Generate Reply';
    generateBtn.style.background = '';
    loading.classList.remove('show');
  }

  async function generateSingleResponse(prompt, settings, systemPrompt, temperature, index, total, pageContext, refContents, images) {
    if (total > 1) {
      loadingText.innerHTML = `Writing reply ${index + 1} of ${total}<span class="thinking-text"></span>`;
    } else {
      loadingText.innerHTML = 'Writing your reply<span class="thinking-text"></span>';
    }

    const url = `${settings.ollamaUrl}/api/chat`;

    const maxTokens = settings.maxTokens || 500;
    const messages = buildMessages(systemPrompt, prompt, pageContext, refContents, storedPageText, images);

    if (settings.streamingEnabled && total === 1) {
      // Streaming for single response
      return await streamResponse(url, settings.modelName, messages, index, temperature, maxTokens);
    } else {
      // Non-streaming for multiple variants
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.modelName,
          messages: messages,
          stream: false,
          options: {
            temperature: temperature,
            num_predict: maxTokens
          }
        }),
        signal: abortController?.signal
      });

      if (!res.ok) {
        if (res.status === 404) {
          const available = await getAvailableModels(settings);
          const hint = available.length > 0
            ? ` You have: ${available.join(', ')}`
            : ' Run "ollama list" in your terminal to see available models.';
          throw new Error(`Model "${settings.modelName}" not found.${hint} Type the correct name in Settings.`);
        }
        let errBody = '';
        try { errBody = await res.text(); } catch (e) {}
        throw new Error(`Ollama error ${res.status}: ${errBody || 'Internal server error. Try reducing context or using a smaller model.'}`);
      }
      const data = await res.json();
      return cleanResponse(data.message?.content || data.response || '');
    }
  }

  async function streamResponse(url, model, messages, index, temperature, maxTokens) {
    showResponses(true);
    responseCards[index].classList.add('active');
    loading.classList.remove('show');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        stream: true,
        options: {
          temperature: temperature,
          num_predict: maxTokens
        }
      }),
      signal: abortController?.signal
    });

    if (!res.ok) {
      if (res.status === 404) {
        const available = await getAvailableModels({ollamaUrl: url.replace('/api/chat', '')});
        const hint = available.length > 0
          ? ` You have: ${available.join(', ')}`
          : ' Check your model name in Settings, or run "ollama list" in your terminal.';
        throw new Error(`Model not found.${hint}`);
      }
      let errBody = '';
      try { errBody = await res.text(); } catch (e) {}
      throw new Error(`Ollama error ${res.status}: ${errBody || 'Internal server error. Try reducing context or using a smaller model.'}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          // /api/chat returns message.content, /api/generate returns response
          const text = data.message?.content || data.response || '';
          if (text) {
            fullText += text;
            responseCards[index].textContent = fullText;
            responseCards[index].scrollTop = responseCards[index].scrollHeight;
          }
          if (data.done) {
            const cleaned = cleanResponse(fullText);
            responseCards[index].textContent = cleaned;
            updateActionButtons();
            return cleaned;
          }
        } catch (e) {
          // Ignore malformed lines
        }
      }
    }
    return fullText;
  }

  // Clean up model response for copying
  function cleanResponse(text) {
    if (!text) return '';
    return text
      // Strip thinking/reasoning tags (common in reasoning models)
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
      .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
      // Strip ollama metadata markers
      .replace(/\[DONE\]/gi, '')
      .replace(/\[END\]/gi, '')
      // Strip stray assistant/user role markers
      .replace(/^assistant:\s*/i, '')
      .replace(/^user:\s*/i, '')
      .replace(/^system:\s*/i, '')
      // Strip common chat template special tokens
      .replace(/<\|im_start\|>/gi, '')
      .replace(/<\|im_end\|>/gi, '')
      .replace(/<\|eot_id\|>/gi, '')
      .replace(/<\|start_header_id\|>/gi, '')
      .replace(/<\|end_header_id\|>/gi, '')
      // Remove markdown code block wrappers if present
      .replace(/```(?:json|text|markdown)?\n?/gi, '')
      // Clean up extra blank lines
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
  }

  // Copy button
  copyBtn.addEventListener('click', async function() {
    if (!responseCards[activeVariant]) return;
    const rawText = responseCards[activeVariant].textContent;
    if (!rawText) return;
    const text = cleanResponse(rawText);

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to copy', 'info');
    }
  });

  // Paste button - try to insert into page
  pasteBtn.addEventListener('click', async function() {
    if (!responseCards[activeVariant]) return;
    const rawText = responseCards[activeVariant].textContent;
    if (!rawText) return;
    const text = cleanResponse(rawText);

    const response = await sendMessageToActiveTab({action: 'insertText', text: text});
    if (response && response.success) {
      showToast('Pasted into chat!', 'success');
    } else {
      // Fallback: just copy
      navigator.clipboard.writeText(text).then(() => {
        showToast('Copied (paste not supported on this site)', 'success');
      });
    }
  });

  // Regenerate button - re-run generation with same prompt and template
  if (regenerateBtn) {
    regenerateBtn.addEventListener('click', async function() {
      if (isGenerating || !currentInput) {
        showToast('Nothing to regenerate', 'info');
        return;
      }
      // Clear responses but keep input and page context
      responseCards.forEach(c => { c.textContent = ''; c.classList.remove('active'); });
      showResponses(false);
      resetFeedbackUI();
      // Re-run generation with same prompt
      await generateResponses(currentInput, currentTemplateId);
    });
  }

  // Clear button - remove all responses, storage, and page context
  clearBtn.addEventListener('click', function() {
    responseCards.forEach(c => { c.textContent = ''; c.classList.remove('active'); });
    showResponses(false);
    if (storageAvailable()) {
      try {
        chrome.storage.local.remove(['lastResponses', 'lastActiveVariant', 'lastInput']);
      } catch (e) {
        // Extension context invalidated - ignore
      }
    }
    // Reset page context
    storedPageText = null;
    storedPageImages = null;
    currentPageContext = null;
    if (pagePreview) {
      pagePreview.innerHTML = '';
      pagePreview.classList.remove('show');
    }
    currentInput = '';
    updateActionButtons();
    showToast('Cleared', 'success');
  });

  // Feedback buttons
  if (feedbackUp) {
    feedbackUp.addEventListener('click', function() {
      feedbackUp.classList.add('selected');
      feedbackDown.classList.remove('selected');
      if (feedbackThanks) feedbackThanks.classList.add('show');
      saveFeedback(activeVariant, 'up');
      showToast('Marked as helpful — thanks!', 'success');
    });
  }
  if (feedbackDown) {
    feedbackDown.addEventListener('click', function() {
      feedbackDown.classList.add('selected');
      feedbackUp.classList.remove('selected');
      if (feedbackThanks) feedbackThanks.classList.add('show');
      saveFeedback(activeVariant, 'down');
      showToast('Marked as unhelpful — noted for improvement', 'warning');
    });
  }

  // Toast notifications
  function showToast(message, type) {
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  async function updateModelInfo(settings, pageContext) {
    const visionBadge = isVisionModel(settings.modelName) ? ' 👁️' : '';
    let footerText = `${settings.modelName}${visionBadge} • ${settings.ollamaUrl.replace(/^https?:\/\//, '').split('/')[0]}`;
    if (pageContext && pageContext.title) {
      footerText += ` • Context: ${pageContext.title}`;
    }
    const imageCount = (pageContext && pageContext.images) ? pageContext.images.length : 0;
    if (imageCount > 0) {
      footerText += ` • ${imageCount} image${imageCount > 1 ? 's' : ''}`;
    }
    // Show formatting badge when using Reddit-specific tone
    if (currentTemplateId) {
      const templates = await getTemplates();
      const template = templates.find(t => t.id == currentTemplateId);
      if (template && template.reddit && template.redditFormatting) {
        const fmtKeys = Object.keys(template.redditFormatting).filter(k => template.redditFormatting[k]);
        if (fmtKeys.length > 0) {
          footerText += ` • 📝 ${fmtKeys.length} format${fmtKeys.length > 1 ? 's' : ''}`;
        }
      }
    }
    footerInfo.textContent = footerText;
  }

  // Helpers
  async function getAvailableModels(settings) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${settings.ollamaUrl}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!res.ok) return [];
      const data = await res.json();
      // Defensive: ensure data is an object and has models array
      if (!data || typeof data !== 'object') return [];
      const models = data.models || [];
      if (!Array.isArray(models)) return [];
      return models.map(m => m.name || m.model).filter(Boolean);
    } catch (e) {
      return [];
    }
  }

  async function resolveModelName(url, savedName) {
    if (!url) return savedName;
    try {
      const available = await getAvailableModels({ ollamaUrl: url });
      if (available.length === 0) return savedName;
      // Exact match
      if (available.includes(savedName)) return savedName;
      // Empty or missing — pick first available and persist it
      if (!savedName) {
        const pick = available[0];
        if (storageAvailable()) {
          try { chrome.storage.local.set({ modelName: pick }); } catch (e) {}
        }
        return pick;
      }
      // Partial match (e.g. saved "llama3" matches "llama3.1:8b")
      const partial = available.find(a => a.toLowerCase().startsWith(savedName.toLowerCase()));
      if (partial) {
        if (storageAvailable()) {
          try { chrome.storage.local.set({ modelName: partial }); } catch (e) {}
        }
        return partial;
      }
      // Fuzzy: saved name appears anywhere in available name
      const fuzzy = available.find(a => a.toLowerCase().includes(savedName.toLowerCase()));
      if (fuzzy) {
        if (storageAvailable()) {
          try { chrome.storage.local.set({ modelName: fuzzy }); } catch (e) {}
        }
        return fuzzy;
      }
      // Fallback to first available
      const pick = available[0];
      if (storageAvailable()) {
        try { chrome.storage.local.set({ modelName: pick }); } catch (e) {}
      }
      return pick;
    } catch (e) {
      return savedName;
    }
  }

  function getSettings() {
    return new Promise((resolve) => {
      if (!storageAvailable()) {
        resolve({
          ollamaUrl: '',
          modelName: '',
          streamingEnabled: true,
          temperature: 0.7,
          maxTokens: 500
        });
        return;
      }
      try {
        chrome.storage.local.get([
          'ollamaUrl', 'modelName', 'streamingEnabled',
          'temperature', 'maxTokens'
        ], async function(result) {
          const base = {
            ollamaUrl: result.ollamaUrl,
            modelName: result.modelName || '',
            streamingEnabled: result.streamingEnabled !== false,
            temperature: result.temperature || 0.7,
            maxTokens: result.maxTokens || 500
          };
          // Auto-resolve model if missing / stale
          if (base.ollamaUrl) {
            base.modelName = await resolveModelName(base.ollamaUrl, base.modelName);
          }
          resolve(base);
        });
      } catch (e) {
        resolve({
          ollamaUrl: '',
          modelName: '',
          streamingEnabled: true,
          temperature: 0.7,
          maxTokens: 500
        });
      }
    });
  }

  function getTemplates() {
    return new Promise((resolve) => {
      if (!storageAvailable()) {
        resolve([...BUILTIN_TEMPLATES]);
        return;
      }
      try {
        chrome.storage.local.get(['templates'], function(result) {
          const custom = result.templates || [];
          resolve([...BUILTIN_TEMPLATES, ...custom]);
        });
      } catch (e) {
        resolve([...BUILTIN_TEMPLATES]);
      }
    });
  }

  function saveToHistory(input, output, modelName) {
    try {
      if (!storageAvailable()) return;
      chrome.storage.local.get(['history'], function(result) {
        try {
          const history = result.history || [];
          history.unshift({
            input: input,
            output: output,
            model: modelName,
            timestamp: Date.now()
          });
          if (history.length > 50) history.pop();
          chrome.storage.local.set({history: history});
        } catch (e) {
          // Extension context invalidated - ignore
        }
      });
    } catch (e) {
      // Extension context invalidated - ignore
    }
  }

  function showError(message) {
    error.textContent = message;
    error.classList.add('show');
  }

  function hideError() {
    error.classList.remove('show');
  }

  // Check connection periodically
  setInterval(checkConnection, 30000);
});

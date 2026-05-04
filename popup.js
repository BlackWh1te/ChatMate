document.addEventListener('DOMContentLoaded', function() {
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
  const pasteBtn = document.getElementById('paste-btn');
  const regenerateBtn = document.getElementById('regenerate-btn');
  const themeToggle = document.getElementById('theme-toggle');
  const contextToggle = document.getElementById('context-toggle');
  const statusBadge = document.getElementById('status-badge');
  const modelInfo = document.getElementById('model-info');
  const tokenInfo = document.getElementById('token-info');
  const footerInfo = document.getElementById('footer-info');
  const toast = document.getElementById('toast');

  // State
  let currentSettings = null;
  let currentTemplateId = '';
  let currentInput = '';
  let activeVariant = 0;
  let isGenerating = false;
  let abortController = null;
  let currentPageContext = null;

  // Theme handling
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.title = theme === 'dark' ? 'Toggle light mode' : 'Toggle dark mode';
  }

  chrome.storage.local.get(['theme', 'contextEnabled'], function(result) {
    applyTheme(result.theme || 'light');
    if (contextToggle) {
      contextToggle.checked = result.contextEnabled !== false;
    }
  });

  themeToggle.addEventListener('click', function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({theme: newTheme});
  });

  if (contextToggle) {
    contextToggle.addEventListener('change', function() {
      chrome.storage.local.set({contextEnabled: contextToggle.checked});
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
      const res = await fetch(`${settings.ollamaUrl}/api/tags`, { method: 'GET', signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        const modelCount = data.models ? data.models.length : 0;
        setStatus('online', `${modelCount} model${modelCount !== 1 ? 's' : ''}`);
      } else {
        setStatus('offline', 'Error');
      }
    } catch (err) {
      setStatus('offline', 'Offline');
    }
  }

  function setStatus(type, text) {
    statusBadge.className = `status-badge status-${type}`;
    statusBadge.textContent = text;
  }

  // Load settings, templates, check connection
  chrome.storage.local.get([
    'ollamaUrl', 'modelName', 'templates', 'streamingEnabled',
    'variantCount', 'temperature', 'maxTokens'
  ], function(result) {
    currentSettings = {
      ollamaUrl: result.ollamaUrl,
      modelName: result.modelName || 'llama2',
      streamingEnabled: result.streamingEnabled !== false,
      variantCount: result.variantCount || 1,
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

    // Load templates
    const templates = result.templates || [];
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });

    // Update variant buttons visibility
    updateVariantButtons(result.variantCount || 1);
  });

  function updateVariantButtons(count) {
    const buttons = variantSelector.querySelectorAll('.tab-btn');
    buttons.forEach((btn, i) => {
      btn.style.display = i < count ? 'block' : 'none';
    });
  }

  // Check for pending text from context menu or keyboard shortcut
  chrome.runtime.sendMessage({action: 'getPendingText'}, function(response) {
    if (response && response.text) {
      inputText.value = response.text;
    } else {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelectedText'}, function(tabResponse) {
          if (tabResponse && tabResponse.text) {
            inputText.value = tabResponse.text;
          }
        });
      });
    }
  });

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
    const hasContent = responseCards[activeVariant].textContent.length > 0;
    copyBtn.disabled = !hasContent;
    pasteBtn.disabled = !hasContent;
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
    await generateResponses(text, currentTemplateId);
  });

  async function fetchPageContext(maxLength) {
    return new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (!tabs || !tabs[0]) { resolve(null); return; }
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getPageContext', maxLength: maxLength || 4000}, function(response) {
          if (chrome.runtime.lastError || !response || !response.context) {
            resolve(null);
          } else {
            resolve(response.context);
          }
        });
      });
    });
  }

  async function fetchReferenceUrls(maxLength) {
    return new Promise((resolve) => {
      chrome.storage.local.get(['referenceUrls'], function(result) {
        const urls = result.referenceUrls || [];
        if (urls.length === 0) { resolve([]); return; }
        const limit = maxLength || 4000;
        const fetchPromises = urls.map(async (item) => {
          try {
            const res = await fetch(item.url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) return null;
            const html = await res.text();
            const text = htmlToText(html);
            return { label: item.label || item.url, text: truncate(text, limit) };
          } catch (e) {
            return null;
          }
        });
        Promise.all(fetchPromises).then(results => resolve(results.filter(Boolean)));
      });
    });
  }

  function htmlToText(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Remove script/style/nav/footer tags
    const removeTags = ['script', 'style', 'nav', 'footer', 'header', 'aside', 'noscript'];
    removeTags.forEach(tag => {
      tmp.querySelectorAll(tag).forEach(el => el.remove());
    });
    let text = tmp.innerText || tmp.textContent || '';
    return text
      .replace(/\n{3,}/g, '\n\n')
      .replace(/\t+/g, ' ')
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  function truncate(text, maxLen) {
    if (!text || text.length <= maxLen) return text;
    return text.substring(0, maxLen) + '... [truncated]';
  }

  function buildFullPrompt(systemPrompt, userInput, pageContext, refContents) {
    let prompt = systemPrompt;
    if (refContents && refContents.length > 0) {
      prompt += '\n\nReference materials:';
      refContents.forEach((ref, i) => {
        prompt += `\n\n[${i + 1}] ${ref.label}:\n---\n${ref.text}\n---`;
      });
    }
    if (pageContext && pageContext.text) {
      prompt += `\n\nHere is relevant context from the current page "${pageContext.title || ''}" (${pageContext.url || ''}):\n---\n${pageContext.text}\n---`;
    }
    prompt += `\n\nUser message:\n${userInput}\n\nPlease write a response.`;
    return prompt;
  }

  async function generateResponses(text, templateId) {
    isGenerating = true;
    abortController = new AbortController();
    generateBtn.innerHTML = '<span>⏹</span> Stop';
    generateBtn.style.background = 'var(--danger)';
    hideError();
    responsesContainer.classList.remove('show');
    responseCards.forEach(c => { c.textContent = ''; c.classList.remove('active'); });
    loading.classList.add('show');

    try {
      const settings = await getSettings();
      if (!settings.ollamaUrl) {
        throw new Error('Go to Settings and set up your AI server');
      }

      // Fetch page context if enabled
      currentPageContext = null;
      if (contextToggle && contextToggle.checked) {
        currentPageContext = await fetchPageContext(settings.contextLimit);
      }

      // Fetch reference URLs content
      const refContents = await fetchReferenceUrls(settings.contextLimit);

      // Get template prompt
      let systemPrompt = 'Help me write a response to this message. Keep it natural and conversational';
      if (templateId) {
        const templates = await getTemplates();
        const template = templates.find(t => t.id == templateId);
        if (template) systemPrompt = template.prompt;
      }

      const variantCount = settings.variantCount || 1;
      const promises = [];

      const baseTemp = settings.temperature || 0.7;
      for (let i = 0; i < variantCount; i++) {
        // Vary temperature slightly for diversity when generating multiple variants
        const temperature = variantCount > 1 ? baseTemp + (i * 0.15) : baseTemp;
        promises.push(generateSingleResponse(text, settings, systemPrompt, Math.min(temperature, 1.5), i, variantCount, currentPageContext, refContents));
      }

      const results = await Promise.allSettled(promises);

      // Show results
      let hasAnySuccess = false;
      results.forEach((result, i) => {
        if (result.status === 'fulfilled' && result.value) {
          responseCards[i].textContent = result.value;
          hasAnySuccess = true;
        } else if (result.status === 'rejected') {
          responseCards[i].textContent = 'Oops: ' + result.reason.message;
        }
      });

      if (hasAnySuccess) {
        responsesContainer.classList.add('show');
        setActiveVariant(0);
        updateModelInfo(settings, currentPageContext);

        // Save to history (save first successful response)
        const firstSuccess = results.find(r => r.status === 'fulfilled' && r.value);
        if (firstSuccess) {
          saveToHistory(text, firstSuccess.value, settings.modelName);
        }
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
    generateBtn.innerHTML = '<span>⚡</span> Generate Response';
    generateBtn.style.background = '';
    loading.classList.remove('show');
  }

  async function generateSingleResponse(prompt, settings, systemPrompt, temperature, index, total, pageContext, refContents) {
    if (total > 1) {
      loadingText.textContent = `Writing reply ${index + 1} of ${total}...`;
    } else {
      loadingText.textContent = 'Writing your reply...';
    }

    const url = `${settings.ollamaUrl}/api/generate`;

    const maxTokens = settings.maxTokens || 500;
    const fullPrompt = buildFullPrompt(systemPrompt, prompt, pageContext, refContents);

    if (settings.streamingEnabled && total === 1) {
      // Streaming for single response
      return await streamResponse(url, settings.modelName, fullPrompt, index, temperature, maxTokens);
    } else {
      // Non-streaming for multiple variants
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: settings.modelName,
          prompt: fullPrompt,
          stream: false,
          options: {
            temperature: temperature,
            num_predict: maxTokens
          }
        }),
        signal: abortController?.signal
      });

      if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
      const data = await res.json();
      return data.response;
    }
  }

  async function streamResponse(url, model, fullPrompt, index, temperature, maxTokens) {
    responsesContainer.classList.add('show');
    responseCards[index].classList.add('active');
    loading.classList.remove('show');

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: temperature,
          num_predict: maxTokens
        }
      }),
      signal: abortController?.signal
    });

    if (!res.ok) throw new Error(`Ollama error: ${res.status}`);

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
          if (data.response) {
            fullText += data.response;
            responseCards[index].textContent = fullText;
            responseCards[index].scrollTop = responseCards[index].scrollHeight;
          }
          if (data.done) {
            updateActionButtons();
            return fullText;
          }
        } catch (e) {
          // Ignore malformed lines
        }
      }
    }
    return fullText;
  }

  // Copy button
  copyBtn.addEventListener('click', async function() {
    const text = responseCards[activeVariant].textContent;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!', 'success');
    } catch (err) {
      showToast('Failed to copy', 'info');
    }
  });

  // Paste button - try to insert into page
  pasteBtn.addEventListener('click', async function() {
    const text = responseCards[activeVariant].textContent;
    if (!text) return;

    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'insertText',
        text: text
      }, function(response) {
        if (response && response.success) {
          showToast('Pasted into chat!', 'success');
        } else {
          // Fallback: just copy
          navigator.clipboard.writeText(text).then(() => {
            showToast('Copied (paste not supported on this site)', 'success');
          });
        }
      });
    });
  });

  // Regenerate button
  regenerateBtn.addEventListener('click', async function() {
    if (!currentInput) {
      showError('Write a reply first, then you can redo it');
      return;
    }
    await generateResponses(currentInput, currentTemplateId);
  });

  // Toast notifications
  function showToast(message, type) {
    toast.textContent = message;
    toast.className = `toast toast-${type} show`;
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function updateModelInfo(settings, pageContext) {
    modelInfo.textContent = `Model: ${settings.modelName}`;
    tokenInfo.textContent = '';
    let footerText = `${settings.modelName} • ${settings.ollamaUrl.replace(/^https?:\/\//, '').split('/')[0]}`;
    if (pageContext && pageContext.title) {
      footerText += ` • Context: ${pageContext.title}`;
    }
    footerInfo.textContent = footerText;
  }

  // Helpers
  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'ollamaUrl', 'modelName', 'streamingEnabled', 'variantCount',
        'temperature', 'maxTokens', 'contextLimit'
      ], function(result) {
        resolve({
          ollamaUrl: result.ollamaUrl,
          modelName: result.modelName || 'llama2',
          streamingEnabled: result.streamingEnabled !== false,
          variantCount: result.variantCount || 1,
          temperature: result.temperature || 0.7,
          maxTokens: result.maxTokens || 500,
          contextLimit: result.contextLimit || 4000
        });
      });
    });
  }

  function getTemplates() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['templates'], function(result) {
        resolve(result.templates || []);
      });
    });
  }

  function saveToHistory(input, output, modelName) {
    chrome.storage.local.get(['history'], function(result) {
      const history = result.history || [];
      history.unshift({
        input: input,
        output: output,
        model: modelName,
        timestamp: Date.now()
      });
      if (history.length > 50) history.pop();
      chrome.storage.local.set({history: history});
    });
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

document.addEventListener('DOMContentLoaded', function() {
  // Vision-capable model prefixes (shared with popup.js)
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

  // DOM Elements
  const ollamaUrlInput = document.getElementById('ollama-url');
  const modelSelect = document.getElementById('model-select');
  const modelManual = document.getElementById('model-manual');
  const detectModelsBtn = document.getElementById('detect-models-btn');
  const saveBtn = document.getElementById('save-btn');
  const streamingToggle = document.getElementById('streaming-toggle');
  const temperatureSlider = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperature-value');
  const maxTokens = document.getElementById('max-tokens');
  const themeToggle = document.getElementById('theme-toggle');
  const success = document.getElementById('success');
  const error = document.getElementById('error');

  // Template-specific Reddit formatting
  const templateReddit = document.getElementById('template-reddit');
  const templateRedditFmt = document.getElementById('template-reddit-fmt');
  const tfmtBold = document.getElementById('tfmt-bold');
  const tfmtItalic = document.getElementById('tfmt-italic');
  const tfmtQuote = document.getElementById('tfmt-quote');
  const tfmtCodeblock = document.getElementById('tfmt-codeblock');
  const tfmtBullet = document.getElementById('tfmt-bullet');

  // Templates
  const templateNameInput = document.getElementById('template-name');
  const templatePromptInput = document.getElementById('template-prompt');
  const addTemplateBtn = document.getElementById('add-template-btn');
  const templatesList = document.getElementById('templates-list');

  // History
  const historySearch = document.getElementById('history-search');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const exportHistoryBtn = document.getElementById('export-history-btn');
  const importHistoryBtn = document.getElementById('import-history-btn');
  const importFile = document.getElementById('import-file');

  // Feedback
  const feedbackList = document.getElementById('feedback-list');
  const feedbackStats = document.getElementById('feedback-stats');
  const clearFeedbackBtn = document.getElementById('clear-feedback-btn');

  let allHistory = [];

  // Theme
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.title = theme === 'dark' ? 'Toggle light mode' : 'Toggle dark mode';
  }

  chrome.storage.local.get(['theme'], function(result) {
    applyTheme(result.theme || 'light');
  });

  themeToggle.addEventListener('click', function() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({theme: newTheme});
  });

  // Temperature slider
  temperatureSlider.addEventListener('input', function() {
    temperatureValue.textContent = this.value;
  });

  // Toggle Reddit formatting section when template-reddit checkbox changes
  if (templateReddit) {
    templateReddit.addEventListener('change', function() {
      templateRedditFmt.style.display = this.checked ? 'block' : 'none';
    });
  }

  // Load current settings
  chrome.storage.local.get([
    'ollamaUrl', 'modelName', 'templates', 'history',
    'streamingEnabled', 'temperature', 'maxTokens'
  ], function(result) {
    ollamaUrlInput.value = result.ollamaUrl || '';
    streamingToggle.checked = result.streamingEnabled !== false;
    temperatureSlider.value = result.temperature || 0.7;
    temperatureValue.textContent = temperatureSlider.value;
    maxTokens.value = result.maxTokens || 500;

    // Populate model dropdown
    populateModelSelect(result.modelName || '', result.models || []);

    // Display templates
    displayTemplates(result.templates || []);

    // Display history
    allHistory = result.history || [];
    displayHistory(allHistory);

    // Display feedback
    displayFeedback(result.feedbackHistory || []);
  });

  // Find models from Ollama
  detectModelsBtn.addEventListener('click', async function() {
    const url = ollamaUrlInput.value.trim();
    if (!url) {
      showError('Please enter Ollama URL first');
      return;
    }

    detectModelsBtn.disabled = true;
    detectModelsBtn.textContent = '🔍 Finding...';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${url}/api/tags`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      const data = await res.json();
      const models = data.models || [];
      const modelNames = models.map(m => m.name || m.model).filter(Boolean);

      if (modelNames.length === 0) {
        showError('No models found. Is Ollama running?');
        modelSelect.style.display = 'none';
        modelManual.style.display = 'block';
      } else {
        chrome.storage.local.set({ models: modelNames, modelName: modelNames[0] });
        populateModelSelect(modelNames[0], modelNames);
        showSuccess(`Found ${modelNames.length} model${modelNames.length !== 1 ? 's' : ''}. Saved ${modelNames[0]} as default.`);
      }
    } catch (err) {
      showError(`Cannot connect: ${err.message}. Try typing your model name below.`);
      modelSelect.style.display = 'none';
      modelManual.style.display = 'block';
    } finally {
      detectModelsBtn.disabled = false;
      detectModelsBtn.textContent = '🔍 Find Models';
    }
  });

  function populateModelSelect(selectedModel, availableModels) {
    modelSelect.innerHTML = '';

    if (availableModels.length === 0) {
      // No models detected — show manual input
      modelSelect.style.display = 'none';
      modelManual.style.display = 'block';
      modelManual.value = selectedModel || '';
      const option = document.createElement('option');
      option.value = '__manual__';
      option.textContent = 'Type manually below';
      modelSelect.appendChild(option);
    } else {
      // Models detected — use dropdown, hide manual input
      modelSelect.style.display = 'block';
      modelManual.style.display = 'none';

      // Sort: vision models first, then alphabetical
      const sorted = [...availableModels].sort((a, b) => {
        const av = isVisionModel(a);
        const bv = isVisionModel(b);
        if (av && !bv) return -1;
        if (!av && bv) return 1;
        return a.localeCompare(b);
      });

      sorted.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = isVisionModel(name) ? `${name}  👁️` : name;
        if (name === selectedModel) option.selected = true;
        modelSelect.appendChild(option);
      });
    }
  }

  // Save settings
  saveBtn.addEventListener('click', function() {
    const ollamaUrl = ollamaUrlInput.value.trim();
    const modelName = (modelManual.style.display !== 'none' && modelManual.value.trim())
      ? modelManual.value.trim()
      : modelSelect.value.trim();
    const streaming = streamingToggle.checked;
    const temp = parseFloat(temperatureSlider.value);
    const tokens = parseInt(maxTokens.value);

    if (!ollamaUrl) {
      showError('Ollama URL is required');
      return;
    }
    if (!modelName) {
      showError('Model name is required');
      return;
    }

    chrome.storage.local.set({
      ollamaUrl: ollamaUrl,
      modelName: modelName,
      streamingEnabled: streaming,
      temperature: temp,
      maxTokens: tokens
    }, function() {
      showSuccess('Saved!');
    });
  });

  // Templates
  addTemplateBtn.addEventListener('click', function() {
    const name = templateNameInput.value.trim();
    const prompt = templatePromptInput.value.trim();

    if (!name || !prompt) {
      showError('Please enter both template name and prompt');
      return;
    }

    const isReddit = templateReddit ? templateReddit.checked : false;
    const redditFmt = isReddit ? {
      bold: tfmtBold ? tfmtBold.checked : false,
      italic: tfmtItalic ? tfmtItalic.checked : false,
      quote: tfmtQuote ? tfmtQuote.checked : false,
      codeblock: tfmtCodeblock ? tfmtCodeblock.checked : false,
      bullet: tfmtBullet ? tfmtBullet.checked : false
    } : null;

    chrome.storage.local.get(['templates'], function(result) {
      const templates = result.templates || [];
      templates.push({ name, prompt, id: Date.now(), reddit: isReddit, redditFormatting: redditFmt });
      chrome.storage.local.set({ templates: templates }, function() {
        displayTemplates(templates);
        templateNameInput.value = '';
        templatePromptInput.value = '';
        if (templateReddit) templateReddit.checked = false;
        if (templateRedditFmt) templateRedditFmt.style.display = 'none';
        // Reset formatting toggles
        if (tfmtBold) tfmtBold.checked = false;
        if (tfmtItalic) tfmtItalic.checked = false;
        if (tfmtQuote) tfmtQuote.checked = false;
        if (tfmtCodeblock) tfmtCodeblock.checked = false;
        if (tfmtBullet) tfmtBullet.checked = false;
        showSuccess('Tone saved!');
      });
    });
  });

  function displayTemplates(templates) {
    if (!templates || templates.length === 0) {
      templatesList.innerHTML = '<div class="empty-state">No saved tones yet</div>';
      return;
    }

    templatesList.innerHTML = templates.map(template => {
      const redditBadge = template.reddit ? ' <span style="background:var(--primary-soft);color:var(--primary);padding:1px 6px;border-radius:10px;font-size:10px;font-weight:600;">Reddit</span>' : '';
      return `
      <div class="template-item" data-id="${template.id}">
        <div class="template-info">
          <div class="template-name">${escapeHtml(template.name)}${redditBadge}</div>
          <div class="template-prompt">${escapeHtml(template.prompt)}</div>
        </div>
        <div class="template-actions">
          <button class="btn btn-danger small-btn delete-template" data-id="${template.id}">Delete</button>
        </div>
      </div>
    `;
    }).join('');

    templatesList.querySelectorAll('.delete-template').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = parseInt(this.dataset.id);
        deleteTemplate(id);
      });
    });
  }

  function deleteTemplate(id) {
    if (!confirm('Delete this tone?')) return;

    chrome.storage.local.get(['templates'], function(result) {
      const templates = (result.templates || []).filter(t => t.id !== id);
      chrome.storage.local.set({ templates: templates }, function() {
        displayTemplates(templates);
      });
    });
  }

  // History
  function displayHistory(history) {
    if (!history || history.length === 0) {
      historyList.innerHTML = '<div class="empty-state">No history yet</div>';
      return;
    }

    historyList.innerHTML = history.slice(0, 20).map(item => {
      const date = new Date(item.timestamp).toLocaleString();
      const model = item.model || 'unknown';
      return `
        <div class="history-item">
          <div class="history-input">You: ${escapeHtml((item.input || '').substring(0, 80))}${(item.input || '').length > 80 ? '...' : ''}</div>
          <div class="history-output">AI: ${escapeHtml((item.output || '').substring(0, 100))}${(item.output || '').length > 100 ? '...' : ''}</div>
          <div class="history-meta">${date} · ${model}</div>
        </div>
      `;
    }).join('');
  }

  // Search history
  historySearch.addEventListener('input', function() {
    const query = this.value.toLowerCase();
    if (!query) {
      displayHistory(allHistory);
      return;
    }
    const filtered = allHistory.filter(item =>
      (item.input || '').toLowerCase().includes(query) ||
      (item.output || '').toLowerCase().includes(query)
    );
    displayHistory(filtered);
  });

  // Export history
  exportHistoryBtn.addEventListener('click', function() {
    chrome.storage.local.get(['history'], function(result) {
      const data = {
        version: 1,
        exportedAt: new Date().toISOString(),
        history: result.history || []
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatmate-history-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('History exported!');
    });
  });

  // Import history
  importHistoryBtn.addEventListener('click', function() {
    importFile.click();
  });

  importFile.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const data = JSON.parse(event.target.result);
        if (!data.history || !Array.isArray(data.history)) {
          throw new Error('Invalid file format');
        }

        chrome.storage.local.get(['history'], function(result) {
          const existing = result.history || [];
          const merged = [...data.history, ...existing];
          // Remove duplicates based on timestamp
          const seen = new Set();
          const unique = merged.filter(item => {
            const key = item.timestamp + (item.input || '').slice(0, 50);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          // Keep last 200 entries
          const trimmed = unique.slice(0, 200);

          chrome.storage.local.set({ history: trimmed }, function() {
            allHistory = trimmed;
            displayHistory(trimmed);
            showSuccess(`Imported ${data.history.length} entries!`);
          });
        });
      } catch (err) {
        showError('Failed to import: ' + err.message);
      }
    };
    reader.readAsText(file);
    importFile.value = '';
  });

  // Clear history
  clearHistoryBtn.addEventListener('click', function() {
    if (!confirm('Clear all history? This cannot be undone.')) return;
    chrome.storage.local.set({ history: [] }, function() {
      allHistory = [];
      displayHistory([]);
      showSuccess('History cleared!');
    });
  });

  // Feedback
  function displayFeedback(feedback) {
    if (!feedback || feedback.length === 0) {
      feedbackList.innerHTML = '<div class="empty-state">No feedback yet. Rate replies with 👍/👎 in the popup to build this list.</div>';
      if (feedbackStats) feedbackStats.textContent = '';
      return;
    }
    const upCount = feedback.filter(f => f.rating === 'up').length;
    const downCount = feedback.filter(f => f.rating === 'down').length;
    const pct = Math.round((upCount / feedback.length) * 100);
    if (feedbackStats) {
      feedbackStats.innerHTML = `<strong>${upCount}</strong> 👍  <strong>${downCount}</strong> 👎  — <strong>${pct}%</strong> helpful overall (${feedback.length} total)`;
    }

    feedbackList.innerHTML = feedback.slice(0, 50).map(item => {
      const emoji = item.rating === 'up' ? '👍' : '👎';
      const cls = item.rating === 'up' ? 'feedback-up' : 'feedback-down';
      const date = new Date(item.timestamp).toLocaleDateString();
      const page = item.pageUrl ? `<a href="${escapeHtml(item.pageUrl)}" target="_blank" style="color:var(--primary);text-decoration:none;font-size:11px;">🔗 ${escapeHtml(item.pageUrl.replace(/^https?:\/\//, '').substring(0, 40))}</a>` : '';
      return `<div class="history-item ${cls}" style="border-left: 3px solid ${item.rating === 'up' ? 'var(--success)' : 'var(--danger)'};">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-size:12px;font-weight:600;">${emoji} ${date}</span>
          <span style="font-size:11px;color:var(--secondary-text);">${escapeHtml(item.model || '')}</span>
        </div>
        <div style="font-size:12px;margin-bottom:4px;color:var(--text-color);"><strong>Prompt:</strong> ${escapeHtml(item.input || '').substring(0, 120)}${(item.input || '').length > 120 ? '...' : ''}</div>
        <div style="font-size:12px;color:var(--secondary-text);white-space:pre-wrap;word-break:break-word;"><strong>Reply:</strong> ${escapeHtml(item.output || '').substring(0, 200)}${(item.output || '').length > 200 ? '...' : ''}</div>
        ${page}
      </div>`;
    }).join('');
  }

  if (clearFeedbackBtn) {
    clearFeedbackBtn.addEventListener('click', function() {
      if (!confirm('Clear all feedback ratings? This cannot be undone.')) return;
      chrome.storage.local.set({ feedbackHistory: [] }, function() {
        displayFeedback([]);
        showSuccess('Feedback cleared!');
      });
    });
  }

  // Helpers
  function showSuccess(message) {
    success.textContent = message;
    success.classList.add('show');
    error.classList.remove('show');
    setTimeout(() => success.classList.remove('show'), 3000);
  }

  function showError(message) {
    error.textContent = message;
    error.classList.add('show');
    success.classList.remove('show');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }
});

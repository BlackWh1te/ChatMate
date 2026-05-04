document.addEventListener('DOMContentLoaded', function() {
  // DOM Elements
  const ollamaUrlInput = document.getElementById('ollama-url');
  const modelSelect = document.getElementById('model-select');
  const detectModelsBtn = document.getElementById('detect-models-btn');
  const saveBtn = document.getElementById('save-btn');
  const streamingToggle = document.getElementById('streaming-toggle');
  const variantCount = document.getElementById('variant-count');
  const temperatureSlider = document.getElementById('temperature');
  const temperatureValue = document.getElementById('temperature-value');
  const maxTokens = document.getElementById('max-tokens');
  const contextLimit = document.getElementById('context-limit');
  const themeToggle = document.getElementById('theme-toggle');
  const success = document.getElementById('success');
  const error = document.getElementById('error');

  // Reference URLs
  const refUrlInput = document.getElementById('ref-url-input');
  const refUrlLabelInput = document.getElementById('ref-url-label');
  const addRefUrlBtn = document.getElementById('add-ref-url-btn');
  const refUrlsList = document.getElementById('ref-urls-list');

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

  // Load current settings
  chrome.storage.local.get([
    'ollamaUrl', 'modelName', 'templates', 'history',
    'streamingEnabled', 'variantCount', 'temperature', 'maxTokens',
    'referenceUrls', 'contextLimit'
  ], function(result) {
    ollamaUrlInput.value = result.ollamaUrl || '';
    streamingToggle.checked = result.streamingEnabled !== false;
    variantCount.value = result.variantCount || 1;
    temperatureSlider.value = result.temperature || 0.7;
    temperatureValue.textContent = temperatureSlider.value;
    maxTokens.value = result.maxTokens || 500;
    contextLimit.value = result.contextLimit || 4000;

    // Populate model dropdown
    populateModelSelect(result.modelName || 'llama2', result.models || []);

    // Display reference URLs
    displayRefUrls(result.referenceUrls || []);

    // Display templates
    displayTemplates(result.templates || []);

    // Display history
    allHistory = result.history || [];
    displayHistory(allHistory);
  });

  // Find models from Ollama (via background script to avoid CORS)
  detectModelsBtn.addEventListener('click', async function() {
    const url = ollamaUrlInput.value.trim();
    if (!url) {
      showError('Please enter Ollama URL first');
      return;
    }

    detectModelsBtn.disabled = true;
    detectModelsBtn.textContent = '🔍 Finding...';

    chrome.runtime.sendMessage({action: 'detectModels', url: url}, function(response) {
      detectModelsBtn.disabled = false;
      detectModelsBtn.textContent = '🔍 Find Models';

      if (chrome.runtime.lastError || (response && response.error)) {
        showError('Cannot connect: ' + (response?.error || chrome.runtime.lastError?.message || 'unknown error'));
        return;
      }

      if (response && response.models) {
        const modelNames = response.models;
        chrome.storage.local.set({ models: modelNames });
        populateModelSelect(modelSelect.value || modelNames[0] || 'llama2', modelNames);
        showSuccess(`Found ${modelNames.length} model${modelNames.length !== 1 ? 's' : ''}`);
      } else {
        showError('No models found');
      }
    });
  });

  function populateModelSelect(selectedModel, availableModels) {
    modelSelect.innerHTML = '';

    if (availableModels.length === 0) {
      const option = document.createElement('option');
      option.value = selectedModel || 'llama2';
      option.textContent = (selectedModel || 'llama2') + ' (manual)';
      modelSelect.appendChild(option);
    } else {
      availableModels.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        if (name === selectedModel) option.selected = true;
        modelSelect.appendChild(option);
      });
    }
  }

  // Save settings
  saveBtn.addEventListener('click', function() {
    const ollamaUrl = ollamaUrlInput.value.trim();
    const modelName = modelSelect.value.trim();
    const streaming = streamingToggle.checked;
    const variants = parseInt(variantCount.value);
    const temp = parseFloat(temperatureSlider.value);
    const tokens = parseInt(maxTokens.value);
    const ctxLimit = parseInt(contextLimit.value) || 4000;

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
      variantCount: variants,
      temperature: temp,
      maxTokens: tokens,
      contextLimit: ctxLimit
    }, function() {
      showSuccess('Saved!');
    });
  });

  // Reference URLs
  addRefUrlBtn.addEventListener('click', function() {
    const url = refUrlInput.value.trim();
    const label = refUrlLabelInput.value.trim();

    if (!url) {
      showError('Please enter a URL');
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      showError('URL must start with http:// or https://');
      return;
    }

    chrome.storage.local.get(['referenceUrls'], function(result) {
      const urls = result.referenceUrls || [];
      urls.push({ url, label: label || url, id: Date.now() });
      chrome.storage.local.set({ referenceUrls: urls }, function() {
        displayRefUrls(urls);
        refUrlInput.value = '';
        refUrlLabelInput.value = '';
        showSuccess('Reference URL added!');
      });
    });
  });

  function displayRefUrls(urls) {
    if (!urls || urls.length === 0) {
      refUrlsList.innerHTML = '<div class="empty-state">No reference URLs yet</div>';
      return;
    }

    refUrlsList.innerHTML = urls.map(item => `
      <div class="template-item" data-id="${item.id}">
        <div class="template-info">
          <div class="template-name">${escapeHtml(item.label)}</div>
          <div class="template-prompt">${escapeHtml(item.url)}</div>
        </div>
        <div class="template-actions">
          <button class="btn btn-danger small-btn delete-ref-url" data-id="${item.id}">Delete</button>
        </div>
      </div>
    `).join('');

    refUrlsList.querySelectorAll('.delete-ref-url').forEach(btn => {
      btn.addEventListener('click', function() {
        const id = parseInt(this.dataset.id);
        deleteRefUrl(id);
      });
    });
  }

  function deleteRefUrl(id) {
    if (!confirm('Delete this reference URL?')) return;

    chrome.storage.local.get(['referenceUrls'], function(result) {
      const urls = (result.referenceUrls || []).filter(u => u.id !== id);
      chrome.storage.local.set({ referenceUrls: urls }, function() {
        displayRefUrls(urls);
      });
    });
  }

  // Templates
  addTemplateBtn.addEventListener('click', function() {
    const name = templateNameInput.value.trim();
    const prompt = templatePromptInput.value.trim();

    if (!name || !prompt) {
      showError('Please enter both template name and prompt');
      return;
    }

    chrome.storage.local.get(['templates'], function(result) {
      const templates = result.templates || [];
      templates.push({ name, prompt, id: Date.now() });
      chrome.storage.local.set({ templates: templates }, function() {
        displayTemplates(templates);
        templateNameInput.value = '';
        templatePromptInput.value = '';
        showSuccess('Tone saved!');
      });
    });
  });

  function displayTemplates(templates) {
    if (!templates || templates.length === 0) {
      templatesList.innerHTML = '<div class="empty-state">No saved tones yet</div>';
      return;
    }

    templatesList.innerHTML = templates.map(template => `
      <div class="template-item" data-id="${template.id}">
        <div class="template-info">
          <div class="template-name">${escapeHtml(template.name)}</div>
          <div class="template-prompt">${escapeHtml(template.prompt)}</div>
        </div>
        <div class="template-actions">
          <button class="btn btn-danger small-btn delete-template" data-id="${template.id}">Delete</button>
        </div>
      </div>
    `).join('');

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

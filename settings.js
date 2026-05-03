document.addEventListener('DOMContentLoaded', function() {
  const ollamaUrlInput = document.getElementById('ollama-url');
  const modelNameInput = document.getElementById('model-name');
  const saveBtn = document.getElementById('save-btn');
  const success = document.getElementById('success');
  const error = document.getElementById('error');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const templateNameInput = document.getElementById('template-name');
  const templatePromptInput = document.getElementById('template-prompt');
  const addTemplateBtn = document.getElementById('add-template-btn');
  const templatesList = document.getElementById('templates-list');
  const themeToggle = document.getElementById('theme-toggle');

  // Theme handling
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
      themeToggle.title = theme === 'dark' ? 'Toggle light mode' : 'Toggle dark mode';
    }
  }

  chrome.storage.local.get(['theme'], function(result) {
    const savedTheme = result.theme || 'light';
    applyTheme(savedTheme);
  });

  if (themeToggle) {
    themeToggle.addEventListener('click', function() {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      chrome.storage.local.set({theme: newTheme});
    });
  }

  // Load current settings
  chrome.storage.local.get(['ollamaUrl', 'modelName', 'history', 'templates'], function(result) {
    ollamaUrlInput.value = result.ollamaUrl || 'http://localhost:11434';
    modelNameInput.value = result.modelName || 'llama2';
    displayHistory(result.history || []);
    displayTemplates(result.templates || []);
  });

  saveBtn.addEventListener('click', function() {
    const ollamaUrl = ollamaUrlInput.value.trim();
    const modelName = modelNameInput.value.trim();

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
      modelName: modelName
    }, function() {
      showSuccess();
    });
  });

  clearHistoryBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all history?')) {
      chrome.storage.local.set({history: []}, function() {
        displayHistory([]);
      });
    }
  });

  addTemplateBtn.addEventListener('click', function() {
    const name = templateNameInput.value.trim();
    const prompt = templatePromptInput.value.trim();

    if (!name || !prompt) {
      showError('Please enter both template name and prompt');
      return;
    }

    chrome.storage.local.get(['templates'], function(result) {
      const templates = result.templates || [];
      templates.push({name, prompt, id: Date.now()});
      chrome.storage.local.set({templates: templates}, function() {
        displayTemplates(templates);
        templateNameInput.value = '';
        templatePromptInput.value = '';
        showSuccess();
      });
    });
  });

  function displayHistory(history) {
    if (!history || history.length === 0) {
      historyList.innerHTML = '<p style="color: #666; font-size: 12px;">No history yet</p>';
      return;
    }

    historyList.innerHTML = history.map((item, index) => `
      <div class="history-item">
        <div class="history-input"><strong>You:</strong> ${escapeHtml(item.input.substring(0, 100))}${item.input.length > 100 ? '...' : ''}</div>
        <div class="history-output"><strong>AI:</strong> ${escapeHtml(item.output.substring(0, 100))}${item.output.length > 100 ? '...' : ''}</div>
      </div>
    `).join('');
  }

  function showSuccess() {
    success.classList.add('show');
    error.classList.remove('show');
    setTimeout(function() {
      success.classList.remove('show');
    }, 2000);
  }

  function showError(message) {
    error.textContent = message;
    error.classList.add('show');
    success.classList.remove('show');
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function displayTemplates(templates) {
    if (!templates || templates.length === 0) {
      templatesList.innerHTML = '<p style="color: #666; font-size: 12px;">No templates yet</p>';
      return;
    }

    templatesList.innerHTML = templates.map(template => `
      <div class="history-item" style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: bold; color: #333;">${escapeHtml(template.name)}</div>
          <div style="color: #666; font-size: 11px;">${escapeHtml(template.prompt)}</div>
        </div>
        <button onclick="deleteTemplate(${template.id})" style="background: #dc3545; padding: 4px 8px; font-size: 11px; width: auto;">Delete</button>
      </div>
    `).join('');
  }

  // Make deleteTemplate available globally
  window.deleteTemplate = function(id) {
    if (confirm('Delete this template?')) {
      chrome.storage.local.get(['templates'], function(result) {
        const templates = result.templates || [];
        const filtered = templates.filter(t => t.id !== id);
        chrome.storage.local.set({templates: filtered}, function() {
          displayTemplates(filtered);
        });
      });
    }
  };
});

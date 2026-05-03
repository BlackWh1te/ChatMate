document.addEventListener('DOMContentLoaded', function() {
  const inputText = document.getElementById('input-text');
  const templateSelect = document.getElementById('template-select');
  const generateBtn = document.getElementById('generate-btn');
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  const response = document.getElementById('response');
  const actions = document.getElementById('actions');
  const copyBtn = document.getElementById('copy-btn');
  const clearBtn = document.getElementById('clear-btn');
  const themeToggle = document.getElementById('theme-toggle');

  // Theme handling
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    themeToggle.title = theme === 'dark' ? 'Toggle light mode' : 'Toggle dark mode';
  }

  chrome.storage.local.get(['theme'], function(result) {
    const savedTheme = result.theme || 'light';
    applyTheme(savedTheme);
  });

  themeToggle.addEventListener('click', function() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    chrome.storage.local.set({theme: newTheme});
  });

  // Load settings and templates
  chrome.storage.local.get(['ollamaUrl', 'modelName', 'templates'], function(result) {
    if (!result.ollamaUrl) {
      showError('Please configure your Ollama URL in Settings');
      generateBtn.disabled = true;
    }

    // Load templates
    const templates = result.templates || [];
    templates.forEach(template => {
      const option = document.createElement('option');
      option.value = template.id;
      option.textContent = template.name;
      templateSelect.appendChild(option);
    });
  });

  // Check for pending text from context menu or keyboard shortcut
  chrome.runtime.sendMessage({action: 'getPendingText'}, function(response) {
    if (response && response.text) {
      inputText.value = response.text;
    } else {
      // Fallback: get selected text from active tab
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'getSelectedText'}, function(tabResponse) {
          if (tabResponse && tabResponse.text) {
            inputText.value = tabResponse.text;
          }
        });
      });
    }
  });

  generateBtn.addEventListener('click', async function() {
    const text = inputText.value.trim();
    if (!text) {
      showError('Please enter some text');
      return;
    }

    showLoading(true);
    hideError();
    response.classList.remove('show');
    actions.style.display = 'none';

    try {
      const settings = await getSettings();
      if (!settings.ollamaUrl) {
        throw new Error('Please configure Ollama URL in Settings');
      }

      // Get selected template
      const templateId = templateSelect.value;
      let systemPrompt = 'Help me write a response to this message. Keep it natural and conversational';
      
      if (templateId) {
        const templates = await getTemplates();
        const template = templates.find(t => t.id == templateId);
        if (template) {
          systemPrompt = template.prompt;
        }
      }

      const aiResponse = await callOllama(text, settings, systemPrompt);
      response.textContent = aiResponse;
      response.classList.add('show');
      actions.style.display = 'flex';
      
      // Save to history
      saveToHistory(text, aiResponse);
    } catch (err) {
      showError(err.message);
    } finally {
      showLoading(false);
    }
  });

  copyBtn.addEventListener('click', function() {
    navigator.clipboard.writeText(response.textContent).then(function() {
      copyBtn.textContent = 'Copied!';
      setTimeout(function() {
        copyBtn.textContent = 'Copy';
      }, 2000);
    });
  });

  clearBtn.addEventListener('click', function() {
    inputText.value = '';
    response.textContent = '';
    response.classList.remove('show');
    actions.style.display = 'none';
    hideError();
  });

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ollamaUrl', 'modelName'], function(result) {
        resolve({
          ollamaUrl: result.ollamaUrl || 'http://localhost:11434',
          modelName: result.modelName || 'llama2'
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

  async function callOllama(prompt, settings, systemPrompt) {
    const url = `${settings.ollamaUrl}/api/generate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: settings.modelName,
        prompt: `${systemPrompt}:\n\n${prompt}`,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  function saveToHistory(input, output) {
    chrome.storage.local.get(['history'], function(result) {
      const history = result.history || [];
      history.unshift({
        input: input,
        output: output,
        timestamp: Date.now()
      });
      // Keep only last 50 entries
      if (history.length > 50) {
        history.pop();
      }
      chrome.storage.local.set({history: history});
    });
  }

  function showLoading(show) {
    loading.classList.toggle('show', show);
    generateBtn.disabled = show;
  }

  function showError(message) {
    error.textContent = message;
    error.classList.add('show');
  }

  function hideError() {
    error.classList.remove('show');
  }
});

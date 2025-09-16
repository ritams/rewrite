document.addEventListener('DOMContentLoaded', async () => {
  const apiKeyInput = document.getElementById('apiKey');
  const saveButton = document.getElementById('save');
  const statusDiv = document.getElementById('status');

  // Load saved API key if it exists
  const result = await chrome.storage.sync.get(['geminiApiKey']);
  if (result.geminiApiKey) {
    apiKeyInput.value = result.geminiApiKey;
  }

  saveButton.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showStatus('API key cannot be empty', 'error');
      return;
    }

    try {
      await chrome.storage.sync.set({ geminiApiKey: apiKey });
      showStatus('API key saved successfully!', 'success');
      // Close the popup after a short delay
      setTimeout(() => window.close(), 1500);
    } catch (error) {
      console.error('Error saving API key:', error);
      showStatus('Failed to save API key', 'error');
    }
  });

  function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = type;
    statusDiv.style.display = 'block';
  }
});

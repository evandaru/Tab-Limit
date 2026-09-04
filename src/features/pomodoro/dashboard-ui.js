export function initPomodoroDashboard() {
    const sizeSlider = document.getElementById('pomoSizeSlider');
    const textInput = document.getElementById('pomoDefaultText');
    const previewImg = document.getElementById('pomoPreviewImg');
    const previewText = document.getElementById('pomoPreviewText');
    const saveBtn = document.getElementById('savePomoBtn');

    if (!saveBtn) return;

    // Live-sync text & size preview
    const updateLivePreview = () => {
        const text = textInput.value || "stay focused";
        previewText.innerHTML = `${text}<br>25:00 left`;
        if (sizeSlider && previewImg) {
            previewImg.style.width = `${sizeSlider.value}px`;
        }
    };

    if (textInput) textInput.addEventListener('input', updateLivePreview);
    if (sizeSlider) sizeSlider.addEventListener('input', updateLivePreview);

    // Load data from storage (no more pomoImage)
    chrome.storage.local.get(['pomoSize', 'pomoDefaultText'], (data) => {
        if (data.pomoSize && sizeSlider) sizeSlider.value = data.pomoSize;
        if (data.pomoDefaultText && textInput) textInput.value = data.pomoDefaultText;
        updateLivePreview();
    });

    // Save handler
    saveBtn.addEventListener('click', async () => {
        const settings = {
            pomoSize: sizeSlider ? parseInt(sizeSlider.value) : 120,
            pomoDefaultText: textInput ? textInput.value : "stay focused",
            pomoText: textInput ? textInput.value : "stay focused"
        };

        await chrome.storage.local.set(settings);

        // Optional: remove any leftover pomoImage from user storage
        chrome.storage.local.remove('pomoImage');

        alert("✅ Settings saved!");
    });
}
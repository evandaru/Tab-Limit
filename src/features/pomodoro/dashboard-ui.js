export function initPomodoroDashboard() {
    const sizeSlider = document.getElementById('pomoSizeSlider');
    const textInput = document.getElementById('pomoDefaultText');
    const previewImg = document.getElementById('pomoPreviewImg');
    const previewText = document.getElementById('pomoPreviewText');
    const saveBtn = document.getElementById('savePomoBtn');

    if (!saveBtn) return;

    // Sinkronisasi Live Preview Teks & Ukuran
    const updateLivePreview = () => {
        const text = textInput.value || "mangat2";
        previewText.innerHTML = `${text}<br>kurang 25:00`;
        if (sizeSlider && previewImg) {
            previewImg.style.width = `${sizeSlider.value}px`;
        }
    };

    if (textInput) textInput.addEventListener('input', updateLivePreview);
    if (sizeSlider) sizeSlider.addEventListener('input', updateLivePreview);

    // Load Data dari Storage (sudah tanpa pomoImage)
    chrome.storage.local.get(['pomoSize', 'pomoDefaultText'], (data) => {
        if (data.pomoSize && sizeSlider) sizeSlider.value = data.pomoSize;
        if (data.pomoDefaultText && textInput) textInput.value = data.pomoDefaultText;
        updateLivePreview();
    });

    // Handler Simpan
    saveBtn.addEventListener('click', async () => {
        const settings = {
            pomoSize: sizeSlider ? parseInt(sizeSlider.value) : 120,
            pomoDefaultText: textInput ? textInput.value : "mangat2",
            pomoText: textInput ? textInput.value : "mangat2"
        };

        await chrome.storage.local.set(settings);

        // Opsional: Hapus sisa pomoImage lama jika masih ada di storage pengguna
        chrome.storage.local.remove('pomoImage');

        alert("✅ Pengaturan berhasil disimpan!");
    });
}
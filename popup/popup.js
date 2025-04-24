const selectedImagesContainer = document.getElementById('selected-images');
const imageCountElement = document.getElementById('image-count');
const folderInput = document.getElementById('folder');
const setFolderButton = document.getElementById('set-folder');
const selectAllButton = document.getElementById('select-all');
const clearSelectionButton = document.getElementById('clear-selection');
const downloadSelectedButton = document.getElementById('download-selected');
const downloadProgress = document.getElementById('download-progress');
const progressValue = document.querySelector('.progress-value');
const progressCount = document.getElementById('progress-count');
const statusMessage = document.getElementById('status-message');
const extensionToggle = document.getElementById('extension-toggle');
const cancelDownloadButton = document.getElementById('cancel-download');
const resumeDownloadButton = document.getElementById('resume-download');

let selectedImages = [];
let downloadedImages = {};
let totalImagesToDownload = 0;
let downloadedCount = 0;
let extensionEnabled = true;
let isDownloadPaused = false;

// Initialize popup
function initPopup() {
    // Load the extension state
    chrome.storage.local.get(['extensionEnabled'], (result) => {
        if (result.hasOwnProperty('extensionEnabled')) {
            extensionEnabled = result.extensionEnabled;
            extensionToggle.checked = extensionEnabled;
            updateUIBasedOnState();
        }
    });

    // Load the current download folder
    chrome.runtime.sendMessage({ action: 'getDownloadFolder' }, (response) => {
        if (response && response.folder) {
            folderInput.value = response.folder;
        }
    });
    
    // Get downloaded images history
    chrome.runtime.sendMessage({ action: 'getDownloadedImages' }, (response) => {
        if (response && response.downloadedImages) {
            downloadedImages = response.downloadedImages;
        }
        
        // Get selected images from active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedImages' }, (response) => {
                    if (response && response.images) {
                        selectedImages = response.images;
                        updateSelectedImagesDisplay();
                    }
                });
            }
        });
    });
    
    // Check if there's an ongoing download
    chrome.runtime.sendMessage({ action: 'getDownloadStatus' }, (response) => {
        if (response) {
            if (response.isDownloading || response.isPaused) {
                // We have an active or paused download
                totalImagesToDownload = response.queueLength + downloadedCount;
                downloadProgress.classList.remove('hidden');
                
                if (response.isPaused) {
                    isDownloadPaused = true;
                    togglePauseResumeUI(true);
                    statusMessage.textContent = `Download paused (${response.pausedQueueLength} images remaining)`;
                }
            }
        }
    });
}

// Update UI based on extension state
function updateUIBasedOnState() {
    const selectionControls = document.querySelectorAll('#select-all, #clear-selection');
    
    selectionControls.forEach(button => {
        button.disabled = !extensionEnabled;
        button.style.opacity = extensionEnabled ? '1' : '0.5';
    });
    
    if (!extensionEnabled) {
        statusMessage.textContent = 'Image selection mode is disabled';
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
    } else {
        statusMessage.textContent = 'Image selection mode is enabled';
        setTimeout(() => {
            statusMessage.textContent = '';
        }, 3000);
    }
}

// Toggle UI between pause and resume states
function togglePauseResumeUI(isPaused) {
    isDownloadPaused = isPaused;
    
    if (isPaused) {
        cancelDownloadButton.classList.remove('hidden');
        resumeDownloadButton.classList.remove('hidden');
        downloadSelectedButton.classList.add('hidden');
    } else {
        cancelDownloadButton.classList.remove('hidden');
        resumeDownloadButton.classList.add('hidden');
        downloadSelectedButton.classList.add('hidden');
    }
}

// Toggle extension state
function toggleExtensionState() {
    extensionEnabled = extensionToggle.checked;
    
    // Save the state
    chrome.storage.local.set({ extensionEnabled });
    
    // Update the UI
    updateUIBasedOnState();
    
    // Notify content script of state change
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'setExtensionState',
                enabled: extensionEnabled
            });
        }
    });
    
    // If disabling, clear current selection
    if (!extensionEnabled) {
        clearSelection();
    }
}

// Update the selected images display
function updateSelectedImagesDisplay() {
    // Clear the container
    selectedImagesContainer.innerHTML = '';
    
    // Update the count
    imageCountElement.textContent = `(${selectedImages.length})`;
    
    if (selectedImages.length === 0) {
        selectedImagesContainer.innerHTML = '<div class="no-images">No images selected. Click on images in the web page to select them.</div>';
        return;
    }
    
    // Add each image to the container
    selectedImages.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        // Add downloaded class if the image has been downloaded
        if (downloadedImages[image.src]) {
            imageItem.classList.add('downloaded');
        }
        
        // Create thumbnail
        const img = document.createElement('img');
        img.src = image.src;
        img.alt = `Selected image ${index + 1}`;
        imageItem.appendChild(img);
        
        // Add remove button
        const removeButton = document.createElement('div');
        removeButton.className = 'remove';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => removeSelectedImage(index));
        imageItem.appendChild(removeButton);
        
        // Add status
        const status = document.createElement('div');
        status.className = 'status';
        status.textContent = downloadedImages[image.src] ? 'Downloaded' : 'Not downloaded';
        imageItem.appendChild(status);
        
        selectedImagesContainer.appendChild(imageItem);
    });
}

// Remove an image from the selection
function removeSelectedImage(index) {
    selectedImages.splice(index, 1);
    
    // Update selection in content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'updateSelectedImages',
                images: selectedImages
            });
        }
    });
    
    // Update display
    updateSelectedImagesDisplay();
}

// Set the download folder
function setDownloadFolder() {
    const folder = folderInput.value.trim();
    
    chrome.runtime.sendMessage({ 
        action: 'setDownloadFolder',
        folder: folder
    }, (response) => {
        if (response && response.success) {
            statusMessage.textContent = `Download folder set to: ${folder}`;
            setTimeout(() => {
                statusMessage.textContent = '';
            }, 3000);
        }
    });
}

// Select all images on the page
function selectAllImages() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'selectAllImages' }, (response) => {
                if (response && response.success) {
                    statusMessage.textContent = `Selected ${response.count} images`;
                    
                    // Refresh our list
                    chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedImages' }, (response) => {
                        if (response && response.images) {
                            selectedImages = response.images;
                            updateSelectedImagesDisplay();
                        }
                    });
                }
            });
        }
    });
}

// Clear all selected images
function clearSelection() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'clearSelectedImages' }, (response) => {
                if (response && response.success) {
                    selectedImages = [];
                    updateSelectedImagesDisplay();
                    statusMessage.textContent = 'Selection cleared';
                    setTimeout(() => {
                        statusMessage.textContent = '';
                    }, 3000);
                }
            });
        }
    });
}

// Download selected images
function downloadSelectedImages() {
    if (selectedImages.length === 0) {
        statusMessage.textContent = 'No images selected';
        return;
    }
    
    // Reset progress
    downloadedCount = 0;
    totalImagesToDownload = selectedImages.length;
    updateDownloadProgress();
    
    // Show progress bar and cancel button
    downloadProgress.classList.remove('hidden');
    togglePauseResumeUI(false);
    
    // Start download
    chrome.runtime.sendMessage({
        action: 'downloadImages',
        images: selectedImages,
        folder: folderInput.value.trim()
    }, (response) => {
        if (response && response.success) {
            statusMessage.textContent = `Downloading ${response.queueLength} images...`;
        }
    });
}

// Update download progress
function updateDownloadProgress() {
    const percent = totalImagesToDownload > 0 ? (downloadedCount / totalImagesToDownload) * 100 : 0;
    progressValue.style.width = `${percent}%`;
    progressCount.textContent = `${downloadedCount}/${totalImagesToDownload}`;
    
    if (downloadedCount >= totalImagesToDownload && totalImagesToDownload > 0) {
        statusMessage.textContent = 'Download complete!';
        setTimeout(() => {
            downloadProgress.classList.add('hidden');
            statusMessage.textContent = '';
            // Reset UI to original state
            downloadSelectedButton.classList.remove('hidden');
            cancelDownloadButton.classList.add('hidden');
            resumeDownloadButton.classList.add('hidden');
        }, 3000);
    }
}

// Cancel the current download
function cancelDownload() {
    chrome.runtime.sendMessage({ action: 'cancelDownload' }, (response) => {
        if (response && response.success) {
            statusMessage.textContent = `Download cancelled (${response.cancelled} images remaining)`;
            
            // Update UI
            downloadProgress.classList.add('hidden');
            downloadSelectedButton.classList.remove('hidden');
            cancelDownloadButton.classList.add('hidden');
            resumeDownloadButton.classList.add('hidden');
            
            // Reset download state
            isDownloadPaused = false;
            
            setTimeout(() => {
                statusMessage.textContent = '';
            }, 3000);
        }
    });
}

// Pause the current download
function pauseDownload() {
    chrome.runtime.sendMessage({ action: 'pauseDownload' }, (response) => {
        if (response && response.success) {
            statusMessage.textContent = `Download paused (${response.remaining} images remaining)`;
            
            // Update UI
            togglePauseResumeUI(true);
            isDownloadPaused = true;
        }
    });
}

// Resume a paused download
function resumeDownload() {
    chrome.runtime.sendMessage({ action: 'resumeDownload' }, (response) => {
        if (response && response.success) {
            statusMessage.textContent = `Resuming download (${response.queueLength} images remaining)...`;
            
            // Update UI
            togglePauseResumeUI(false);
            isDownloadPaused = false;
        }
    });
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'imageDownloaded') {
        downloadedCount++;
        
        // Update our local record of downloaded images
        if (message.image && message.image.src) {
            downloadedImages[message.image.src] = {
                timestamp: Date.now(),
                filename: message.image.filename
            };
        }
        
        updateDownloadProgress();
        updateSelectedImagesDisplay();
    } else if (message.action === 'imageDownloadFailed') {
        // Count failed downloads in progress
        downloadedCount++;
        
        // Mark image with error
        if (message.image && message.image.src) {
            // Find the corresponding image item and update its status
            const imageItems = document.querySelectorAll('.image-item');
            imageItems.forEach(item => {
                const img = item.querySelector('img');
                if (img && img.src === message.image.src) {
                    item.classList.add('failed');
                    const status = item.querySelector('.status');
                    if (status) {
                        status.textContent = 'Failed: ' + (message.error || 'Unknown error');
                    }
                }
            });
            
            // Show error in status message
            statusMessage.textContent = `Failed to download image: ${message.error}`;
        }
        
        updateDownloadProgress();
    } else if (message.action === 'downloadComplete') {
        updateDownloadProgress();
    } else if (message.action === 'downloadPaused') {
        statusMessage.textContent = `Download paused (${message.remaining} images remaining)`;
        togglePauseResumeUI(true);
    } else if (message.action === 'downloadCancelled') {
        statusMessage.textContent = `Download cancelled`;
        downloadProgress.classList.add('hidden');
        downloadSelectedButton.classList.remove('hidden');
        cancelDownloadButton.classList.add('hidden');
        resumeDownloadButton.classList.add('hidden');
    } else if (message.action === 'updateSelectedImages') {
        // Refresh our display
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getSelectedImages' }, (response) => {
                    if (response && response.images) {
                        selectedImages = response.images;
                        updateSelectedImagesDisplay();
                    }
                });
            }
        });
    }
});

// Add a new event listener for the toggle
extensionToggle.addEventListener('change', toggleExtensionState);

// Add view history button handler
document.getElementById('view-history').addEventListener('click', () => {
    chrome.tabs.create({ url: 'popup/history.html' });
});

// Event listeners
setFolderButton.addEventListener('click', setDownloadFolder);
selectAllButton.addEventListener('click', selectAllImages);
clearSelectionButton.addEventListener('click', clearSelection);
downloadSelectedButton.addEventListener('click', downloadSelectedImages);
cancelDownloadButton.addEventListener('click', cancelDownload);
resumeDownloadButton.addEventListener('click', resumeDownload);

// Initialize the popup when the DOM is loaded
document.addEventListener('DOMContentLoaded', initPopup);
/* Background script for image downloader extension */

// Keep track of which images have been downloaded
let downloadedImages = {};
let downloadQueue = [];
let pausedQueue = [];
let isDownloading = false;
let isPaused = false;
let downloadFolder = '';

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Update the list of selected images
    if (message.action === 'updateSelectedImages') {
        // Save selected images to storage
        chrome.storage.local.set({ selectedImages: message.images });
    } else if (message.action === 'historyCleared') {
        // Clear downloaded images state
        downloadedImages = {};
        sendResponse({ success: true });
    } else if (message.action === 'historyImported') {
        // Update downloaded images state with merged history
        downloadedImages = message.mergedHistory;
        sendResponse({ success: true });
    }
    
    // Start downloading selected images
    else if (message.action === 'downloadImages') {
        downloadFolder = message.folder || '';
        
        // If download was paused, use the paused queue
        if (isPaused && pausedQueue.length > 0) {
            downloadQueue = pausedQueue;
            pausedQueue = [];
            isPaused = false;
        } else {
            downloadQueue = message.images || [];
        }
        
        if (downloadQueue.length > 0 && !isDownloading) {
            processDownloadQueue();
        }
        
        sendResponse({ success: true, queueLength: downloadQueue.length });
    }
    
    // Pause the current download process
    else if (message.action === 'pauseDownload') {
        // Only pause if currently downloading
        if (isDownloading) {
            isPaused = true;
            // Store the remaining queue for later
            pausedQueue = downloadQueue;
            downloadQueue = [];
            isDownloading = false;
            
            chrome.runtime.sendMessage({
                action: 'downloadPaused',
                remaining: pausedQueue.length
            });
            
            sendResponse({ success: true, remaining: pausedQueue.length });
        } else {
            sendResponse({ success: false, message: 'No active download to pause' });
        }
    }
    
    // Resume a paused download
    else if (message.action === 'resumeDownload') {
        if (isPaused && pausedQueue.length > 0) {
            isPaused = false;
            downloadQueue = pausedQueue;
            pausedQueue = [];
            
            if (!isDownloading) {
                processDownloadQueue();
            }
            
            sendResponse({ success: true, queueLength: downloadQueue.length });
        } else {
            sendResponse({ success: false, message: 'No paused download to resume' });
        }
    }
    
    // Cancel the current download process
    else if (message.action === 'cancelDownload') {
        const remainingCount = downloadQueue.length + (isPaused ? pausedQueue.length : 0);
        
        // Clear all queues
        downloadQueue = [];
        pausedQueue = [];
        isDownloading = false;
        isPaused = false;
        
        chrome.runtime.sendMessage({
            action: 'downloadCancelled',
            cancelled: remainingCount
        });
        
        sendResponse({ success: true, cancelled: remainingCount });
    }
    
    // Get downloaded images status
    else if (message.action === 'getDownloadedImages') {
        sendResponse({ downloadedImages });
    }
    
    // Get download status
    else if (message.action === 'getDownloadStatus') {
        sendResponse({
            isDownloading: isDownloading,
            isPaused: isPaused,
            queueLength: downloadQueue.length,
            pausedQueueLength: pausedQueue.length
        });
    }
    
    // Set download folder
    else if (message.action === 'setDownloadFolder') {
        downloadFolder = message.folder;
        chrome.storage.local.set({ downloadFolder });
        sendResponse({ success: true });
    }
    
    // Get download folder
    else if (message.action === 'getDownloadFolder') {
        chrome.storage.local.get(['downloadFolder'], (result) => {
            downloadFolder = result.downloadFolder || '';
            sendResponse({ folder: downloadFolder });
        });
        return true; // Keep the message channel open for the async response
    }
    
    // Return true to use sendResponse asynchronously
    return true;
});

// Process download queue
function processDownloadQueue() {
    if (downloadQueue.length === 0 || isPaused) {
        isDownloading = false;
        
        if (!isPaused) {
            chrome.runtime.sendMessage({
                action: 'downloadComplete'
            });
        }
        return;
    }
    
    isDownloading = true;
    const image = downloadQueue.shift();
    
    // Skip if already downloaded
    if (downloadedImages[image.src]) {
        processDownloadQueue();
        return;
    }
    
    try {
        // Prepare filename with folder if specified
        let filename = image.filename;
        if (downloadFolder) {
            filename = downloadFolder + '/' + filename;
        }
        
        // Ensure the filename ends with .png
        if (!filename.toLowerCase().endsWith('.png')) {
            filename = filename.replace(/\.[^/.]+$/, "") + '.png';
        }
        
        // Handle base64 images differently
        if (image.src.startsWith('data:')) {
            // For base64 images, we already have the data
            chrome.downloads.download({
                url: image.src,
                filename: filename,
                saveAs: false
            }, (downloadId) => handleDownloadComplete(downloadId, image));
        } else {
            // For regular URLs, download directly from source
            chrome.downloads.download({
                url: image.src,
                filename: filename,
                saveAs: false
            }, (downloadId) => handleDownloadComplete(downloadId, image));
        }
    } catch (error) {
        console.error('Error setting up download:', error);
        
        // Notify popup about the failed download
        chrome.runtime.sendMessage({
            action: 'imageDownloadFailed',
            image: image,
            error: error.message || 'Failed to set up download',
            remaining: downloadQueue.length
        });
        
        // Continue with next image in queue even if there's an error
        if (!isPaused) {
            setTimeout(processDownloadQueue, 300);
        } else {
            isDownloading = false;
        }
    }
}

// Handle download completion
function handleDownloadComplete(downloadId, image) {
    if (downloadId) {
        // Mark as downloaded if successful
        downloadedImages[image.src] = {
            timestamp: Date.now(),
            filename: image.filename,
            folder: downloadFolder || 'Default Directory' // Add folder information
        };
        
        // Save downloaded image info to storage
        chrome.storage.local.set({ downloadedImages });
        
        // Notify popup that an image was downloaded
        chrome.runtime.sendMessage({
            action: 'imageDownloaded',
            image: image,
            remaining: downloadQueue.length
        });
    } else {
        // Handle download error
        const error = chrome.runtime.lastError ? chrome.runtime.lastError.message : 'Unknown error';
        console.error('Error downloading image:', error);
        
        // Notify popup about the failed download
        chrome.runtime.sendMessage({
            action: 'imageDownloadFailed',
            image: image,
            error: error || 'Failed to download image',
            remaining: downloadQueue.length
        });
    }
    
    // Check if we should continue (not paused and still has images)
    if (!isPaused) {
        // Continue with next image in queue
        setTimeout(processDownloadQueue, 300);
    } else {
        isDownloading = false;
    }
}

// Initialize by loading download history from storage
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['downloadedImages', 'downloadFolder'], (result) => {
        if (result.downloadedImages) {
            downloadedImages = result.downloadedImages;
        }
        
        if (result.downloadFolder) {
            downloadFolder = result.downloadFolder;
        }
    });
});
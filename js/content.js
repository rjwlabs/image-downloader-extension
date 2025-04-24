// Keep track of selected images
let selectedImages = [];
let extensionEnabled = true;
let overlays = [];
let downloadedImages = {};

// Check if an image has already been downloaded
function isImageDownloaded(imgSrc) {
    return downloadedImages[imgSrc] !== undefined;
}

// Check if an image has already been selected
function isImageSelected(imgSrc) {
    return selectedImages.some(img => img.src === imgSrc);
}

// Show or hide all selection overlays based on extension state
function toggleOverlays(show) {
    overlays.forEach(overlay => {
        overlay.style.display = show ? 'block' : 'none';
    });
}

// Get the full resolution image URL if available
function getFullResolutionImageUrl(img) {
    // Default to the src attribute
    let imageUrl = img.src;
    
    // Handle base64 encoded images
    if (imageUrl.startsWith('data:')) {
        return imageUrl;
    }
    
    // Check for common high-resolution image attributes
    if (img.dataset.src) {
        imageUrl = img.dataset.src;
    } else if (img.getAttribute('data-original')) {
        imageUrl = img.getAttribute('data-original');
    } else if (img.srcset) {
        // If srcset is available, get the highest resolution image
        const srcset = img.srcset.split(',');
        let maxWidth = 0;
        let bestSrc = imageUrl;
        
        srcset.forEach(src => {
            const parts = src.trim().split(' ');
            if (parts.length >= 2) {
                const url = parts[0];
                const widthMatch = parts[1].match(/^(\d+)w$/);
                if (widthMatch && widthMatch[1]) {
                    const width = parseInt(widthMatch[1], 10);
                    if (width > maxWidth) {
                        maxWidth = width;
                        bestSrc = url;
                    }
                }
            }
        });
        
        if (bestSrc !== imageUrl) {
            imageUrl = bestSrc;
        }
    }
    
    // Check for Google Images specific structure
    if (window.location.hostname.includes('google')) {
        // Check for base64 images
        if (img.src && img.src.startsWith('data:')) {
            return img.src;
        }
        
        // Look for parent anchor with href pointing to the original image
        const parent = img.closest('a');
        if (parent && parent.href) {
            // Google Images often has the image URL as a parameter in the link
            const urlParams = new URLSearchParams(new URL(parent.href).search);
            const imageParam = urlParams.get('imgurl') || urlParams.get('imgrefurl');
            if (imageParam) {
                imageUrl = imageParam;
            }
        }
        
        // Check for metadata stored in parent elements
        const container = img.closest('div[data-tbnid]');
        if (container) {
            const metadata = container.querySelector('[data-lpage]');
            if (metadata && metadata.dataset.lpage) {
                imageUrl = metadata.dataset.lpage;
            }
        }
    }
    
    return imageUrl;
}

// Add selection overlay to images when hovered
function addImageSelectionFunctionality() {
    const images = document.querySelectorAll('img');
    
    // Clear existing overlays
    overlays.forEach(overlay => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }
    });
    overlays = [];
    
    images.forEach(img => {
        // Skip tiny images or icons
        if (img.width < 50 || img.height < 50) return;
        
        // Create selection overlay
        const overlay = document.createElement('div');
        overlay.className = 'image-selector-overlay';
        
        // Initial display state based on extension enabled status
        overlay.style.display = extensionEnabled ? 'block' : 'none';
        
        // Position the overlay over the image
        const updateOverlayPosition = () => {
            const rect = img.getBoundingClientRect();
            overlay.style.top = `${rect.top + window.scrollY}px`;
            overlay.style.left = `${rect.left + window.scrollX}px`;
            overlay.style.width = `${img.offsetWidth}px`;
            overlay.style.height = `${img.offsetHeight}px`;
        };
        
        updateOverlayPosition();
        
        // Update overlay position on window resize
        window.addEventListener('resize', updateOverlayPosition);
        
        // Add selection indicator
        const indicator = document.createElement('div');
        indicator.className = 'image-selector-indicator';
        overlay.appendChild(indicator);
        
        // Add the overlay to the document
        document.body.appendChild(overlay);
        overlays.push(overlay);
        
        // Get full resolution image URL
        const imgSrc = getFullResolutionImageUrl(img);
        
        // Check if image is downloaded and mark accordingly
        if (isImageDownloaded(imgSrc)) {
            overlay.classList.add('downloaded');
        }
        
        // Handle click events on overlay instead of image
        overlay.addEventListener('click', (event) => {
            // Only process clicks if extension is enabled
            if (!extensionEnabled) return true;
            
            event.preventDefault();
            event.stopPropagation();
            
            // If already selected, remove from selection
            if (isImageSelected(imgSrc)) {
                selectedImages = selectedImages.filter(image => image.src !== imgSrc);
                overlay.classList.remove('selected');
            } else {
                // Otherwise, add to selection
                // Get base filename without extension
                let filename = imgSrc.split('/').pop().split('?')[0] || 'image';
                // Remove any existing extension and add .png
                filename = filename.replace(/\.[^/.]+$/, "") + '.png';
                
                selectedImages.push({
                    src: imgSrc,
                    filename: filename,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    originalSrc: img.src, // Keep track of original src for identification
                    isDownloaded: isImageDownloaded(imgSrc)
                });
                overlay.classList.add('selected');
            }
            
            // Send updated selection to popup
            chrome.runtime.sendMessage({
                action: 'updateSelectedImages',
                images: selectedImages
            });
            
            return false;
        });
        
        // Show which images are already selected
        if (isImageSelected(imgSrc) || 
            selectedImages.some(selected => selected.originalSrc === img.src)) {
            overlay.classList.add('selected');
        }
    });
}

// Initialize the extension
function initializeExtension() {
    // Get extension enabled state, previously selected images, and downloaded images from storage
    chrome.storage.local.get(['selectedImages', 'extensionEnabled', 'downloadedImages'], (result) => {
        if (result.selectedImages) {
            selectedImages = result.selectedImages;
        }
        
        if (result.hasOwnProperty('extensionEnabled')) {
            extensionEnabled = result.extensionEnabled;
        }
        
        downloadedImages = result.downloadedImages || {}; // Ensure it's an empty object if undefined
        
        // Set up image selection functionality and mark downloaded images
        addImageSelectionFunctionality();
    });
    
    // Also get fresh downloaded images list from background script
    chrome.runtime.sendMessage({ action: 'getDownloadedImages' }, (response) => {
        if (response && response.downloadedImages) {
            downloadedImages = response.downloadedImages;
            // Refresh overlays to show downloaded state
            addImageSelectionFunctionality();
        }
    });
}

// Listen for messages from popup or background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSelectedImages') {
        sendResponse({ images: selectedImages });
    } else if (message.action === 'clearSelectedImages') {
        selectedImages = [];
        
        // Remove selected class from all overlays
        document.querySelectorAll('.image-selector-overlay').forEach(overlay => {
            overlay.classList.remove('selected');
        });
        
        // Update storage
        chrome.storage.local.set({ selectedImages: [] });
        
        sendResponse({ success: true });
    } else if (message.action === 'selectAllImages') {
        // If extension is disabled, don't select anything
        if (!extensionEnabled) {
            sendResponse({ success: false, message: 'Extension is disabled' });
            return true;
        }
        
        // Find all valid images on the page
        const images = document.querySelectorAll('img');
        
        images.forEach(img => {
            // Skip tiny images or icons
            if (img.width < 50 || img.height < 50) return;
            
            // Get full resolution image URL if available
            const imgSrc = getFullResolutionImageUrl(img);
            
            // Skip if already selected
            if (isImageSelected(imgSrc)) return;
            
            // Get base filename without extension
            let filename = imgSrc.split('/').pop().split('?')[0] || 'image';
            // Remove any existing extension and add .png
            filename = filename.replace(/\.[^/.]+$/, "") + '.png';
            
            // Add to selection
            selectedImages.push({
                src: imgSrc,
                filename: filename,
                width: img.naturalWidth,
                height: img.naturalHeight,
                originalSrc: img.src // Keep track of original src for identification
            });
            
            // Find and update the overlay for this image
            document.querySelectorAll('.image-selector-overlay').forEach(overlay => {
                const rect = img.getBoundingClientRect();
                const overlayRect = overlay.getBoundingClientRect();
                
                // Check if this overlay belongs to the current image
                if (Math.abs(rect.top - overlayRect.top) < 5 && 
                    Math.abs(rect.left - overlayRect.left) < 5) {
                    overlay.classList.add('selected');
                }
            });
        });
        
        // Send updated selection to popup
        chrome.runtime.sendMessage({
            action: 'updateSelectedImages',
            images: selectedImages
        });
        
        sendResponse({ success: true, count: selectedImages.length });
    } else if (message.action === 'updateSelectedImages') {
        selectedImages = message.images || [];
        
        // Update all overlays first
        document.querySelectorAll('.image-selector-overlay').forEach(overlay => {
            overlay.classList.remove('selected');
        });
        
        // Find and mark selected images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            const imgSrc = getFullResolutionImageUrl(img);
            
            // Check if this image is selected
            if (isImageSelected(imgSrc) || 
                selectedImages.some(selected => selected.originalSrc === img.src)) {
                // Find the overlay for this image
                const overlays = document.querySelectorAll('.image-selector-overlay');
                for (const overlay of overlays) {
                    const rect = img.getBoundingClientRect();
                    const overlayRect = overlay.getBoundingClientRect();
                    
                    if (Math.abs(rect.top - overlayRect.top) < 5 && 
                        Math.abs(rect.left - overlayRect.left) < 5) {
                        overlay.classList.add('selected');
                        break;
                    }
                }
            }
        });
        
        // Update storage
        chrome.storage.local.set({ selectedImages });
        
        sendResponse({ success: true });
    } else if (message.action === 'setExtensionState') {
        extensionEnabled = message.enabled;
        
        // Save the state
        chrome.storage.local.set({ extensionEnabled });
        
        // Show or hide overlays based on new state
        toggleOverlays(extensionEnabled);
        
        sendResponse({ success: true });
    } else if (message.action === 'historyCleared') {
        // Clear downloaded images state when history is cleared
        downloadedImages = {};
        // Refresh overlays to remove downloaded indicators
        addImageSelectionFunctionality();
        
        sendResponse({ success: true });
    } else if (message.action === 'historyImported') {
        // Update downloaded images state with imported history
        downloadedImages = message.downloadedImages;
        // Refresh overlays to show downloaded indicators
        addImageSelectionFunctionality();
        
        sendResponse({ success: true });
    }
    
    return true;
});

// Initialize the extension when the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}
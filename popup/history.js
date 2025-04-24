// Initialize the history page
function initHistoryPage() {
    // Get downloaded images from storage
    chrome.storage.local.get(['downloadedImages'], (result) => {
        if (!result.downloadedImages || Object.keys(result.downloadedImages).length === 0) {
            showNoImagesMessage();
            return;
        }

        const downloadedImages = result.downloadedImages;
        const folderGroups = groupImagesByFolder(downloadedImages);
        displayFolderGroups(folderGroups);
    });

    // Add event listeners for new buttons
    document.getElementById('export-history').addEventListener('click', exportHistory);
    document.getElementById('import-history').addEventListener('click', () => {
        document.getElementById('import-input').click();
    });
    document.getElementById('import-input').addEventListener('change', importHistory);
    document.getElementById('clear-history').addEventListener('click', clearHistory);
}

// Show message when no images are found
function showNoImagesMessage() {
    const container = document.getElementById('images-container');
    container.innerHTML = '<div class="no-images">No downloaded images found.</div>';
}

// Group images by their download folder
function groupImagesByFolder(images) {
    const groups = {};
    
    for (const [src, info] of Object.entries(images)) {
        const folder = info.folder || 'Default Directory';
        if (!groups[folder]) {
            groups[folder] = [];
        }
        groups[folder].push({
            src: src,
            filename: info.filename,
            timestamp: info.timestamp,
            folder: folder
        });
    }
    
    // Sort images within each folder by timestamp (newest first)
    for (const folder in groups) {
        groups[folder].sort((a, b) => b.timestamp - a.timestamp);
    }
    
    return groups;
}

// Format date for display
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString();
}

// Display folder groups
function displayFolderGroups(groups) {
    const container = document.getElementById('images-container');
    container.innerHTML = '';
    
    // Sort folders alphabetically
    const sortedFolders = Object.keys(groups).sort();
    
    for (const folder of sortedFolders) {
        const folderGroup = document.createElement('div');
        folderGroup.className = 'folder-group';
        
        // Add folder title
        const title = document.createElement('div');
        title.className = 'folder-title';
        title.textContent = folder;
        folderGroup.appendChild(title);
        
        // Create grid for images
        const grid = document.createElement('div');
        grid.className = 'images-grid';
        
        // Add images to grid
        groups[folder].forEach(image => {
            const card = createImageCard(image);
            grid.appendChild(card);
        });
        
        folderGroup.appendChild(grid);
        container.appendChild(folderGroup);
    }
}

// Create an image card element
function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    
    // Image preview
    const img = document.createElement('img');
    img.className = 'image-preview';
    img.src = image.src;
    img.alt = image.filename;
    
    // Add click handler to open image in new tab
    img.addEventListener('click', () => {
        window.open(image.src, '_blank');
    });
    
    // Image info section
    const info = document.createElement('div');
    info.className = 'image-info';
    
    const filename = document.createElement('p');
    filename.textContent = `File: ${image.filename}`;
    
    const date = document.createElement('p');
    date.textContent = `Downloaded: ${formatDate(image.timestamp)}`;
    
    info.appendChild(filename);
    info.appendChild(date);
    
    card.appendChild(img);
    card.appendChild(info);
    
    return card;
}

// Export history function
function exportHistory() {
    chrome.storage.local.get(['downloadedImages'], (result) => {
        if (!result.downloadedImages) {
            alert('No history to export');
            return;
        }

        const historyData = result.downloadedImages;
        const blob = new Blob([JSON.stringify(historyData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const now = new Date();
        const defaultFilename = `image-history-${now.toISOString().split('T')[0]}.json`;

        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}

// Import history function
function importHistory(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Merge with existing history
            chrome.storage.local.get(['downloadedImages'], (result) => {
                const currentHistory = result.downloadedImages || {};
                const mergedHistory = { ...currentHistory, ...importedData };
                
                chrome.storage.local.set({ downloadedImages: mergedHistory }, () => {
                    // Refresh the display
                    const folderGroups = groupImagesByFolder(mergedHistory);
                    displayFolderGroups(folderGroups);

                    // Notify background script about the new history
                    chrome.runtime.sendMessage({ 
                        action: 'historyImported',
                        mergedHistory: mergedHistory
                    });
                    
                    // Notify all tabs to update their overlays
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.sendMessage(tab.id, { 
                                action: 'historyImported',
                                downloadedImages: mergedHistory
                            });
                        });
                    });

                    alert('History imported successfully');
                });
            });
        } catch (error) {
            alert('Error importing history: Invalid file format');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
}

// Clear history function
function clearHistory() {
    if (confirm('Are you sure you want to clear all download history? This cannot be undone.')) {
        chrome.storage.local.set({ downloadedImages: {} }, () => {
            showNoImagesMessage();
            
            // Notify background script
            chrome.runtime.sendMessage({ action: 'historyCleared' });
            
            // Notify all tabs that history was cleared
            chrome.tabs.query({}, (tabs) => {
                tabs.forEach(tab => {
                    chrome.tabs.sendMessage(tab.id, { action: 'historyCleared' });
                });
            });
        });
    }
}

// Initialize when the DOM is loaded
document.addEventListener('DOMContentLoaded', initHistoryPage);
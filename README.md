# Image Selector & Downloader Extension

A browser extension to easily select and download images from web pages.

## Features

*   **Image Selection:** Activate selection mode to choose specific images on the current web page, images will be highlighted in blue.
*   **Display Already Downloaded Images:** Images you have already downloaded will be highlighted in green.
*   **Download Queue:** Selected images are added to a queue visible in the extension popup.
*   **Download Selected Images:** Download all images currently in the queue with a single click.
*   **Download History:** View a history of previously downloaded images.
*   **Import/Export History:** Can import and export the download history.
*   **Clear Queue:** Option to clear the current selection queue.

## How to Use

1.  **Navigate** to the web page containing the images you want to download. (Super helpful for picking images on Google Images)
2.  **Click** the extension icon in your browser toolbar to open the popup.
3.  **Activate Selection:** Ensure "Selection Mode" is enabled in the popup.
4.  **Select Images:** Click on the images you wish to download. They should appear in the popup's queue and will be highlighted in blue.
5.  **Change Download Location:** Enter the path you want the images to save to and click "Set". The default location is the Downloads folder.
5.  **Download:** Once you have selected all desired images, click the "Download Selected" button in the popup.
6.  **View History:** Access the download history through a link or button within the popup (e.g., "View History").

## Installation (Development)

1.  Clone or download this repository.
2.  Open your browser's extension management page:
    *   Chrome/Edge: `chrome://extensions` or `edge://extensions`
    *   Firefox: `about:debugging#/runtime/this-firefox`
3.  Enable "Developer mode" (usually a toggle switch).
4.  Click "Load unpacked" (Chrome/Edge) or "Load Temporary Add-on..." (Firefox).
5.  Select the directory containing the extension's `manifest.json` file.

The extension icon should now appear in your browser toolbar.

## Extra Notes

This tool was developed to aid me in handpicking images for my personal projects including training a local vision model. It's a handy tool for those who need to download specific images from a web page.

**DISCLAIMER**: This extension is intended for educational purposes and should be used responsibly. The developer is not responsible for any misuse or damage caused by this extension.
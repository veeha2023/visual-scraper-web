// Enhanced service worker for Visual Web Scraper v2.0
// Handles bulk processing coordination and message routing

chrome.runtime.onInstalled.addListener(() => {
  console.log('Visual Web Scraper v2.0 installed.');
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Visual Web Scraper started.');
});

// Enhanced message handling for bulk processing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'bulkProcessingStatus') {
      // Handle bulk processing status updates
      console.log(`Bulk processing: ${request.message}`);
      sendResponse({ status: 'acknowledged' });
  } else if (request.action === 'exportData') {
      // Handle data export requests
      console.log('Data export requested:', request.format);
      sendResponse({ status: 'export_initiated' });
  } else if (request.action === 'showExtractionResults') {
      // Forward extraction results between content script and popup
      sendResponse({ status: 'received' });
  } else if (request.action === 'robotSaved') {
      // Handle robot saved notification
      sendResponse({ status: 'received' });
  }
  
  // Return true to indicate we will send a response asynchronously
  return true;
});

// Handle tab updates for bulk processing
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
      // Tab has completed loading - this can be used for bulk processing coordination
      console.log(`Tab ${tabId} loaded: ${tab.url}`);
  }
});

// Cleanup function for when extension is disabled
chrome.runtime.onSuspend.addListener(() => {
  console.log('Visual Web Scraper suspending...');
});
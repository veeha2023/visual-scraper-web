// Version 4.1: Fixed CSP errors for XLSX, added robot validation for bulk scraping
// Patched: Added 4s delay for bulk scraping and fixed data duplication issue.
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const views = {
        main: document.getElementById('main-view'),
        loading: document.getElementById('loading-view'),
        results: document.getElementById('results-view'),
        bulkUrls: document.getElementById('bulk-urls-view'),
        editRobot: document.getElementById('edit-robot-view')
    };
    
    const robotNameInput = document.getElementById('robot-name');
    const startRecordingBtn = document.getElementById('start-recording-btn');
    const robotsList = document.getElementById('robots-list');
    const noRobotsMessage = document.getElementById('no-robots-message');
    const resultsContainer = document.getElementById('results-container');
    const resultsCount = document.getElementById('results-count');
    const backToMainBtn = document.getElementById('back-to-main-btn');
    
    // Bulk scraping elements
    const bulkUrlsInput = document.getElementById('bulk-urls-input');
    const bulkRobotNameSpan = document.getElementById('bulk-robot-name');
    const startBulkScrapingBtn = document.getElementById('start-bulk-scraping-btn');
    const cancelBulkBtn = document.getElementById('cancel-bulk-btn');
    
    // Progress elements
    const loadingText = document.getElementById('loading-text');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    
    // Export elements
    const exportDropdownBtn = document.getElementById('export-dropdown-btn');
    const exportDropdownContent = document.getElementById('export-dropdown-content');

    // Edit robot elements
    const editRobotNameSpan = document.getElementById('edit-robot-name');
    const editSelectorsList = document.getElementById('edit-selectors-list');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    // --- State Variables ---
    let extractedData = [];
    let activeRobotName = '';
    let currentBulkUrls = [];
    let bulkProcessingIndex = 0;
    let editingRobot = null;

    // --- View Switching Logic ---
    const switchView = (viewName) => {
        Object.values(views).forEach(view => view && view.classList.remove('active'));
        if (views[viewName]) {
            views[viewName].classList.add('active');
        } else {
            console.error(`View ${viewName} not found`);
            showNotification(`Error: View ${viewName} not found`, 'error');
        }
    };

    // --- Enhanced Export Functions ---
    const exportAsCSV = () => {
        if (!extractedData || extractedData.length === 0) {
            showNotification('No data to export', 'error');
            return;
        }
    
        const allHeaders = new Set();
        extractedData.forEach(row => {
            Object.keys(row).forEach(key => allHeaders.add(key));
        });
        
        const headerArray = Array.from(allHeaders);
        let csvContent = headerArray.join(',') + '\n';
    
        extractedData.forEach(row => {
            const values = headerArray.map(header => {
                let value = row[header] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvContent += values.join(',') + '\n';
        });
    
        downloadFile(csvContent, `${activeRobotName || 'extracted'}_data.csv`, 'text/csv');
    };

    const exportAsJSON = () => {
        if (!extractedData || extractedData.length === 0) {
            showNotification('No data to export', 'error');
            return;
        }
        
        const jsonContent = JSON.stringify(extractedData, null, 2);
        downloadFile(jsonContent, `${activeRobotName || 'extracted'}_data.json`, 'application/json');
    };

    const exportAsExcel = () => {
        if (!extractedData || extractedData.length === 0) {
            showNotification('No data to export', 'error');
            return;
        }
        
        if (typeof XLSX === 'undefined') {
            console.error('XLSX library not loaded');
            showNotification('Excel export unavailable: Library failed to load', 'error');
            return;
        }
        
        try {
            const worksheet = XLSX.utils.json_to_sheet(extractedData);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
            
            const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            downloadFile(blob, `${activeRobotName || 'extracted'}_data.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        } catch (error) {
            console.error('Error exporting to Excel:', error);
            showNotification('Failed to export as Excel', 'error');
        }
    };

    const exportToGoogleSheets = () => {
        if (!extractedData || extractedData.length === 0) {
            showNotification('No data to export', 'error');
            return;
        }
        
        try {
            const csvContent = convertToCSV(extractedData);
            const dataUri = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
            const link = document.createElement('a');
            link.href = dataUri;
            link.download = `${activeRobotName || 'extracted'}_data_for_sheets.csv`;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => {
                window.open('https://sheets.google.com/create', '_blank');
            }, 500);
            
            showNotification('CSV downloaded! Upload it to Google Sheets:\n1. Go to File → Import\n2. Upload the CSV\n3. Choose "Replace spreadsheet" and click "Import data"', 'success');
        } catch (error) {
            console.error('Error exporting to Google Sheets:', error);
            showNotification('Error preparing data for Google Sheets', 'error');
        }
    };

    const convertToCSV = (data) => {
        const headers = Object.keys(data[0]);
        let csvContent = headers.join(',') + '\n';
        
        data.forEach(row => {
            const values = headers.map(header => {
                let value = row[header] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            });
            csvContent += values.join(',') + '\n';
        });
        
        return csvContent;
    };

    const downloadFile = (content, filename, mimeType) => {
        const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", filename);
        link.click();
        URL.revokeObjectURL(url);
    };

    // --- Bulk Processing Functions ---
    const processBulkUrls = async (robotName, urls) => {
        // Validate robot existence
        const result = await new Promise(resolve => chrome.storage.local.get({ robots: {} }, resolve));
        const robots = result.robots;
        if (!robots[robotName]) {
            showNotification(`Robot "${robotName}" not found. Please create or select a valid robot.`, 'error');
            switchView('main');
            loadRobots();
            return;
        }

        currentBulkUrls = urls;
        bulkProcessingIndex = 0;
        extractedData = [];
        
        switchView('loading');
        updateProgress(0, urls.length, 'Starting bulk scraping...');
        
        for (let i = 0; i < urls.length; i++) {
            bulkProcessingIndex = i;
            updateProgress(i, urls.length, `Processing URL ${i + 1} of ${urls.length}`);
            
            try {
                await processUrl(urls[i], robotName);
                displayResultsUI(extractedData);
                await delay(1000);
            } catch (error) {
                console.error(`Error processing URL ${urls[i]}:`, error.message);
                extractedData.push({
                    'Error': `Failed to process URL: ${error.message}`,
                    'Source URL': urls[i],
                    'Scraped At': new Date().toLocaleString()
                });
                displayResultsUI(extractedData);
            }
        }
        
        updateProgress(urls.length, urls.length, 'Bulk scraping completed!');
        setTimeout(() => {
            switchView('results');
        }, 1000);
    };

    const processUrl = (url, robotName) => {
        return new Promise((resolve, reject) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                const tabId = tabs[0].id;
                
                chrome.tabs.update(tabId, { url: url }, (updatedTab) => {
                    if (chrome.runtime.lastError) {
                        reject(new Error(chrome.runtime.lastError.message));
                        return;
                    }
                    
                    // MODIFICATION: Set delay to 4 seconds for page load as requested.
                    setTimeout(() => {
                        chrome.storage.local.get({ robots: {} }, (result) => {
                            if (chrome.runtime.lastError) {
                                reject(new Error(chrome.runtime.lastError.message));
                                return;
                            }
                            
                            const robotSelectors = result.robots[robotName];
                            if (!robotSelectors) {
                                reject(new Error('Robot not found'));
                                return;
                            }
                            
                            chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                files: ['content.js']
                            }, (injectionResults) => {
                                if (chrome.runtime.lastError) {
                                    reject(new Error(chrome.runtime.lastError.message));
                                    return;
                                }
                                
                                const requestId = Date.now().toString() + Math.random();
                                const messageListener = (request, sender, sendResponse) => {
                                    if (request.action === 'showExtractionResults' && 
                                        request.robotName === robotName && 
                                        request.requestId === requestId) {
                                        extractedData.push(...request.data);
                                        chrome.runtime.onMessage.removeListener(messageListener);
                                        resolve();
                                    }
                                };
                                
                                chrome.runtime.onMessage.addListener(messageListener);
                                
                                chrome.tabs.sendMessage(tabId, { 
                                    action: 'runExtraction', 
                                    selectors: robotSelectors, 
                                    robotName: robotName,
                                    requestId: requestId
                                }, (response) => {
                                    if (chrome.runtime.lastError) {
                                        chrome.runtime.onMessage.removeListener(messageListener);
                                        reject(new Error(chrome.runtime.lastError.message));
                                    }
                                });
                                
                                setTimeout(() => {
                                    chrome.runtime.onMessage.removeListener(messageListener);
                                    reject(new Error('Extraction timeout'));
                                }, 15000);
                            });
                        });
                    }, 4000);
                });
            });
        });
    };

    const updateProgress = (current, total, message) => {
        const percentage = total > 0 ? (current / total) * 100 : 0;
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = message;
        loadingText.textContent = current === total ? 'Bulk scraping completed!' : 'Processing URLs...';
    };

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // --- Edit Robot Functions ---
    const showEditView = (robotName) => {
        activeRobotName = robotName;
        editRobotNameSpan.textContent = robotName;
        chrome.storage.local.get({ robots: {} }, (result) => {
            const robots = result.robots;
            const selectors = robots[robotName] || [];
            if (!editSelectorsList) {
                console.error('edit-selectors-list element not found');
                showNotification('Error: Edit view not available', 'error');
                return;
            }
            editSelectorsList.innerHTML = '';
            selectors.forEach((selector, index) => {
                const selectorDiv = document.createElement('div');
                selectorDiv.className = 'robot-card';
                selectorDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <span class="text-sm text-gray-700">${selector.name}</span>
                        <div class="flex gap-2">
                            <button data-index="${index}" data-name="${selector.name}" class="edit-selector-btn btn-primary">
                                <i class="bx bx-edit"></i>Edit
                            </button>
                            <button data-index="${index}" class="delete-selector-btn btn-danger">
                                <i class="bx bx-trash"></i>Delete
                            </button>
                        </div>
                    </div>
                `;
                editSelectorsList.appendChild(selectorDiv);
            });
            document.querySelectorAll('.edit-selector-btn').forEach(btn => btn.addEventListener('click', startSelectorEdit));
            document.querySelectorAll('.delete-selector-btn').forEach(btn => btn.addEventListener('click', deleteSelector));
            switchView('editRobot');
        });
    };

    const startSelectorEdit = async (event) => {
        const index = parseInt(event.target.dataset.index);
        const name = event.target.dataset.name;
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }, () => {
            chrome.tabs.sendMessage(tab.id, { 
                action: 'editSelector', 
                robotName: activeRobotName, 
                selectorIndex: index,
                selectorName: name 
            });
            window.close();
        });
    };

    const deleteSelector = (event) => {
        const index = parseInt(event.target.dataset.index);
        chrome.storage.local.get({ robots: {} }, (result) => {
            const robots = result.robots;
            if (robots[activeRobotName]) {
                robots[activeRobotName].splice(index, 1);
                chrome.storage.local.set({ robots }, () => {
                    showEditView(activeRobotName);
                    showNotification('Selector deleted successfully', 'success');
                });
            }
        });
    };

    // --- Event Listeners ---
    startRecordingBtn.addEventListener('click', async () => {
        const robotName = robotNameInput.value.trim();
        if (!robotName) {
            showNotification('Please enter a name for your robot', 'error');
            robotNameInput.focus();
            return;
        }
        
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content.js']
        }, () => {
            chrome.tabs.sendMessage(tab.id, { action: 'startRecording', robotName: robotName });
            window.close();
        });
    });

    backToMainBtn.addEventListener('click', () => switchView('main'));

    startBulkScrapingBtn.addEventListener('click', () => {
        const urlsText = bulkUrlsInput.value.trim();
        if (!urlsText) {
            showNotification('Please enter at least one URL', 'error');
            return;
        }
        
        const urls = urlsText.split('\n')
            .map(url => url.trim())
            .filter(url => url && isValidUrl(url));
        
        if (urls.length === 0) {
            showNotification('Please enter valid URLs (must start with http:// or https://)', 'error');
            return;
        }
        
        const robotName = bulkRobotNameSpan.textContent;
        if (!robotName) {
            showNotification('No robot selected for bulk scraping', 'error');
            return;
        }
        
        processBulkUrls(robotName, urls);
    });

    cancelBulkBtn.addEventListener('click', () => switchView('main'));

    exportDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdownContent.classList.toggle('show');
    });

    document.addEventListener('click', () => {
        exportDropdownContent.classList.remove('show');
    });

    exportDropdownContent.addEventListener('click', (e) => {
        e.stopPropagation();
        const format = e.target.dataset.format;
        
        switch(format) {
            case 'csv':
                exportAsCSV();
                break;
            case 'json':
                exportAsJSON();
                break;
            case 'excel':
                exportAsExcel();
                break;
            case 'sheets':
                exportToGoogleSheets();
                break;
        }
        
        exportDropdownContent.classList.remove('show');
    });

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            chrome.storage.local.get({ robots: {} }, (result) => {
                const robots = result.robots;
                if (robots[activeRobotName]) {
                    chrome.storage.local.set({ robots }, () => {
                        showNotification(`Robot "${activeRobotName}" updated successfully`, 'success');
                        switchView('main');
                        loadRobots();
                    });
                }
            });
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => switchView('main'));
    }

    // --- Utility Functions ---
    const isValidUrl = (string) => {
        try {
            new URL(string);
            return string.startsWith('http://') || string.startsWith('https://');
        } catch (_) {
            return false;
        }
    };

    // --- UI Update Functions ---
    function loadRobots() {
        chrome.storage.local.get({ robots: {} }, (result) => {
            const robots = result.robots;
            robotsList.innerHTML = '';
            const robotNames = Object.keys(robots);

            noRobotsMessage.style.display = robotNames.length === 0 ? 'block' : 'none';

            robotNames.forEach(name => {
                const robotDiv = document.createElement('div');
                robotDiv.className = 'robot-card';
                
                const fieldCount = robots[name].length;
                robotDiv.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex-grow">
                            <div class="flex items-center gap-2 mb-1">
                                <i class="bx bx-robot text-yellow-500"></i>
                                <span class="font-bold text-sm text-gray-900">${name}</span>
                            </div>
                            <div class="flex items-center gap-1 text-xs text-gray-600">
                                <i class="bx bx-tag"></i>
                                <span>${fieldCount} field${fieldCount !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button data-robot-name="${name}" class="run-btn btn-primary">
                                <i class="bx bx-play-circle"></i>Run
                            </button>
                            <button data-robot-name="${name}" class="bulk-btn btn-primary">
                                <i class="bx bx-link"></i>Bulk
                            </button>
                            <button data-robot-name="${name}" class="edit-btn btn-primary">
                                <i class="bx bx-edit"></i>Edit
                            </button>
                            <button data-robot-name="${name}" class="delete-btn btn-danger">
                                <i class="bx bx-trash"></i>Delete
                            </button>
                        </div>
                    </div>
                `;
                robotsList.appendChild(robotDiv);
            });

            document.querySelectorAll('.run-btn').forEach(btn => btn.addEventListener('click', runRobot));
            document.querySelectorAll('.bulk-btn').forEach(btn => btn.addEventListener('click', showBulkView));
            document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => showEditView(btn.dataset.robotName)));
            document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', deleteRobot));
        });
    }

    function displayResultsUI(data) {
        extractedData = data;
        resultsContainer.innerHTML = '';
        resultsCount.textContent = `${data.length} result${data.length !== 1 ? 's' : ''}`;
    
        if (!data || data.length === 0) {
            resultsContainer.innerHTML = `
                <div class="text-center py-8 text-gray-600">
                    <i class="bx bx-search text-4xl mb-3 text-gray-400"></i>
                    <p class="font-light">No data was extracted</p>
                </div>
            `;
        } else {
            data.forEach((result, index) => {
                const resultCard = document.createElement('div');
                resultCard.className = 'glass-card p-3 mb-3';
                
                let cardContent = '';
                if (data.length > 1) {
                    cardContent += `
                        <div class="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                            <i class="bx bx-file text-yellow-500"></i>
                            <span class="font-semibold text-sm text-yellow-500">Result #${index + 1}</span>
                        </div>
                    `;
                }
                
                for (const key in result) {
                    const value = result[key];
                    const isUrl = key === 'Source URL' && value.startsWith('http');
                    cardContent += `
                        <div class="mb-2 last:mb-0">
                            <div class="flex items-center gap-2 mb-1">
                                <i class="bx bx-${getFieldIcon(key)} text-yellow-500 text-xs"></i>
                                <p class="font-semibold text-sm text-gray-900">${key}</p>
                            </div>
                            <p class="text-sm pl-5 break-words ${isUrl ? 'text-blue-600' : 'text-gray-600'}">
                                ${isUrl ? `<a href="${value}" target="_blank" class="hover:underline">${value}</a>` : value}
                            </p>
                        </div>
                    `;
                }
                
                resultCard.innerHTML = cardContent;
                resultsContainer.appendChild(resultCard);
            });
        }
        switchView('results');
    }

    function getFieldIcon(fieldName) {
        const name = fieldName.toLowerCase();
        if (name.includes('url')) return 'link';
        if (name.includes('price') || name.includes('cost')) return 'dollar-sign';
        if (name.includes('title') || name.includes('name')) return 'heading';
        if (name.includes('date') || name.includes('time')) return 'calendar';
        if (name.includes('email')) return 'envelope';
        if (name.includes('phone')) return 'phone';
        if (name.includes('address')) return 'map-marker-alt';
        if (name.includes('scraped')) return 'clock';
        return 'tag';
    }

    async function runRobot(event) {
        activeRobotName = event.target.dataset.robotName;
        switchView('loading');
        updateProgress(0, 1, 'Extracting data...');
        
        chrome.storage.local.get({ robots: {} }, async (result) => {
            const robotSelectors = result.robots[activeRobotName];
            if (!robotSelectors) {
                showNotification(`Robot "${activeRobotName}" not found`, 'error');
                switchView('main');
                return;
            }
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js']
            }, () => {
                chrome.tabs.sendMessage(tab.id, { 
                    action: 'runExtraction', 
                    selectors: robotSelectors, 
                    robotName: activeRobotName 
                });
            });
        });
    }

    function showBulkView(event) {
        activeRobotName = event.target.dataset.robotName;
        chrome.storage.local.get({ robots: {} }, (result) => {
            if (!result.robots[activeRobotName]) {
                showNotification(`Robot "${activeRobotName}" not found`, 'error');
                return;
            }
            bulkRobotNameSpan.textContent = activeRobotName;
            bulkUrlsInput.value = '';
            switchView('bulkUrls');
        });
    }

    function deleteRobot(event) {
        const robotName = event.target.closest('button').dataset.robotName;
        const confirmDelete = confirm(`🤖 Delete Robot "${robotName}"?\n\n⚠️ This action cannot be undone.\n\n✓ Click OK to delete\n✗ Click Cancel to keep`);
        
        if (confirmDelete) {
            chrome.storage.local.get({ robots: {} }, (result) => {
                delete result.robots[robotName];
                chrome.storage.local.set({ robots: result.robots }, () => {
                    loadRobots();
                    showNotification(`Robot "${robotName}" deleted successfully`, 'success');
                });
            });
        }
    }

    function showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
        const icon = type === 'success' ? 'bx bx-check-circle' : type === 'error' ? 'bx bx-error-circle' : 'bx bx-info-circle';
        
        notification.className = `fixed top-4 right-4 ${bgColor} text-white px-4 py-3 rounded-lg text-sm z-50 flex items-center gap-2 shadow-lg`;
        notification.style.animation = 'slideInRight 0.3s ease';
        notification.innerHTML = `
            <i class="${icon}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        // MODIFICATION: Added check for request.requestId to prevent data duplication.
        // If a requestId exists, it means the bulk processing listener inside `processUrl` will handle it.
        // This listener should only handle single runs or other general messages.
        if (request.action === 'showExtractionResults') {
            if (request.requestId) {
                // This message is for the bulk processor, ignore it here.
                sendResponse({ status: "ignored by main listener" });
                return true; 
            }
            activeRobotName = request.robotName;
            extractedData.push(...request.data);
            displayResultsUI(extractedData);
        } else if (request.action === 'robotSaved' || request.action === 'selectorEdited') {
            loadRobots();
            showNotification(`Robot "${request.robotName}" ${request.action === 'robotSaved' ? 'saved' : 'updated'} successfully!`, 'success');
        }
        sendResponse({ status: "received" });
        return true;
    });

    // --- Initial Load ---
    loadRobots();

    chrome.storage.local.get({ hasSeenWelcome: false }, (result) => {
        if (!result.hasSeenWelcome) {
            setTimeout(() => {
                const welcomeMessage = `🎉 Welcome to Visual Scraper!\n\n✨ Your intelligent data extraction companion\n\n🤖 Create robots by recording your clicks\n📊 Extract data from multiple URLs\n💾 Export in multiple formats\n\n🚀 Ready to get started?`;
                
                if (confirm(welcomeMessage)) {
                    chrome.storage.local.set({ hasSeenWelcome: true });
                }
            }, 1000);
        }
    });

    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { opacity: 0; transform: translateX(100px); }
            to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes slideOutRight {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(100px); }
        }
        
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
        
        .animate-pulse-gentle {
            animation: pulse 2s infinite;
        }
    `;
    document.head.appendChild(style);
});
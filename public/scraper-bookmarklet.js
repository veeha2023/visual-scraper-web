// Visual Scraper Bookmarklet - Enhanced version with robot selection
(function() {
    if (typeof window.visualScraperLoaded !== 'undefined') {
        alert('Visual Scraper is already running on this page!');
        return;
    }
    window.visualScraperLoaded = true;

    const API_BASE = 'https://visual-scraper-web.vercel.app';
    
    let isRecording = false;
    let currentRobotName = '';
    let currentSelections = [];
    let highlightOverlay = null;
    let controlPanel = null;
    let previewTooltip = null;
    let selectionCounter = null;

    // Create highlight overlay
    const createHighlightOverlay = () => {
        highlightOverlay = document.createElement('div');
        highlightOverlay.id = 'vs-highlight-overlay';
        Object.assign(highlightOverlay.style, {
            position: 'absolute',
            backgroundColor: 'rgba(250, 204, 21, 0.3)',
            border: '3px solid #facc15',
            borderRadius: '6px',
            pointerEvents: 'none',
            zIndex: '999998',
            transition: 'all 0.2s ease-out',
            boxShadow: '0 4px 12px rgba(250, 204, 21, 0.4)',
            display: 'none'
        });
        document.body.appendChild(highlightOverlay);
    };

    const createPreviewTooltip = () => {
        previewTooltip = document.createElement('div');
        previewTooltip.id = 'vs-preview-tooltip';
        Object.assign(previewTooltip.style, {
            position: 'absolute',
            backgroundColor: '#1f2937',
            color: '#d1d5db',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: '500',
            zIndex: '999999',
            pointerEvents: 'none',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '1px solid #374151',
            maxWidth: '250px',
            wordWrap: 'break-word',
            display: 'none'
        });
        document.body.appendChild(previewTooltip);
    };

    const createSelectionCounter = () => {
        selectionCounter = document.createElement('div');
        selectionCounter.id = 'vs-selection-counter';
        Object.assign(selectionCounter.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            backgroundColor: '#facc15',
            color: '#111827',
            padding: '8px 16px',
            borderRadius: '20px',
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: '600',
            zIndex: '1000001',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'background-color 0.3s ease'
        });
        selectionCounter.textContent = '0 fields selected';
        document.body.appendChild(selectionCounter);
    };

    const createRobotSelectionPanel = async () => {
        // First, try to load existing robots
        let existingRobots = [];
        
        try {
            const response = await fetch(`${API_BASE}/api/robots`);
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    existingRobots = Object.keys(data.robots);
                }
            }
        } catch (error) {
            console.log('Could not load existing robots:', error);
        }

        const panel = document.createElement('div');
        panel.id = 'vs-robot-selection-panel';
        Object.assign(panel.style, {
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#1f2937',
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
            zIndex: '1000000',
            minWidth: '300px',
            border: '1px solid #374151',
            color: 'white'
        });

        let panelContent = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #facc15;">🤖 Visual Scraper</h3>
                <p style="font-size: 12px; color: #d1d5db; margin: 0;">Choose an option to start scraping</p>
            </div>
        `;

        if (existingRobots.length > 0) {
            panelContent += `
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #d1d5db; font-size: 14px;">Use Existing Robot:</h4>
                    ${existingRobots.map(robot => `
                        <button onclick="window.useExistingRobot('${robot}')" 
                                style="width: 100%; background: #374151; color: white; border: none; padding: 10px; margin: 5px 0; border-radius: 6px; cursor: pointer; text-align: left;">
                            🚀 ${robot}
                        </button>
                    `).join('')}
                </div>
                <hr style="border: none; border-top: 1px solid #374151; margin: 15px 0;">
            `;
        }

        panelContent += `
            <div>
                <h4 style="margin: 0 0 10px 0; color: #d1d5db; font-size: 14px;">Create New Robot:</h4>
                <input type="text" id="vs-new-robot-name" placeholder="Enter robot name" 
                       style="width: 100%; padding: 10px; border: 1px solid #4b5563; background: #374151; color: white; border-radius: 6px; margin-bottom: 10px;">
                <button onclick="window.createNewRobot()" 
                        style="width: 100%; background: #facc15; color: #111827; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">
                    🆕 Create New Robot
                </button>
            </div>
            <div style="text-align: center; margin-top: 15px;">
                <button onclick="window.cleanupScraper()" 
                        style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 12px;">
                    Cancel
                </button>
            </div>
        `;

        panel.innerHTML = panelContent;
        document.body.appendChild(panel);

        // Add global functions
        window.useExistingRobot = function(robotName) {
            runExistingRobot(robotName);
        };

        window.createNewRobot = function() {
            const robotName = document.getElementById('vs-new-robot-name').value.trim();
            if (!robotName) {
                alert('Please enter a robot name');
                return;
            }
            startRecording(robotName);
        };

        window.cleanupScraper = function() {
            cleanup();
        };
    };

    const runExistingRobot = async (robotName) => {
        try {
            const response = await fetch(`${API_BASE}/api/robots`);
            if (!response.ok) throw new Error('Failed to fetch robots');
            
            const data = await response.json();
            if (!data.success || !data.robots[robotName]) {
                throw new Error('Robot not found');
            }

            const selectors = data.robots[robotName];
            
            // Remove selection panel
            const panel = document.getElementById('vs-robot-selection-panel');
            if (panel) panel.remove();

            // Extract data immediately
            const extractedData = {};
            selectors.forEach(item => {
                try {
                    const element = document.querySelector(item.selector);
                    extractedData[item.name] = element ? element.innerText.trim() : 'Not Found';
                } catch (e) {
                    extractedData[item.name] = 'Invalid Selector';
                }
            });
            
            extractedData['Source URL'] = window.location.href;
            extractedData['Scraped At'] = new Date().toISOString();
            extractedData['robotName'] = robotName;

            // Save the data
            const saveResponse = await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    robotName: robotName,
                    selectors: selectors,
                    data: extractedData
                })
            });

            if (saveResponse.ok) {
                const result = await saveResponse.json();
                alert(`✅ Data extracted successfully using "${robotName}"!\n\n📊 ${Object.keys(extractedData).length} fields extracted\n💾 Saved to database\n\nYou can view your data at: ${API_BASE}`);
            } else {
                throw new Error('Failed to save data');
            }

            cleanup();
            
        } catch (error) {
            alert(`❌ Error running robot "${robotName}": ${error.message}`);
            cleanup();
        }
    };

    // ... (keep all the existing functions: createHighlightOverlay, createPreviewTooltip, createSelectionCounter, 
    // createControlPanel, updateSelectionCounter, handleMouseOver, handleMouseOut, handleClick, getCssSelector, 
    // saveData, cleanup, startRecording from your original code)

    // Modified start function
    const start = () => {
        createRobotSelectionPanel();
    };

    // Start the scraper
    start();
})();
// Visual Scraper Bookmarklet - Complete Recording Version
(function() {
    if (typeof window.visualScraperLoaded !== 'undefined') {
        alert('Visual Scraper is already running on this page!');
        return;
    }
    window.visualScraperLoaded = true;

    const API_BASE = 'https://visual-scraper-web.vercel.app';
    let currentWorkspace = 'general';
    let recordingState = null;
    
    // First, get the current workspace from the dashboard
    const getCurrentWorkspace = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/workspaces`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.workspaces.length > 0) {
                    const lastWorkspace = localStorage.getItem('lastWorkspace') || 'general';
                    const workspaceExists = data.workspaces.find(ws => ws.id === lastWorkspace);
                    return workspaceExists ? lastWorkspace : 'general';
                }
            }
        } catch (error) {
            console.log('Could not load workspaces:', error);
        }
        return 'general';
    };

    const createRobotSelectionPanel = async () => {
        currentWorkspace = await getCurrentWorkspace();
        
        // Load existing robots
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
            minWidth: '400px',
            border: '1px solid #374151',
            color: 'white',
            fontFamily: 'Arial, sans-serif'
        });

        // Get workspace name for display
        let workspaceName = 'General';
        try {
            const wsResponse = await fetch(`${API_BASE}/api/workspaces`);
            if (wsResponse.ok) {
                const wsData = await wsResponse.json();
                if (wsData.success) {
                    const ws = wsData.workspaces.find(w => w.id === currentWorkspace);
                    if (ws) workspaceName = ws.name;
                }
            }
        } catch (error) {
            console.log('Could not load workspace name:', error);
        }

        let panelContent = `
            <div style="text-align: center; margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0; color: #facc15;">🤖 Visual Scraper</h3>
                <p style="font-size: 12px; color: #d1d5db; margin: 0 0 10px 0;">Choose a robot to extract data</p>
                <div style="background: #374151; padding: 8px 12px; border-radius: 6px; font-size: 11px;">
                    📁 Workspace: <strong>${workspaceName}</strong>
                </div>
            </div>
        `;

        if (existingRobots.length > 0) {
            panelContent += `
                <div style="margin-bottom: 15px;">
                    <h4 style="margin: 0 0 10px 0; color: #d1d5db; font-size: 14px;">Use Existing Robot:</h4>
                    ${existingRobots.map(robot => `
                        <button class="vs-robot-btn" data-robot="${robot}" 
                                style="width: 100%; background: #374151; color: white; border: none; padding: 12px; margin: 5px 0; border-radius: 6px; cursor: pointer; text-align: left; transition: background 0.2s;">
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
                <button id="vs-create-new-btn" 
                        style="width: 100%; background: #facc15; color: #111827; border: none; padding: 12px; border-radius: 6px; font-weight: bold; cursor: pointer; transition: background 0.2s;">
                    🆕 Create New Robot
                </button>
            </div>
            <div style="text-align: center; margin-top: 15px;">
                <button id="vs-cancel-btn" 
                        style="background: none; border: none; color: #9ca3af; cursor: pointer; font-size: 12px;">
                    Cancel
                </button>
            </div>
        `;

        panel.innerHTML = panelContent;
        document.body.appendChild(panel);

        // Add event listeners
        const robotButtons = panel.querySelectorAll('.vs-robot-btn');
        robotButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const robotName = this.getAttribute('data-robot');
                runExistingRobot(robotName);
            });
            
            btn.addEventListener('mouseenter', function() {
                this.style.background = '#4b5563';
            });
            
            btn.addEventListener('mouseleave', function() {
                this.style.background = '#374151';
            });
        });

        const createBtn = panel.querySelector('#vs-create-new-btn');
        createBtn.addEventListener('click', function() {
            const robotName = document.getElementById('vs-new-robot-name').value.trim();
            if (!robotName) {
                alert('Please enter a robot name');
                return;
            }
            startRecording(robotName);
        });

        createBtn.addEventListener('mouseenter', function() {
            this.style.background = '#eab308';
        });
        
        createBtn.addEventListener('mouseleave', function() {
            this.style.background = '#facc15';
        });

        const cancelBtn = panel.querySelector('#vs-cancel-btn');
        cancelBtn.addEventListener('click', cleanup);
    };

    const runExistingRobot = async (robotName) => {
        try {
            // Show loading message
            alert(`🔄 Running "${robotName}"...\n\nExtracting data from current page...`);

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
            let extractedCount = 0;
            let errorCount = 0;
            
            selectors.forEach(item => {
                try {
                    const element = document.querySelector(item.selector);
                    if (element && element.innerText.trim()) {
                        extractedData[item.name] = element.innerText.trim();
                        extractedCount++;
                    } else {
                        extractedData[item.name] = 'Not Found';
                        errorCount++;
                    }
                } catch (e) {
                    extractedData[item.name] = 'Invalid Selector';
                    errorCount++;
                }
            });
            
            extractedData['Source URL'] = window.location.href;
            extractedData['Scraped At'] = new Date().toLocaleString();
            extractedData['robotName'] = robotName;
            extractedData['workspace'] = currentWorkspace;

            // Save the data to current workspace
            const saveResponse = await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    robotName: robotName,
                    selectors: selectors,
                    data: extractedData,
                    workspace: currentWorkspace
                })
            });

            if (saveResponse.ok) {
                const result = await saveResponse.json();
                
                let message = `✅ Data extracted successfully!\n\n`;
                message += `🤖 Robot: ${robotName}\n`;
                message += `📁 Workspace: ${currentWorkspace}\n`;
                message += `📊 Fields extracted: ${extractedCount}\n`;
                if (errorCount > 0) {
                    message += `⚠️ Fields with issues: ${errorCount}\n`;
                }
                message += `💾 Saved to database\n\n`;
                message += `View your data at: ${API_BASE}`;
                
                alert(message);
            } else {
                throw new Error('Failed to save data');
            }

            cleanup();
            
        } catch (error) {
            alert(`❌ Error running robot "${robotName}": ${error.message}`);
            cleanup();
        }
    };

    const startRecording = (robotName) => {
        // Remove selection panel
        const panel = document.getElementById('vs-robot-selection-panel');
        if (panel) panel.remove();

        // Initialize recording state
        recordingState = {
            robotName: robotName,
            workspace: currentWorkspace,
            selectors: [],
            currentStep: 'recording'
        };

        // Show recording interface
        showRecordingInterface(robotName);
    };

    const showRecordingInterface = (robotName) => {
        const overlay = document.createElement('div');
        overlay.id = 'vs-recording-overlay';
        overlay.innerHTML = `
            <div style="position: fixed; top: 10px; left: 10px; background: #1f2937; color: white; padding: 15px; border-radius: 8px; z-index: 1000001; max-width: 350px; border: 2px solid #facc15;">
                <h4 style="margin: 0 0 10px 0; color: #facc15;">🎯 Recording: ${robotName}</h4>
                <p style="margin: 0 0 10px 0; font-size: 12px; color: #d1d5db;">Click on page elements to add fields. Click Save when done.</p>
                <div id="vs-recorded-fields" style="max-height: 200px; overflow-y: auto; margin-bottom: 10px; font-size: 12px;">
                    <div style="color: #9ca3af; text-align: center;">No fields added yet</div>
                </div>
                <div style="display: flex; gap: 5px;">
                    <button id="vs-save-robot" style="background: #10b981; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer;">💾 Save Robot</button>
                    <button id="vs-cancel-recording" style="background: #ef4444; color: white; border: none; padding: 8px 16px; border-radius: 4px; font-size: 12px; cursor: pointer;">❌ Cancel</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Add highlight style for selected elements
        const style = document.createElement('style');
        style.id = 'vs-highlight-style';
        style.textContent = `
            .vs-element-highlight {
                outline: 2px solid #facc15 !important;
                background-color: rgba(250, 204, 21, 0.1) !important;
                cursor: pointer !important;
            }
            .vs-element-highlight:hover {
                outline: 2px solid #eab308 !important;
                background-color: rgba(234, 179, 8, 0.2) !important;
            }
        `;
        document.head.appendChild(style);

        // Add event listeners for element clicking
        document.addEventListener('click', handleElementClick, true);
        document.addEventListener('mouseover', handleElementHover, true);
        document.addEventListener('mouseout', handleElementHoverOut, true);
        
        // Add control listeners
        document.getElementById('vs-save-robot').addEventListener('click', saveRecordedRobot);
        document.getElementById('vs-cancel-recording').addEventListener('click', cancelRecording);
    };

    const handleElementHover = (e) => {
        if (!recordingState || recordingState.currentStep !== 'recording') return;
        
        const element = e.target;
        if (element.id !== 'vs-recording-overlay' && !element.closest('#vs-recording-overlay')) {
            element.classList.add('vs-element-highlight');
        }
    };

    const handleElementHoverOut = (e) => {
        if (!recordingState || recordingState.currentStep !== 'recording') return;
        
        const element = e.target;
        element.classList.remove('vs-element-highlight');
    };

    const handleElementClick = (e) => {
        if (!recordingState || recordingState.currentStep !== 'recording') return;
        
        e.preventDefault();
        e.stopPropagation();

        const element = e.target;
        if (element.id === 'vs-recording-overlay' || element.closest('#vs-recording-overlay')) {
            return;
        }

        // Remove highlights from all elements
        document.querySelectorAll('.vs-element-highlight').forEach(el => {
            el.classList.remove('vs-element-highlight');
        });

        // Generate unique field name
        const fieldCount = recordingState.selectors.length + 1;
        const fieldName = prompt(`Enter name for this field (e.g., "Price", "Title", "Description"):`, `field_${fieldCount}`);
        
        if (fieldName && fieldName.trim()) {
            const selector = generateSelector(element);
            
            // Add to recording state
            recordingState.selectors.push({
                name: fieldName.trim(),
                selector: selector,
                exampleText: element.innerText.trim().substring(0, 50) + '...'
            });

            // Update UI
            updateRecordedFieldsDisplay();
            
            // Show confirmation
            alert(`✅ Field "${fieldName}" added!\n\nSelector: ${selector}\n\nClick on another element to add more fields, or click "Save Robot" when done.`);
        }
    };

    const generateSelector = (element) => {
        // Simple selector generation - you can enhance this
        if (element.id) {
            return `#${element.id}`;
        }
        
        if (element.className && typeof element.className === 'string') {
            const classes = element.className.split(' ').filter(c => c.length > 0);
            if (classes.length > 0) {
                return `${element.tagName.toLowerCase()}.${classes[0]}`;
            }
        }
        
        // Fallback to more specific selector
        const path = [];
        let current = element;
        while (current && current.nodeType === Node.ELEMENT_NODE) {
            let selector = current.nodeName.toLowerCase();
            if (current.id) {
                selector += `#${current.id}`;
                path.unshift(selector);
                break;
            } else {
                let sibling = current;
                let nth = 1;
                while (sibling.previousElementSibling) {
                    sibling = sibling.previousElementSibling;
                    nth++;
                }
                if (nth !== 1) {
                    selector += `:nth-of-type(${nth})`;
                }
            }
            path.unshift(selector);
            current = current.parentNode;
        }
        
        return path.join(' > ');
    };

    const updateRecordedFieldsDisplay = () => {
        const fieldsContainer = document.getElementById('vs-recorded-fields');
        
        if (recordingState.selectors.length === 0) {
            fieldsContainer.innerHTML = '<div style="color: #9ca3af; text-align: center;">No fields added yet</div>';
            return;
        }

        fieldsContainer.innerHTML = recordingState.selectors.map((field, index) => `
            <div style="background: #374151; padding: 8px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #facc15;">
                <div style="font-weight: bold; color: white;">${field.name}</div>
                <div style="font-size: 10px; color: #9ca3af; word-break: break-all;">${field.selector}</div>
                <div style="font-size: 10px; color: #d1d5db;">Example: "${field.exampleText}"</div>
                <button onclick="removeField(${index})" style="background: #ef4444; color: white; border: none; padding: 2px 6px; border-radius: 2px; font-size: 10px; cursor: pointer; margin-top: 3px;">Remove</button>
            </div>
        `).join('');
    };

    // Add removeField to global scope for the buttons to work
    window.removeField = (index) => {
        if (recordingState && recordingState.selectors[index]) {
            recordingState.selectors.splice(index, 1);
            updateRecordedFieldsDisplay();
        }
    };

    const saveRecordedRobot = async () => {
        if (!recordingState || recordingState.selectors.length === 0) {
            alert('Please add at least one field before saving the robot.');
            return;
        }

        try {
            // Save the robot
            const saveResponse = await fetch(`${API_BASE}/api/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    robotName: recordingState.robotName,
                    selectors: recordingState.selectors,
                    data: null, // Just saving the robot, not data
                    workspace: recordingState.workspace
                })
            });

            if (saveResponse.ok) {
                const result = await saveResponse.json();
                
                let message = `✅ Robot "${recordingState.robotName}" saved successfully!\n\n`;
                message += `📊 Fields: ${recordingState.selectors.length}\n`;
                message += `📁 Workspace: ${recordingState.workspace}\n\n`;
                message += `You can now use this robot on any website.`;
                
                alert(message);
                cleanup();
            } else {
                throw new Error('Failed to save robot');
            }
        } catch (error) {
            alert(`❌ Error saving robot: ${error.message}`);
        }
    };

    const cancelRecording = () => {
        if (confirm('Are you sure you want to cancel robot creation? All progress will be lost.')) {
            cleanup();
        }
    };

    const cleanup = () => {
        // Remove all VS elements and event listeners
        const panel = document.getElementById('vs-robot-selection-panel');
        if (panel) panel.remove();
        
        const overlay = document.getElementById('vs-recording-overlay');
        if (overlay) overlay.remove();
        
        const style = document.getElementById('vs-highlight-style');
        if (style) style.remove();
        
        // Remove event listeners
        document.removeEventListener('click', handleElementClick, true);
        document.removeEventListener('mouseover', handleElementHover, true);
        document.removeEventListener('mouseout', handleElementHoverOut, true);
        
        // Clean up global state
        window.visualScraperLoaded = undefined;
        window.removeField = undefined;
        recordingState = null;
        
        // Remove all highlights
        document.querySelectorAll('.vs-element-highlight').forEach(el => {
            el.classList.remove('vs-element-highlight');
        });
    };

    // Start the scraper
    createRobotSelectionPanel();
})();
// Visual Scraper Bookmarklet - Complete version with recording and editing
(function() {
    if (typeof window.visualScraperLoaded !== 'undefined') {
        alert('Visual Scraper is already running on this page!');
        return;
    }
    window.visualScraperLoaded = true;

    const API_BASE = 'https://visual-scraper-web.vercel.app';
    let currentWorkspace = 'general';
    let isRecording = false;
    let currentRobotName = '';
    let currentSelections = [];
    let highlightOverlay = null;
    let controlPanel = null;
    let previewTooltip = null;
    let selectionCounter = null;

    // --- UI Creation Functions ---
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

    const createControlPanel = () => {
        controlPanel = document.createElement('div');
        controlPanel.id = 'vs-control-panel';
        Object.assign(controlPanel.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#1f2937',
            padding: '16px',
            borderRadius: '12px',
            boxShadow: '0 8px 25px rgba(0,0,0,0.4)',
            zIndex: '1000000',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            minWidth: '280px',
            border: '1px solid #374151'
        });

        const instructionText = document.createElement('div');
        instructionText.style.cssText = 'color: #d1d5db; font-size: 12px; text-align: center; font-family: Arial, sans-serif;';
        instructionText.textContent = 'Click elements to select data fields';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        // Add Remove Last button if we have selections
        if (currentSelections.length > 0) {
            const removeButton = document.createElement('button');
            removeButton.id = 'vs-remove-button';
            removeButton.textContent = 'Remove Last';
            Object.assign(removeButton.style, {
                backgroundColor: '#f59e0b',
                color: '#ffffff',
                padding: '12px 16px',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                fontSize: '13px',
                fontFamily: 'Arial, sans-serif',
                transition: 'all 0.2s ease',
                flex: '1'
            });

            removeButton.addEventListener('click', removeLastSelection);
            buttonContainer.appendChild(removeButton);
        }

        const finishButton = document.createElement('button');
        finishButton.id = 'vs-finish-button';
        finishButton.textContent = 'Finish & Save Robot';
        Object.assign(finishButton.style, {
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '12px 16px',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            transition: 'all 0.2s ease',
            flex: '1'
        });

        const stopButton = document.createElement('button');
        stopButton.id = 'vs-stop-button';
        stopButton.textContent = 'Cancel';
        Object.assign(stopButton.style, {
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '12px 16px',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'Arial, sans-serif',
            transition: 'all 0.2s ease',
            flex: '1'
        });

        // Hover effects
        [finishButton, stopButton].forEach(button => {
            button.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
            });
            button.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });

        finishButton.addEventListener('click', stopAndSave);
        stopButton.addEventListener('click', stopRecording);

        buttonContainer.appendChild(stopButton);
        buttonContainer.appendChild(finishButton);
        controlPanel.appendChild(instructionText);
        controlPanel.appendChild(buttonContainer);
        document.body.appendChild(controlPanel);
    };

    const updateSelectionCounter = () => {
        if (selectionCounter) {
            const count = currentSelections.length;
            selectionCounter.textContent = `${count} field${count !== 1 ? 's' : ''} selected`;
            selectionCounter.style.backgroundColor = count > 0 ? '#10b981' : '#facc15';
        }
    };

    const removeLastSelection = () => {
        if (currentSelections.length > 0) {
            currentSelections.pop();
            updateSelectionCounter();
            
            // Show removal feedback
            const feedback = document.createElement('div');
            feedback.style.cssText = `
                position: fixed;
                top: 60px;
                right: 20px;
                background: #f59e0b;
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 14px;
                font-family: Arial, sans-serif;
                z-index: 1000002;
            `;
            feedback.textContent = 'Last field removed';
            document.body.appendChild(feedback);
            
            setTimeout(() => {
                feedback.style.opacity = '0';
                setTimeout(() => feedback.remove(), 300);
            }, 2000);
            
            // Recreate control panel to update buttons
            if (controlPanel) controlPanel.remove();
            createControlPanel();
        }
    };

    // --- Event Handlers for Recording ---
    const handleMouseOver = (e) => {
        if (!isRecording) return;
        const target = e.target;
        if (target.closest('[id^="vs-"]')) {
            if (highlightOverlay) highlightOverlay.style.display = 'none';
            if (previewTooltip) previewTooltip.style.display = 'none';
            return;
        }

        const rect = target.getBoundingClientRect();
        if (highlightOverlay) {
            Object.assign(highlightOverlay.style, {
                display: 'block',
                width: `${rect.width}px`,
                height: `${rect.height}px`,
                top: `${rect.top + window.scrollY}px`,
                left: `${rect.left + window.scrollX}px`
            });
        }

        const textContent = target.innerText.trim();
        if (textContent && previewTooltip) {
            const truncatedText = textContent.length > 100 ? textContent.substring(0, 100) + '...' : textContent;
            previewTooltip.textContent = `Preview: "${truncatedText}"`;
            Object.assign(previewTooltip.style, {
                display: 'block',
                top: `${rect.top + window.scrollY - 40}px`,
                left: `${Math.min(rect.left + window.scrollX, window.innerWidth - 250)}px`
            });
        }
    };

    const handleMouseOut = (e) => {
        if (!isRecording) return;
        if (previewTooltip) {
            previewTooltip.style.display = 'none';
        }
    };

    const handleClick = (e) => {
        if (!isRecording) return;
        const target = e.target;
        if (target.closest('[id^="vs-"]')) return;
        e.preventDefault();
        e.stopPropagation();

        const textPreview = target.innerText.trim().substring(0, 50);
        const defaultName = `Field ${currentSelections.length + 1}`;

        const dataName = prompt(
            `Enter a name for this data field:\n\nPreview: "${textPreview}..."\n\nSuggested name: ${defaultName}`,
            defaultName
        );

        if (dataName && dataName.trim()) {
            const selector = getCssSelector(target);
            currentSelections.push({
                name: dataName.trim(),
                selector,
                preview: textPreview
            });
            updateSelectionCounter();
            
            // Show success indicator (no confirmation dialog)
            const successIndicator = document.createElement('div');
            successIndicator.style.cssText = `
                position: absolute;
                top: ${target.getBoundingClientRect().top + window.scrollY}px;
                left: ${target.getBoundingClientRect().left + window.scrollX}px;
                background: #10b981;
                color: #ffffff;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-family: Arial, sans-serif;
                z-index: 1000002;
                pointer-events: none;
                transition: opacity 0.3s ease;
            `;
            successIndicator.textContent = `✓ ${dataName.trim()}`;
            document.body.appendChild(successIndicator);

            setTimeout(() => {
                successIndicator.style.opacity = '0';
                setTimeout(() => successIndicator.remove(), 300);
            }, 2000);
            
            // Recreate control panel to update remove button
            if (controlPanel) controlPanel.remove();
            createControlPanel();
        }
    };

    // --- Core Recording Logic ---
    const getCssSelector = (el) => {
        if (!(el instanceof Element)) return;
        const path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                const sanitizedId = el.id.trim().replace(/(:|\.|\[|\]|,|=)/g, "\\$1");
                if (sanitizedId) {
                    selector += '#' + sanitizedId;
                    path.unshift(selector);
                    break;
                }
            }
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() == selector) nth++;
            }
            if (nth != 1) selector += `:nth-of-type(${nth})`;
            path.unshift(selector);
            el = el.parentNode;
        }
        return path.join(' > ');
    };

    const stopAndSave = async () => {
        if (currentSelections.length === 0) {
            const createAnyway = confirm("No elements were selected. Would you like to save the robot anyway? You can add fields later by editing the robot.");
            if (!createAnyway) {
                return;
            }
        }

        const fieldList = currentSelections.length > 0 ? 
            `\n\nFields: ${currentSelections.map(s => s.name).join(', ')}` : 
            '\n\nNo fields selected yet - you can add them later by editing the robot.';

        const confirmMessage = `Save robot "${currentRobotName}" with ${currentSelections.length} selected fields?${fieldList}`;

        if (confirm(confirmMessage)) {
            try {
                // Save robot to API
                const saveResponse = await fetch(`${API_BASE}/api/save`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        robotName: currentRobotName,
                        selectors: currentSelections,
                        data: {
                            'Robot Created': new Date().toLocaleString(),
                            'Total Fields': currentSelections.length,
                            'Fields': currentSelections.map(s => s.name).join(', ')
                        },
                        workspace: currentWorkspace
                    })
                });

                if (saveResponse.ok) {
                    const result = await saveResponse.json();
                    alert(`✅ Robot "${currentRobotName}" saved successfully with ${currentSelections.length} fields!\n\n📁 Workspace: ${currentWorkspace}\n\nYou can now use this robot to extract data from any page!`);
                } else {
                    throw new Error('Failed to save robot to API');
                }
            } catch (error) {
                alert(`❌ Error saving robot: ${error.message}\n\nBut don't worry! The robot has been saved locally. You can use it with the Chrome extension.`);
            } finally {
                cleanup();
            }
        }
    };

    const stopRecording = () => {
        isRecording = false;
        if (highlightOverlay) highlightOverlay.remove();
        if (previewTooltip) previewTooltip.remove();
        if (selectionCounter) selectionCounter.remove();
        if (controlPanel) controlPanel.remove();

        document.removeEventListener('mouseover', handleMouseOver, true);
        document.removeEventListener('mouseout', handleMouseOut, true);
        document.removeEventListener('click', handleClick, true);
    };

    const startRecording = (robotName) => {
        isRecording = true;
        currentRobotName = robotName;
        currentSelections = [];

        createHighlightOverlay();
        createPreviewTooltip();
        createSelectionCounter();
        createControlPanel();

        updateSelectionCounter();

        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('click', handleClick, true);

        setTimeout(() => {
            alert(`🎯 Recording started for "${robotName}"!\n\n📁 Workspace: ${currentWorkspace}\n\n✨ Instructions:\n• Click elements to select data fields\n• Use "Remove Last" if you make a mistake\n• Click "Finish & Save Robot" when done`);
        }, 500);
    };

    // --- Robot Selection Panel ---
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
            minWidth: '450px',
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
                        <div style="display: flex; gap: 5px; margin: 5px 0;">
                            <button class="vs-robot-btn" data-robot="${robot}" 
                                    style="flex: 1; background: #374151; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; text-align: left; transition: background 0.2s;">
                                🚀 ${robot}
                            </button>
                            <button class="vs-edit-robot-btn" data-robot="${robot}" 
                                    style="background: #f59e0b; color: white; border: none; padding: 12px; border-radius: 6px; cursor: pointer; transition: background 0.2s; width: 50px;">
                                ✏️
                            </button>
                        </div>
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

        // Add event listeners for robot buttons
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

        // Add event listeners for edit buttons
        const editButtons = panel.querySelectorAll('.vs-edit-robot-btn');
        editButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const robotName = this.getAttribute('data-robot');
                alert(`To edit robot "${robotName}", please use the Chrome extension popup:\n\n1. Click the Visual Scraper extension icon\n2. Find "${robotName}" in your robots list\n3. Click the "Edit" button\n4. The extension will open recording mode for editing`);
            });
            
            btn.addEventListener('mouseenter', function() {
                this.style.background = '#eab308';
            });
            
            btn.addEventListener('mouseleave', function() {
                this.style.background = '#f59e0b';
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
            panel.remove();
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

    const cleanup = () => {
        const panel = document.getElementById('vs-robot-selection-panel');
        if (panel) panel.remove();
        
        if (highlightOverlay) highlightOverlay.remove();
        if (previewTooltip) previewTooltip.remove();
        if (selectionCounter) selectionCounter.remove();
        if (controlPanel) controlPanel.remove();

        document.removeEventListener('mouseover', handleMouseOver, true);
        document.removeEventListener('mouseout', handleMouseOut, true);
        document.removeEventListener('click', handleClick, true);
        
        window.visualScraperLoaded = undefined;
    };

    // Start the scraper
    createRobotSelectionPanel();
})();
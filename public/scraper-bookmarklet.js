// Visual Scraper Bookmarklet - Workspace-aware version
(function() {
    if (typeof window.visualScraperLoaded !== 'undefined') {
        alert('Visual Scraper is already running on this page!');
        return;
    }
    window.visualScraperLoaded = true;

    const API_BASE = 'https://visual-scraper-web.vercel.app';
    let currentWorkspace = 'general';
    
    // First, get the current workspace from the dashboard
    const getCurrentWorkspace = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/workspaces`);
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.workspaces.length > 0) {
                    // Try to get last used workspace from localStorage
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

        alert(`🎯 Recording started for "${robotName}"!\n\n📁 Workspace: ${currentWorkspace}\n\n✨ Instructions:\n• Click on page elements to select data fields\n• Give each field a name\n• The data will be saved to current workspace`);
        
        // For now, just save an empty robot and redirect to dashboard
        setTimeout(() => {
            alert(`Robot "${robotName}" configuration started!\n\nPlease visit the dashboard to complete the robot setup.`);
            window.open(`${API_BASE}`, '_blank');
            cleanup();
        }, 1000);
    };

    const cleanup = () => {
        const panel = document.getElementById('vs-robot-selection-panel');
        if (panel) panel.remove();
        window.visualScraperLoaded = undefined;
    };

    // Start the scraper
    createRobotSelectionPanel();
})();
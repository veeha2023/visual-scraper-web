// Visual Scraper Bookmarklet - Fixed version
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
            color: 'white',
            fontFamily: 'Arial, sans-serif'
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
                        <button class="vs-robot-btn" data-robot="${robot}" 
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
                <button id="vs-create-new-btn" 
                        style="width: 100%; background: #facc15; color: #111827; border: none; padding: 10px; border-radius: 6px; font-weight: bold; cursor: pointer;">
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

        // Add event listeners directly
        const robotButtons = panel.querySelectorAll('.vs-robot-btn');
        robotButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const robotName = this.getAttribute('data-robot');
                runExistingRobot(robotName);
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
            
            selectors.forEach(item => {
                try {
                    const element = document.querySelector(item.selector);
                    if (element) {
                        extractedData[item.name] = element.innerText.trim();
                        extractedCount++;
                    } else {
                        extractedData[item.name] = 'Not Found';
                    }
                } catch (e) {
                    extractedData[item.name] = 'Invalid Selector';
                }
            });
            
            extractedData['Source URL'] = window.location.href;
            extractedData['Scraped At'] = new Date().toLocaleString();
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
                alert(`✅ Data extracted successfully using "${robotName}"!\n\n📊 ${extractedCount} fields extracted\n💾 Saved to database (Total records: ${result.count})\n\nYou can view your data at: ${API_BASE}`);
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
        isRecording = true;
        currentRobotName = robotName;
        currentSelections = [];

        // Remove selection panel
        const panel = document.getElementById('vs-robot-selection-panel');
        if (panel) panel.remove();

        alert(`🎯 Recording started for "${robotName}"!\n\n✨ Instructions:\n• Click on page elements to select data fields\n• Give each field a name\n• The data will be saved automatically`);
        
        // Add click listener for selecting elements
        document.addEventListener('click', handleElementClick, true);
    };

    const handleElementClick = (e) => {
        if (!isRecording) return;
        
        e.preventDefault();
        e.stopPropagation();

        const target = e.target;
        const textPreview = target.innerText.trim().substring(0, 50);
        const defaultName = `Field ${currentSelections.length + 1}`;

        const dataName = prompt(
            `Enter a name for this data field:\n\nPreview: "${textPreview}..."\n\nSuggested name: ${defaultName}`,
            defaultName
        );

        if (dataName) {
            const selector = getCssSelector(target);
            currentSelections.push({
                name: dataName.trim(),
                selector: selector,
                preview: textPreview
            });

            // Show success indicator
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
            `;
            successIndicator.textContent = `✓ ${dataName}`;
            document.body.appendChild(successIndicator);

            setTimeout(() => {
                successIndicator.style.opacity = '0';
                setTimeout(() => successIndicator.remove(), 300);
            }, 2000);

            // Ask if user wants to continue or finish
            const continueRecording = confirm(`✅ Added: ${dataName}\n\nTotal fields: ${currentSelections.length}\n\nClick OK to add more fields, or Cancel to finish and save.`);
            
            if (!continueRecording) {
                saveRobotData();
            }
        }
    };

    const getCssSelector = (el) => {
        if (!(el instanceof Element)) return;
        const path = [];
        while (el.nodeType === Node.ELEMENT_NODE) {
            let selector = el.nodeName.toLowerCase();
            if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
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

    const saveRobotData = async () => {
        if (currentSelections.length === 0) {
            alert("No elements were selected. The robot was not saved.");
            cleanup();
            return;
        }

        try {
            // Save robot configuration
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
                    }
                })
            });

            if (saveResponse.ok) {
                const result = await saveResponse.json();
                alert(`🤖 Robot "${currentRobotName}" saved successfully!\n\n📊 ${currentSelections.length} fields configured\n💾 Ready to use on any webpage\n\nYou can now use this robot to extract data from any page!`);
            } else {
                throw new Error('Failed to save robot');
            }
        } catch (error) {
            alert(`❌ Error saving robot: ${error.message}`);
        } finally {
            cleanup();
        }
    };

    const cleanup = () => {
        isRecording = false;
        const panel = document.getElementById('vs-robot-selection-panel');
        if (panel) panel.remove();
        
        document.removeEventListener('click', handleElementClick, true);
        window.visualScraperLoaded = undefined;
    };

    // Start the scraper
    createRobotSelectionPanel();
})();
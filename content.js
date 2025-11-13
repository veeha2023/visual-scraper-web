// Version 3.0: Fixed recording buttons, added edit functionality, streamlined element selection
if (typeof window.visualScraperLoaded === 'undefined') {
    window.visualScraperLoaded = true;

    let isRecording = false;
    let isEditingSelector = false;
    let editingSelectorIndex = -1;
    let editingSelectorName = '';
    let highlightOverlay = null;
    let controlPanel = null;
    let currentSelections = [];
    let currentRobotName = '';
    let previewTooltip = null;
    let selectionCounter = null;

    // --- Enhanced UI Creation ---
    const createHighlightOverlay = () => {
        if (document.getElementById('vs-highlight-overlay')) return;
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
        if (document.getElementById('vs-preview-tooltip')) return;
        previewTooltip = document.createElement('div');
        previewTooltip.id = 'vs-preview-tooltip';
        Object.assign(previewTooltip.style, {
            position: 'absolute',
            backgroundColor: '#1f2937',
            color: '#d1d5db',
            padding: '8px 12px',
            borderRadius: '6px',
            fontSize: '12px',
            fontFamily: 'Inter, sans-serif',
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
        if (document.getElementById('vs-selection-counter')) return;
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
            fontFamily: 'Inter, sans-serif',
            fontWeight: '600',
            zIndex: '1000001',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'background-color 0.3s ease'
        });
        selectionCounter.textContent = isEditingSelector ? `Editing: ${editingSelectorName}` : '0 fields selected';
        document.body.appendChild(selectionCounter);
    };

    const createControlPanel = () => {
        if (document.getElementById('vs-control-panel')) return;
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
        instructionText.style.cssText = 'color: #d1d5db; font-size: 12px; text-align: center; font-family: Inter, sans-serif;';
        instructionText.textContent = isEditingSelector ? 
            `Click an element to update "${editingSelectorName}"` : 
            'Click elements to select data fields';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        const finishButton = document.createElement('button');
        finishButton.id = 'vs-finish-button';
        finishButton.textContent = isEditingSelector ? 'Save Selector' : 'Finish & Save Robot';
        Object.assign(finishButton.style, {
            backgroundColor: '#10b981',
            color: '#ffffff',
            padding: '12px 16px',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
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
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s ease',
            flex: '1'
        });

        // Add remove button if not editing and has selections
        if (!isEditingSelector && currentSelections.length > 0) {
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
                fontFamily: 'Inter, sans-serif',
                transition: 'all 0.2s ease',
                flex: '1'
            });

            removeButton.addEventListener('click', removeLastSelection);
            buttonContainer.appendChild(removeButton);
        }

        // Hover effects
        [finishButton, stopButton].forEach(button => {
            button.addEventListener('mouseenter', function() {
                this.style.transform = 'translateY(-2px)';
            });
            button.addEventListener('mouseleave', function() {
                this.style.transform = 'translateY(0)';
            });
        });

        finishButton.addEventListener('click', isEditingSelector ? saveEditedSelector : stopAndSave);
        stopButton.addEventListener('click', stopRecording);

        buttonContainer.appendChild(stopButton);
        buttonContainer.appendChild(finishButton);
        controlPanel.appendChild(instructionText);
        controlPanel.appendChild(buttonContainer);
        document.body.appendChild(controlPanel);
    };

    const updateSelectionCounter = () => {
        if (selectionCounter) {
            if (isEditingSelector) {
                selectionCounter.textContent = `Editing: ${editingSelectorName}`;
                selectionCounter.style.backgroundColor = '#f59e0b';
            } else {
                const count = currentSelections.length;
                selectionCounter.textContent = `${count} field${count !== 1 ? 's' : ''} selected`;
                selectionCounter.style.backgroundColor = count > 0 ? '#10b981' : '#facc15';
            }
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
                top: '60px';
                right: '20px';
                background: #f59e0b;
                color: white;
                padding: '8px 16px';
                border-radius: '20px';
                font-size: '14px';
                font-family: Inter, sans-serif;
                z-index: '1000002';
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

    // --- Enhanced Event Handlers ---
    const handleMouseOver = (e) => {
        if (!isRecording && !isEditingSelector) return;
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
        if (!isRecording && !isEditingSelector) return;
        if (previewTooltip) {
            previewTooltip.style.display = 'none';
        }
    };

    const handleClick = (e) => {
        if (!isRecording && !isEditingSelector) return;
        const target = e.target;
        if (target.closest('[id^="vs-"]')) return;
        e.preventDefault();
        e.stopPropagation();

        const textPreview = target.innerText.trim().substring(0, 50);
        const defaultName = isEditingSelector ? editingSelectorName : `Field ${currentSelections.length + 1}`;

        const dataName = prompt(
            `Enter a name for this data field:\n\nPreview: "${textPreview}..."\n\nSuggested name: ${defaultName}`,
            defaultName
        );

        if (dataName && dataName.trim()) {
            const selector = getCssSelector(target);
            if (isEditingSelector) {
                currentSelections[editingSelectorIndex] = {
                    name: dataName.trim(),
                    selector,
                    preview: textPreview
                };
                saveEditedSelector();
            } else {
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
                    font-family: Inter, sans-serif;
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
        }
    };

    // --- Core Logic ---
    const stopAndSave = () => {
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
            chrome.storage.local.get({ robots: {} }, (result) => {
                const robots = result.robots;
                robots[currentRobotName] = currentSelections.map(({ name, selector }) => ({ name, selector }));
                chrome.storage.local.set({ robots }, () => {
                    alert(`✅ Robot "${currentRobotName}" saved successfully with ${currentSelections.length} fields!`);
                    chrome.runtime.sendMessage({ 
                        action: 'robotSaved', 
                        robotName: currentRobotName,
                        fieldCount: currentSelections.length 
                    });
                    stopRecording();
                });
            });
        }
    };

    const saveEditedSelector = () => {
        if (currentSelections.length === 0) {
            alert("No selector was updated. Please click an element to update the selector.");
            return;
        }

        chrome.storage.local.get({ robots: {} }, (result) => {
            const robots = result.robots;
            if (robots[currentRobotName]) {
                robots[currentRobotName][editingSelectorIndex] = {
                    name: currentSelections[0].name,
                    selector: currentSelections[0].selector
                };
                chrome.storage.local.set({ robots }, () => {
                    alert(`✅ Selector "${currentSelections[0].name}" updated successfully!`);
                    chrome.runtime.sendMessage({ 
                        action: 'selectorEdited', 
                        robotName: currentRobotName 
                    });
                    stopRecording();
                });
            }
        });
    };

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

    const startRecording = (robotName, editMode = false, selectorIndex = -1, selectorName = '') => {
        isRecording = !editMode;
        isEditingSelector = editMode;
        currentRobotName = robotName;
        currentSelections = editMode ? [] : [];
        
        if (editMode) {
            editingSelectorIndex = selectorIndex;
            editingSelectorName = selectorName;
        }

        createHighlightOverlay();
        createPreviewTooltip();
        createSelectionCounter();
        createControlPanel();

        updateSelectionCounter();

        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('click', handleClick, true);

        const message = editMode ? 
            `Editing selector "${selectorName}" for "${robotName}"!\n\nClick an element to update this field.` :
            `Recording started for "${robotName}"!\n\nInstructions:\n• Click elements to select data fields\n• Use "Remove Last" if you make a mistake\n• Click "Finish & Save Robot" when done`;

        setTimeout(() => {
            alert(message);
        }, 500);
    };

    const stopRecording = () => {
        isRecording = false;
        isEditingSelector = false;
        if (highlightOverlay) highlightOverlay.remove();
        if (previewTooltip) previewTooltip.remove();
        if (selectionCounter) selectionCounter.remove();
        if (controlPanel) controlPanel.remove();

        document.removeEventListener('mouseover', handleMouseOver, true);
        document.removeEventListener('mouseout', handleMouseOut, true);
        document.removeEventListener('click', handleClick, true);
    };

    const extractData = (selectors, robotName, requestId) => {
        const data = {};

        try {
            selectors.forEach(item => {
                try {
                    const element = document.querySelector(item.selector);
                    data[item.name] = element ? element.innerText.trim() : 'Not Found';
                } catch (e) {
                    console.error(`Error extracting data for selector "${item.selector}":`, e);
                    data[item.name] = 'Invalid Selector';
                }
            });

            data['Source URL'] = window.location.href;
            data['Scraped At'] = new Date().toLocaleString();

            chrome.runtime.sendMessage({
                action: 'showExtractionResults',
                data: [data],
                robotName: robotName,
                requestId: requestId
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending extraction results:', chrome.runtime.lastError);
                }
            });
        } catch (error) {
            console.error('Error during data extraction:', error);
            chrome.runtime.sendMessage({
                action: 'showExtractionResults',
                data: [{ 'Error': 'Failed to extract data', 'Source URL': window.location.href }],
                robotName: robotName,
                requestId: requestId
            });
        }
    };

    // --- Message Listener ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'startRecording') {
            startRecording(request.robotName);
        } else if (request.action === 'runExtraction') {
            extractData(request.selectors, request.robotName, request.requestId);
        } else if (request.action === 'editSelector') {
            startRecording(request.robotName, true, request.selectorIndex, request.selectorName);
        } else if (request.action === 'editRobot') {
            // Start recording mode for editing entire robot
            startRecording(request.robotName);
        }
        sendResponse({ status: "received" });
        return true;
    });
}
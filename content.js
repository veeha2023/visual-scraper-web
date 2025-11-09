// Version 2.0: Added support for editing individual selectors
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
            boxShadow: '0 4px 12px rgba(250, 204, 21, 0.4)'
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
            minWidth: '200px',
            border: '1px solid #374151'
        });

        const instructionText = document.createElement('div');
        instructionText.style.cssText = 'color: #d1d5db; font-size: 12px; text-align: center; font-family: Inter, sans-serif;';
        instructionText.textContent = isEditingSelector ? `Click an element to update "${editingSelectorName}"` : 'Click elements to select data fields';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex; gap: 8px;';

        const finishButton = document.createElement('button');
        finishButton.id = 'vs-finish-button';
        finishButton.textContent = isEditingSelector ? 'Save Selector' : 'Finish & Save';
        Object.assign(finishButton.style, {
            backgroundColor: '#facc15',
            color: '#111827',
            padding: '10px 15px',
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
            padding: '10px 15px',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            fontSize: '13px',
            fontFamily: 'Inter, sans-serif',
            transition: 'all 0.2s ease',
            flex: '1'
        });

        finishButton.addEventListener('mouseenter', () => {
            finishButton.style.backgroundColor = '#eab308';
            finishButton.style.transform = 'translateY(-2px)';
        });
        finishButton.addEventListener('mouseleave', () => {
            finishButton.style.backgroundColor = '#facc15';
            finishButton.style.transform = 'translateY(0)';
        });

        stopButton.addEventListener('mouseenter', () => {
            stopButton.style.backgroundColor = '#dc2626';
            stopButton.style.transform = 'translateY(-2px)';
        });
        stopButton.addEventListener('mouseleave', () => {
            stopButton.style.backgroundColor = '#ef4444';
            stopButton.style.transform = 'translateY(0)';
        });

        buttonContainer.appendChild(stopButton);
        buttonContainer.appendChild(finishButton);
        controlPanel.appendChild(instructionText);
        controlPanel.appendChild(buttonContainer);
        document.body.appendChild(controlPanel);

        finishButton.addEventListener('click', isEditingSelector ? saveEditedSelector : stopAndSave);
        stopButton.addEventListener('click', stopRecording);
    };

    const updateSelectionCounter = () => {
        if (selectionCounter && !isEditingSelector) {
            const count = currentSelections.length;
            selectionCounter.textContent = `${count} field${count !== 1 ? 's' : ''} selected`;
            selectionCounter.style.backgroundColor = count > 0 ? '#10b981' : '#facc15';
        }
    };

    // --- Enhanced Event Handlers ---
    const handleMouseOver = (e) => {
        if (!isRecording && !isEditingSelector) return;
        const target = e.target;
        if (target.closest('[id^="vs-"]')) {
            highlightOverlay.style.display = 'none';
            previewTooltip.style.display = 'none';
            return;
        }

        const rect = target.getBoundingClientRect();
        Object.assign(highlightOverlay.style, {
            display: 'block',
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            top: `${rect.top + window.scrollY}px`,
            left: `${rect.left + window.scrollX}px`
        });

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

        if (dataName) {
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
            }

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
            successIndicator.textContent = `✓ ${dataName}`;
            document.body.appendChild(successIndicator);

            setTimeout(() => {
                successIndicator.style.opacity = '0';
                setTimeout(() => successIndicator.remove(), 300);
            }, 2000);
        }
    };

    // --- Core Logic ---
    const stopAndSave = () => {
        if (currentSelections.length === 0) {
            alert("No elements were selected. Click elements on the page to add them to your robot.");
            return;
        }

        const confirmMessage = `Save robot "${currentRobotName}" with ${currentSelections.length} selected fields?\n\nFields: ${currentSelections.map(s => s.name).join(', ')}`;

        if (confirm(confirmMessage)) {
            chrome.storage.local.get({ robots: {} }, (result) => {
                const robots = result.robots;
                robots[currentRobotName] = currentSelections.map(({ name, selector }) => ({ name, selector }));
                chrome.storage.local.set({ robots }, () => {
                    alert(`Robot "${currentRobotName}" saved successfully with ${currentSelections.length} fields!`);
                    chrome.runtime.sendMessage({ action: 'robotSaved', robotName: currentRobotName });
                    stopRecording();
                });
            });
        }
    };

    const saveEditedSelector = () => {
        chrome.storage.local.get({ robots: {} }, (result) => {
            const robots = result.robots;
            if (robots[currentRobotName]) {
                robots[currentRobotName][editingSelectorIndex] = {
                    name: currentSelections[editingSelectorIndex].name,
                    selector: currentSelections[editingSelectorIndex].selector
                };
                chrome.storage.local.set({ robots }, () => {
                    alert(`Selector "${currentSelections[editingSelectorIndex].name}" updated successfully!`);
                    chrome.runtime.sendMessage({ action: 'selectorEdited', robotName: currentRobotName });
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

    const startRecording = (robotName) => {
        isRecording = true;
        isEditingSelector = false;
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
            alert(`Recording started for "${robotName}"!\n\nInstructions:\n• Hover over elements to preview\n• Click elements to select data fields\n• Use the control panel to finish or cancel`);
        }, 500);
    };

    const startSelectorEdit = (robotName, selectorIndex, selectorName) => {
        isRecording = false;
        isEditingSelector = true;
        currentRobotName = robotName;
        editingSelectorIndex = selectorIndex;
        editingSelectorName = selectorName;
        currentSelections = [{ name: selectorName, selector: '', preview: '' }]; // Temporary for editing

        createHighlightOverlay();
        createPreviewTooltip();
        createSelectionCounter();
        createControlPanel();

        document.addEventListener('mouseover', handleMouseOver, true);
        document.addEventListener('mouseout', handleMouseOut, true);
        document.addEventListener('click', handleClick, true);

        setTimeout(() => {
            alert(`Editing selector "${selectorName}" for "${robotName}"!\n\nInstructions:\n• Hover over an element to preview\n• Click to select a new element for this field\n• Use the control panel to save or cancel`);
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
            startSelectorEdit(request.robotName, request.selectorIndex, request.selectorName);
        }
        sendResponse({ status: "received" });
        return true;
    });
}
document.addEventListener('DOMContentLoaded', () => {
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const submitBtn = document.getElementById('submitBtn');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const collectionsListContainer = document.getElementById('collectionsListContainer');
    const fieldsListContainer = document.getElementById('fieldsListContainer');
    const blogGeneratorContainer = document.getElementById('blogGeneratorContainer');

    if (!apiKeyForm || !apiKeyInput || !submitBtn || !sitesListContainer || !collectionsListContainer) {
        console.warn('Webflow connector: Required DOM nodes are missing.');
        return;
    }

    const apiUrl = 'https://lightslategray-spoonbill-600904.hostingersite.com/api.php';

    const SUPPORTED_FIELD_TYPES = new Set([
        'PlainText',
        'RichText',
        'TextArea',
        'Markdown',
        'MultiLinePlainText',
        'LongText',
        'Number',
        'Date',
        'Slug',
        'Switch',
        'Boolean',
        'Image',
        'Reference',
    ]);

    const LONG_TEXT_FIELD_TYPES = new Set([
        'RichText',
        'TextArea',
        'Markdown',
        'MultiLinePlainText',
        'LongText',
    ]);

    const BOOLEAN_FIELD_TYPES = new Set(['Switch', 'Boolean']);
    const IMAGE_FIELD_TYPES = new Set(['Image']);
    const REFERENCE_FIELD_TYPES = new Set(['Reference']);

    let selectedSiteId = null;
    let selectedCollection = null;
    let selectedCollectionFields = [];
    let draftFieldValues = {};
    let rawAiContent = '';
    let lastKeyword = '';

    resetCollectionsUI();
    resetFieldsUI();
    resetBlogGenerator();

    apiKeyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        await fetchSites();
    });

    sitesListContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-site-id]');
        if (!button) {
            return;
        }

        const siteId = button.dataset.siteId;
        if (!siteId) {
            return;
        }

        selectedSiteId = siteId;
        selectedCollection = null;
        selectedCollectionFields = [];
        draftFieldValues = {};
        rawAiContent = '';
        lastKeyword = '';

        highlightSelectedSite(button.closest('li'));
        resetCollectionsUI('Loading collections…');
        resetFieldsUI();
        resetBlogGenerator('Select a collection to enable the AI generator.');

        fetchCollections(siteId);
    });

    collectionsListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('li[data-collection-id]');
        if (!listItem) {
            return;
        }

        const collectionId = listItem.dataset.collectionId;
        if (!collectionId) {
            return;
        }

        selectedCollection = {
            id: collectionId,
            displayName: listItem.dataset.collectionName || 'Selected Collection',
            slug: listItem.dataset.collectionSlug || '',
        };
        selectedCollectionFields = [];
        draftFieldValues = {};
        rawAiContent = '';
        lastKeyword = '';

        highlightSelectedCollection(listItem);
        resetFieldsUI('Loading fields…');
        resetBlogGenerator('Loading collection details…');

        fetchCollectionFields(collectionId);
    });

    async function fetchSites() {
        const key = apiKeyInput.value.trim();
        if (!key) {
            alert('Please enter an Access Token.');
            return;
        }

        submitBtn.disabled = true;
        sitesListContainer.innerHTML = '<p class="text-center text-blue-600">Loading sites…</p>';
        resetCollectionsUI();
        resetFieldsUI();
        resetBlogGenerator();

        try {
            const data = await callApi({ action: 'list-sites' });
            displaySites(data.sites ?? data);
        } catch (error) {
            sitesListContainer.innerHTML = `<p class="text-center text-red-600">${escapeHtml(error.message)}</p>`;
        } finally {
            submitBtn.disabled = false;
        }
    }

    async function fetchCollections(siteId) {
        resetCollectionsUI('Loading collections…');

        try {
            const data = await callApi({ action: 'list-collections', siteId });
            displayCollections(data.collections ?? data);
        } catch (error) {
            resetCollectionsUI(`Error: ${escapeHtml(error.message)}`);
        }
    }

    async function fetchCollectionFields(collectionId) {
        try {
            const data = await callApi({ action: 'collection-details', collectionId });
            const collection = normalizeCollectionResponse(data);

            selectedCollection = {
                id: collection.id ?? collectionId,
                displayName: collection.displayName ?? collection.name ?? selectedCollection?.displayName ?? 'Collection',
                slug: collection.slug ?? selectedCollection?.slug ?? '',
            };

            selectedCollectionFields = Array.isArray(collection.fields) ? collection.fields : [];

            displayFields(selectedCollectionFields);
            renderBlogGenerator();
        } catch (error) {
            fieldsListContainer.innerHTML = `<p class="text-center text-red-600">${escapeHtml(error.message)}</p>`;
            renderBlogGenerator('Unable to load collection fields.');
        }
    }

    async function callApi(body) {
        const key = apiKeyInput.value.trim();
        if (!key) {
            throw new Error('Access Token is required for this request.');
        }

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: key, ...body }),
        });

        const text = await response.text();
        let data = {};

        if (text) {
            try {
                data = JSON.parse(text);
            } catch (_error) {
                data = { message: text };
            }
        }

        if (!response.ok) {
            const message = data && typeof data === 'object' && data.message
                ? data.message
                : `Request failed with status ${response.status}`;
            throw new Error(message);
        }

        return data;
    }

    function displaySites(sites) {
        sitesListContainer.innerHTML = '';

        if (!Array.isArray(sites) || sites.length === 0) {
            sitesListContainer.innerHTML = '<p class="text-center text-gray-500">No sites found for this token.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-3';

        sites.forEach((site) => {
            const listItem = document.createElement('li');
            listItem.className = 'p-4 bg-white border rounded-md shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center transition-shadow duration-200 hover:shadow-lg';
            listItem.innerHTML = `
                <div class="flex-1 min-w-0">
                    <p class="font-semibold text-gray-800 truncate">${escapeHtml(site.displayName ?? site.name ?? 'Untitled Site')}</p>
                    <p class="text-sm text-gray-500 truncate">${escapeHtml(site.previewUrl ?? site.publicUrl ?? 'No preview URL')}</p>
                </div>
                <div class="flex items-center gap-3">
                    <span class="hidden sm:inline text-xs text-gray-400">${escapeHtml(site.id ?? site._id ?? '')}</span>
                    <button class="text-sm bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600" data-site-id="${escapeHtml(site.id ?? site._id ?? '')}">
                        Select
                    </button>
                </div>
            `;
            list.appendChild(listItem);
        });

        sitesListContainer.appendChild(list);
    }

    function displayCollections(collections) {
        collectionsListContainer.innerHTML = '';

        if (!Array.isArray(collections) || collections.length === 0) {
            collectionsListContainer.innerHTML = '<p class="text-center text-gray-500">No collections found for this site.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2';

        collections.forEach((collection) => {
            const listItem = document.createElement('li');
            listItem.className = 'p-3 bg-white border rounded-md flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition';
            listItem.dataset.collectionId = collection.id ?? collection._id ?? '';
            listItem.dataset.collectionName = collection.displayName ?? collection.name ?? '';
            listItem.dataset.collectionSlug = collection.slug ?? '';
            listItem.innerHTML = `
                <div class="flex flex-col gap-1">
                    <span class="font-medium text-gray-800">${escapeHtml(collection.displayName ?? collection.name ?? 'Unnamed Collection')}</span>
                    <span class="text-xs text-gray-500">Slug: ${escapeHtml(collection.slug ?? 'n/a')}</span>
                </div>
                <span class="text-xs text-blue-600">View fields →</span>
            `;
            list.appendChild(listItem);
        });

        collectionsListContainer.appendChild(list);
    }

    function displayFields(fields) {
        fieldsListContainer.innerHTML = '';

        if (!Array.isArray(fields) || fields.length === 0) {
            fieldsListContainer.innerHTML = '<p class="text-center text-gray-500">No CMS fields found for this collection.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2';

        fields.forEach((field) => {
            const required = field.isRequired === true || field.required === true;
            const fieldType = field.type ?? 'unknown';
            const badges = [];
            if (required) {
                badges.push('<span class="text-xs uppercase tracking-wide text-white bg-rose-500 px-2 py-0.5 rounded">Required</span>');
            }
            if (field.localized) {
                badges.push('<span class="text-xs uppercase tracking-wide text-white bg-indigo-500 px-2 py-0.5 rounded">Multi-language</span>');
            }

            const listItem = document.createElement('li');
            listItem.className = 'p-4 bg-white border rounded-md flex flex-col gap-2';
            listItem.innerHTML = `
                <div class="flex items-center justify-between gap-3">
                    <p class="font-medium text-gray-800">${escapeHtml(field.displayName ?? field.name ?? field.slug ?? 'Untitled Field')}</p>
                    <span class="text-xs uppercase text-gray-600 bg-gray-100 px-2 py-1 rounded">${escapeHtml(fieldType)}</span>
                </div>
                <div class="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <span>Slug: <span class="font-mono">${escapeHtml(field.slug ?? 'n/a')}</span></span>
                    ${badges.join(' ')}
                </div>
            `;
            list.appendChild(listItem);
        });

        fieldsListContainer.appendChild(list);
    }

    function renderBlogGenerator(placeholderMessage) {
        if (!blogGeneratorContainer) {
            return;
        }

        if (placeholderMessage) {
            blogGeneratorContainer.innerHTML = `<p class="text-center text-gray-500">${escapeHtml(placeholderMessage)}</p>`;
            return;
        }

        if (!selectedCollection) {
            blogGeneratorContainer.innerHTML = '<p class="text-center text-gray-500">Pick a collection to enable the AI blog generator.</p>';
            return;
        }

        const editableFields = selectedCollectionFields.filter(isFieldEditable);
        if (editableFields.length === 0) {
            blogGeneratorContainer.innerHTML = `
                <div class="p-6 bg-white border border-amber-200 text-amber-700 rounded-md">
                    <h3 class="text-lg font-semibold mb-2">AI generation unavailable</h3>
                    <p class="text-sm">This collection does not contain text-based fields that can be populated automatically. You can still create items directly in Webflow.</p>
                </div>
            `;
            return;
        }

        const unsupportedRequired = selectedCollectionFields.filter((field) => {
            const required = field.isRequired === true || field.required === true;
            return required && !isFieldEditable(field);
        });

        blogGeneratorContainer.innerHTML = `
            <section class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <div class="flex flex-col gap-1">
                    <h3 class="text-xl font-semibold text-gray-800">AI Blog Draft Generator</h3>
                    <p class="text-sm text-gray-600">Generate draft content for <span class="font-medium">${escapeHtml(selectedCollection.displayName ?? 'this collection')}</span>.</p>
                </div>
                <form id="blogPromptForm" class="mt-4 space-y-4">
                    <div>
                        <label for="blogKeywordInput" class="block text-sm font-medium text-gray-700">Focus keyword</label>
                        <input id="blogKeywordInput" type="text" required placeholder="e.g. Sustainable web design" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div>
                        <label for="blogModelSelect" class="block text-sm font-medium text-gray-700">AI provider & model</label>
                        <select id="blogModelSelect" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <optgroup label="OpenAI">
                                <option value="openai:gpt-4o-mini" selected>GPT-4o Mini (fast)</option>
                                <option value="openai:o4-mini">o4-mini (higher quality)</option>
                            </optgroup>
                            <optgroup label="Google Gemini">
                                <option value="gemini:gemini-2.5-flash" selected>Gemini 2.5 Flash (fast, versatile)</option>
                                <option value="gemini:gemini-2.5-pro">Gemini 2.5 Pro (higher quality)</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="text-xs text-gray-500">
                        <p class="font-medium text-gray-600">Fields targeted by the generator:</p>
                        <ul class="list-disc pl-5 mt-1 space-y-0.5">
                            ${editableFields.map((field) => `<li>${escapeHtml(field.displayName ?? field.slug ?? 'Field')} <span class="text-gray-400">(${escapeHtml(field.type ?? 'unknown')})</span></li>`).join('')}
                        </ul>
                        ${unsupportedRequired.length > 0 ? `<p class="mt-2 text-amber-600">Heads up: these required fields must be completed manually after draft creation — ${unsupportedRequired.map((field) => escapeHtml(field.displayName ?? field.slug ?? 'Field')).join(', ')}.</p>` : ''}
                    </div>
                    <div class="flex items-center gap-3">
                        <button type="submit" class="inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">Generate draft</button>
                        <button type="button" id="blogClearButton" class="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Clear</button>
                    </div>
                </form>
                <div id="blogGeneratorStatus" class="mt-4 hidden text-sm"></div>
                <div id="blogDraftEditor" class="mt-6 hidden"></div>
            </section>
        `;

        attachBlogGeneratorHandlers(editableFields);
    }

    function attachBlogGeneratorHandlers(editableFields) {
        const form = blogGeneratorContainer.querySelector('#blogPromptForm');
        const clearButton = blogGeneratorContainer.querySelector('#blogClearButton');

        if (!form) {
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const keywordInput = form.querySelector('#blogKeywordInput');
            const modelSelect = form.querySelector('#blogModelSelect');

            if (!keywordInput) {
                return;
            }

            const keyword = keywordInput.value.trim();
            if (!keyword) {
                setBlogGeneratorStatus('Please provide a keyword to guide the draft.', 'warning');
                return;
            }

            lastKeyword = keyword;
            await generateBlogDraft(keyword, modelSelect ? modelSelect.value : 'gpt-4o-mini', editableFields);
        });

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                draftFieldValues = {};
                rawAiContent = '';
                lastKeyword = '';
                renderBlogGenerator();
                setBlogGeneratorStatus('Cleared the current draft.', 'info');
            });
        }
    }

    async function generateBlogDraft(keyword, model, editableFields) {
        toggleGeneratorControls(true);
        setBlogGeneratorStatus('Generating blog draft…', 'info');

        try {
            const metadata = serializeFieldMetadata(selectedCollectionFields);
            const data = await callApi({
                action: 'generate-blog',
                prompt: keyword,
                model,
                fields: metadata,
            });

            rawAiContent = typeof data.content === 'string' ? data.content.trim() : '';
            const parsed = safeParseJson(rawAiContent);

            if (parsed && typeof parsed === 'object') {
                draftFieldValues = mapDraftValues(parsed);
                fillMissingFieldsFromRaw(rawAiContent, editableFields);
                setBlogGeneratorStatus('AI draft generated. Review and refine the fields below.', 'success');
            } else {
                draftFieldValues = buildDraftFromRaw(rawAiContent || keyword, editableFields);
                const warning = rawAiContent ? 'AI response was not valid JSON. Populated the first text field with raw content.' : 'AI response was empty. Started a blank draft instead.';
                setBlogGeneratorStatus(warning, 'warning');
            }

            renderDraftEditor(editableFields);
        } catch (error) {
            setBlogGeneratorStatus(`Generation failed: ${error.message}`, 'error');
        } finally {
            toggleGeneratorControls(false);
        }
    }

    function renderDraftEditor(editableFields) {
        const container = blogGeneratorContainer.querySelector('#blogDraftEditor');
        if (!container) {
            return;
        }

        if (editableFields.length === 0) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="border-t border-gray-200 pt-6">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h4 class="text-lg font-semibold text-gray-800">Draft fields</h4>
                        <p class="text-sm text-gray-500">Review and edit before creating a Webflow draft.</p>
                    </div>
                    <button type="button" id="copyRawAiButton" class="text-xs font-medium text-indigo-600 hover:text-indigo-500">Copy raw AI output</button>
                </div>
                <div class="mt-4 space-y-4">
                    ${editableFields.map((field) => renderFieldEditor(field)).join('')}
                </div>
                <div class="mt-5 flex flex-wrap items-center gap-3">
                    <button type="button" id="createDraftButton" class="inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2">Create Webflow draft</button>
                    <button type="button" id="resetDraftButton" class="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Reset fields</button>
                </div>
                <details class="mt-4">
                    <summary class="cursor-pointer text-sm text-gray-500 hover:text-gray-700">Raw AI output</summary>
                    <pre class="mt-2 max-h-64 overflow-auto rounded bg-gray-900 p-4 text-xs text-gray-100 whitespace-pre-wrap">${escapeHtml(rawAiContent || 'No AI output captured yet.')}</pre>
                </details>
            </div>
        `;

        attachDraftEditorEvents(editableFields);
    }

    function renderFieldEditor(field) {
        const slug = field.slug ?? '';
        const value = draftFieldValues[slug] ?? '';
        const label = field.displayName ?? field.name ?? slug;
        const isLongText = isLongTextField(field.type ?? '');
        const required = field.isRequired === true || field.required === true;

        if (isLongText) {
            return `
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-gray-700" for="draft-field-${escapeHtml(slug)}">${escapeHtml(label)} ${required ? '<span class="text-rose-600">*</span>' : ''}</label>
                    <textarea id="draft-field-${escapeHtml(slug)}" data-draft-field="${escapeHtml(slug)}" rows="6" class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500">${escapeHtml(value)}</textarea>
                    <p class="text-xs text-gray-400">Slug: ${escapeHtml(slug)}</p>
                </div>
            `;
        }

        if (IMAGE_FIELD_TYPES.has(field.type ?? '')) {
            return `
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-gray-700" for="draft-field-${escapeHtml(slug)}">${escapeHtml(label)} ${required ? '<span class="text-rose-600">*</span>' : ''}</label>
                    <input id="draft-field-${escapeHtml(slug)}" data-draft-field="${escapeHtml(slug)}" type="url" value="${escapeHtml(value)}" placeholder="https://example.com/image.jpg" class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <p class="text-xs text-gray-400">Enter a full image URL. Slug: ${escapeHtml(slug)}</p>
                </div>
            `;
        }

        if (BOOLEAN_FIELD_TYPES.has(field.type ?? '')) {
            const checked = value === true || value === 'true' || value === '1';
            return `
                <div class="flex items-center justify-between gap-3">
                    <label class="text-sm font-medium text-gray-700" for="draft-field-${escapeHtml(slug)}">${escapeHtml(label)}</label>
                    <input id="draft-field-${escapeHtml(slug)}" data-draft-field="${escapeHtml(slug)}" type="checkbox" ${checked ? 'checked' : ''} class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                </div>
            `;
        }

        if (REFERENCE_FIELD_TYPES.has(field.type ?? '')) {
            return `
                <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-gray-700" for="draft-field-${escapeHtml(slug)}">${escapeHtml(label)} ${required ? '<span class="text-rose-600">*</span>' : ''}</label>
                    <input id="draft-field-${escapeHtml(slug)}" data-draft-field="${escapeHtml(slug)}" type="text" value="${escapeHtml(value)}" placeholder="Paste the referenced item ID" class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <p class="text-xs text-gray-400">Enter the reference ID (e.g., another item's _id). Slug: ${escapeHtml(slug)}</p>
                </div>
            `;
        }

        return `
            <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-gray-700" for="draft-field-${escapeHtml(slug)}">${escapeHtml(label)} ${required ? '<span class="text-rose-600">*</span>' : ''}</label>
                <input id="draft-field-${escapeHtml(slug)}" data-draft-field="${escapeHtml(slug)}" type="text" value="${escapeHtml(value)}" class="rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p class="text-xs text-gray-400">Slug: ${escapeHtml(slug)}</p>
            </div>
        `;
    }

    function attachDraftEditorEvents(editableFields) {
        const container = blogGeneratorContainer.querySelector('#blogDraftEditor');
        if (!container) {
            return;
        }

        container.querySelectorAll('[data-draft-field]').forEach((input) => {
            const fieldSlug = input.dataset.draftField;

            if (input.type === 'checkbox') {
                input.addEventListener('change', (event) => {
                    draftFieldValues[fieldSlug] = event.target.checked;
                });
            } else {
                input.addEventListener('input', (event) => {
                    draftFieldValues[fieldSlug] = event.target.value;
                });
            }
        });

        const createDraftButton = container.querySelector('#createDraftButton');
        if (createDraftButton) {
            createDraftButton.addEventListener('click', async () => {
                await submitDraftToWebflow(editableFields);
            });
        }

        const resetDraftButton = container.querySelector('#resetDraftButton');
        if (resetDraftButton) {
            resetDraftButton.addEventListener('click', () => {
                draftFieldValues = {};
                rawAiContent = '';
                renderDraftEditor(editableFields);
                setBlogGeneratorStatus('Draft editor reset. Generate again to repopulate.', 'info');
            });
        }

        const copyRawButton = container.querySelector('#copyRawAiButton');
        if (copyRawButton) {
            copyRawButton.addEventListener('click', async () => {
                try {
                    const text = rawAiContent || JSON.stringify(draftFieldValues, null, 2) || 'No AI output available yet.';
                    await navigator.clipboard.writeText(text);
                    setBlogGeneratorStatus('Raw AI output copied to clipboard.', 'success');
                } catch (_error) {
                    setBlogGeneratorStatus('Unable to copy to clipboard. Please copy manually from the raw output section.', 'warning');
                }
            });
        }
    }

    async function submitDraftToWebflow(editableFields) {
        if (!selectedCollection) {
            setBlogGeneratorStatus('Please select a collection before creating a draft.', 'error');
            return;
        }

        const payload = buildDraftPayload();
        const missingRequired = findMissingRequiredFields(payload, editableFields);

        if (missingRequired.length > 0) {
            setBlogGeneratorStatus(`Fill in required fields before submitting: ${missingRequired.join(', ')}`, 'warning');
            return;
        }

        setBlogGeneratorStatus('Creating Webflow draft…', 'info');
        toggleDraftControls(true);

        try {
            await callApi({
                action: 'create-draft',
                targetCollectionId: selectedCollection.id,
                fields: payload,
            });
            setBlogGeneratorStatus('Draft created in Webflow. Review it inside your CMS drafts.', 'success');
        } catch (error) {
            setBlogGeneratorStatus(`Draft creation failed: ${error.message}`, 'error');
        } finally {
            toggleDraftControls(false);
        }
    }

    function buildDraftPayload() {
        const payload = {};

        Object.entries(draftFieldValues).forEach(([slug, value]) => {
            if (typeof value === 'string') {
                payload[slug] = value.trim();
            } else if (value !== null && value !== undefined) {
                payload[slug] = value;
            }
        });

        if (!payload.name || payload.name.length === 0) {
            const fallbackTitle = lastKeyword ? capitalizeFirstLetter(lastKeyword) : 'AI Draft';
            payload.name = fallbackTitle;
        }

        if (!payload.slug && payload.name) {
            payload.slug = slugify(payload.name);
        } else if (payload.slug) {
            payload.slug = slugify(payload.slug);
        }

        return payload;
    }

    function findMissingRequiredFields(payload, editableFields) {
        const editableSlugs = new Set(editableFields.map((field) => field.slug));

        return selectedCollectionFields
            .filter((field) => (field.isRequired === true || field.required === true) && editableSlugs.has(field.slug))
            .filter((field) => {
                const value = payload[field.slug];
                return value === undefined || value === null || String(value).trim() === '';
            })
            .map((field) => field.displayName ?? field.slug ?? 'Field');
    }

    function highlightSelectedSite(listItem) {
        document.querySelectorAll('#sitesListContainer li').forEach((li) => li.classList.remove('ring-2', 'ring-blue-500'));
        if (listItem) {
            listItem.classList.add('ring-2', 'ring-blue-500');
        }
    }

    function highlightSelectedCollection(listItem) {
        document.querySelectorAll('#collectionsListContainer li').forEach((li) => li.classList.remove('ring-2', 'ring-indigo-500'));
        if (listItem) {
            listItem.classList.add('ring-2', 'ring-indigo-500');
        }
    }

    function resetCollectionsUI(message = 'Select a site to load its collections.') {
        collectionsListContainer.innerHTML = `<p class="text-center text-gray-500">${escapeHtml(message)}</p>`;
    }

    function resetFieldsUI(message = 'Once you pick a collection, its fields appear here.') {
        if (!fieldsListContainer) {
            return;
        }
        fieldsListContainer.innerHTML = `<p class="text-center text-gray-500">${escapeHtml(message)}</p>`;
    }

    function resetBlogGenerator(message = 'Select a collection to enable the AI blog generator.') {
        if (!blogGeneratorContainer) {
            return;
        }
        blogGeneratorContainer.innerHTML = `<p class="text-center text-gray-500">${escapeHtml(message)}</p>`;
    }

    function toggleGeneratorControls(disabled) {
        const form = blogGeneratorContainer.querySelector('#blogPromptForm');
        if (!form) {
            return;
        }

        form.querySelectorAll('button, input, select, textarea').forEach((element) => {
            element.disabled = disabled;
        });
    }

    function toggleDraftControls(disabled) {
        const container = blogGeneratorContainer.querySelector('#blogDraftEditor');
        if (!container) {
            return;
        }

        container.querySelectorAll('button, input, textarea').forEach((element) => {
            element.disabled = disabled;
        });
    }

    function setBlogGeneratorStatus(message, variant = 'info') {
        const statusElement = blogGeneratorContainer.querySelector('#blogGeneratorStatus');
        if (!statusElement) {
            return;
        }

        if (!message) {
            statusElement.classList.add('hidden');
            statusElement.textContent = '';
            return;
        }

        const variantClasses = {
            info: 'text-blue-600',
            success: 'text-emerald-600',
            warning: 'text-amber-600',
            error: 'text-rose-600',
        };

        statusElement.className = `mt-4 text-sm ${variantClasses[variant] ?? 'text-gray-600'}`;
        statusElement.textContent = message;
        statusElement.classList.remove('hidden');
    }

    function safeParseJson(text) {
        try {
            return JSON.parse(text);
        } catch (_error) {
            return null;
        }
    }

    function mapDraftValues(parsed) {
        const values = {};

        selectedCollectionFields.forEach((field) => {
            if (!isFieldEditable(field)) {
                return;
            }

            const slug = field.slug;
            if (!slug) {
                return;
            }

            const rawValue = parsed[slug];

            if (BOOLEAN_FIELD_TYPES.has(field.type ?? '')) {
                values[slug] = normalizeBoolean(rawValue);
                return;
            }

            if (IMAGE_FIELD_TYPES.has(field.type ?? '')) {
                values[slug] = normalizeImage(rawValue);
                return;
            }

            if (REFERENCE_FIELD_TYPES.has(field.type ?? '')) {
                values[slug] = normalizeReference(rawValue);
                return;
            }

            values[slug] = valueToEditableString(rawValue);
        });

        return values;
    }

    function buildDraftFromRaw(raw, editableFields) {
        const values = {};

        if (editableFields.length > 0) {
            const firstField = editableFields[0];
            values[firstField.slug] = raw;
        }

        const nameField = editableFields.find((field) => field.slug === 'name');
        if (nameField && !values[nameField.slug]) {
            values[nameField.slug] = capitalizeFirstLetter(lastKeyword || raw || 'AI Draft');
        }

        return values;
    }

    function valueToEditableString(value) {
        if (value === null || value === undefined) {
            return '';
        }
        if (typeof value === 'string') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((item) => (typeof item === 'string' ? item : JSON.stringify(item))).join('\n');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    }

    function fillMissingFieldsFromRaw(rawText, editableFields) {
        if (!rawText) {
            return;
        }

        editableFields.forEach((field) => {
            const slug = field.slug ?? '';
            if (!slug) {
                return;
            }

            if (draftFieldValues[slug] !== undefined && draftFieldValues[slug] !== '') {
                return;
            }

            if (slug === 'name') {
                draftFieldValues[slug] = inferTitleFromRaw(rawText) || capitalizeFirstLetter(lastKeyword || 'AI Draft');
            } else if (slug === 'slug') {
                const base = draftFieldValues.name || inferTitleFromRaw(rawText) || lastKeyword;
                if (base) {
                    draftFieldValues.slug = slugify(base);
                }
            } else if (slug === 'post-summary' || slug === 'seo-meta-description') {
                draftFieldValues[slug] = summarizeRawText(rawText, 24);
            } else if (slug === 'image-alt-tag') {
                draftFieldValues[slug] = inferImageAlt(rawText);
            }
        });
    }

    function normalizeBoolean(value) {
        if (typeof value === 'boolean') {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            return normalized === 'true' || normalized === '1' || normalized === 'yes';
        }
        if (typeof value === 'number') {
            return value !== 0;
        }
        return false;
    }

    function normalizeImage(value) {
        if (typeof value === 'string' && value.startsWith('http')) {
            return value;
        }

        if (value && typeof value === 'object') {
            if (typeof value.url === 'string') {
                return value.url;
            }
            if (typeof value.src === 'string') {
                return value.src;
            }
        }

        return '';
    }

    function normalizeReference(value) {
        if (typeof value === 'string') {
            return value;
        }

        if (value && typeof value === 'object') {
            if (typeof value._id === 'string') {
                return value._id;
            }
            if (typeof value.id === 'string') {
                return value.id;
            }
        }

        return '';
    }

    function inferTitleFromRaw(rawText) {
        const match = rawText.match(/<h1[^>]*>(.*?)<\/h1>/i) || rawText.match(/<h2[^>]*>(.*?)<\/h2>/i);
        if (match && match[1]) {
            return stripHtml(match[1]);
        }

        const sentences = rawText.split(/[.!?]/).map((s) => s.trim()).filter(Boolean);
        if (sentences.length > 0) {
            return capitalizeFirstLetter(sentences[0].slice(0, 120));
        }

        return '';
    }

    function inferImageAlt(rawText) {
        const match = rawText.match(/<img[^>]*alt="([^"]*)"[^>]*>/i);
        if (match && match[1]) {
            return match[1];
        }

        const sentence = summarizeRawText(rawText, 12);
        return sentence ? sentence : 'Illustration related to the blog post.';
    }

    function summarizeRawText(rawText, wordLimit) {
        const stripped = stripHtml(rawText);
        const words = stripped.split(/\s+/).filter(Boolean);
        if (words.length === 0) {
            return '';
        }

        const summary = words.slice(0, wordLimit).join(' ');
        return words.length > wordLimit ? `${summary}…` : summary;
    }

    function stripHtml(raw) {
        return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function isFieldEditable(field) {
        const type = field.type ?? '';
        if (!SUPPORTED_FIELD_TYPES.has(type)) {
            return false;
        }

        if (REFERENCE_FIELD_TYPES.has(type)) {
            return true;
        }

        if (IMAGE_FIELD_TYPES.has(type)) {
            return true;
        }

        if (BOOLEAN_FIELD_TYPES.has(type)) {
            return true;
        }

        return TEXT_FIELD_TYPES.has(type);
    }

    function isLongTextField(type) {
        return LONG_TEXT_FIELD_TYPES.has(type);
    }

    function serializeFieldMetadata(fields) {
        return fields.map((field) => ({
            slug: field.slug ?? '',
            displayName: field.displayName ?? field.name ?? '',
            type: field.type ?? 'unknown',
            required: field.isRequired === true || field.required === true,
        }));
    }

    function normalizeCollectionResponse(data) {
        if (data && typeof data === 'object') {
            if (data.collection && typeof data.collection === 'object') {
                return data.collection;
            }
        }
        return data;
    }

    function capitalizeFirstLetter(text) {
        if (!text) {
            return '';
        }
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function slugify(text) {
        return text
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 64);
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
});
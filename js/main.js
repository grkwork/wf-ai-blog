document.addEventListener('DOMContentLoaded', () => {
    // Get references to all HTML elements we'll interact with
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const submitBtn = document.getElementById('submitBtn');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const collectionsListContainer = document.getElementById('collectionsListContainer'); // New container
    const fieldsListContainer = document.getElementById('fieldsListContainer');

    const apiUrl = 'https://lightslategray-spoonbill-600904.hostingersite.com/api.php';

    // === EVENT LISTENERS ===

    // 1. Listen for the initial form submission to get sites
    apiKeyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        collectionsListContainer.innerHTML = ''; // Clear collections when loading new sites
        fetchSites();
    });

    // 2. (NEW) Listen for clicks on the "Select" button for any site
    sitesListContainer.addEventListener('click', (event) => {
        // Use event delegation to catch clicks on dynamically added buttons
        if (event.target && event.target.matches('button[data-site-id]')) {
            const siteId = event.target.dataset.siteId;
            fetchCollections(siteId);
            // Highlight the selected site
            document.querySelectorAll('#sitesListContainer li').forEach(li => li.classList.remove('ring-2', 'ring-blue-500'));
            event.target.closest('li').classList.add('ring-2', 'ring-blue-500');
        }
    });

    // === DATA FETCHING FUNCTIONS ===

    async function fetchSites() {
        const key = apiKeyInput.value.trim();
        if (!key) {
            alert('Please enter an Access Token.');
            return;
        }

        submitBtn.disabled = true;
        sitesListContainer.innerHTML = '<p class="text-center text-blue-600">Loading sites...</p>';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            displaySites(data.sites);
        } catch (error) {
            sitesListContainer.innerHTML = `<p class="text-center text-red-600">Error: ${error.message}</p>`;
        } finally {
            submitBtn.disabled = false;
        }
    }

    async function fetchCollections(siteId) {
        const key = apiKeyInput.value.trim(); // The API key is still needed for authentication
        collectionsListContainer.innerHTML = '<p class="text-center text-blue-600">Loading collections...</p>';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // This time, we send both the key AND the siteId
                body: JSON.stringify({ apiKey: key, siteId: siteId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            displayCollections(data.collections);
            clearFields();
        } catch (error) {
            collectionsListContainer.innerHTML = `<p class="text-center text-red-600">Error: ${error.message}</p>`;
            clearFields();
        }
    }

    // === DISPLAY FUNCTIONS ===

    function displaySites(sites) {
        sitesListContainer.innerHTML = '';
        if (!sites || sites.length === 0) {
            sitesListContainer.innerHTML = '<p class="text-center text-gray-500">No sites found.</p>';
            return;
        }
        const list = document.createElement('ul');
        list.className = 'space-y-3';
        sites.forEach(site => {
            const listItem = document.createElement('li');
            listItem.className = 'p-4 bg-white border rounded-md shadow-sm flex justify-between items-center transition-shadow duration-200 hover:shadow-lg';
            listItem.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${site.displayName}</p>
                    <p class="text-sm text-gray-500">${site.previewUrl}</p>
                </div>
                <button class="text-sm bg-green-500 text-white py-1 px-3 rounded-md hover:bg-green-600" data-site-id="${site.id}">
                    Select
                </button>
            `;
            list.appendChild(listItem);
        });
        sitesListContainer.appendChild(list);
    }

    function displayCollections(collections) {
        collectionsListContainer.innerHTML = ''; // Clear previous content
        
        // Add a title for the collections section
        const title = document.createElement('h3');
        title.className = 'text-xl font-bold mb-4 text-gray-700 border-t pt-6 mt-6';
        title.textContent = 'CMS Collections';
        collectionsListContainer.appendChild(title);

        if (!collections || collections.length === 0) {
            collectionsListContainer.innerHTML += '<p class="text-center text-gray-500">No CMS Collections found on this site.</p>';
            return;
        }
        const list = document.createElement('ul');
        list.className = 'space-y-2';
        collections.forEach(collection => {
            const listItem = document.createElement('li');
            listItem.className = 'p-3 bg-white border rounded-md flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 transition';
            listItem.dataset.collectionId = collection.id;
            listItem.innerHTML = `
                <div class="flex flex-col gap-1">
                    <span class="font-medium text-gray-800">${collection.displayName}</span>
                    <span class="text-xs text-gray-500">Slug: ${collection.slug}</span>
                </div>
                <span class="text-xs text-blue-600">View fields →</span>
            `;
            list.appendChild(listItem);
        });
        collectionsListContainer.appendChild(list);
    }

    collectionsListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('li[data-collection-id]');
        if (!listItem) return;

        const collectionId = listItem.dataset.collectionId;
        document.querySelectorAll('#collectionsListContainer li[data-collection-id]').forEach((li) => {
            li.classList.remove('ring-2', 'ring-indigo-500');
        });
        listItem.classList.add('ring-2', 'ring-indigo-500');

        fetchCollectionFields(collectionId);
    });

    async function fetchCollectionFields(collectionId) {
        const key = apiKeyInput.value.trim();
        if (!collectionId) return;

        setFieldsContent('<p class="text-center text-blue-600">Loading fields...</p>');

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key, collectionId }),
            });

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Failed to load fields.');
            }

            displayFields(data.fields ?? []);
        } catch (error) {
            setFieldsContent(`<p class="text-center text-red-600">Error: ${error.message}</p>`);
        }
    }

    function setFieldsContent(markup) {
        if (!fieldsListContainer) {
            return;
        }

        fieldsListContainer.innerHTML = markup;
    }

    function clearFields() {
        setFieldsContent('');
    }

    function displayFields(fields) {
        if (!fieldsListContainer) {
            return;
        }

        fieldsListContainer.innerHTML = '';

        const title = document.createElement('h3');
        title.className = 'text-xl font-bold mb-4 text-gray-700 border-t pt-6 mt-6';
        title.textContent = 'Collection Fields';
        fieldsListContainer.appendChild(title);

        if (!Array.isArray(fields) || fields.length === 0) {
            fieldsListContainer.innerHTML += '<p class="text-center text-gray-500">No fields found for this collection.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2';

        fields.forEach((field) => {
            const listItem = document.createElement('li');
            listItem.className = 'p-3 bg-white border rounded-md flex flex-col gap-1';

            listItem.innerHTML = `
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-800">${field.displayName ?? field.name ?? 'Untitled Field'}</span>
                    <span class="text-xs uppercase text-gray-500 bg-gray-100 px-2 py-1 rounded">${field.type ?? 'unknown'}</span>
                </div>
                <p class="text-xs text-gray-500">Slug: ${field.slug ?? 'n/a'}</p>
            `;

            list.appendChild(listItem);
        });

        fieldsListContainer.appendChild(list);
    }
});
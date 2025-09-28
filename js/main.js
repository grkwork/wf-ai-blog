document.addEventListener('DOMContentLoaded', () => {
    // Get references to all HTML elements we'll interact with
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const submitBtn = document.getElementById('submitBtn');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const collectionsListContainer = document.getElementById('collectionsListContainer'); // New container

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
        } catch (error) {
            collectionsListContainer.innerHTML = `<p class="text-center text-red-600">Error: ${error.message}</p>`;
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
            listItem.className = 'p-3 bg-white border rounded-md flex items-center gap-3';
            listItem.innerHTML = `
                <span class="bg-gray-200 text-gray-700 text-xs font-mono py-1 px-2 rounded">${collection.slug}</span>
                <span class="font-medium text-gray-800">${collection.displayName}</span>
            `;
            list.appendChild(listItem);
        });
        collectionsListContainer.appendChild(list);
    }
});
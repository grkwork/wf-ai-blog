document.addEventListener('DOMContentLoaded', () => {
    const apiKeyForm = document.getElementById('apiKeyForm');
    const apiKeyInput = document.getElementById('apiKeyInput');
    const submitBtn = document.getElementById('submitBtn');
    const sitesListContainer = document.getElementById('sitesListContainer');
    const collectionsListContainer = document.getElementById('collectionsListContainer');

    const apiUrl = '/api.php';

    apiKeyForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        collectionsListContainer.innerHTML = '';
        await fetchSites();
    });

    sitesListContainer.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-site-id]');
        if (!button) {
            return;
        }

        const siteId = button.dataset.siteId;
        fetchCollections(siteId);

        document.querySelectorAll('#sitesListContainer li').forEach((li) => {
            li.classList.remove('ring-2', 'ring-blue-500');
        });

        const listItem = button.closest('li');
        if (listItem) {
            listItem.classList.add('ring-2', 'ring-blue-500');
        }
    });

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

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load sites.');
            }

            displaySites(data.sites ?? data);
        } catch (error) {
            sitesListContainer.innerHTML = `<p class="text-center text-red-600">Error: ${error.message}</p>`;
        } finally {
            submitBtn.disabled = false;
        }
    }

    async function fetchCollections(siteId) {
        const key = apiKeyInput.value.trim();

        collectionsListContainer.innerHTML = '<p class="text-center text-blue-600">Loading collections...</p>';

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: key, siteId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to load collections.');
            }

            displayCollections(data.collections ?? data);
        } catch (error) {
            collectionsListContainer.innerHTML = `<p class="text-center text-red-600">Error: ${error.message}</p>`;
        }
    }

    function displaySites(sites) {
        sitesListContainer.innerHTML = '';

        if (!Array.isArray(sites) || sites.length === 0) {
            sitesListContainer.innerHTML = '<p class="text-center text-gray-500">No sites found.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-3';

        sites.forEach((site) => {
            const siteId = site.id ?? site._id;
            const displayName = site.displayName ?? site.name ?? 'Untitled Site';
            const previewUrl = site.previewUrl ?? site.publicUrl ?? 'No preview URL available';

            const listItem = document.createElement('li');
            listItem.className = 'p-4 bg-white border rounded-md shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center transition-shadow duration-200 hover:shadow-lg';
            listItem.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${displayName}</p>
                    <p class="text-sm text-gray-500 truncate">${previewUrl}</p>
                </div>
                <button class="text-sm bg-green-500 text-white py-2 px-4 rounded-md hover:bg-green-600" data-site-id="${siteId}">
                    Select
                </button>
            `;

            list.appendChild(listItem);
        });

        sitesListContainer.appendChild(list);
    }

    function displayCollections(collections) {
        collectionsListContainer.innerHTML = '';

        const title = document.createElement('h2');
        title.className = 'text-xl font-bold mb-4 text-gray-700 border-t pt-6 mt-6';
        title.textContent = 'CMS Collections';
        collectionsListContainer.appendChild(title);

        if (!Array.isArray(collections) || collections.length === 0) {
            collectionsListContainer.innerHTML += '<p class="text-center text-gray-500">No CMS Collections found on this site.</p>';
            return;
        }

        const list = document.createElement('ul');
        list.className = 'space-y-2';

        collections.forEach((collection) => {
            const slug = collection.slug ?? 'no-slug';
            const displayName = collection.displayName ?? collection.name ?? 'Untitled Collection';

            const listItem = document.createElement('li');
            listItem.className = 'p-3 bg-white border rounded-md flex items-center gap-3';
            listItem.innerHTML = `
                <span class="bg-gray-200 text-gray-700 text-xs font-mono py-1 px-2 rounded">${slug}</span>
                <span class="font-medium text-gray-800">${displayName}</span>
            `;

            list.appendChild(listItem);
        });

        collectionsListContainer.appendChild(list);
    }
});


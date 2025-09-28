<?php

declare(strict_types=1);

$sites = null;
$error = null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $apiKey = trim($_POST['api_key'] ?? '');

    if ($apiKey === '') {
        $error = 'Please enter a valid Webflow API key.';
    } else {
        try {
            $sites = fetchWebflowSites($apiKey);
        } catch (Throwable $exception) {
            $error = $exception->getMessage();
        }
    }
}

function fetchWebflowSites(string $apiKey): array
{
    $curl = curl_init('https://api.webflow.com/sites');

    $headers = [
        'Authorization: Bearer ' . $apiKey,
        'Accept-Version: 1.0.0',
        'Content-Type: application/json',
    ];

    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($curl);
    $httpStatus = curl_getinfo($curl, CURLINFO_HTTP_CODE);

    if ($response === false) {
        $curlError = curl_error($curl) ?: 'Unknown error while communicating with Webflow API.';
        curl_close($curl);

        throw new RuntimeException($curlError);
    }

    curl_close($curl);

    $payload = json_decode($response, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('Failed to parse Webflow API response: ' . json_last_error_msg());
    }

    if ($httpStatus >= 400) {
        $message = $payload['message'] ?? 'Webflow API returned an error (status ' . $httpStatus . ').';
        throw new RuntimeException($message);
    }

    if (!isset($payload) || !is_array($payload)) {
        throw new RuntimeException('Unexpected Webflow API response structure.');
    }

    return $payload;
}

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webflow AI Blog Assistant</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3.4.10/dist/tailwind.min.css" rel="stylesheet">
</head>
<body class="bg-slate-100 min-h-screen">
    <div class="max-w-4xl mx-auto px-4 py-12">
        <header class="mb-8 text-center">
            <h1 class="text-3xl font-bold text-slate-900">Webflow AI Blog Assistant</h1>
            <p class="mt-2 text-slate-600">Enter your Webflow API key to retrieve the sites available in your account.</p>
        </header>

        <section class="bg-white shadow rounded-lg p-6">
            <form method="POST" class="space-y-4">
                <div>
                    <label for="api_key" class="block text-sm font-medium text-slate-700">Webflow API Key</label>
                    <input
                        type="password"
                        name="api_key"
                        id="api_key"
                        value=""
                        placeholder="Enter your API key"
                        class="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        autocomplete="off"
                        required
                    >
                    <p class="mt-2 text-xs text-slate-500">Your key is used only for this request and is never stored.</p>
                </div>

                <div class="flex items-center justify-end gap-2">
                    <button
                        type="submit"
                        class="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    >
                        Fetch Sites
                    </button>
                </div>
            </form>

            <?php if ($error !== null): ?>
                <div class="mt-6 rounded-md bg-rose-50 p-4">
                    <div class="flex">
                        <div class="ml-3">
                            <h3 class="text-sm font-medium text-rose-800">Error</h3>
                            <div class="mt-2 text-sm text-rose-700">
                                <p><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></p>
                            </div>
                        </div>
                    </div>
                </div>
            <?php endif; ?>

            <?php if (is_array($sites)): ?>
                <div class="mt-6">
                    <h2 class="text-xl font-semibold text-slate-900">Your Sites</h2>
                    <?php if (count($sites) === 0): ?>
                        <p class="mt-2 text-slate-600">No sites found for this API key.</p>
                    <?php else: ?>
                        <div class="mt-4 overflow-hidden rounded-lg border border-slate-200">
                            <table class="min-w-full divide-y divide-slate-200">
                                <thead class="bg-slate-50">
                                    <tr>
                                        <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Name</th>
                                        <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Site ID</th>
                                        <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Created</th>
                                        <th scope="col" class="px-4 py-3 text-left text-sm font-semibold text-slate-600">Published</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100 bg-white">
                                    <?php foreach ($sites as $site): ?>
                                        <tr>
                                            <td class="px-4 py-3 text-sm text-slate-900">
                                                <?= htmlspecialchars($site['name'] ?? 'Untitled', ENT_QUOTES, 'UTF-8'); ?>
                                            </td>
                                            <td class="px-4 py-3 text-sm text-slate-600">
                                                <code class="rounded bg-slate-100 px-2 py-1 text-xs">
                                                    <?= htmlspecialchars($site['_id'] ?? 'N/A', ENT_QUOTES, 'UTF-8'); ?>
                                                </code>
                                            </td>
                                            <td class="px-4 py-3 text-sm text-slate-600">
                                                <?= htmlspecialchars($site['createdOn'] ?? 'N/A', ENT_QUOTES, 'UTF-8'); ?>
                                            </td>
                                            <td class="px-4 py-3 text-sm text-slate-600">
                                                <?= htmlspecialchars($site['lastPublished'] ?? 'Never', ENT_QUOTES, 'UTF-8'); ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                </tbody>
                            </table>
                        </div>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
        </section>

        <footer class="mt-12 text-center text-xs text-slate-500">
            <p>Built with PHP and Tailwind CSS. Enter the next steps to generate AI blog posts.</p>
        </footer>
    </div>
</body>
</html>


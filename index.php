<?php declare(strict_types=1); ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webflow AI Blog Connector</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-100 min-h-screen">
    <div class="w-full max-w-2xl mx-auto p-6 bg-gray-50 rounded-lg shadow-md mt-10">
        <h1 class="text-2xl font-bold mb-4 text-gray-800">Connect Your Account</h1>
        <p class="text-gray-600 mb-6">Enter your Access Token to load your available sites.</p>

        <form id="apiKeyForm" class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <input
                type="password"
                id="apiKeyInput"
                placeholder="Enter your Access Token here"
                class="flex-grow p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                required
            />
            <button
                type="submit"
                id="submitBtn"
                class="bg-blue-600 text-white font-semibold py-3 px-5 rounded-md hover:bg-blue-700 transition disabled:bg-gray-400"
            >
                Load Sites
            </button>
        </form>

        <div id="sitesListContainer" class="mt-8">
            <p class="text-center text-gray-500">Your sites will appear here...</p>
        </div>

        <div id="collectionsListContainer" class="mt-8"></div>
    </div>

    <script src="/js/main.js"></script>
</body>
</html>
<?php
require 'vendor/autoload.php';

use GuzzleHttp\Client;
use GuzzleHttp\Exception\RequestException;

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['message' => 'Invalid request method.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$token = $input['apiKey'] ?? null;
$siteId = $input['siteId'] ?? null;
$collectionId = $input['collectionId'] ?? null;

if (!$token) {
    http_response_code(400);
    echo json_encode(['message' => 'Access Token is missing.']);
    exit;
}

$client = new Client();

// --- NEW LOGIC: Decide which API endpoint to call ---
if ($collectionId) {
    // If a collectionId is provided, fetch its details (includes fields)
    $apiUrl = "https://api.webflow.com/v2/collections/{$collectionId}";
} elseif ($siteId) {
    // If a siteId is provided, fetch its collections
    $apiUrl = "https://api.webflow.com/v2/sites/{$siteId}/collections";
} else {
    // Otherwise, fetch the list of sites
    $apiUrl = 'https://api.webflow.com/v2/sites';
}

try {
    $response = $client->request('GET', $apiUrl, [
        'headers' => [
            'Authorization' => 'Bearer ' . $token,
            'accept' => 'application/json',
        ]
    ]);

    $body = $response->getBody()->getContents();
    $data = json_decode($body, true);

    http_response_code(200);
    // Return the full data payload from Webflow
    echo json_encode($data); 

} catch (RequestException $e) {
    if ($e->hasResponse()) {
        $response = $e->getResponse();
        $statusCode = $response->getStatusCode();
        $errorBody = $response->getBody()->getContents();
        $errorData = json_decode($errorBody, true);
        
        $errorMessage = $errorData['message'] ?? 'An API error occurred.';

        http_response_code($statusCode);
        echo json_encode(['message' => $errorMessage]);
    } else {
        http_response_code(500);
        echo json_encode(['message' => 'Network error: Unable to connect to Webflow API.']);
    }
}
?>
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
$selectedFields = $input['fields'] ?? [];
$action = $input['action'] ?? 'list';
$blogPrompt = $input['prompt'] ?? null;
$blogModel = $input['model'] ?? 'gpt-4o-mini';
$blogCollectionId = $input['targetCollectionId'] ?? null;

if (!$token) {
    http_response_code(400);
    echo json_encode(['message' => 'Access Token is missing.']);
    exit;
}

$client = new Client();

try {
    switch ($action) {
        case 'list-sites':
            handleListSites($client, $token);
            break;
        case 'list-collections':
            handleListCollections($client, $token, $siteId);
            break;
        case 'collection-details':
            handleCollectionDetails($client, $token, $collectionId);
            break;
        case 'generate-blog':
            handleGenerateBlog($token, $blogPrompt, $selectedFields, $blogModel);
            break;
        case 'create-draft':
            handleCreateDraft($client, $token, $blogCollectionId, $selectedFields);
            break;
        default:
            http_response_code(400);
            echo json_encode(['message' => 'Unsupported action.']);
            break;
    }
} catch (RequestException $e) {
    handleRequestException($e);
} catch (RuntimeException $e) {
    http_response_code(400);
    echo json_encode(['message' => $e->getMessage()]);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['message' => 'Unexpected error: ' . $e->getMessage()]);
}

function handleListSites(Client $client, string $token): void
{
    $response = $client->request('GET', 'https://api.webflow.com/v2/sites', [
        'headers' => baseWebflowHeaders($token),
    ]);

    outputResponseBody($response);
}

function handleListCollections(Client $client, string $token, ?string $siteId): void
{
    if ($siteId === null) {
        throw new RuntimeException('siteId is required to list collections.');
    }

    $response = $client->request('GET', "https://api.webflow.com/v2/sites/{$siteId}/collections", [
        'headers' => baseWebflowHeaders($token),
    ]);

    outputResponseBody($response);
}

function handleCollectionDetails(Client $client, string $token, ?string $collectionId): void
{
    if ($collectionId === null) {
        throw new RuntimeException('collectionId is required to fetch details.');
    }

    $response = $client->request('GET', "https://api.webflow.com/v2/collections/{$collectionId}", [
        'headers' => baseWebflowHeaders($token),
    ]);

    outputResponseBody($response);
}

function handleGenerateBlog(string $token, ?string $prompt, array $fields, string $model): void
{
    $apiKey = getenv('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');

    if (!$apiKey) {
        throw new RuntimeException('Missing server-side OpenAI API key.');
    }

    if ($prompt === null || trim($prompt) === '') {
        throw new RuntimeException('Prompt is required to generate blog content.');
    }

    $client = OpenAI::client($apiKey);

    $response = $client->responses()->create([
        'model' => $model,
        'input' => buildBlogPrompt($prompt, $fields),
    ]);

    $generated = $response->output[0]->content[0]->text ?? '';

    http_response_code(200);
    echo json_encode(['content' => $generated]);
}

function handleCreateDraft(Client $client, string $token, ?string $collectionId, array $fields): void
{
    if ($collectionId === null) {
        throw new RuntimeException('collectionId is required to create a draft.');
    }

    $payload = ['fields' => $fields, 'isDraft' => true];

    $response = $client->request('POST', "https://api.webflow.com/v2/collections/{$collectionId}/items", [
        'headers' => baseWebflowHeaders($token),
        'json' => $payload,
    ]);

    outputResponseBody($response);
}

function buildBlogPrompt(string $keyword, array $fields): string
{
    $fieldDescriptions = array_map(
        static fn(array $field): string => sprintf('- %s (%s)', $field['displayName'] ?? $field['slug'] ?? 'Unnamed field', $field['type'] ?? 'unknown'),
        $fields
    );

    return "Generate a Webflow CMS blog post draft using the keyword '{$keyword}'.\n" .
        "Follow these field expectations:\n" . implode("\n", $fieldDescriptions) . "\n" .
        "Return structured JSON matching field slugs with sample content.";
}

function baseWebflowHeaders(string $token): array
{
    return [
        'Authorization' => 'Bearer ' . $token,
        'accept' => 'application/json',
        'Content-Type' => 'application/json',
    ];
}

function outputResponseBody($response): void
{
    $body = $response->getBody()->getContents();
    $data = json_decode($body, true);

    http_response_code(200);
    echo json_encode($data);
}

function handleRequestException(RequestException $e): void
{
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
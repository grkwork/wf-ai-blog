<?php
require 'vendor/autoload.php';

$configPath = __DIR__ . '/../config.php';
if (file_exists($configPath)) {
    include_once $configPath;
}

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ClientException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use OpenAI;

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
$blogModel = $input['model'] ?? 'openai:gpt-4o-mini';
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
        case 'list-reference-items':
            handleListReferenceItems($client, $token, $collectionId);
            break;
        case 'list-collection-items':
            handleListCollectionItems($client, $token, $collectionId);
            break;
        case 'generate-blog':
            handleGenerateBlog($token, $blogPrompt, $selectedFields, $blogModel, $OPENAI_API_KEY ?? null, $GEMINI_API_KEY ?? null);
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

function handleListReferenceItems(Client $client, string $token, ?string $collectionId): void
{
    if ($collectionId === null) {
        throw new RuntimeException('collectionId is required to list reference items.');
    }

    $response = $client->request('GET', "https://api.webflow.com/v2/collections/{$collectionId}/items", [
        'headers' => baseWebflowHeaders($token),
    ]);

    outputResponseBody($response);
}

function handleListCollectionItems(Client $client, string $token, ?string $collectionId): void
{
    if ($collectionId === null) {
        throw new RuntimeException('collectionId is required to list items.');
    }

    $response = $client->request('GET', "https://api.webflow.com/v2/collections/{$collectionId}/items", [
        'headers' => baseWebflowHeaders($token),
    ]);

    outputResponseBody($response);
}

function handleGenerateBlog(string $token, ?string $prompt, array $fields, string $modelSelection, ?string $openAiApiKey, ?string $geminiApiKey): void
{
    if ($prompt === null || trim($prompt) === '') {
        throw new RuntimeException('Prompt is required to generate blog content.');
    }

    [$provider, $model] = parseModelSelection($modelSelection);
    $promptText = buildBlogPrompt($prompt, $fields);

    switch ($provider) {
        case 'openai':
            $apiKey = $openAiApiKey ?? getenv('OPENAI_API_KEY');
            if (!$apiKey) {
                throw new RuntimeException('Missing server-side OpenAI API key.');
            }

            $client = OpenAI::client($apiKey);

            // Retry mechanism with exponential backoff for rate limits
            $maxRetries = 3;
            $baseDelay = 2; // seconds
            
            for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
                try {
                    $response = $client->responses()->create([
                        'model' => $model,
                        'input' => $promptText,
                    ]);

                    $generated = $response->output[0]->content[0]->text ?? '';
                    break; // Success, exit retry loop
                    
                } catch (Exception $e) {
                    $errorMessage = $e->getMessage();
                    
                    // Check if it's a rate limit error
                    if (strpos($errorMessage, 'rate limit') !== false || strpos($errorMessage, 'Rate limit') !== false) {
                        if ($attempt < $maxRetries - 1) {
                            $delay = $baseDelay * pow(2, $attempt); // Exponential backoff: 2s, 4s, 8s
                            sleep($delay);
                            continue; // Retry
                        }
                    }
                    
                    // If not a rate limit error, or we've exhausted retries, re-throw
                    throw $e;
                }
            }
            break;

        case 'gemini':
            $apiKey = $geminiApiKey ?? getenv('GEMINI_API_KEY');
            if (!$apiKey) {
                throw new RuntimeException('Missing server-side Gemini API key.');
            }

            $generated = generateWithGemini($model, $promptText, $apiKey);
            break;

        default:
            throw new RuntimeException('Unsupported AI provider selected.');
    }

    http_response_code(200);
    echo json_encode(['content' => $generated]);
}

function generateWithGemini(string $model, string $promptText, string $apiKey): string
{
    $httpClient = new Client();
    $resolvedModel = resolveGeminiModel($model);

    try {
        $response = requestGemini($httpClient, 'v1beta', $resolvedModel, $promptText, $apiKey);
    } catch (GuzzleException $exception) {
        throw new RuntimeException('Gemini request failed: ' . $exception->getMessage(), 0, $exception);
    }

    $payload = json_decode($response->getBody()->getContents(), true);

    if (isset($payload['error'])) {
        $message = $payload['error']['message'] ?? 'Unknown Gemini API error.';
        throw new RuntimeException('Gemini API error: ' . $message);
    }

    $text = $payload['candidates'][0]['content']['parts'][0]['text'] ?? '';

    if (!is_string($text) || trim($text) === '') {
        throw new RuntimeException('Gemini API returned an unexpected response.');
    }

    return $text;
}

function parseModelSelection(string $selection): array
{
    $parts = explode(':', $selection, 2);

    if (count($parts) !== 2) {
        return ['openai', $selection];
    }

    return [$parts[0] ?: 'openai', $parts[1] ?: 'gpt-4o-mini'];
}

function resolveGeminiModel(string $model): string
{
    $map = [
        'gemini-2.5-flash' => 'gemini-2.5-flash',
        'gemini-2.5-flash-latest' => 'gemini-2.5-flash',
        'gemini-2.5-pro' => 'gemini-2.5-pro',
        'gemini-2.5-pro-latest' => 'gemini-2.5-pro',
        'gemini-1.5-flash-latest' => 'gemini-1.5-flash',
        'gemini-1.5-pro-latest' => 'gemini-1.5-pro',
        'gemini-pro-latest' => 'gemini-pro',
        'gemini-pro' => 'gemini-pro',
    ];

    return $map[$model] ?? $model;
}

function requestGemini(Client $client, string $apiVersion, string $model, string $promptText, string $apiKey)
{
    return $client->request('POST', "https://generativelanguage.googleapis.com/{$apiVersion}/models/{$model}:generateContent", [
        'headers' => [
            'x-goog-api-key' => $apiKey,
            'Content-Type' => 'application/json',
        ],
        'json' => [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $promptText],
                    ],
                ],
            ],
        ],
        'timeout' => 30,
    ]);
}

function handleCreateDraft(Client $client, string $token, ?string $collectionId, array $fields): void
{
    if ($collectionId === null) {
        throw new RuntimeException('collectionId is required to create a draft.');
    }

    // Webflow API v2 expects fieldData structure
    $payload = [
        'fieldData' => $fields,
        'isDraft' => true
    ];

    $response = $client->request('POST', "https://api.webflow.com/v2/collections/{$collectionId}/items", [
        'headers' => baseWebflowHeaders($token),
        'json' => $payload,
    ]);

    outputResponseBody($response);
}

function buildBlogPrompt(string $keyword, array $fields): string
{
    $lines = [];
    $lines[] = "You are an assistant that generates draft content for a Webflow CMS collection.";
    $lines[] = "Use the keyword: {$keyword}.";
    $lines[] = "Return only valid JSON with keys that exactly match the provided field slugs. Do not wrap the JSON in quotes or code fences.";
    $lines[] = "For each field, follow the instructions below:";
    $lines[] = "";
    $lines[] = "IMPORTANT FOR IMAGES: Use reliable, accessible free image sources. Prefer these sources in order:";
    $lines[] = "1. Pexels (https://images.pexels.com/photos/) - Use direct image URLs like: https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg";
    $lines[] = "2. Pixabay (https://pixabay.com/photos/) - Use direct image URLs";
    $lines[] = "3. Wikimedia Commons (https://commons.wikimedia.org/) - Use direct image URLs";
    $lines[] = "4. Unsplash (https://images.unsplash.com/) - Only if other sources fail, use direct URLs like: https://images.unsplash.com/photo-1234567890-abcdef";
    $lines[] = "AVOID: Complex Unsplash URLs with parameters, broken links, or placeholder images.";
    $lines[] = "";

    foreach ($fields as $field) {
        $slug = $field['slug'] ?? 'unknown';
        $displayName = $field['displayName'] ?? $slug;
        $type = strtolower($field['type'] ?? 'unknown');
        $required = ($field['required'] ?? false) ? 'Required' : 'Optional';

        $instruction = match ($type) {
            'plaintext' => 'Provide concise text.',
            'slug' => 'Generate a lowercase, hyphen-separated URL slug based on the "name" field.',
            'richtext' => 'Return rich, well-structured HTML. Include headings (h2, h3), paragraphs (p), lists (ul, ol), and embed at least one relevant, royalty-free image using an <img> tag with a direct HTTPS URL in the src attribute.',
            'image' => 'Return a direct HTTPS URL to a relevant, high-quality, royalty-free image from Pexels, Pixabay, or Wikimedia Commons. Ensure the URL is accessible and returns a valid image.',
            'switch', 'boolean' => 'Return true or false.',
            'reference' => 'Return a related item identifier as a string.',
            'number' => 'Return a numeric value.',
            'date' => 'Return an ISO 8601 date string.',
            default => 'Provide suitable content.',
        };

        $lines[] = "- Slug: {$slug} ({$required}, type: {$type}) — {$instruction}";
    }

    $lines[] = "Example JSON format: {\"slug-name\": \"value\"}";
    $lines[] = "Do not include any commentary or extra keys.";

    return implode("\n", $lines);
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
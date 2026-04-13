# GenerateApi

All URIs are relative to _/api_

| Method                                            | HTTP request       | Description |
| ------------------------------------------------- | ------------------ | ----------- |
| [**generateCards**](GenerateApi.md#generatecards) | **POST** /generate |             |

## generateCards

> Array&lt;GeneratedCard&gt; generateCards(GenerateRequest)

### Example

```ts
import {
  Configuration,
  GenerateApi,
} from '';
import type { GenerateCardsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new GenerateApi(config);

  const body = {
    // GenerateRequest
    GenerateRequest: ...,
  } satisfies GenerateCardsRequest;

  try {
    const data = await api.generateCards(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name                | Type                                  | Description | Notes |
| ------------------- | ------------------------------------- | ----------- | ----- |
| **GenerateRequest** | [GenerateRequest](GenerateRequest.md) |             |       |

### Return type

[**Array&lt;GeneratedCard&gt;**](GeneratedCard.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description     | Response headers |
| ----------- | --------------- | ---------------- |
| **200**     | Generated cards | -                |
| **0**       | Error response  | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

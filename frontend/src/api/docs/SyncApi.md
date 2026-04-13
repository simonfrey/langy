# SyncApi

All URIs are relative to _/api_

| Method                               | HTTP request   | Description |
| ------------------------------------ | -------------- | ----------- |
| [**sync**](SyncApi.md#syncoperation) | **POST** /sync |             |

## sync

> SyncResult sync(SyncRequest)

### Example

```ts
import {
  Configuration,
  SyncApi,
} from '';
import type { SyncOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new SyncApi(config);

  const body = {
    // SyncRequest
    SyncRequest: ...,
  } satisfies SyncOperationRequest;

  try {
    const data = await api.sync(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name            | Type                          | Description | Notes |
| --------------- | ----------------------------- | ----------- | ----- |
| **SyncRequest** | [SyncRequest](SyncRequest.md) |             |       |

### Return type

[**SyncResult**](SyncResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description    | Response headers |
| ----------- | -------------- | ---------------- |
| **200**     | Sync result    | -                |
| **0**       | Error response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

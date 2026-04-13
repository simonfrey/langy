# LanguagesApi

All URIs are relative to _/api_

| Method                                                     | HTTP request            | Description                   |
| ---------------------------------------------------------- | ----------------------- | ----------------------------- |
| [**listLanguagePairs**](LanguagesApi.md#listlanguagepairs) | **GET** /language-pairs | List supported language pairs |

## listLanguagePairs

> Array&lt;LanguagePairResponse&gt; listLanguagePairs()

List supported language pairs

### Example

```ts
import { Configuration, LanguagesApi } from "";
import type { ListLanguagePairsRequest } from "";

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new LanguagesApi();

  try {
    const data = await api.listLanguagePairs();
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

This endpoint does not need any parameter.

### Return type

[**Array&lt;LanguagePairResponse&gt;**](LanguagePairResponse.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description              | Response headers |
| ----------- | ------------------------ | ---------------- |
| **200**     | Supported language pairs | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

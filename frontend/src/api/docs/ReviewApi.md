# ReviewApi

All URIs are relative to _/api_

| Method                                        | HTTP request        | Description |
| --------------------------------------------- | ------------------- | ----------- |
| [**getDueCards**](ReviewApi.md#getduecards)   | **GET** /review/due |             |
| [**submitReview**](ReviewApi.md#submitreview) | **POST** /review    |             |

## getDueCards

> Array&lt;Card&gt; getDueCards(deck_id)

### Example

```ts
import {
  Configuration,
  ReviewApi,
} from '';
import type { GetDueCardsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReviewApi(config);

  const body = {
    // string (optional)
    deck_id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetDueCardsRequest;

  try {
    const data = await api.getDueCards(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name        | Type     | Description | Notes                                |
| ----------- | -------- | ----------- | ------------------------------------ |
| **deck_id** | `string` |             | [Optional] [Defaults to `undefined`] |

### Return type

[**Array&lt;Card&gt;**](Card.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`

### HTTP response details

| Status code | Description          | Response headers |
| ----------- | -------------------- | ---------------- |
| **200**     | Due cards for review | -                |
| **0**       | Error response       | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

## submitReview

> Card submitReview(ReviewRequest)

### Example

```ts
import {
  Configuration,
  ReviewApi,
} from '';
import type { SubmitReviewRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ReviewApi(config);

  const body = {
    // ReviewRequest
    ReviewRequest: ...,
  } satisfies SubmitReviewRequest;

  try {
    const data = await api.submitReview(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters

| Name              | Type                              | Description | Notes |
| ----------------- | --------------------------------- | ----------- | ----- |
| **ReviewRequest** | [ReviewRequest](ReviewRequest.md) |             |       |

### Return type

[**Card**](Card.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`

### HTTP response details

| Status code | Description                             | Response headers |
| ----------- | --------------------------------------- | ---------------- |
| **200**     | Review submitted, updated card returned | -                |
| **0**       | Error response                          | -                |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

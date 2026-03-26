# DecksApi

All URIs are relative to */api*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createDeck**](DecksApi.md#createdeckoperation) | **POST** /decks |  |
| [**deleteDeck**](DecksApi.md#deletedeck) | **DELETE** /decks/{id} |  |
| [**listDecks**](DecksApi.md#listdecks) | **GET** /decks |  |



## createDeck

> Deck createDeck(CreateDeckRequest)



### Example

```ts
import {
  Configuration,
  DecksApi,
} from '';
import type { CreateDeckOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DecksApi(config);

  const body = {
    // CreateDeckRequest
    CreateDeckRequest: ...,
  } satisfies CreateDeckOperationRequest;

  try {
    const data = await api.createDeck(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **CreateDeckRequest** | [CreateDeckRequest](CreateDeckRequest.md) |  | |

### Return type

[**Deck**](Deck.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Deck created |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteDeck

> StatusResponse deleteDeck(id)



### Example

```ts
import {
  Configuration,
  DecksApi,
} from '';
import type { DeleteDeckRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DecksApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteDeckRequest;

  try {
    const data = await api.deleteDeck(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**StatusResponse**](StatusResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Deck deleted |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listDecks

> Array&lt;Deck&gt; listDecks()



### Example

```ts
import {
  Configuration,
  DecksApi,
} from '';
import type { ListDecksRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new DecksApi(config);

  try {
    const data = await api.listDecks();
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

[**Array&lt;Deck&gt;**](Deck.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | List of decks |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


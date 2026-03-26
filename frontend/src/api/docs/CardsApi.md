# CardsApi

All URIs are relative to */api*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**createCard**](CardsApi.md#createcardoperation) | **POST** /decks/{deckId}/cards |  |
| [**deleteCard**](CardsApi.md#deletecard) | **DELETE** /cards/{id} |  |
| [**listCards**](CardsApi.md#listcards) | **GET** /decks/{deckId}/cards |  |
| [**updateCard**](CardsApi.md#updatecardoperation) | **PUT** /cards/{id} |  |



## createCard

> Card createCard(deckId, CreateCardRequest)



### Example

```ts
import {
  Configuration,
  CardsApi,
} from '';
import type { CreateCardOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CardsApi(config);

  const body = {
    // string
    deckId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // CreateCardRequest
    CreateCardRequest: ...,
  } satisfies CreateCardOperationRequest;

  try {
    const data = await api.createCard(body);
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
| **deckId** | `string` |  | [Defaults to `undefined`] |
| **CreateCardRequest** | [CreateCardRequest](CreateCardRequest.md) |  | |

### Return type

[**Card**](Card.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Card created |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## deleteCard

> StatusResponse deleteCard(id)



### Example

```ts
import {
  Configuration,
  CardsApi,
} from '';
import type { DeleteCardRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CardsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies DeleteCardRequest;

  try {
    const data = await api.deleteCard(body);
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
| **200** | Card deleted |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## listCards

> Array&lt;Card&gt; listCards(deckId)



### Example

```ts
import {
  Configuration,
  CardsApi,
} from '';
import type { ListCardsRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CardsApi(config);

  const body = {
    // string
    deckId: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies ListCardsRequest;

  try {
    const data = await api.listCards(body);
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
| **deckId** | `string` |  | [Defaults to `undefined`] |

### Return type

[**Array&lt;Card&gt;**](Card.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | List of cards |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## updateCard

> StatusResponse updateCard(id, UpdateCardRequest)



### Example

```ts
import {
  Configuration,
  CardsApi,
} from '';
import type { UpdateCardOperationRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new CardsApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
    // UpdateCardRequest
    UpdateCardRequest: ...,
  } satisfies UpdateCardOperationRequest;

  try {
    const data = await api.updateCard(body);
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
| **UpdateCardRequest** | [UpdateCardRequest](UpdateCardRequest.md) |  | |

### Return type

[**StatusResponse**](StatusResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Card updated |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


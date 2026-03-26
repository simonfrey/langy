# ImagesApi

All URIs are relative to */api*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**getImage**](ImagesApi.md#getimage) | **GET** /images/{id} |  |
| [**uploadImage**](ImagesApi.md#uploadimage) | **POST** /images |  |



## getImage

> Blob getImage(id)



### Example

```ts
import {
  Configuration,
  ImagesApi,
} from '';
import type { GetImageRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ImagesApi(config);

  const body = {
    // string
    id: 38400000-8cf0-11bd-b23e-10b96e4ef00d,
  } satisfies GetImageRequest;

  try {
    const data = await api.getImage(body);
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

**Blob**

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `image/*`, `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Image binary |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## uploadImage

> ImageUploadResponse uploadImage(image)



### Example

```ts
import {
  Configuration,
  ImagesApi,
} from '';
import type { UploadImageRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ImagesApi(config);

  const body = {
    // Blob
    image: BINARY_DATA_HERE,
  } satisfies UploadImageRequest;

  try {
    const data = await api.uploadImage(body);
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
| **image** | `Blob` |  | [Defaults to `undefined`] |

### Return type

[**ImageUploadResponse**](ImageUploadResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `multipart/form-data`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **201** | Image uploaded |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


# ExercisesApi

All URIs are relative to */api*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**completeExercise**](ExercisesApi.md#completeexercise) | **POST** /exercises/complete |  |
| [**generateExercises**](ExercisesApi.md#generateexercises) | **POST** /exercises/generate |  |
| [**getDueExercises**](ExercisesApi.md#getdueexercises) | **GET** /exercises/due |  |
| [**gradeExercise**](ExercisesApi.md#gradeexercise) | **POST** /exercises/grade |  |



## completeExercise

> StatusResponse completeExercise(ExerciseCompleteRequest)



### Example

```ts
import {
  Configuration,
  ExercisesApi,
} from '';
import type { CompleteExerciseRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExercisesApi(config);

  const body = {
    // ExerciseCompleteRequest
    ExerciseCompleteRequest: ...,
  } satisfies CompleteExerciseRequest;

  try {
    const data = await api.completeExercise(body);
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
| **ExerciseCompleteRequest** | [ExerciseCompleteRequest](ExerciseCompleteRequest.md) |  | |

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
| **200** | Exercise completed |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## generateExercises

> Array&lt;ExerciseResponse&gt; generateExercises(ExerciseGenerateRequest)



### Example

```ts
import {
  Configuration,
  ExercisesApi,
} from '';
import type { GenerateExercisesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExercisesApi(config);

  const body = {
    // ExerciseGenerateRequest
    ExerciseGenerateRequest: ...,
  } satisfies GenerateExercisesRequest;

  try {
    const data = await api.generateExercises(body);
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
| **ExerciseGenerateRequest** | [ExerciseGenerateRequest](ExerciseGenerateRequest.md) |  | |

### Return type

[**Array&lt;ExerciseResponse&gt;**](ExerciseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Generated exercises |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## getDueExercises

> Array&lt;ExerciseResponse&gt; getDueExercises()



### Example

```ts
import {
  Configuration,
  ExercisesApi,
} from '';
import type { GetDueExercisesRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExercisesApi(config);

  try {
    const data = await api.getDueExercises();
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

[**Array&lt;ExerciseResponse&gt;**](ExerciseResponse.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Due exercises |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## gradeExercise

> GradeResult gradeExercise(ExerciseGradeRequest)



### Example

```ts
import {
  Configuration,
  ExercisesApi,
} from '';
import type { GradeExerciseRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: bearerAuth
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new ExercisesApi(config);

  const body = {
    // ExerciseGradeRequest
    ExerciseGradeRequest: ...,
  } satisfies GradeExerciseRequest;

  try {
    const data = await api.gradeExercise(body);
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
| **ExerciseGradeRequest** | [ExerciseGradeRequest](ExerciseGradeRequest.md) |  | |

### Return type

[**GradeResult**](GradeResult.md)

### Authorization

[bearerAuth](../README.md#bearerAuth)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Grade result |  -  |
| **0** | Error response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


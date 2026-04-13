# CreateCardRequest

## Properties

| Name             | Type   |
| ---------------- | ------ |
| `front`          | string |
| `back`           | string |
| `front_image_id` | string |
| `back_image_id`  | string |

## Example

```typescript
import type { CreateCardRequest } from "";

// TODO: Update the object below with actual values
const example = {
  front: null,
  back: null,
  front_image_id: null,
  back_image_id: null,
} satisfies CreateCardRequest;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as CreateCardRequest;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

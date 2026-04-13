# SyncRequest

## Properties

| Name      | Type                                     |
| --------- | ---------------------------------------- |
| `actions` | [Array&lt;SyncAction&gt;](SyncAction.md) |

## Example

```typescript
import type { SyncRequest } from "";

// TODO: Update the object below with actual values
const example = {
  actions: null,
} satisfies SyncRequest;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as SyncRequest;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


# Deck


## Properties

Name | Type
------------ | -------------
`id` | string
`user_id` | string
`name` | string
`source_lang` | string
`target_lang` | string
`created_at` | Date

## Example

```typescript
import type { Deck } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "user_id": null,
  "name": null,
  "source_lang": null,
  "target_lang": null,
  "created_at": null,
} satisfies Deck

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Deck
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)




# GenerateRequest


## Properties

Name | Type
------------ | -------------
`prompt` | string
`source_lang` | string
`target_lang` | string
`deck_id` | string
`generate_images` | boolean
`from_deck` | boolean
`mode` | string
`image_ids` | Array&lt;string&gt;

## Example

```typescript
import type { GenerateRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "prompt": null,
  "source_lang": null,
  "target_lang": null,
  "deck_id": null,
  "generate_images": null,
  "from_deck": null,
  "mode": null,
  "image_ids": null,
} satisfies GenerateRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as GenerateRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)



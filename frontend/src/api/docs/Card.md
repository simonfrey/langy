
# Card


## Properties

Name | Type
------------ | -------------
`id` | string
`deck_id` | string
`front` | string
`back` | string
`front_image_url` | string
`back_image_url` | string
`ease_factor` | number
`interval_days` | number
`repetitions` | number
`next_review` | Date
`created_at` | Date
`updated_at` | Date

## Example

```typescript
import type { Card } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "deck_id": null,
  "front": null,
  "back": null,
  "front_image_url": null,
  "back_image_url": null,
  "ease_factor": null,
  "interval_days": null,
  "repetitions": null,
  "next_review": null,
  "created_at": null,
  "updated_at": null,
} satisfies Card

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Card
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)



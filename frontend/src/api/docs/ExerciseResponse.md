
# ExerciseResponse


## Properties

Name | Type
------------ | -------------
`id` | string
`type` | string
`level` | number
`instruction` | string
`prompt` | string
`correct_answer` | string
`hint` | string
`source_sentence` | string
`options` | Array&lt;string&gt;
`data` | { [key: string]: any; }
`source_card_id` | string

## Example

```typescript
import type { ExerciseResponse } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "type": null,
  "level": null,
  "instruction": null,
  "prompt": null,
  "correct_answer": null,
  "hint": null,
  "source_sentence": null,
  "options": null,
  "data": null,
  "source_card_id": null,
} satisfies ExerciseResponse

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExerciseResponse
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)



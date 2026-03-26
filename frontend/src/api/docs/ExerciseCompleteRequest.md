
# ExerciseCompleteRequest


## Properties

Name | Type
------------ | -------------
`exercise_id` | string
`user_answer` | string
`correct` | boolean

## Example

```typescript
import type { ExerciseCompleteRequest } from ''

// TODO: Update the object below with actual values
const example = {
  "exercise_id": null,
  "user_answer": null,
  "correct": null,
} satisfies ExerciseCompleteRequest

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExerciseCompleteRequest
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)



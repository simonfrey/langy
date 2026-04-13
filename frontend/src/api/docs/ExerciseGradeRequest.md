# ExerciseGradeRequest

## Properties

| Name             | Type   |
| ---------------- | ------ |
| `exercise_id`    | string |
| `exercise_type`  | string |
| `prompt`         | string |
| `correct_answer` | string |
| `user_answer`    | string |
| `source_lang`    | string |
| `target_lang`    | string |

## Example

```typescript
import type { ExerciseGradeRequest } from "";

// TODO: Update the object below with actual values
const example = {
  exercise_id: null,
  exercise_type: null,
  prompt: null,
  correct_answer: null,
  user_answer: null,
  source_lang: null,
  target_lang: null,
} satisfies ExerciseGradeRequest;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExerciseGradeRequest;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

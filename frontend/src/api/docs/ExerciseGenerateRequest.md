# ExerciseGenerateRequest

## Properties

| Name          | Type                                         |
| ------------- | -------------------------------------------- |
| `session_id`  | string                                       |
| `cards`       | [Array&lt;ExerciseCard&gt;](ExerciseCard.md) |
| `known_words` | [Array&lt;KnownWord&gt;](KnownWord.md)       |
| `source_lang` | string                                       |
| `target_lang` | string                                       |

## Example

```typescript
import type { ExerciseGenerateRequest } from "";

// TODO: Update the object below with actual values
const example = {
  session_id: null,
  cards: null,
  known_words: null,
  source_lang: null,
  target_lang: null,
} satisfies ExerciseGenerateRequest;

console.log(example);

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example);
console.log(exampleJSON);

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as ExerciseGenerateRequest;
console.log(exampleParsed);
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

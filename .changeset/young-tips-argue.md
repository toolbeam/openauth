---
"@openauthjs/openauth": patch
---

Adds support for a custom DynamoDB endpoint which enables use of a amazon/dynamodb-local container.

Usabe example:

```ts
  storage: DynamoStorage({ 
    table: 'openauth-users',
    endpoint: 'http://localhost:8000',
  }),
```

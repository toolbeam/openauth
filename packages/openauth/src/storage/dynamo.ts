import { client } from "./aws.js"
import { joinKey, StorageAdapter } from "./storage.js"

export interface DynamoStorageOptions {
  table: string
  pk?: string
  sk?: string
}

export function DynamoStorage(options: DynamoStorageOptions) {
  const c = client()
  const pk = options.pk || "pk"
  const sk = options.sk || "sk"
  const tableName = options.table

  function parseKey(key: string[]) {
    if (key.length === 2) {
      return {
        pk: key[0],
        sk: key[1],
      }
    }
    return {
      pk: joinKey(key.slice(0, 2)),
      sk: joinKey(key.slice(2)),
    }
  }

  async function dynamo(action: string, payload: any) {
    const client = await c
    const response = await client.fetch(
      `https://dynamodb.${client.region}.amazonaws.com`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-amz-json-1.0",
          "X-Amz-Target": `DynamoDB_20120810.${action}`,
        },
        body: JSON.stringify(payload),
      },
    )

    if (!response.ok) {
      throw new Error(`DynamoDB request failed: ${response.statusText}`)
    }

    return response.json() as Promise<any>
  }

  return {
    async get(key: string[]) {
      const { pk: keyPk, sk: keySk } = parseKey(key)
      const params = {
        TableName: tableName,
        Key: {
          [pk]: { S: keyPk },
          [sk]: { S: keySk },
        },
      }
      const result = await dynamo("GetItem", params)
      if (!result.Item) return
      if (result.Item.expiry && result.Item.expiry.N < Date.now() / 1000) {
        return
      }
      return JSON.parse(result.Item.value.S)
    },

    async set(key: string[], value: any, expiry?: Date) {
      const parsed = parseKey(key)
      const params = {
        TableName: tableName,
        Item: {
          [pk]: { S: parsed.pk },
          [sk]: { S: parsed.sk },
          ...(expiry
            ? {
                expiry: { N: Math.floor(expiry.getTime() / 1000).toString() },
              }
            : {}),
          value: { S: JSON.stringify(value) },
        },
      }
      await dynamo("PutItem", params)
    },

    async remove(key: string[]) {
      const { pk: keyPk, sk: keySk } = parseKey(key)
      const params = {
        TableName: tableName,
        Key: {
          [pk]: { S: keyPk },
          [sk]: { S: keySk },
        },
      }

      await dynamo("DeleteItem", params)
    },

    async *scan(prefix: string[]) {
      const prefixPk =
        prefix.length >= 2 ? joinKey(prefix.slice(0, 2)) : prefix[0]
      const prefixSk = prefix.length > 2 ? joinKey(prefix.slice(2)) : ""
      let lastEvaluatedKey = undefined
      const now = Date.now() / 1000
      while (true) {
        const params = {
          TableName: tableName,
          ExclusiveStartKey: lastEvaluatedKey,
          KeyConditionExpression: prefixSk
            ? `#pk = :pk AND begins_with(#sk, :sk)`
            : `#pk = :pk`,
          ExpressionAttributeNames: {
            "#pk": pk,
            ...(prefixSk && { "#sk": sk }),
          },
          ExpressionAttributeValues: {
            ":pk": { S: prefixPk },
            ...(prefixSk && { ":sk": { S: prefixSk } }),
          },
        }

        const result = await dynamo("Query", params)

        for (const item of result.Items || []) {
          if (item.expiry && item.expiry.N < now) {
            continue
          }
          yield [[item[pk].S, item[sk].S], JSON.parse(item.value.S)]
        }

        if (!result.LastEvaluatedKey) break
        lastEvaluatedKey = result.LastEvaluatedKey
      }
    },
  } satisfies StorageAdapter
}

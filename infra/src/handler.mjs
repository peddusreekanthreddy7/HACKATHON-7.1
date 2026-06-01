import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

/**
 * Idempotent attendance ingest.
 * Conditional PutItem on `attribute_not_exists(id)` makes replays safe:
 *  - first write  -> 200 { ok:true, duplicate:false }
 *  - replayed id  -> 200 { ok:true, duplicate:true }  (no double-count)
 * The device only purges its local row after this 200 ACK.
 */
export const handler = async event => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return resp(400, { ok: false, error: 'invalid json' });
  }

  const headers = event.headers || {};
  const id = headers['Idempotency-Key'] || headers['idempotency-key'] || payload.id;
  if (!id || !payload.personId || !payload.deviceId) {
    return resp(400, { ok: false, error: 'missing id/personId/deviceId' });
  }

  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: { ...payload, id, receivedAt: Date.now() },
        ConditionExpression: 'attribute_not_exists(id)',
      }),
    );
    return resp(200, { ok: true, id, duplicate: false });
  } catch (e) {
    if (e.name === 'ConditionalCheckFailedException') {
      return resp(200, { ok: true, id, duplicate: true });
    }
    console.error('ddb error', e);
    return resp(500, { ok: false, error: 'storage error' });
  }
};

function resp(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

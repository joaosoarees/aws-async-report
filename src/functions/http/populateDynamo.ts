import { PutItemCommand } from '@aws-sdk/client-dynamodb';
import { faker } from '@faker-js/faker';
import { randomUUID } from 'node:crypto';

import { dynamoClient } from '../../clients/dynamoClient';
import { env } from '../../config/env';
import { response } from '../../utils/reponse';

export async function handler() {
  const total = 2500;

  const responses = await Promise.allSettled(
    Array.from({ length: total }, async () => {
      const command = new PutItemCommand({
        TableName: env.DYNAMO_LEADS_TABLE,
        Item: {
          id: { S: randomUUID() },
          name: { S: faker.person.fullName() },
          email: { S: faker.internet.email().toLocaleLowerCase() },
          jobTitle: { S: faker.person.jobTitle() },
        }
      });

      await dynamoClient.send(command);
    })
  );

  const totalCreatedLeads = responses
    .filter(result => result.status === 'fulfilled').length;

  return response(200, { totalCreatedLeads });
}

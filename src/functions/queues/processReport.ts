import { randomUUID } from 'node:crypto';

import { env } from '../../config/env';
import { getLeadsGenerator } from '../../db/getLeadsGenerator';
import { S3MPUManager } from '../../services/S3MPUManager';
import { mbToBytes } from '../../utils/mbToBytes';

const minChunckSize = mbToBytes(6);

export async function handler() {
  const fileKey = `${new Date().toISOString()}-${randomUUID()}.csv`;

  const s3Mpu = new S3MPUManager(env.REPORTS_BUCKET_NAME, fileKey);

  await s3Mpu.start();

  try {
    const header = 'Id,Nome,E-mail,Cargo\n';

    let currentChunck = header;

    for await (const { Items: leads = [] } of getLeadsGenerator()) {
      currentChunck += leads.map(lead => (
        `${lead.id.S},${lead.name.S},${lead.email.S},${lead.jobTitle.S}\n`
      )).join('');

      const currentChunckSize = Buffer.byteLength(currentChunck, 'utf-8');

      if (currentChunckSize < minChunckSize) {
        continue;
      }

      await s3Mpu.uploadPart(Buffer.from(currentChunck, 'utf-8'));

      currentChunck = '';
    }

    if (currentChunck) {
      await s3Mpu.uploadPart(Buffer.from(currentChunck, 'utf-8'));
    }

    await s3Mpu.complete();
  } catch {
    await s3Mpu.abort();
  }
}

import { randomUUID } from 'node:crypto';

import { env } from '../../config/env';
import { getLeadsGenerator } from '../../db/getLeadsGenerator';
import { S3MPUManager } from '../../services/S3MPUManager';
import { getPresignedUrl } from '../../utils/getPresignedUrl';
import { mbToBytes } from '../../utils/mbToBytes';
import { sendEmail } from '../../utils/sendEmail';

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

  const presignedUrl = await getPresignedUrl({
    bucket: env.REPORTS_BUCKET_NAME,
    fileKey
  });

  await sendEmail({
    from: 'João <onboarding@resend.dev>',
    to: ['delivered@resend.dev'],
    subject: 'O seu relatório já está pronto!',
    text: `Aqui está o seu relatório (a URL é válida por apenas 24 horas): ${presignedUrl}`,
    html: `
      <h1 style="font-size: 32px; font-weight: bold;">Seu relatório ficou pronto!</h1>
      <br />
      Clique <a href="${presignedUrl}">aqui para baixar.</a>
      <br /><br />
      <small>Este link é válido por apenas 24 horas.</small>
    `
  });
}

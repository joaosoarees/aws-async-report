import { response } from '../utils/reponse';

export async function handler() {
  return response(200, {
    message: 'World!',
  });
}

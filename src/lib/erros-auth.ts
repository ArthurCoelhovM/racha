import { mensagemDeErro } from './api';

export function traduzirErroAuth(erro: unknown): string {
  const texto = mensagemDeErro(erro);
  if (/Invalid login credentials/i.test(texto)) return 'E-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(texto)) return 'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if (/already registered|already been registered/i.test(texto)) return 'Já existe uma conta com esse e-mail.';
  if (/Password should be at least/i.test(texto)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit|For security purposes/i.test(texto))
    return 'Muitas tentativas seguidas. Espere um pouco e tente de novo.';
  if (/invalid format|Unable to validate email|valid email/i.test(texto)) return 'Esse e-mail não parece válido.';
  if (/same as the old|different from the old/i.test(texto)) return 'A nova senha precisa ser diferente da atual.';
  return texto;
}

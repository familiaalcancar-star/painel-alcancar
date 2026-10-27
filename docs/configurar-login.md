# Configurar o login (Google + e-mail e senha)

Endereços usados:
- Site: `https://familia-alcancar.netlify.app`
- Supabase (projeto `znuxdxwnunagvkjekmgc`): `https://znuxdxwnunagvkjekmgc.supabase.co`
- Endereço de retorno do Google (callback): `https://znuxdxwnunagvkjekmgc.supabase.co/auth/v1/callback`

## 1. Supabase → URL do site e redirecionamentos
Authentication → URL Configuration
- **Site URL:** `https://familia-alcancar.netlify.app`
- **Redirect URLs:** `https://familia-alcancar.netlify.app/**`
  (quando o subdomínio existir, acrescentar `https://escala.comunidadealcancar.com.br/**`)

## 2. Google Cloud (conta familiaalcancar@gmail.com)
1. Criar o projeto `Painel Familia Alcancar`.
2. Google Auth Platform → **Branding** (tela de consentimento): nome do app `Painel Família Alcançar`,
   e-mail de suporte `familiaalcancar@gmail.com`, domínio autorizado `supabase.co`, e-mail de contato do desenvolvedor.
3. **Audience:** tipo *External*; depois **Publish app** (em produção), para qualquer pessoa conseguir entrar.
   Só usamos nome, e-mail e foto (escopos básicos), então não precisa de verificação do Google.
4. **Clients → Create client:** tipo *Web application*, nome `Painel (Supabase)`.
   - Authorized JavaScript origins: `https://familia-alcancar.netlify.app`
   - Authorized redirect URIs: `https://znuxdxwnunagvkjekmgc.supabase.co/auth/v1/callback`
   - Guardar o **Client ID** e o **Client secret** (o secret nunca vai para o chat nem para o GitHub).

## 3. Supabase → provedor Google
Authentication → Sign In / Providers → **Google** → ligar, colar Client ID e Client secret → Save.

## 4. Supabase → e-mail e senha
Authentication → Sign In / Providers → **Email**: ligado, **Confirm email** ligado,
senha mínima 8 caracteres. (Authentication → Policies/Password, conforme o painel.)

## 5. E-mails em português
Authentication → Emails → Templates: **Confirm signup** e **Reset password** (textos em `docs/emails/`).

## 6. Envio de e-mails (SMTP próprio)
O envio padrão do Supabase só entrega para os e-mails da equipe do projeto e tem limite baixo por hora.
Para "Criar conta" e "Esqueci minha senha" funcionarem para todos, configurar SMTP próprio
(Authentication → Emails → SMTP Settings), por exemplo o Gmail da igreja com **senha de app**.
O login com Google não depende de e-mail.

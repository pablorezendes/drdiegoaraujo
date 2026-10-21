# Dr. Diego de Araújo — NOÉRION

Landing page editorial para **https://drdiegoaraujo.com**, com o conteúdo do NOÉRION Signature System, imagens do projeto e layout responsivo para desktop e celular.

HTML, CSS e JavaScript puro, sem dependências de instalação ou etapa de build. Inclui navegação móvel, cinco dimensões interativas, detalhes das práticas, experiência privada, kit de boas-vindas, FAQ e pré-solicitação de entrevista em duas etapas.

## Publicar no servidor

Diretório previsto: `/srv/stack/drdiegoaraujo`.

Consulte [DEPLOY.md](DEPLOY.md) para clonar o repositório, iniciar o container e conectar o domínio ao proxy e ao HTTPS. A aplicação usa uma porta local própria para coexistir com os outros projetos do servidor.

## Rodar localmente

Com Node.js 18 ou superior:

```sh
npm run dev
```

Abra `http://localhost:4173`. O servidor local está em `server.mjs`; a variável `PORT` permite escolher outra porta.

## Estrutura

- `dist/index.html`: conteúdo, entrevista e informações de privacidade.
- `dist/styles.css`: identidade visual e layouts responsivos.
- `dist/app.js`: menu, abas, diálogos e formulário.
- `dist/contact-config.js`: contato oficial e registro profissional.
- `dist/assets/`: imagens e emblema.
- `Dockerfile`, `compose.yaml`, `infra/`: serviço estático de produção.
- `deploy.sh`: atualização e verificação do serviço.

## Canal de contato e CREFITO

Preencha apenas os dados oficiais confirmados em `dist/contact-config.js`:

```js
window.NOERION_CONTACT = {
  whatsapp: '', // País + DDD + número, somente dígitos.
  email: '',
  crefito: ''
};
```

O material original não contém telefone, e-mail ou número de CREFITO. O registro preenchido aparece no rodapé.

O formulário valida as respostas e prepara um resumo no navegador. Não transmite dados automaticamente nem grava respostas em banco de dados ou armazenamento local. A pessoa pode baixar o resumo em TXT. Se houver canal configurado, também pode abrir o WhatsApp ou aplicativo de e-mail com a mensagem preparada e confirmar o envio nesse aplicativo. A opção de receber novidades é separada e opcional.

## Conteúdo e imagens

Conteúdo adaptado dos materiais NOÉRION V6. Retratos e cenas são ilustrações editoriais criadas a partir de fotografias, identificadas na página. O kit é um mockup; telas cenográficas não são laudos ou resultados clínicos. As ressalvas sobre práticas opcionais e cuidados de saúde foram preservadas.

Confirmar credenciais, registro profissional, canais oficiais e condições comerciais antes da divulgação comercial. A alegação de mais de 200 palestras foi omitida por estar marcada para validação nos materiais originais.

O pacote de referência, PDFs, prévias de revisão e metadados da hospedagem de demonstração não fazem parte deste repositório de produção.

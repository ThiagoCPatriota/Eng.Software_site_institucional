# Fase 8 — Contato, coordenação e FAQ

## Objetivo da fase

Implementar a área de contato do site institucional do curso de Engenharia de Software do IFPE Campus Belo Jardim, incluindo coordenação, canais de atendimento, formulário visual com validação simples, localização preparada e FAQ interativo.

A fase foi feita sem inventar dados oficiais. Por isso, nome da coordenação, e-mail, telefone, WhatsApp, endereço completo e horários aparecem como **a confirmar** até que as informações reais sejam fornecidas.

## O que foi feito

- Criação da página `contato.html`.
- Criação da página `faq.html`.
- Criação do CSS modular `assets/css/pages/contato.css`.
- Criação do CSS modular `assets/css/pages/faq.css`.
- Atualização de `assets/js/script.js` para:
  - manter o menu mobile funcionando;
  - destacar o item ativo do menu;
  - validar o formulário da home e o formulário da página de contato;
  - controlar o accordion do FAQ;
  - filtrar perguntas do FAQ por busca.
- Atualização do cabeçalho nas páginas existentes para incluir o grupo **Contato** com:
  - Coordenação e contato;
  - FAQ.
- Atualização do rodapé nas páginas existentes para incluir links de Contato e FAQ.
- Substituição dos links antigos `index.html#contato` por `contato.html` nos CTAs e rodapés.

## Arquivos adicionados

- `contato.html`
- `faq.html`
- `assets/css/pages/contato.css`
- `assets/css/pages/faq.css`
- `README_FASE_8.md`

## Arquivos alterados

- `index.html`
- `sobre.html`
- `ingresso.html`
- `grade.html`
- `mercado.html`
- `projetos.html`
- `estrutura.html`
- `docentes.html`
- `assets/js/script.js`

## Sequência prática de teste

1. Abrir `index.html`.
2. Conferir se o menu superior continua limpo.
3. Abrir o grupo **Contato** no menu.
4. Clicar em **Coordenação e contato**.
5. Confirmar que `contato.html` abre corretamente.
6. Conferir os cards de canais principais.
7. Conferir a seção da coordenação com dados marcados como “a confirmar”.
8. Testar o formulário vazio e verificar mensagem de erro.
9. Testar o formulário com e-mail inválido e verificar mensagem de erro.
10. Preencher nome, e-mail, assunto e mensagem e verificar o feedback de envio simulado.
11. Conferir o placeholder de mapa/localização.
12. Abrir `faq.html` pelo menu.
13. Clicar nas perguntas e verificar se abrem e fecham.
14. Testar a busca do FAQ com termos como `ingresso`, `estágio`, `documentos`, `contato` e `xyz`.
15. Verificar o menu mobile no celular.
16. Conferir se o botão de voltar ao topo continua funcionando.
17. Navegar pelos rodapés e verificar se `Contato` e `FAQ` aparecem.

## Observações importantes

- O formulário ainda não envia dados reais, pois o projeto continua estático, feito em HTML, CSS e JavaScript puro.
- O mapa ainda é um placeholder visual, pronto para receber iframe, imagem ou link oficial depois.
- A coordenação ainda está como modelo institucional, sem nome ou foto inventados.
- As respostas do FAQ devem ser revisadas no polimento final com base nos dados oficiais do curso.

## Próximo módulo sugerido

A próxima etapa sugerida é a **Fase 9 — Área do aluno e calendário**, com:

- `area-aluno.html`;
- `calendario.html`;
- cards de links úteis;
- aviso de que a área do aluno é demonstrativa;
- calendário acadêmico visual com datas a confirmar;
- estrutura pronta para futura alimentação por administração/backend.

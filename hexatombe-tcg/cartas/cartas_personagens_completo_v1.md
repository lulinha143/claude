# Hexatombe TCG — Catálogo completo de personagens (v1)

Protótipo de fã inspirado em *Ordem Paranormal: Hexatombe* (campanha de RPG mestrada por Cellbit, exibida de 25/10/2025 a 27/12/2025). Este catálogo não tem arte e não é material oficial. Antes de planejar qualquer comercialização com conteúdo canônico, confira a licença aplicável junto aos detentores de Ordem Paranormal.

Data desta versão: 16/10/2026. Revisão 1.1: inclusão de Caíto Rocha, confirmado como parte da seleção.

---

## 0. Estado do projeto antes desta versão

Antes de escrever, verifiquei o que existia de verdade:

- A pasta `hexatombe-tcg/` **não existia** no workspace. Não havia `cartas_personagens_v1.md`, `cartas_personagens_completo_v1.md`, documento de regras, referências de lore nem registro de trabalho.
- O único repositório da conta GitHub conectada (`contatoleonardoorrutia-oss/claude`, todas as 10 branches) não contém arquivos de Hexatombe. A conta não tem gists.
- Portanto, **nenhuma carta anterior pôde ser recuperada do disco**. As únicas decisões anteriores disponíveis eram as descritas na mensagem que pediu este catálogo.

O que foi preservado dessa mensagem:

- As duas habilidades de referência da **Kemi** (*Furtividade* e *Tiro de Precisão*) foram mantidas com o comportamento descrito. Só foram fixados os valores que a descrição deixava em aberto (o bônus de dano virou +1 ferimento, e a contagem de rodadas usa um marcador).
- Os nomes de protótipo *Sem Recuar* (Colosso) e *Morte Natural* (Maria) foram mantidos como nomes de habilidade do TCG, marcados como **não oficiais**.
- A restrição dos Pássaros: só **Pomba** e **Harpia** entram. Suellen e os demais Pássaros ficam de fora.
- Todos os personagens citados no pedido entraram (menos Suellen), além de **Caíto Rocha**, confirmado depois como parte da seleção.

Toda a lore foi verificada de novo, sem confiar nos resumos anteriores. As correções encontradas estão na seção de cada carta e resumidas na seção 11.

---

## 1. Como ler as cartas

Cada carta traz:

- **Nome**, atributos (❤️ Vida | ⚔️ Ataque | 🛡️ Defesa) e habilidades com texto final.
- **Função**: a identidade de jogo, em poucas palavras.
- **Base na lore**, dividida em três partes:
  - **Fato** — o que as fontes afirmam. Quando o fato vem de material oficial fora das sessões (Arquivos Secretos, webcomics, episódio de bastidores), isso está indicado.
  - **Interpretação** — leitura ou inferência minha a partir dos fatos.
  - **Adaptação** — o que foi criado para o TCG.
- **Equipe/identidade**: equipe, tipo de identidade e corpo (quando aplicável).
- **Fontes**: páginas e episódios usados na verificação.

Referências como `Ep7 @4h46m` indicam o episódio de *Hexatombe* e o tempo aproximado citado pela Ordem Paranormal Wiki. Os episódios não foram assistidos nesta revisão; a verificação foi feita pelas páginas da wiki, que citam esses trechos.

---

## 2. Premissas de regras usadas nos textos das cartas

As regras do jogo ainda estão em desenvolvimento. Os textos das cartas usam só o vocabulário abaixo. Se uma regra-base mudar, ajuste esta seção antes de reescrever cartas.

### 2.1 Base (já definida no projeto)

- ❤️ Vida de 1 a 6; ⚔️ Ataque de 1 a 5; 🛡️ Defesa de 1 a 5.
- Um ataque acerta quando o Ataque do atacante é **igual ou maior** que a Defesa do alvo.
- Um ataque que acerta causa **1 ferimento**. O personagem é derrotado quando seus ferimentos igualam sua Vida.
- Movimento normal: **1 área adjacente por rodada**.
- Não há dados, moedas, porcentagens, mana ou energia. Tudo é determinístico.

### 2.2 Premissas provisórias assumidas por este catálogo

- **Ativação.** Cada personagem é ativado uma vez por rodada. Na ativação, ele pode se mover 1 área (antes ou depois da ação) e realizar **1 ação**. Movimentos concedidos por habilidades são **adicionais** a esse movimento, salvo texto contrário.
- **Ação padrão: atacar** um inimigo na mesma área. Ataques normais só podem ter **inimigos** como alvo, a menos que a carta diga o contrário.
- **Aliado** é **outro** personagem do mesmo lado; um personagem nunca é aliado de si mesmo. **Inimigo** é qualquer personagem do outro lado.
- **Quem derrota.** É o personagem que causou o último ferimento. Ferimentos de marcadores (armadilhas, lampião) são causados por quem colocou o marcador. Se o ferimento não tiver causador (fim de rodada, tirar a Máscara) ou se o personagem o causou a si mesmo, ninguém o derrotou. Quando vários ferimentos acontecem ao mesmo tempo, aplique todos e só depois verifique as derrotas.
- **Conflitos.** Uma proibição ("não pode atacar...") vence uma obrigação ("deve atacar..."). Uma obrigação impossível de cumprir é ignorada. Personagens Ocultos nunca contam para obrigações de alvo. Empates e conflitos restantes são decididos pelo dono do personagem afetado.
- **Distância.** "Adjacente" = área conectada diretamente. "A até 1 área de distância" = a mesma área ou uma adjacente. "A até 2 áreas" = até duas conexões. "Em outra área, a qualquer distância" = qualquer área do tabuleiro, exceto a do próprio personagem.
- **Tipos de habilidade.**
  - **Ação**: substitui o ataque daquela ativação.
  - **Passiva**: está sempre valendo.
  - **Reação**: resolve-se no momento em que a condição acontece, mesmo fora da ativação do personagem. Cada Reação só pode ser usada **uma vez por rodada**, salvo texto diferente.
  - **Uma vez por partida**: vire a carta de lado ou use um marcador para lembrar.
- **+1 ferimento**: o acerto causa 1 ferimento adicional (total de 2).
- **Remover ferimentos (cura)**: nunca deixa um personagem com menos de 0 ferimentos.
- **Deslocar**: mover outro personagem para uma área adjacente. Não conta como o movimento dele.
- **Oculto**: o personagem continua no tabuleiro, mas não pode ser alvo de ataques nem de habilidades inimigas. Ele é revelado quando ataca ou quando uma regra o revela. Marque com o marcador de Oculto.
- **Proteção**: só contam como proteção as habilidades marcadas com a palavra *proteção*. Elas impedem, anulam, enfraquecem ou redirecionam ataques ou ferimentos. Algumas cartas (como a Fantasma) ignoram esse tipo de habilidade.
- **Condições** (marcador na carta; duram até o **fim da próxima ativação** do personagem afetado; uma condição recebida durante a própria ativação dura até o fim da ativação **seguinte**):
  - **Atordoado**: não realiza ação (ainda pode se mover).
  - **Preso**: não pode se mover nem ser deslocado.
  - **Silenciado**: não pode usar habilidades de Ação nem de Reação. Passivas continuam valendo.

### 2.3 Corpo, versões e máscaras (Mascarados)

Na história, cinco agentes da Ordo Realitas ocuparam os corpos de cinco assassinos. Primeiro viveram sem memória como os assassinos (receptáculos), depois escolheram o próprio nome ao tocar a Coroa de Espinhos (agentes) e, em momentos extremos, vestiram as máscaras dos assassinos (formas mascaradas). Para que isso funcione numa mesa física sem virar três personagens independentes:

1. **Mesmo Corpo.** Cartas com o mesmo campo *Corpo* nunca podem estar em jogo ao mesmo tempo do mesmo lado.
2. **Versões.** *Receptáculo* e *Agente* são versões alternativas do mesmo corpo (antes e depois da escolha do nome). Escolha **uma** delas ao montar a equipe. Henri e Juan seguem a mesma regra.
3. **Máscara.** A carta de Máscara fica fora do tabuleiro, ao lado da equipe.
   - **Vestir:** no início da ativação do personagem com o mesmo Corpo, se houver um inimigo na área dele **ou** se ele tiver pelo menos 1 ferimento, coloque a Máscara por cima da carta. Isso não gasta a ação.
   - Enquanto a Máscara estiver por cima, valem **só os atributos e habilidades da Máscara**; as habilidades da carta coberta ficam suspensas. Os ferimentos continuam os mesmos.
   - Ao vestir ou tirar a Máscara, o personagem é **revelado** (perde Oculto). Condições e outros marcadores continuam nele, mas um marcador só tem efeito se a carta que está por cima tiver a habilidade que o usa. Marcadores que ele colocou em áreas ou em outros personagens permanecem.
   - **Tirar:** no fim de qualquer ativação do personagem, você pode retirar a Máscara. Algumas máscaras saem sozinhas, conforme o texto delas.
   - Não é possível vestir uma Máscara se os ferimentos já forem iguais ou maiores que a Vida dela. Se, ao tirar a Máscara, os ferimentos igualarem ou superarem a Vida da carta de baixo, o personagem é derrotado.
   - Um personagem só pode vestir a Máscara **uma vez por rodada**.

### 2.4 Sacrifícios e estigmas

No ritual, cada equipe protege um sacrifício marcado por um Estigma, e quem mata um sacrifício pode herdar esse estigma. No TCG:

- Cartas com a identidade **Sacrifício** têm uma habilidade de Estigma.
- Quando um Sacrifício é derrotado, o personagem que o derrotou (ver "Quem derrota", em 2.2) recebe o **marcador de Estigma** correspondente. Deixe a carta derrotada ao lado dele como referência do efeito. Se ninguém o derrotou, ninguém recebe o Estigma.
- Um personagem só pode ter um marcador de Estigma. Se receber outro, escolha qual manter.

### 2.5 Marcadores usados no catálogo

- **Estados:** Oculto · Mira · Atordoado · Preso · Silenciado · Olhar (−1 Ataque).
- **Marcas em personagens:** Rastro · Presa · Ritmo · Paixão · Vínculo · Sangue · Filho da Dor · Armadilha Sanguinária · Estigma.
- **Marcas em áreas:** Marca X · Armadilha · Barricada · Olho · Lampião.
- **Outros:** Contrato (anotação secreta) · Clone (fichas iguais com o verso marcado em segredo) · Proteção (lembrete opcional).

---

## 3. Roster

Legenda do estado: **Nova** = criada nesta versão; **Preservada** = mantém decisões descritas no pedido; **Corrigida** = a descrição anterior divergia das fontes e foi ajustada.

| # | Carta | Equipe | Identidade | Corpo | Estado | Fonte principal |
|---|---|---|---|---|---|---|
| 1 | Kemi | Mascarados | Receptáculo (Lena sem memória) | Kemi | Preservada + Nova | Wiki: Kemi; Ep1, Ep4 |
| 2 | Lena Viegas | Mascarados | Agente | Kemi | Nova | Wiki: Lena Viegas; Ep9 |
| 3 | Fantasma | Mascarados | Forma mascarada (faixas) | Kemi | Nova | Wiki: Kemi, Lena Viegas; Ep7, Ep9 |
| 4 | Jonas Aguiar | Mascarados | Receptáculo (Jasper sem memória) | Jonas Aguiar | Nova | Wiki: Jonas Aguiar; Ep3, Ep4 |
| 5 | Jasper | Mascarados | Agente | Jonas Aguiar | Nova | Wiki: Jasper; Ep9 |
| 6 | Mutilador Noturno | Mascarados | Forma mascarada | Jonas Aguiar | Corrigida | Wiki: Jasper, Jonas Aguiar; Ep4, Ep7, Ep9 |
| 7 | Labirinto | Mascarados | Receptáculo (Remi sem memória) | Labirinto | Nova | Wiki: Labirinto, Remi; Ep1–Ep8 |
| 8 | Remi | Mascarados | Agente (líder) | Labirinto | Corrigida | Wiki: Remi; Ep9, Ep10 |
| 9 | ??? | Mascarados | Forma mascarada (capacete) | Labirinto | Nova | Wiki: Labirinto, Remi; Ep7, Ep9 |
| 10 | Dalmo Magno | Mascarados | Receptáculo (Tuco sem memória) | Dalmo Magno | Nova | Wiki: Dalmo Magno, Tuco Belez; Ep1, Ep2 |
| 11 | Tuco Belez | Mascarados | Agente | Dalmo Magno | Nova | Wiki: Tuco Belez; Ep7; Ep11 |
| 12 | Colosso | Mascarados | Forma mascarada (escafandro) | Dalmo Magno | Corrigida | Wiki: Dalmo Magno, Mosto; Ep5 |
| 13 | Park Jae-Yoon | Mascarados | Receptáculo (Maria sem memória) | Park Jae-Yoon | Corrigida | Wiki: Park Jae-Yoon, Maria; Ep1, Ep7 |
| 14 | Maria Helena Rodrigues | Mascarados | Agente | Park Jae-Yoon | Corrigida | Wiki: Maria Helena Rodrigues; Ep9 |
| 15 | X | Mascarados | Forma mascarada (capuz) | Park Jae-Yoon | Corrigida | Wiki: Maria, Park Jae-Yoon; Ep5, Ep7 |
| 16 | Henri | Mascarados | Sacrifício (Estigma do Desejo) | Lúcio Davo | Nova | Wiki: Juan; Ep3–Ep8 |
| 17 | Juan | Mascarados | Sacrifício (Estigma do Desejo) | Lúcio Davo | Nova | Wiki: Juan; Ep9, Ep10 |
| 18 | Escarlata | Couraças | Líder | — | Nova | Wiki: Escarlata; Ep5–Ep7 |
| 19 | Torvo | Couraças | Membro | — | Nova | Wiki: Torvo; Ep5, Ep7 |
| 20 | Ana Delgado dos Santos | Couraças | Membro (batedora) | — | Corrigida | Wiki: Ana Delgado dos Santos; Ep5–Ep7 |
| 21 | Argano | Couraças | Membro (guardião) | — | Nova | Wiki: Argano; Ep7, Ep10 |
| 22 | Chispa | Couraças | Membro (batedor) | — | Corrigida | Wiki: Chispa; Ep3, Ep7 |
| 23 | Miasma | Couraças | Sacrifício (Estigma da Obsessão) | — | Corrigida | Wiki: Miasma; Ep7 |
| 24 | Pomba | Pássaros | Membro (cartógrafo), desertor | — | Corrigida | Wiki: Pomba; Ep3–Ep10 |
| 25 | Harpia | Pássaros | Líder, desertor, último sacrifício | — | Nova | Wiki: Harpia; Ep4, Ep10 |
| 26 | Eloy Furtado | PSIKOLERA | Membro (bateria) | — | Corrigida | Wiki: Eloy Furtado; Ep7–Ep10 |
| 27 | Cindy Lopes | PSIKOLERA | Líder (baixo) | — | Nova | Wiki: Cindy Lopes; Ep4, Ep7–Ep9 |
| 28 | Caio Teles | PSIKOLERA | Membro (vocal) | — | Nova | Wiki: Caio Teles; Ep7–Ep9 |
| 29 | Franco | PSIKOLERA | Membro (guitarra) | — | Nova | Wiki: Franco; Ep7 |
| 30 | Alê | PSIKOLERA | Membro (teclado) | — | Corrigida | Wiki: Alê; Ep4, Ep7 |
| 31 | Caíto Rocha | PSIKOLERA | Sacrifício (Estigma do Rancor) | — | Nova | Wiki: Caíto Rocha; Ep4, Ep7, Ep8 |
| 32 | Giovanni Opspor | Transtornados | Líder | — | Corrigida | Wiki: Giovanni Opspor; Ep2–Ep10 |
| 33 | Cristino | Transtornados | Membro (integrado à força) | — | Nova | Wiki: Cristino; Ep4–Ep10 |
| 34 | Mosto | Transtornados | Membro (segurança) | — | Nova | Wiki: Mosto; Ep2, Ep5 |
| 35 | Tarrafa | Transtornados | Membro | — | Nova | Wiki: Tarrafa, Zumbi Espinhento; Ep2, Ep3 |
| 36 | Cleo Brisa | Transtornados | Membro (forçada) | — | Corrigida | Wiki: Cleo Brisa; Ep6, Ep9 |
| 37 | Nando Salles | Transtornados | Sacrifício (Estigma do Orgulho) | — | Corrigida | Wiki: Nando Salles; Ep4, Ep5 |
| 38 | Raziel | Vampiros | Líder, herdeiro do sacrifício | — | Nova | Wiki: Raziel; Ep7–Ep9 |
| 39 | Alvira | Vampiros | Membro (a Primeira Vampira) | — | Nova | Wiki: Alvira; Ep7–Ep9 |
| 40 | Sabara | Vampiros | Membro (batedora) | — | Nova | Wiki: Sabara; Ep4 |
| 41 | Velisar | Vampiros | Membro (diplomata) | — | Corrigida | Wiki: Velisar; Ep6, Ep7, Ep9 |
| 42 | Zéfero | Vampiros | Criatura da equipe | — | Nova | Wiki: Zéfero; Ep6, Ep7, Ep9 |
| 43 | Damir Lukic | Vampiros | Sacrifício (Estigma da Culpa) | — | Corrigida | Wiki: Damir Lukic; Ep8 |

**Total: 43 cartas.** O motivo de cada exclusão está na seção 10.

Como só uma carta por Corpo pode estar em jogo, os Mascarados colocam no máximo **6 personagens** na mesa (5 corpos + Henri ou Juan), o mesmo tamanho das outras equipes completas.

---

## 4. Equipe Mascarados

Agentes da Ordo Realitas nos corpos dos Assassinos, mais Henri/Juan, o sacrifício da equipe. A equipe venceu o ritual: Lena, Remi e Juan sobreviveram até o fim. Sobre como usar várias cartas do mesmo corpo, veja a seção 2.3.

---

### 4.1 Corpo: Kemi

#### 1. KEMI

❤️ 3 | ⚔️ 3 | 🛡️ 2

**Habilidade — Furtividade** *(Ação)*

> Kemi fica Oculta: coloque o marcador de Oculto com o lado "1" para cima. Enquanto Oculta, ela pode se mover, mas não pode ser alvo. Atacar a revela. No fim de cada rodada em que ela continuar Oculta, vire o marcador para o lado "2"; se ele já estiver no "2", Kemi se revela e recebe o marcador de Mira. O próximo ataque dela com Mira causa +1 ferimento (descarte a Mira).

**Habilidade — Tiro de Precisão** *(Passiva)*

> Uma vez por rodada, o ataque de Kemi pode ter como alvo um inimigo em outra área, a qualquer distância.

**Habilidade — Contrato** *(Passiva)*

> Antes da partida, anote em segredo um personagem inimigo: ele é o alvo do Contrato. Kemi recebe +1 Ataque contra esse alvo. Revele a anotação na primeira vez que usar o bônus.

**Função:** atiradora de preparação. Some, escolhe o momento e acerta um alvo em qualquer lugar do mapa. É frágil se for encontrada, principalmente na rodada em que sai do esconderijo.

**Base na lore:**
- **Fato:** Kemi era uma mercenária que matava por dinheiro com um rifle de precisão ligado ao elemento Morte. A biografia da wiki, que provavelmente vem da webcomic *Kemi* (Arquivos Secretos, Pacote 02), conta:
  - ela cresceu num orfanato que explorava as órfãs;
  - foi comprada e treinada por "a Mulher" para lutar, atirar e passar despercebida, "praticamente se tornar um Fantasma";
  - via o dinheiro como sua vida e a vida como um jogo;
  - cumpriu o contrato contra Erivaldo, ex-jogador do Palmeiras ligado a apostas e lavagem de dinheiro, que era o pai dela;
  - matou o vocalista Andrei Colfas a pedido de Giovanni, que agia em nome de Cindy;
  - hesitou no contrato contra o Colosso ao ver Dalmo com a filha no colo, lutou com ele num beco e foi convidada por ele para os Assassinos.
- **Fato (episódio):** no Ep1, o apartamento tem armadilhas de facas e um painel com as fotos dos alvos queimadas, menos a de Dalmo. O Mestre resume que ela "só matava pra vencer" (Ep1 @5m44s).
- **Interpretação:** em Hexatombe, quem usa esse corpo é Lena sem memória. A carta representa esse período (Ep1–Ep8), em que ela age como a mercenária.
- **Adaptação:** *Furtividade* e *Tiro de Precisão* são as habilidades de referência do protótipo, mantidas, mas não são nomes oficiais. A ficha oficial "Corpo de Kemi" tem *Perita*, *Disparo da Morte* e *Sniper da Morte*. *Contrato* foi criada para o tema dos contratos.

**Equipe/identidade:** Mascarados (antes, Assassinos). Receptáculo. Corpo: Kemi. Alcunha: Fantasma.

**Fontes:** [Kemi](https://ordemparanormal.fandom.com/wiki/Kemi); [Lena Viegas](https://ordemparanormal.fandom.com/wiki/Lena_Viegas); [Andrei Colfas](https://ordemparanormal.fandom.com/wiki/Andrei_Colfas); [Pacote 02](https://ordemparanormal.fandom.com/wiki/Arquivos_Secretos/Pacote_02:_Hexatombe_-_Parte_1); Ep1 e Ep4.

---

#### 2. LENA VIEGAS

❤️ 4 | ⚔️ 3 | 🛡️ 2

**Habilidade — Sede de Vingança** *(Reação)*

> Quando um aliado for derrotado, Lena pode atacar imediatamente o personagem que o derrotou, em qualquer área, mesmo que ele seja um aliado. Quando a própria Lena for derrotada, ela pode fazer um último ataque, com o mesmo alcance, antes de sair do jogo.

**Habilidade — Bandagens** *(Ação)*

> Remova 1 ferimento de um aliado na área de Lena.

**Função:** sentinela reativa. Fica perto da equipe, mantém os aliados de pé e responde a cada baixa com um tiro de longe.

**Base na lore:**
- **Fato:** ao tocar a Coroa de Espinhos (Ep9), ela escolhe "Lena" e ganha o Poder de Intenção *Sede de Vingança*. Quando um aliado cai em Morrendo, ela ataca como reação quem o derrubou; se ela cai, faz um último ataque. Na igreja (Ep9):
  - atira em Raziel quando Jasper cai;
  - mata Velisar quando Eloy cai;
  - mata Jasper depois que o Mutilador decapita Caio.
- **Fato:** ela estabilizou aliados com bandagens: Dalmo (Ep6), Eloy (Ep7), Pomba e Eloy (Ep8). Era a sentinela e a diplomata da equipe e fez a aliança com o PSIKOLERA. Fez o último sacrifício, matando Harpia (Ep10 @3h13m). Fala: "Eu sou o fantasma de uma mãe." (Ep8 @2h41m).
- **Fato (material extra):** entrou na Ordem para se vingar do homem que sacrificou a filha dela, Aurora.
- **Interpretação:** "cair em Morrendo" no RPG equivale a "ser derrotado" no TCG.
- **Adaptação:** o alcance ilimitado da reação representa o rifle. O ataque normal dela fica na mesma área, para diferenciá-la da Kemi, que atira por iniciativa própria. Poder atacar um aliado reproduz o tiro em Jasper.

**Equipe/identidade:** Mascarados; agente da Ordo Realitas. Corpo: Kemi.

**Fontes:** [Lena Viegas](https://ordemparanormal.fandom.com/wiki/Lena_Viegas); [Mascarados](https://ordemparanormal.fandom.com/wiki/Mascarados); [Harpia](https://ordemparanormal.fandom.com/wiki/Harpia); [Velisar](https://ordemparanormal.fandom.com/wiki/Velisar); Ep6–Ep10.

---

#### 3. FANTASMA

❤️ 3 | ⚔️ 4 | 🛡️ 2

**Habilidade — Disparo Espiral** *(Passiva)*

> Uma vez por rodada, o ataque da Fantasma pode ter como alvo um inimigo em outra área, a qualquer distância. Esse ataque pode mirar inimigos Ocultos e ignora habilidades de proteção.

**Habilidade — Cantiga da Múmia** *(Passiva)*

> Quando a Fantasma derrotar um personagem, ela pode ficar Oculta imediatamente. Ela se revela ao atacar ou no fim da rodada seguinte.

**Habilidade — Solitária** *(Passiva)*

> A Fantasma não pode ter ferimentos removidos e não é afetada por habilidades de aliados.

**Função:** forma de execução. Por algumas rodadas, é a melhor atiradora do jogo: acerta alvos escondidos ou protegidos e some depois de matar. Em troca, não recebe ajuda de ninguém.

**Base na lore:**
- **Fato:** a ficha "Faixas da Fantasma" inclui *Disparo Espiral*: ela puxa a sniper com as faixas e atira balas curvas, que anulam cobertura não total e ignoram resistência. Usos:
  - no Ep7, uma bala curva atinge Chispa dentro da oficina, e depois ela o mata;
  - no Ep9, a bala faz uma curva e acerta Velisar.
- **Fato:** a narração do Ep7 descreve a intenção da Fantasma: nascida para vencer, "abandonado, sozinho, mas nunca derrotado"; quem está do outro lado do tabuleiro sempre perde. Ela cantarola "Nana, neném... que a múmia vem pegar" (Ep7 @4h46m). As palavras de intenção de Kemi lidas por Alê incluem "solitária" (Ep4 @3h37m).
- **Interpretação:** a solidão e a cantiga sustentam a ideia de sumir depois de matar.
- **Adaptação:** alcance e capacidade de ignorar proteção vêm do Disparo Espiral. *Cantiga da Múmia* e *Solitária* são criações do TCG. Não há registro de Lena perdendo o controle sob as faixas; por isso a desvantagem é o isolamento, e não descontrole.

**Equipe/identidade:** Mascarados. Forma mascarada (faixas e casaco). Corpo: Kemi; veste-se sobre Kemi ou Lena Viegas.

**Fontes:** [Kemi](https://ordemparanormal.fandom.com/wiki/Kemi); [Lena Viegas](https://ordemparanormal.fandom.com/wiki/Lena_Viegas); [Chispa](https://ordemparanormal.fandom.com/wiki/Chispa); [Velisar](https://ordemparanormal.fandom.com/wiki/Velisar); Ep4, Ep7, Ep9.

---

### 4.2 Corpo: Jonas Aguiar

#### 4. JONAS AGUIAR

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Predador de Sangue** *(Passiva)*

> Quando Aguiar ferir um inimigo, coloque nele o marcador de Rastro (tire-o de quem estava com ele). O personagem com Rastro não pode ficar Oculto. Aguiar pode se mover até 2 áreas na ativação, desde que termine o movimento na área do personagem com Rastro.

**Habilidade — Arpão do Pescador** *(Ação)*

> Escolha um inimigo em uma área adjacente e desloque-o para a área de Aguiar.

**Função:** caçador. Fere uma presa, impede que ela se esconda, persegue mais rápido e puxa alvos para o corpo a corpo.

**Base na lore:**
- **Fato:** a ficha do corpo de Aguiar tem *Ataque Especial* e *Predador de Sangue*: ele memoriza o odor de uma vítima para rastreá-la e atacá-la.
- **Fato (episódios):** em Hexatombe, Jasper sem memória é o rastreador da equipe. Segue pegadas (Ep3, Ep4) e fareja Pomba até o bunker (Ep8). Pega o arpão de Tarrafa (Ep3) e o usa para destruir o Zumbi Espinhento (Ep3 @2h07m) e para segurar o carro dos Couraças (Ep7).
- **Interpretação:** rastrear pelo sangue combina com marcar quem ele já feriu.
- **Adaptação:** Rastro, movimento extra e o puxão do arpão. *Ataque Especial* (um bônus numérico) não virou habilidade própria.
- **Cuidado:** as táticas de Aguiar em *Natal Macabro* (armadilhas de urso, cães, cronômetro) são de outra campanha e não foram usadas.

**Equipe/identidade:** Mascarados (antes, Assassinos). Receptáculo. Corpo: Jonas Aguiar. Alcunha: Mutilador Noturno.

**Fontes:** [Jonas Aguiar](https://ordemparanormal.fandom.com/wiki/Jonas_Aguiar); [Jasper](https://ordemparanormal.fandom.com/wiki/Jasper); [Tarrafa](https://ordemparanormal.fandom.com/wiki/Tarrafa); Ep3, Ep4, Ep7, Ep8.

---

#### 5. JASPER

❤️ 5 | ⚔️ 3 | 🛡️ 3

**Habilidade — Encarar a Fera** *(Ação)*

> Ataque um inimigo na área de Jasper. Até o início da próxima ativação de Jasper, esse inimigo só pode atacar Jasper.

**Habilidade — Filho da Dor** *(Reação)*

> Quando Jasper sofrer um ferimento, ele pode entrar em Filho da Dor (coloque um marcador). Enquanto estiver assim, ele recebe +2 Defesa e sofre 1 ferimento no fim de cada rodada. Você pode encerrar o efeito no início de qualquer ativação dele.

**Função:** protetor de linha de frente. Prende a atenção do inimigo mais perigoso e aguenta o castigo, pagando com o próprio corpo.

**Base na lore:**
- **Fato:** Jasper é descrito como intenso e extremamente protetor. Na Guerra de Intenções da igreja (Ep9), escolheu se vincular a Raziel para impedir que ele atacasse os colegas.
- **Fato:** o Poder de Intenção dele é *Filho da Dor*. Quando é atingido por vários golpes, ele se torna "um com a dor": recebe 25 de resistência a ataques, mas sofre 5 de dano por rodada enquanto o poder estiver ativo. Ele também causou o maior dano numa única rodada da série: 126, em Raziel.
- **Interpretação:** escolher se vincular ao inimigo mais forte funciona como uma provocação.
- **Adaptação:** *Encarar a Fera* é criação do TCG baseada nesse vínculo. *Filho da Dor* converte a resistência em +2 Defesa e o dano por rodada em 1 ferimento.

**Equipe/identidade:** Mascarados; agente da Ordo Realitas. Corpo: Jonas Aguiar.

**Fontes:** [Jasper](https://ordemparanormal.fandom.com/wiki/Jasper); [Mascarados](https://ordemparanormal.fandom.com/wiki/Mascarados); [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); Ep4, Ep7, Ep9.

---

#### 6. MUTILADOR NOTURNO

❤️ 4 | ⚔️ 4 | 🛡️ 3

**Habilidade — Predador Perfeito** *(Passiva)*

> O Mutilador pode atacar duas vezes por ativação.

**Habilidade — Caçada** *(Passiva, obrigatória)*

> Se houver outro personagem ferido na área do Mutilador, os ataques dele devem ter como alvo o personagem com menos Vida restante (Vida menos ferimentos) na área, mesmo que seja um aliado. Em caso de empate, você escolhe.

**Função:** forma de massacre. Dois golpes por ativação, mas sem controle: vai sempre atrás do mais fraco, inclusive dos aliados. Exige que a equipe mantenha os feridos longe dele.

**Base na lore:**
- **Fato:** a ficha "Máscara do Mutilador Noturno" tem *Ataque Mutilador* (bônus de ataque e dano) e *Predador Perfeito* (uma ação extra na rodada). Agatha tinha avisado que as máscaras estavam impregnadas de "intenções macabras" (Ep2).
- **Fato (episódios):** ao vestir a máscara, Jasper sente "fome insaciável" e pensa em quantos segundos a vítima vai aguentar (Ep4). Com ela, mata Sabara (Ep4 @5h29m), Ana (Ep7 @4h24m) e Torvo (Ep7).
- **Fato:** na igreja (Ep9), Jasper entra em crise e perde o controle para a máscara. Ele decapita Caio Teles, um aliado que Raziel tinha deixado à beira da morte (Ep9 @6h43m). Lena o mata com um tiro que atravessa a cabeça e quebra a máscara.
- **Interpretação:** a wiki descreve o controle de Jasper como "completamente tomado pelas intenções da máscara".
- **Adaptação:** *Caçada* é a desvantagem criada para representar a cena de Caio. Ela combina com a *Sede de Vingança* da Lena.
- **Correção da nota anterior:** a morte de Caio está confirmada, mas Caio já estava à beira da morte por causa de Raziel. A perda de controle aconteceu depois de Jasper escolher o próprio nome na Coroa.

**Equipe/identidade:** Mascarados. Forma mascarada (máscara branca com a mão vermelha). Corpo: Jonas Aguiar; veste-se sobre Jonas Aguiar ou Jasper.

**Fontes:** [Jasper](https://ordemparanormal.fandom.com/wiki/Jasper); [Jonas Aguiar](https://ordemparanormal.fandom.com/wiki/Jonas_Aguiar); [Caio Teles](https://ordemparanormal.fandom.com/wiki/Caio_Teles); [Assassinos](https://ordemparanormal.fandom.com/wiki/Assassinos); [Sabara](https://ordemparanormal.fandom.com/wiki/Sabara); Ep2, Ep4, Ep7, Ep9.

---

### 4.3 Corpo: Labirinto

#### 7. LABIRINTO

❤️ 3 | ⚔️ 2 | 🛡️ 3

**Habilidade — Labirinto Mental** *(Ação)*

> Escolha um inimigo a até 1 área de distância. Na próxima ativação dele, ele não realiza ação e deve se mover para uma área adjacente diferente da atual, escolhida pelo dono dele.

**Habilidade — Capturar Momento** *(Ação)*

> Coloque o marcador de Olho em uma área a até 1 área de distância. Só pode haver 1 Olho em jogo; ao colocar um novo, retire o anterior. Personagens na área do Olho são revelados e não podem ficar Ocultos, e marcadores virados para baixo nessa área são revelados.

**Habilidade — A Antena** *(Passiva, uma vez por partida)*

> Uma vez por partida, Labirinto pode usar uma habilidade de Ação sem gastar a ação da ativação.

**Função:** controlador e espião. Tira inimigos de posição e expõe esconderijos e blefes, mas quase não causa dano.

**Base na lore:**
- **Fato:** o corpo é de um ocultista e assassino de nome real desconhecido, líder dos Assassinos e obcecado por labirintos. "Labirinto" é o nome que Remi usou enquanto estava sem memória.
- **Fato:** os rituais do corpo são:
  - *Rajada Caótica*;
  - *Labirinto Mental*: por algumas rodadas, o alvo anda numa direção aleatória "como se sua mente estivesse presa dentro de um labirinto";
  - *Capturar Momento*: um símbolo invisível capta imagens e sons de um lugar;
  - *Mapa Sanguíneo*: localiza todos os seres num raio de 1 km.
- **Fato:** *A Antena* guarda rituais para dispará-los sem tempo de conjuração.
- **Fato (usos):**
  - Labirinto Mental: quase não afeta Mosto e desvia o Quibungo (Ep5); faz Chispa bater o carro (Ep7).
  - Capturar Momento: espiral de lodo pela mansão (Ep6); Remi revê Pomba sendo levado por Cristino (Ep8).
  - Mapa Sanguíneo: Ep3 e Ep8.
- **Interpretação:** como o jogo não tem sorteio, quem decide para onde o alvo "se perde" é o dono dele. O lançador não controla o caminho.
- **Adaptação:** *Capturar Momento* e *Mapa Sanguíneo* viraram um único marcador de Olho. *A Antena* virou uma ação extra por partida. A Rajada Caótica ficou na carta de Remi, para separar as funções.

**Equipe/identidade:** Mascarados (antes, Assassinos). Receptáculo. Corpo: Labirinto. Alcunha mascarada: ???.

**Fontes:** [Labirinto](https://ordemparanormal.fandom.com/wiki/Labirinto); [Remi](https://ordemparanormal.fandom.com/wiki/Remi); [Assassinos](https://ordemparanormal.fandom.com/wiki/Assassinos); Ep1–Ep8.

**Pendência:** o nome real de Labirinto não é confirmado pelas fontes; o jogador o batizou assim e chegou a cogitar "Iter". No Ep10, Giovanni adia a resposta sobre quem ele era.

---

#### 8. REMI

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Rajada Caótica** *(Ação)*

> Ataque um inimigo a até 1 área de distância.

**Habilidade — Novo Caminho** *(Reação)*

> Quando um personagem de qualquer lado for derrotado a até 1 área de distância de Remi, remova de Remi ou de um aliado a até 1 área de distância uma quantidade de ferimentos igual à metade da Vida do personagem derrotado, arredondando para baixo.

**Habilidade — Formação** *(Passiva)*

> No início de cada rodada, um aliado na área de Remi pode se mover para uma área adjacente.

**Função:** líder estrategista. Ajusta a posição da equipe antes de cada rodada, atira de perto e transforma cada morte ao redor em cura.

**Base na lore:**
- **Fato:** Remi é agente veterano e líder dos Mascarados. Discute planos, monta formações (Henri no centro, no Ep3) e divide tarefas. Fala: "Não tem espaço pra erro!" (Ep9 @8m12s).
- **Fato:** ao tocar a Coroa (Ep9), escolhe "Remi" e ganha o Poder de Intenção *Novo Caminho*. Quando vê um alvo morrer, absorve a intenção dele em rabiscos vermelhos que costuram feridas e cura a si mesmo ou a um aliado em metade dos PV máximos do morto. Usos:
  - Cleo → Jasper (Ep9);
  - intenções de Raziel, 195 PV, a maior cura da série (Ep9);
  - intenções de Cristino → Lena (Ep10).
- **Fato:** *Rajada Caótica* causa 8d8 de dano de Energia em alcance médio. Com ela, Remi mata Alvira (Ep9 @6h54m) e carboniza Giovanni (Ep10 @2h05m).
- **Correção da nota anterior:** o nome correto é Poder de Intenção *Novo Caminho*; a forma "Intenção Novo Caminho" não aparece. Ele **não** dá a Remi uma segunda vida: cura alguém quando **outro** personagem morre. A "segunda vida" é a recompensa do Estigma do Desejo, cujo sacrifício é Juan.
- **Adaptação:** "metade dos PV máximos" virou "metade da Vida do derrotado". *Formação* foi criada a partir do papel de estrategista.

**Equipe/identidade:** Mascarados; agente da Ordo Realitas, líder. Corpo: Labirinto.

**Fontes:** [Remi](https://ordemparanormal.fandom.com/wiki/Remi); [Mascarados](https://ordemparanormal.fandom.com/wiki/Mascarados); [Alvira](https://ordemparanormal.fandom.com/wiki/Alvira); [Giovanni Opspor](https://ordemparanormal.fandom.com/wiki/Giovanni_Opspor); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); Ep3, Ep9, Ep10.

---

#### 9. ???

❤️ 3 | ⚔️ 4 | 🛡️ 3

**Habilidade — Tempestade Caótica** *(Ação)*

> Ataque um inimigo a até 2 áreas de distância.

**Habilidade — Labirinto Abissal** *(Ação)*

> Escolha um inimigo a até 1 área de distância e desloque-o até 2 vezes, pelo caminho que você escolher.

**Habilidade — Cada Caminho, uma Alma** *(Passiva)*

> No fim de cada rodada em que ??? não tenha derrotado nenhum personagem, retire a máscara.

**Função:** finalizador de alcance. Vestido no momento certo, acaba com um alvo ferido de longe ou arrasta um inimigo para onde a equipe precisa. Se não matar, o capacete sai no fim da rodada.

**Base na lore:**
- **Fato:** o capacete de ferro tem um rosto sem traços e um enorme sorriso macabro. Com ele, os rituais melhoram. A ficha "Capacete do ???" tem:
  - *Tempestade Caótica*: 8d10 de dano de Energia em alcance médio;
  - *Labirinto Abissal*: o alvo anda na direção que Remi escolher;
  - *Consumir Momento*;
  - *Revelação Sanguínea*.
- **Fato:** ao vesti-lo, Remi sente euforia e sede e quer "expandir o labirinto. Cada caminho, uma alma absorvida", entre gargalhadas (Ep7).
- **Fato (Ep7):** mata Miasma (Ep7 @4h50m) e Escarlata (Ep7 @5h00m). Com o Labirinto Abissal, leva X até a oficina e baixa o capuz dela. Depois, a própria mão direita arranca o capacete.
- **Fato (Ep9):** volta a vesti-lo na igreja.
- **Interpretação:** o capacete arrancado depois da matança e a frase "cada caminho, uma alma" sugerem uma máscara que só se sustenta enquanto mata.
- **Adaptação:** alcance 2 e deslocamento duplo. *Consumir Momento* e *Revelação Sanguínea* não entraram, para manter a carta simples.

**Equipe/identidade:** Mascarados. Forma mascarada (capacete). Corpo: Labirinto; veste-se sobre Labirinto ou Remi.

**Fontes:** [Labirinto](https://ordemparanormal.fandom.com/wiki/Labirinto); [Remi](https://ordemparanormal.fandom.com/wiki/Remi); [Escarlata](https://ordemparanormal.fandom.com/wiki/Escarlata); [Miasma](https://ordemparanormal.fandom.com/wiki/Miasma); Ep7, Ep9.

**Pendência:** não existe nome confirmado por trás de "???". A designação foi preservada.

---

### 4.4 Corpo: Dalmo Magno

#### 10. DALMO MAGNO

❤️ 5 | ⚔️ 3 | 🛡️ 3

**Habilidade — Golpes de Arena** *(Passiva)*

> Uma vez por ativação, quando Dalmo acertar um ataque, escolha um efeito: desloque o alvo para uma área adjacente; **ou** ataque outro inimigo na mesma área; **ou** deixe o alvo Atordoado.

**Habilidade — Glória Viciante** *(Passiva)*

> Quando Dalmo derrotar um inimigo, remova 1 ferimento dele.

**Função:** lutador de arena. Cada acerto vira uma escolha: empurrar, emendar outro golpe ou atordoar. Fica mais forte quanto mais lutas vence.

**Base na lore:**
- **Fato:** Dalmo Magno, o Colosso, lutava em arenas paranormais. Era motorista e diretor da TransMueller. Começou a lutar para pagar o tratamento da filha, Manu, e continuou pela glória: "a glória era viciante" (Mestre, Ep1 @5m33s).
- **Fato:** a ficha do corpo tem:
  - *Golpes de Arena*: ao acertar um golpe corpo a corpo, faz um ataque desarmado extra ou uma manobra;
  - *Pressão Atmosférica*: ao acertar, causa dano extra de Energia e deixa o alvo atordoado por 1 rodada;
  - *Manoplas do Colosso*, amaldiçoadas com Energia.
- **Fato (episódios):** em Hexatombe, quem usa o corpo é Tuco sem memória. Ele rasga o Anulado ao meio (Ep1), mata mais de 15 no mosh pit (Ep2) e quebra o medidor de força do circo (Ep4).
- **Interpretação:** a carta representa Tuco sem memória vivendo como Dalmo.
- **Adaptação:** *Golpes de Arena* reúne as duas habilidades da ficha (a opção de atordoar é a *Pressão Atmosférica*). *Glória Viciante* foi criada a partir da fala do Mestre.

**Equipe/identidade:** Mascarados (antes, Assassinos). Receptáculo. Corpo: Dalmo Magno. Alcunha: Colosso.

**Fontes:** [Dalmo Magno](https://ordemparanormal.fandom.com/wiki/Dalmo_Magno); [Tuco Belez](https://ordemparanormal.fandom.com/wiki/Tuco_Belez); [Manu Magno](https://ordemparanormal.fandom.com/wiki/Manu_Magno); Ep1, Ep2, Ep4.

---

#### 11. TUCO BELEZ

❤️ 5 | ⚔️ 3 | 🛡️ 3

**Habilidade — Assumir o Risco** *(Reação · proteção)*

> Quando um aliado na área de Tuco for atingido por um ataque, Tuco pode sofrer os ferimentos desse ataque no lugar dele.

**Habilidade — Resgate** *(Ação)*

> Tuco se move 1 área além do movimento normal e leva junto um aliado que esteja na área dele.

**Habilidade — Combatente de Arena** *(Passiva)*

> Enquanto houver 2 ou mais aliados na área de Tuco, ele recebe +1 Defesa.

**Função:** protetor e resgatador. Toma os golpes no lugar dos aliados, tira quem está em perigo da linha de frente e fica mais firme quando a equipe luta junta.

**Base na lore:**
- **Fato:** Tuco se ofereceu para usar o corpo do lutador que atormentou o passado dele: o Colosso tinha matado seus amigos mercenários. Exemplos de proteção:
  - salvou Lena numa emboscada (biografia; Ep8);
  - protegeu Aguiar no mosh pit (Ep2);
  - carregou Pomba (Ep3);
  - morreu tentando impedir Raziel de chegar a Henri, e Velisar drenou seu sangue (Ep7 @4h17m).
- **Fato:** Tuco só recuperou as memórias e o próprio nome ao morrer. Nunca tocou a Coroa.
- **Fato (bastidores, Ep11 @2h59m):** o Poder de Intenção dele seria *Combatente de Arena*: com o incentivo de duas pessoas, +10 de Defesa ao contra-atacar e +10 na reação de contra-ataque se o atacante errasse. Nunca foi usado. O desejo dele seria curar Manu.
- **Interpretação:** a versão Agente representa um Tuco consciente de quem é, algo que a história só mostra no momento da morte. Por isso o poder dele vem dos bastidores.
- **Adaptação:** *Combatente de Arena* foi simplificado para +1 Defesa com 2 aliados. O contra-ataque ficou de fora porque, num jogo determinístico, quase ninguém ataca sabendo que vai errar. *Assumir o Risco* e *Resgate* foram criadas a partir das cenas de proteção.

**Equipe/identidade:** Mascarados; agente da Ordo Realitas. Corpo: Dalmo Magno.

**Fontes:** [Tuco Belez](https://ordemparanormal.fandom.com/wiki/Tuco_Belez); [Mascarados](https://ordemparanormal.fandom.com/wiki/Mascarados); [Juan](https://ordemparanormal.fandom.com/wiki/Juan); [Velisar](https://ordemparanormal.fandom.com/wiki/Velisar); Ep2, Ep3, Ep7, Ep8; [Revelando Hexatombe](https://www.youtube.com/watch?v=LVBZay042_c).

---

#### 12. COLOSSO

❤️ 5 | ⚔️ 4 | 🛡️ 4

**Habilidade — Sem Recuar** *(Passiva e Reação)*

> **Passiva:** o Colosso não pode se mover para fora de uma área onde haja um inimigo. **Reação:** quando um inimigo se mover para fora da área do Colosso, o Colosso pode atacá-lo antes que ele saia.

**Habilidade — O Motivo** *(Passiva, uma vez por partida)*

> A primeira vez que o Colosso sofreria o ferimento que o derrotaria, ele fica com 1 de Vida restante e ignora os ferimentos excedentes.

**Função:** duelista que transforma a área em arena. Quem entra fica preso à luta, e quem tenta fugir apanha. Aguenta um golpe a mais, mas não pode recuar.

**Base na lore:**
- **Fato:** o escafandro do Colosso tem três visores vermelhos e um chaveiro de axolote no alto, "para que lembre do motivo" (Manu).
- **Fato (Ep5):**
  1. Mosto vem buscar o Colosso. Dalmo tenta evitar a luta e se vira para ir embora.
  2. Nando usa a *Arrogância Diabólica* e o chama de covarde.
  3. Dalmo volta, veste o capacete e começa o Duelo de Intenções.
  4. O cutelo de Mosto quebra o visor.
  5. O Colosso esmaga a cabeça de Mosto com pisões (Ep5 @1h30m).
- **Fato:** ao vestir o capacete, os músculos crescem e ele pensa "que Deus tenha piedade do seu inimigo, pois ele não vai ter". Pede que ninguém se meta (Ep5).
- **Fato (Ep7):** como Colosso, cego por Velisar, bloqueia golpes andando para trás antes de morrer.
- **Interpretação:** depois de voltar para a luta, ele não recua mais. É uma leitura da cena, não uma frase do texto.
- **Adaptação:** *Sem Recuar* é o nome do protótipo e **não é oficial** (não aparece nas fontes). *O Motivo* é criação do TCG baseada no chaveiro.
- **Correção da nota anterior:** Nando chamou Dalmo de covarde **antes** da luta, quando ele estava indo embora. Dalmo não "voltou a lutar" depois de ter começado. Também não existe habilidade de resistência com nome para o Colosso; a resistência da carta é adaptação.

**Equipe/identidade:** Mascarados. Forma mascarada (escafandro). Corpo: Dalmo Magno; veste-se sobre Dalmo Magno ou Tuco Belez.

**Fontes:** [Dalmo Magno](https://ordemparanormal.fandom.com/wiki/Dalmo_Magno); [Mosto](https://ordemparanormal.fandom.com/wiki/Mosto); [Nando Salles](https://ordemparanormal.fandom.com/wiki/Nando_Salles); [Tuco Belez](https://ordemparanormal.fandom.com/wiki/Tuco_Belez); Ep5, Ep7.

---

### 4.5 Corpo: Park Jae-Yoon

#### 13. PARK JAE-YOON

❤️ 3 | ⚔️ 3 | 🛡️ 3

**Habilidade — Zona dos Sussurros** *(Ação)*

> Coloque um marcador X na área de Jae. Ela só pode ter 2 marcadores X em jogo; ao colocar um terceiro, retire um dos anteriores. Numa área com marcador X, Jae recebe +1 Ataque. No fim de uma ativação em que não atacou, se estiver numa área com X, ela pode ficar Oculta. Ela se revela ao atacar ou ao sair de uma área com X.

**Habilidade — Punhal X** *(Ação)*

> Ataque um inimigo na área de Jae. Se acertar, ele fica Atordoado.

**Função:** assassina de território. Prepara pontos marcados, se esconde neles e ataca de dentro deles. O Punhal tira o alvo da rodada seguinte.

**Base na lore:**
- **Fato:** Park Jae-Yoon, "X", é a assassina que caçava em silêncio e estripava as vítimas. Fora disso, era influenciadora de finanças.
- **Fato:** a ficha do corpo tem:
  - *Assassinato Furtivo*: dano extra contra alvo desprevenido ou flanqueado;
  - *Zona dos Sussurros*: marca uma área com X; dentro dela, ela ganha +5 no ataque e não sofre penalidade de Furtividade depois de ações chamativas;
  - *Punhal X*: deixa o alvo desprevenido; se acertar, o alvo fica cego por 1 rodada;
  - *Perita*.
- **Fato (episódios):** em Hexatombe, quem usa o corpo é Maria sem memória. Ela marca X pelo galpão e flanqueia o Anulado (Ep1), marca a base (Ep3) e o Ferro Velho (Ep7). Uma facada dela deixa Chispa cego (Ep7).
- **Correção da nota anterior:**
  - A velocidade aparece só em *Natal Macabro* ("correndo quase que sobrenaturalmente"); não está na ficha nem em Hexatombe, por isso não entrou.
  - "Interromper o alvo" não faz parte do Punhal X, que cega. O silenciamento é do *Sabor do Silêncio*, da Maria.
- **Adaptação:** *Zona dos Sussurros* ganhou o limite de 2 marcadores e a ocultação dentro da área. A cegueira virou Atordoado.

**Equipe/identidade:** Mascarados (antes, Assassinos). Receptáculo. Corpo: Park Jae-Yoon. Alcunha: X.

**Fontes:** [Park Jae-Yoon](https://ordemparanormal.fandom.com/wiki/Park_Jae-Yoon); [Maria Helena Rodrigues](https://ordemparanormal.fandom.com/wiki/Maria_Helena_Rodrigues); [Chispa](https://ordemparanormal.fandom.com/wiki/Chispa); Ep1, Ep3, Ep7.

---

#### 14. MARIA HELENA RODRIGUES

❤️ 3 | ⚔️ 3 | 🛡️ 3

**Habilidade — Sabor do Silêncio** *(Ação)*

> Escolha um inimigo ferido na área de Maria e coloque nele o marcador de Presa (só uma Presa por vez). Enquanto a Presa estiver na área de Maria, ela não pode usar habilidades de Ação nem de Reação, e os ataques de Maria contra ela causam +1 ferimento.

**Habilidade — Morte Natural** *(Passiva)*

> Quando Maria derrotar um personagem, nenhuma habilidade é ativada por essa derrota.

**Função:** predadora silenciosa. Escolhe uma presa já ferida, a cala e a abate sem deixar rastro: a morte não ativa vingança, cura nem nenhum outro efeito.

**Base na lore:**
- **Fato:** ao tocar a Coroa (Ep9), escolhe "Maria" e ganha o Poder de Intenção *Sabor do Silêncio*. Depois de provar o sangue de uma presa e gastar uma ação, causa dano extra. Num acerto crítico, corta a boca do alvo em X e o silencia: por 2 rodadas, ele não pode se comunicar nem usar poder ou ritual. No Ep9, ela lambe o sangue de Eloy: "um sabor silencioso".
- **Fato (material extra, biografia):** era enfermeira na ala de doenças terminais. A chefe dela, Fernanda, alterou a dosagem de um paciente e acelerou a morte dele. Maria ficou calada e sentiu euforia ao mentir para a família e para a equipe que tinha sido "uma morte natural". Depois, furtou um livro sobre Tirigan e Kian, de quem era devota. Fala: "Kian vai nos salvar." (Ep9).
- **Fato (episódios):** foi a organizadora da base (Ep4, Ep8). Lembrou que era enfermeira (Ep6), mas não há nenhuma cena em que ela faça primeiros socorros. Labirinto ironiza que ela "não sabia nada sobre enfermagem" (Ep6). Raziel a mata na igreja (Ep9).
- **Interpretação:** como não há acerto crítico no TCG, "provar o sangue" virou exigir um alvo já ferido.
- **Adaptação:** *Sabor do Silêncio* dá +1 ferimento e cala a presa enquanto ela estiver perto. *Morte Natural* é nome do protótipo e **não é oficial**: vem da mentira do passado de Maria.
- **Correção da nota anterior:** "Morte Natural" não é um poder, e quem acelerou a morte do paciente foi a chefe, não Maria. A experiência de enfermagem não virou cura, porque ela nunca cura ninguém em Hexatombe.

**Equipe/identidade:** Mascarados; agente da Ordo Realitas. Corpo: Park Jae-Yoon.

**Fontes:** [Maria Helena Rodrigues](https://ordemparanormal.fandom.com/wiki/Maria_Helena_Rodrigues); [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); Ep4, Ep6, Ep8, Ep9.

---

#### 15. X

❤️ 3 | ⚔️ 4 | 🛡️ 2

**Habilidade — Zona das Sombras** *(Ação)*

> Coloque o marcador de Armadilha na área de X ou numa área adjacente. Só pode haver 1 Armadilha de X em jogo. Quando um inimigo entrar nessa área ou começar a ativação nela, ele sofre 1 ferimento e fica Atordoado; depois, retire a Armadilha.

**Habilidade — Assassinato Cruel** *(Passiva)*

> Os ataques de X causam +1 ferimento contra inimigos Atordoados ou que estejam na mesma área de outro aliado de X.

**Habilidade — O Capuz Cai** *(Passiva)*

> Quando X sofrer um ferimento, retire a máscara.

**Função:** forma de emboscada. Arma uma armadilha e pune quem está atordoado ou cercado. Com Defesa baixa, perde o capuz no primeiro golpe que leva.

**Base na lore:**
- **Fato:** a ficha "Capuz de X" tem:
  - *Assassinato Cruel*: dano muito maior contra alvo desprevenido ou flanqueado;
  - *Zona das Sombras*: armadilha de Conhecimento que, ativada, causa dano e deixa o alvo cego por 1 rodada e surdo pelo resto da cena.
- **Fato (Ep5):** é a primeira vez com o capuz, vestido para não deixar Labirinto para trás diante do Quibungo. O capuz desce quando o carro de Ana atropela o monstro. Narração: "O silêncio que a atormentava agora assombra o pesadelo dos outros."
- **Fato (Ep7):**
  - coloca uma armadilha de Conhecimento aos pés de Ana;
  - dominada pela paixão de Escarlata, é obrigada a atacar o Mutilador;
  - enfurecida, fere Labirinto;
  - o Labirinto Abissal baixa o capuz, e ela chora.
- **Interpretação:** o capuz cai com choques e interferências de fora.
- **Adaptação:** *O Capuz Cai* (ser ferida remove a máscara) adapta essa fragilidade.
- **Correção da nota anterior:** a punição a "inimigos isolados" não tem base. A ficha pune alvos desprevenidos ou flanqueados, ou seja, cercados; a carta segue a ficha.

**Equipe/identidade:** Mascarados. Forma mascarada (capuz vermelho). Corpo: Park Jae-Yoon; veste-se sobre Park Jae-Yoon ou Maria Helena Rodrigues.

**Fontes:** [Maria Helena Rodrigues](https://ordemparanormal.fandom.com/wiki/Maria_Helena_Rodrigues); [Park Jae-Yoon](https://ordemparanormal.fandom.com/wiki/Park_Jae-Yoon); [Ana Delgado dos Santos](https://ordemparanormal.fandom.com/wiki/Ana_Delgado_dos_Santos); Ep5, Ep7.

---

### 4.6 Corpo: Lúcio Davo (Henri / Juan)

Henri e Juan são a mesma pessoa, antes e depois de escolher um novo nome na Coroa de Espinhos (Ep9). São versões alternativas: escolha uma ao montar a equipe.

#### 16. HENRI

❤️ 3 | ⚔️ 2 | 🛡️ 2

**Habilidade — Perturbação** *(Ação)*

> Escolha um inimigo a até 1 área de distância e dê uma ordem: "Solta!" (ele fica Atordoado) ou "Senta!" (ele fica Preso).

**Habilidade — Vínculo de Sangue** *(Ação · proteção)*

> Coloque o marcador de Vínculo em um aliado na área de Henri (só um Vínculo por vez). Quando Henri sofrer ferimentos, você pode passar 1 deles para o aliado vinculado, esteja ele em qualquer área.

**Habilidade — Faca Predadora** *(Passiva)*

> Quando Henri ferir um personagem com um ataque, remova 1 ferimento de Henri.

**Habilidade — Estigma do Desejo** *(Sacrifício)*

> Quando Henri for derrotado, quem o derrotou recebe o Estigma do Desejo: na próxima vez que esse personagem sofreria o ferimento que o derrotaria, ele fica com 1 de Vida restante. Depois, descarte o marcador.

**Função:** sacrifício frágil que se defende com truques de sangue: ordens curtas, divisão de dano com um aliado e cura ao ferir. Quem o derrota ganha uma segunda chance.

**Base na lore:**
- **Fato:** nasceu Lúcio Davo. "Henri" foi o nome que recebeu de Arnaldo Fritz ao ser levado ao orfanato. Antes de Hexatombe:
  - foi Escripta (em *Desconjuração*);
  - foi receptáculo da Relíquia de Sangue, o Diabo (em *Calamidade*). Todo sacrifício do Hexatombe precisa ter sido receptáculo do Diabo.
- **Fato:** em Hexatombe, ele desperta com o Estigma do Desejo nas costas e é o sacrifício dos Mascarados. Vive paranoico e repete que não quer morrer.
- **Fato (usos):**
  - *Perturbação Discente*: Sabara larga a mochila e depois a espada (Ep4); Caíto larga a arma, e Caio recebe a ordem de sentar (Ep8);
  - *Vínculo de Sangue*: desenhado em Aguiar; o dano do grito de Caio é dividido com Henri (Ep8);
  - *Faca Predadora*: absorve o sangue de Nando e de Raziel para curá-lo (Ep5, Ep7);
  - *Armadura de Sangue Diabólica*: ativada depois do tiro de Nando (Ep5).
- **Fato:** o Estigma do Desejo dá ao herdeiro uma forma que aprimora as habilidades. A condição, revelada depois do ritual, concede uma "segunda vida".
- **Interpretação:** as ordens "Solta!" e "Senta!" correspondem aos usos narrados.
- **Adaptação:** a segunda vida foi simplificada para "fica com 1 de Vida". A Armadura de Sangue não virou habilidade própria.
- **Cuidado:** o Vínculo de Sangue já existia em *Desconjuração*, quando Henri marcou a si mesmo para que agentes morressem com ele. Só o uso de Hexatombe foi considerado.

**Equipe/identidade:** Mascarados. Sacrifício (Estigma do Desejo). Corpo: Lúcio Davo.

**Fontes:** [Juan](https://ordemparanormal.fandom.com/wiki/Juan) (a página "Henri" redireciona para ela); [O Diabo](https://ordemparanormal.fandom.com/wiki/O_Diabo); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); [Sabara](https://ordemparanormal.fandom.com/wiki/Sabara); Ep3–Ep8.

---

#### 17. JUAN

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Descarnar** *(Ação)*

> Escolha um inimigo a até 1 área de distância: ele sofre 1 ferimento. Isso não é um ataque e ignora a Defesa.

**Habilidade — Desejo Diabólico** *(Passiva)*

> Uma vez por rodada, quando Juan atacar o personagem com menos Vida restante na área dele, o ataque acerta automaticamente e causa +1 ferimento. Esse ataque pode ter um aliado como alvo.

**Habilidade — Estigma do Desejo** *(Sacrifício)*

> Quando Juan for derrotado, quem o derrotou recebe o Estigma do Desejo: na próxima vez que esse personagem sofreria o ferimento que o derrotaria, ele fica com 1 de Vida restante. Depois, descarte o marcador.

**Função:** executor. Arranca a carne de alvos blindados à distância e finaliza quem estiver mais fraco por perto. Continua sendo o sacrifício da equipe.

**Base na lore:**
- **Fato:** na Coroa (Ep9), recusa "Henri" e "Lúcio Davo" e escolhe um nome novo, Juan. O pai dele também se chamava Juan Davo, mas o motivo da escolha não é dito.
- **Fato:** ganha o Poder de Intenção *Desejo Diabólico*: quando obedece a "Ele" (o Diabo), decide que um teste à sua escolha é sucesso automático ou crítico.
- **Fato:** *Descarnar Discente* causa 32 de dano de Sangue e hemorragia. Usos:
  - mata Zéfero na segunda conjuração (Ep9 @6h25m);
  - mata Cristino, preso pelas correntes de Argano (Ep10 @2h56m);
  - deixa o rosto de Harpia em carne viva antes do tiro de Lena (Ep10).
- **Fato:** obedecendo ao desejo diabólico, mata e devora Raziel (Ep9 @7h06m). Recusa a intenção de matar Cindy (Ep9). Diante de Harpia, diz que antes obedeceu e que agora é a vez dele escolher (Ep10). Sobrevive, vence o ritual e se torna o Diabo.
- **Interpretação:** a intenção sempre empurra Juan para quem está mais vulnerável, seja aliado ou inimigo.
- **Adaptação:** *Descarnar* virou dano direto que ignora Defesa. *Desejo Diabólico* virou acerto automático contra o mais fraco, inclusive aliados.

**Equipe/identidade:** Mascarados. Sacrifício (Estigma do Desejo). Corpo: Lúcio Davo.

**Fontes:** [Juan](https://ordemparanormal.fandom.com/wiki/Juan); [Zéfero](https://ordemparanormal.fandom.com/wiki/Zéfero); [Cristino](https://ordemparanormal.fandom.com/wiki/Cristino); [Harpia](https://ordemparanormal.fandom.com/wiki/Harpia); [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); Ep9, Ep10.

---

## 5. Equipe Couraças

Ocultistas de vários países presos a armaduras amaldiçoadas, com base no Ferro Velho e liderados por Escarlata. Foram dizimados na guerra da noite 3 (Ep7); só Argano sobreviveu e chegou ao fim.

---

#### 18. ESCARLATA

❤️ 4 | ⚔️ 2 | 🛡️ 4

**Habilidade — Apaixonado** *(Ação)*

> Coloque o marcador de Paixão em um inimigo na área de Escarlata. No máximo 2 inimigos podem ter Paixão ao mesmo tempo. Personagens com Paixão não podem atacar Escarlata.

**Habilidade — Dominação** *(Ação)*

> Escolha um personagem com Paixão a até 1 área de distância. Ele faz imediatamente um ataque contra um alvo na área dele escolhido por você, que pode ser um aliado dele. Depois, retire a Paixão dele.

**Habilidade — Transfusão Vital** *(Ação)*

> Um aliado na área de Escarlata sofre 1 ferimento. Remova 1 ferimento de Escarlata ou de outro aliado nessa área.

**Função:** líder manipuladora. Seduz inimigos para que não a ataquem, depois os joga contra os próprios aliados. Redistribui a dor da equipe.

**Base na lore:**
- **Fato:** líder dos Couraças, descrita como sedutora, manipuladora e controladora. Habilidades registradas:
  - *Apaixonado*: um alvo apaixonado ganha vigor, mas sofre penalidade nos testes contra ela;
  - *Dominação*: dá ordens a um alvo apaixonado, como "Mata ele!!!";
  - *Transfusão Vital* (ritual): usa a dor de Torvo para curar a si mesma ou um aliado.
- **Fato (episódios):** seduz Jae, Labirinto e Aguiar (Ep5, Ep6). Na guerra (Ep7), usa a paixão contra X, Labirinto e o Mutilador e obriga X a atacar o Mutilador. Morre pela Tempestade Caótica de ??? (Ep7 @5h00m). O desejo dela era tirar a armadura de Ana.
- **Interpretação:** a paixão funciona como um vínculo que impede o alvo de feri-la.
- **Adaptação:** a *Transfusão Vital* foi generalizada para qualquer aliado; Torvo é o par natural. Não há cena explícita de uso: no Ep7, ela só planejava usar Torvo nos rituais.
- **Correção da nota anterior:** o "Crânio Dominador" não é poder de Escarlata em vida. É o item de Argano, feito com o crânio dela depois que ela morreu (Ep10).

**Equipe/identidade:** Couraças, líder. Nome verdadeiro: Camila Perez.

**Fontes:** [Escarlata](https://ordemparanormal.fandom.com/wiki/Escarlata); [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças); [Torvo](https://ordemparanormal.fandom.com/wiki/Torvo); Ep5–Ep7.

---

#### 19. TORVO

❤️ 5 | ⚔️ 1 | 🛡️ 3

**Habilidade — Crucificado** *(Passiva)*

> Torvo não pode se mover sozinho. Quando um aliado sair da área de Torvo, Torvo pode acompanhá-lo.

**Habilidade — Fonte de Dor** *(Passiva)*

> Quando Torvo sofrer um ferimento causado por um aliado, remova 1 ferimento de outro aliado na área dele.

**Função:** bateria de dor. Quase não luta e precisa ser carregado, mas cada ferimento que a própria equipe causa nele vira cura para os outros.

**Base na lore:**
- **Fato:** Torvo (Tadeo Fausto), marido de Escarlata, fica preso com arame farpado a uma grande cruz de madeira. Implora "Me mata... me mata..." (Ep5 @4h02m) e era o único Couraça que obedecia à força.
- **Fato:** a *Revelação Sanguínea* de Labirinto mostra que a única intenção dele era morrer (Ep7). A *Transfusão Vital* de Escarlata usa a dor dele. Ele é levado até a grua com ela na guerra e morre pela dinamite do Mutilador (Ep7 @4h40m).
- **Fato (material extra):** antes da armadura, era agressivo e controlador com as parceiras.
- **Interpretação:** é uma peça passiva, cuja dor serve de recurso para a equipe.
- **Adaptação:** *Crucificado* e *Fonte de Dor*. A combinação com a Transfusão Vital de Escarlata rende 1 cura extra.

**Equipe/identidade:** Couraças.

**Fontes:** [Torvo](https://ordemparanormal.fandom.com/wiki/Torvo); [Escarlata](https://ordemparanormal.fandom.com/wiki/Escarlata); [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças); Ep5, Ep7.

---

#### 20. ANA DELGADO DOS SANTOS

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Ao Volante** *(Ação)*

> Ana se move até 2 áreas. Um aliado que estava na área de onde ela saiu pode se mover junto com ela.

**Habilidade — Eu Te Amo** *(Reação)*

> Quando Ana for derrotada por um ataque de um personagem na mesma área, esse atacante sofre 1 ferimento.

**Função:** batedora e transporte. Leva aliados de um ponto a outro do mapa e cobra caro de quem a finaliza no corpo a corpo.

**Base na lore:**
- **Fato:** Ana, brasileira, é a batedora dos Couraças e a favorita de Escarlata. Dirigia o carro da equipe: atropelou o Quibungo para salvar Jae e Labirinto e levou os dois ao Ferro Velho (Ep5). Lutava com o Florete Obsessivo e a Maça Obsessiva, a "Dupla Obsessiva".
- **Fato:** foi enfermeira. Segundo a biografia (material extra), cursou enfermagem e trabalhou como enfermeira do museu. Tratou os ferimentos de Aguiar e Jae (Ep6).
- **Fato (Ep7):** ferida, diz "eu te amo" a Escarlata (Ep7 @3h25m) e tenta ativar a armadilha de Conhecimento que X tinha posto aos pés dela, para se sacrificar e levar Aguiar junto. O Mutilador a impede e a mata (Ep7 @4h24m).
- **Correção da nota anterior:**
  - "Eu te amo" é uma fala, não o nome de um ato ou sacrifício.
  - A armadilha era de X.
  - Ana não era o sacrifício da equipe; era Miasma.
  - "Curativos" não existe como poder.
  - Ela era enfermeira formada, não estudante.
- **Adaptação:** *Ao Volante* representa o carro. *Eu Te Amo* é a última tentativa de levar o inimigo junto, que no TCG funciona.

**Equipe/identidade:** Couraças, batedora.

**Fontes:** [Ana Delgado dos Santos](https://ordemparanormal.fandom.com/wiki/Ana_Delgado_dos_Santos); [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças); [Escarlata](https://ordemparanormal.fandom.com/wiki/Escarlata); Ep4–Ep7.

---

#### 21. ARGANO

❤️ 6 | ⚔️ 3 | 🛡️ 5

**Habilidade — Coração Exposto** *(Passiva)*

> Contra ataques feitos de outra área, a Defesa de Argano é 3.

**Habilidade — Crânio Dominador** *(Ação)*

> Só pode ser usada depois que uma Escarlata da sua equipe tiver sido derrotada nesta partida. Escolha um inimigo a até 1 área de distância: desloque-o para a área de Argano. Ele fica Preso.

**Função:** muralha. Quase impossível de ferir no corpo a corpo, mas vulnerável a tiros. Se Escarlata estiver na equipe e cair, ele passa a arrastar inimigos para perto.

**Base na lore:**
- **Fato:** Argano (Zacarías) é o guardião da base. Usa uma armadura colossal, fixada ao corpo por agulhas, que parece tomar as decisões por ele, com o coração exposto num buraco no peito. Luta com a Maça Adornada e quase quebra a coluna de Eloy (Ep7). Sobrevive ao incêndio dos dormitórios.
- **Fato (Ep10):** usa o *Crânio Dominador*: o crânio carbonizado de Escarlata, envolto em correntes que voam até o alvo, o prendem e o puxam, deixando-o paralisado até que a corrente seja quebrada. Prende Cristino depois de levar um tiro no coração.
- **Fato:** sobrevive, herda um estigma e vence. O desejo dele, trazer Escarlata de volta, parece se cumprir: o crânio começa a se regenerar.
- **Interpretação:** o crânio só existe depois da morte de Escarlata.
- **Adaptação:** Defesa 5 contra o corpo a corpo e *Coração Exposto* contra tiros (como o de Cristino). O *Crânio Dominador* só funciona depois que uma Escarlata aliada é derrotada, como na história; sem Escarlata na equipe, Argano não tem essa habilidade.
- **Correção da nota anterior:** o perfil não é só defensivo; ele também ataca na linha de frente. "Segura posições" é interpretação, não está nas fontes.

**Equipe/identidade:** Couraças, guardião. Termina como desertor e um dos vencedores.

**Fontes:** [Argano](https://ordemparanormal.fandom.com/wiki/Argano); [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças); [Cristino](https://ordemparanormal.fandom.com/wiki/Cristino); Ep5, Ep7, Ep10.

---

#### 22. CHISPA

❤️ 3 | ⚔️ 3 | 🛡️ 2

**Habilidade — Triciclo** *(Passiva)*

> Chispa pode se mover até 2 áreas por ativação. Se ele se mover 2 áreas antes de atacar, o ataque causa +1 ferimento.

**Habilidade — Alvo Pequeno** *(Passiva)*

> Ataques feitos de outra área só acertam Chispa se o Ataque for maior que a Defesa dele.

**Habilidade — Motor Sanguíneo** *(Reação, uma vez por partida)*

> Quando Chispa sofrer um ferimento, ele pode sofrer mais 1 ferimento para se mover imediatamente até 3 áreas.

**Função:** batedor de investida. Atravessa o mapa, atropela quem está sozinho e escapa sangrando quando é encurralado.

**Base na lore:**
- **Fato:** Chispa (Castel del Toro) é o batedor e mecânico dos Couraças. Não tem as pernas e vive unido a uma handbike motorizada adaptada, chamada de "triciclo" nas habilidades. A lança com espingarda fica presa ao veículo. Empala Tarrafa durante uma perseguição (Ep3 @1h15m).
- **Fato:** habilidades registradas:
  - *Controle por Correntes* (ritual): controla um veículo à distância;
  - *Alvo Pequeno*: ataques contra o pequeno motor do triciclo sofrem penalidade;
  - *Motor Sanguíneo*: quando o motor estoura, o próprio Chispa corta parte do braço e o enfia no painel; o sangue jorra e o impulsiona muito acima da velocidade normal.
- **Fato (Ep7):** emboscado, usa o Motor Sanguíneo e foge. A Fantasma o mata (Ep7 @4h46m).
- **Correção da nota anterior:** quem corta o braço é o próprio Chispa. A penalidade do *Alvo Pequeno* vale contra o motor do triciclo, não contra Chispa nem contra o carro da equipe.
- **Adaptação:** o *Alvo Pequeno* foi aplicado ao próprio Chispa, tratando o motor como a parte que se mira de longe. *Controle por Correntes* não entrou.

**Equipe/identidade:** Couraças, batedor.

**Fontes:** [Chispa](https://ordemparanormal.fandom.com/wiki/Chispa); [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças); [Tarrafa](https://ordemparanormal.fandom.com/wiki/Tarrafa); Ep3–Ep7.

---

#### 23. MIASMA

❤️ 4 | ⚔️ 1 | 🛡️ 2

**Habilidade — Grua Blindada** *(Ação · proteção)*

> Coloque o marcador de Barricada na área de Miasma ou numa área adjacente. Só pode haver 1 Barricada em jogo. Personagens na área da Barricada não podem ser alvo de ataques feitos de outra área.

**Habilidade — Obsessão** *(Passiva)*

> Aliados na área de Miasma recebem +1 Ataque.

**Habilidade — Estigma da Obsessão** *(Sacrifício)*

> Quando Miasma for derrotado, quem o derrotou recebe o Estigma da Obsessão: enquanto estiver na mesma área de um aliado, recebe +1 Defesa.

**Função:** sacrifício de apoio. Monta cobertura contra tiros e fortalece quem luta ao lado dele. Precisa ser protegido.

**Base na lore:**
- **Fato:** Miasma é o sacrifício dos Couraças, com o Estigma da Obsessão ("Testifica tua lealdade e sangra sob as mãos de teu vínculo"). Masoquista, obedece Escarlata cegamente e é arrastado por correntes. A habilidade do estigma dele é fortalecer os outros Couraças, mas isso não aparece em cena.
- **Fato (Ep7):** trancado na grua blindada, move carcaças de carro para formar barreiras. A blindagem o protege dos tiros de Cindy e da Fantasma, e a munição explosiva de Franco só racha o vidro. A dinamite do Mutilador o expõe, e ??? o mata (Ep7 @4h50m). É o 3º sacrifício do ritual.
- **Fato:** quem herda o Estigma da Obsessão aumenta as capacidades de pessoas amadas próximas. A recompensa da condição é resistência a dano para proteger quem ama.
- **Correção da nota anterior:** ele não era literalmente uma "barreira viva": operava a grua que formava as barreiras.
- **Adaptação:** a barricada funciona como cobertura contra ataques à distância. A Fantasma a ignora, como as balas curvas e a munição que trincaram o vidro. A aura de +1 Ataque representa a habilidade do estigma.

**Equipe/identidade:** Couraças. Sacrifício (Estigma da Obsessão).

**Fontes:** [Miasma](https://ordemparanormal.fandom.com/wiki/Miasma); [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); Ep5, Ep7.

---

## 6. Equipe Pássaros (somente Pomba e Harpia)

Por decisão do projeto, só **Pomba** e **Harpia** entram. Papagaio, Corvo, Coruja e a sacrifício da equipe, Suellen, ficam de fora (seção 10).

---

#### 24. POMBA

❤️ 2 | ⚔️ 1 | 🛡️ 2

**Habilidade — Cartógrafo** *(Passiva)*

> Aliados que começarem a ativação na área de Pomba podem se mover 1 área extra nessa ativação.

**Habilidade — Truque dos Pássaros** *(Reação · proteção, uma vez por partida)*

> Quando Pomba for alvo de um ataque, Pomba se move para uma área adjacente antes do ataque: o ataque não acontece.

**Habilidade — O Mais Fraco** *(Passiva)*

> Quando Pomba for derrotado, se Harpia estiver na sua equipe, Harpia pode imediatamente fazer um ataque. Se Harpia ainda estiver fora do tabuleiro, ele primeiro entra na área onde Pomba foi derrotado. Isso não gasta a ativação de Harpia.

**Função:** guia frágil. Abre caminhos para a equipe e escapa uma vez, mas não luta. A morte dele desperta Harpia.

**Base na lore:**
- **Fato:** Pomba é tratado no masculino pelas fontes: "um jovem cartógrafo". Mapeou o perímetro da Coroa de Espinhos e sabia onde ficava cada base. Mantinha um mural sobre todas as equipes (Ep6) e analisou os estigmas (Ep8).
- **Fato (Ep3–Ep5):** escapa do massacre. Kemi (Lena sem memória) o acerta nas costelas quando ele chega à mansão. Depois, os Mascarados o abrigam. O truque dos pássaros foi ensinado por Harpia: soltar os pássaros numa direção e fugir na oposta (Ep4). O desejo dele era "nunca mais ficar sozinho" (Ep5 @3h23m). Também conduziu o grupo dirigindo (Ep9, Ep10).
- **Fato (desfecho, Ep10):** o plano com Harpia era que, quando restassem seis, Pomba mataria o mais fraco para abrir a vaga de Harpia. Pomba julgou que o mais fraco era ele mesmo e se matou com a pistola de Lena (Ep10 @3h01m). Isso forçou Harpia a sair do esconderijo.
- **Interpretação:** conhecer o mapa vira mobilidade para a equipe.
- **Adaptação:** *Cartógrafo* (atalhos), *Truque dos Pássaros* (fuga) e *O Mais Fraco* (gatilho para Harpia).
- **Correção da nota anterior:** as fontes usam o masculino; "cartógrafa" foi corrigido para "cartógrafo".

**Equipe/identidade:** Pássaros; desertor desde a noite 1. Foi abrigado pelos Mascarados.

**Fontes:** [Pomba](https://ordemparanormal.fandom.com/wiki/Pomba); [Pássaros](https://ordemparanormal.fandom.com/wiki/Pássaros); [Revoada](https://ordemparanormal.fandom.com/wiki/Revoada); Ep3–Ep10.

**Pendência:** há duas versões da morte de Pomba (sozinho ou com Lena puxando o gatilho junto), e só a página dele diz que o corpo volta a se mexer no fim.

---

#### 25. HARPIA

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Escondido no Bunker** *(Passiva)*

> Harpia começa a partida fora do tabuleiro. No início de qualquer ativação dele, coloque-o em qualquer área. Se ele ainda estiver fora do tabuleiro na ativação dele na 3ª rodada, ele deve entrar nela.

**Habilidade — Rasante da Harpia** *(Passiva, uma vez por partida)*

> Uma vez por partida, em vez do movimento normal, Harpia pode se mover para qualquer área.

**Habilidade — Garra do Harpia** *(Passiva)*

> O primeiro ataque de Harpia depois de entrar no tabuleiro causa +1 ferimento e deixa o alvo Preso.

**Função:** emboscador estratégico. Fica fora da mesa até o momento certo, aparece onde quiser e prende a presa no primeiro golpe.

**Base na lore:**
- **Fato:** Harpia (Santiago Luis Borges) é o líder e estrategista dos Pássaros. Dividiu a equipe para que cada membro vigiasse uma equipe rival (Ep3).
- **Fato:** no massacre da noite 1, Raziel o derrubou com um golpe. Arrancaram o braço dele e o cravaram na própria arma, a Garra do Harpia (um rastelo), e todos passaram a achar que ele estava morto (Ep4). Ele se escondeu no Bunker do Dia 2 ao Dia 6 e montou um plano com Pomba. Usava um manto de penas como camuflagem e o truque dos pássaros. Citação: "Pássaros só capturam a sua presa se ela estiver distraída."
- **Fato (bastidores):** o *Rasante da Harpia*, com efeito parecido com teletransporte, foi revelado por Cellbit fora do jogo e nunca foi usado em cena.
- **Fato (Ep10):** depois da morte de Pomba, sai do esconderijo, prende Lena com o rastelo e a esfaqueia. Juan o descarna e Lena o mata. Ele foi o último sacrifício (Ep10 @3h13m).
- **Interpretação:** a divisão estratégica da equipe não virou habilidade, porque só ele e Pomba estão no catálogo.
- **Adaptação:** entrada surpresa; o Rasante virou um movimento livre uma vez por partida; a Garra prende o alvo, como prendeu Lena.

**Equipe/identidade:** Pássaros, líder; desertor desde a noite 1 e último sacrifício do ritual.

**Fontes:** [Harpia](https://ordemparanormal.fandom.com/wiki/Harpia); [Pássaros](https://ordemparanormal.fandom.com/wiki/Pássaros); [Pomba](https://ordemparanormal.fandom.com/wiki/Pomba); [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); Ep3, Ep4, Ep10.

---

## 7. Equipe PSIKOLERA

Banda de nu metal formada por ocultistas ligados ao Sangue, com base no Circo e instrumentos modificados como armas. Nas fontes, cada músico tem um **Bônus de Aliado**, um efeito que os companheiros usam em combate. As cartas mantêm esse traço com a marcação *Bônus de Aliado*. Só Eloy sobreviveu. O sacrifício da equipe é Caíto Rocha, que não é músico.

---

#### 26. ELOY FURTADO

❤️ 5 | ⚔️ 3 | 🛡️ 2

**Habilidade — Moeller Method** *(Ação)*

> Ataque um inimigo na área de Eloy e coloque nele o marcador de Ritmo (só um Ritmo em jogo; ao colocar um novo, retire o anterior). Enquanto o inimigo com Ritmo continuar na área de Eloy, no início de cada ativação de Eloy ele pode atacá-lo uma vez sem gastar a ação. O Ritmo sai se um dos dois deixar a área.

**Habilidade — Porrada Rítmica** *(Passiva · Bônus de Aliado)*

> Aliados na área de Eloy recebem +1 Ataque em ataques contra personagens na mesma área.

**Função:** pressão de corpo a corpo. Gruda num alvo e bate a cada rodada até alguém sair da área. Puxa o ritmo dos aliados que lutam ao lado dele. Aguenta muito, mas é fácil de acertar.

**Base na lore:**
- **Fato:** Eloy (Glauber Furtado) é o baterista e cofundador do PSIKOLERA. Com a focinheira, fica irritável e feroz. Na wiki:
  - *Moeller Method* (assim, em inglês): ele pula num alvo e o soca "como se fosse uma bateria"; o espancamento continua até o alvo passar num teste de Fortitude ou Eloy se afastar;
  - *Porrada Rítmica* (Bônus de Aliado): ele incentiva os aliados a bater "no ritmo de um tambor de guerra", dando +5 em Luta corpo a corpo, sem valer para Pontaria.
- **Fato (episódios):** no Ep7, pula em Argano e bate sem parar. Fala: "Uma bateria sem os outros instrumentos não serve pra nada!" (Ep7 @5h54m). É o personagem da série que mais vezes entrou em Morrendo; sobreviveu e foi um dos vencedores.
- **Interpretação:** "até o alvo resistir ou Eloy se afastar" vira uma pressão que só termina quando alguém sai da área.
- **Adaptação:** o marcador de Ritmo e o +1 Ataque corpo a corpo para aliados. A Vida alta representa as várias vezes em que ele sobreviveu à beira da morte.
- **Correção da nota anterior:** o nome oficial está em inglês ("Moeller Method"). O tambor de guerra é só uma imagem, e não existe bônus pela simples presença de um aliado: a *Porrada Rítmica* é um bônus que os aliados usam no corpo a corpo.

**Equipe/identidade:** PSIKOLERA (bateria). Termina como desertor e um dos vencedores, ao lado dos Mascarados.

**Fontes:** [Eloy Furtado](https://ordemparanormal.fandom.com/wiki/Eloy_Furtado); [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA); [Argano](https://ordemparanormal.fandom.com/wiki/Argano); Ep4, Ep7–Ep10.

---

#### 27. CINDY LOPES

❤️ 3 | ⚔️ 3 | 🛡️ 2

**Habilidade — Fuzil Baixo** *(Passiva)*

> Cindy pode atacar inimigos a até 2 áreas de distância, mas não pode atacar inimigos na própria área.

**Habilidade — Tiros de Aviso** *(Reação · Bônus de Aliado)*

> Quando o ataque de um aliado contra um inimigo a até 2 áreas de Cindy errar, esse inimigo sofre 1 ferimento mesmo assim, causado por Cindy.

**Habilidade — Silenciar** *(Ação)*

> Escolha um inimigo a até 2 áreas de distância: ele fica Silenciado.

**Função:** cobertura ofensiva. Atira de longe, garante que o ataque de um aliado contra um alvo resistente cause dano mesmo assim e cala habilidades inimigas. Precisa manter distância.

**Base na lore:**
- **Fato:** Cindy (Cristiene Lopes) é a baixista e líder do PSIKOLERA. A arma dela é o *Fuzil Baixo*, um fuzil modificado e acoplado a um baixo, usado em shows e em combate.
  - No Ep4, atira em Ana e Chispa dançando no alto de um cânion.
  - No Ep7, fica no alto ao lado de Kemi, tentando acertar a grua.
- **Fato:** habilidades na wiki:
  - *Silenciar*: grita para um alvo exigindo silêncio; ele perde determinação, sofre penalidade em Força e Agilidade e fica trêmulo;
  - *Tiros de Aviso* (Bônus de Aliado): quando um aliado usa o bônus, ela causa dano extra no inimigo que ele atacar, mesmo se errar.
  - As fontes não mostram cenas com esses nomes.
- **Fato:** planejou com Giovanni a morte de Andrei Colfas. Raziel a mata na igreja (Ep9 @6h39m).
- **Interpretação:** é uma atiradora que prefere terreno alto e distância.
- **Adaptação:** alcance 2, sem atacar na própria área. *Tiros de Aviso* transforma um erro em ferimento; *Silenciar* aplica a condição Silenciado.

**Equipe/identidade:** PSIKOLERA (baixo), líder.

**Fontes:** [Cindy Lopes](https://ordemparanormal.fandom.com/wiki/Cindy_Lopes); [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA); [Andrei Colfas](https://ordemparanormal.fandom.com/wiki/Andrei_Colfas); Ep4, Ep7–Ep9.

---

#### 28. CAIO TELES

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Berrão** *(Ação)*

> Ataque um inimigo na área de Caio. Se acertar, o alvo escolhe: fica Atordoado ou sofre +1 ferimento.

**Habilidade — Barulheira** *(Reação · Bônus de Aliado · proteção)*

> Quando um inimigo atacar um aliado na área de Caio, esse ataque recebe −1 Ataque.

**Função:** interferência sonora. Obriga o alvo a escolher entre perder a próxima ação ou apanhar mais, e atrapalha quem ataca os aliados ao lado dele.

**Base na lore:**
- **Fato:** Caio Teles é o vocalista que substituiu Andrei. Usa a *Espada Microfone*, uma espada com arame farpado e um microfone adaptado; a máscara dele é uma placa de "Pare". Na wiki:
  - *Berrão*: ele crava a espada no chão e grita no microfone colado ao ouvido do alvo; causa dano e obriga o alvo a soltar o que segura; o alvo pode tapar os ouvidos para resistir em parte;
  - *Barulheira* (Bônus de Aliado): o grito atrapalha um inimigo e tira um dado dos ataques contra os aliados;
  - *Corte na Jugular* (Bônus de Aliado): só depois de perder a voz.
- **Fato (episódios):** no Ep7, grita no Mercado Central para manter o Quibungo longe. No Ep8, crava o pedestal e grita no ouvido de Aguiar, que solta Cindy e tapa os ouvidos. Vive falando do curso de seis meses de primeiros socorros que fez, mas nenhuma cena mostra o uso. Morre na igreja: Raziel rasga a garganta dele e o Mutilador o decapita (Ep9 @6h43m).
- **Distinção:** Caio Teles **não** é Caio Leal (agente da Ordo Realitas), nem Caio Santiago (protagonista de um conto), nem Caíto Rocha (o sacrifício do PSIKOLERA).
- **Adaptação:** no *Berrão*, a escolha do alvo representa soltar a arma ou aguentar o grito. A *Barulheira* virou −1 Ataque. Os primeiros socorros não viraram mecânica, por falta de uso em cena. *Corte na Jugular* não entrou.

**Equipe/identidade:** PSIKOLERA (vocal).

**Fontes:** [Caio Teles](https://ordemparanormal.fandom.com/wiki/Caio_Teles); [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA); [Jasper](https://ordemparanormal.fandom.com/wiki/Jasper); Ep6–Ep9.

---

#### 29. FRANCO

❤️ 3 | ⚔️ 3 | 🛡️ 2

**Habilidade — Guitarra Lança-Chamas** *(Ação)*

> Escolha a área de Franco ou uma área adjacente e faça um ataque separado contra cada outro personagem nela, inclusive aliados. Franco não pode usar esta habilidade em duas ativações seguidas.

**Habilidade — Fogo em Geral** *(Passiva · Bônus de Aliado)*

> Uma vez por rodada, quando um aliado acertar um inimigo na área de Franco, esse inimigo sofre +1 ferimento.

**Função:** pressão em grupo. Pune inimigos amontoados, mas queima também os aliados que estiverem na área, e precisa recuperar o fôlego entre um jato e outro.

**Base na lore:**
- **Fato:** Franco, 19 anos, é o guitarrista e o responsável pela pirotecnia da banda.
  - Arma: a *Guitarra Lança-Chamas*, com um lança-chamas saindo da parte de baixo.
  - Máscara: uma máscara de gás ligada a um tanque, que prejudicou os pulmões dele.
  - Montou as defesas do Circo: canhões que cospem fogo e chamas na entrada (Ep7). Deu ao grupo uma munição explosiva (Ep7).
- **Fato:** o Bônus de Aliado dele, *Fogo em Geral*, deixa um inimigo "Em chamas" quando um aliado usa o bônus. Fala: "Eu acho que só quero ver o mundo queimar." (Ep7 @3h38m).
- **Fato (Ep7):** ao ver os Vampiros, liga os canhões e usa o lança-chamas na entrada. Raziel atravessa as chamas e o decapita (Ep7 @3h51m).
- **Correção da nota anterior:** o bônus oficial afeta um único inimigo. O fogo em área vem das defesas do Circo, não de uma habilidade com nome.
- **Adaptação:** ataque em área com fogo amigo. A proibição de usar em ativações seguidas representa os pulmões prejudicados.

**Equipe/identidade:** PSIKOLERA (guitarra).

**Fontes:** [Franco](https://ordemparanormal.fandom.com/wiki/Franco); [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA); [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); Ep4, Ep7.

---

#### 30. ALÊ

❤️ 3 | ⚔️ 1 | 🛡️ 2

**Habilidade — Cicatrização** *(Ação)*

> Remova 2 ferimentos de um aliado na área de Alê (exceto Alê). Depois, coloque Atordoado em Alê.

**Habilidade — Proteção Sigilosa** *(Ação · proteção)*

> Até o início da próxima ativação de Alê, os outros aliados na área de Alê não sofrem ferimentos de ataques. O efeito termina na hora se Alê sofrer um ferimento.

**Habilidade — Prever Resultados** *(Passiva · Bônus de Aliado)*

> Uma vez por rodada, um aliado a até 1 área de distância de Alê recebe +1 Ataque em um ataque.

**Função:** apoio de retaguarda. Cura muito, mas fica exausta depois. Pode blindar um grupo por uma rodada, desde que ninguém consiga feri-la. Quase não luta.

**Base na lore:**
- **Fato:** Alê, tecladista (keytar) e ocultista, ensinou o paranormal à banda e fez as máscaras de todos. É uma pessoa não binária, que aceita qualquer pronome. Por ordem de Cindy, ficava na base protegendo Caíto, e era a médica da equipe. Na wiki:
  - *Cicatrização Discente* (ritual): com a máscara e o teclado, toca uma melodia ao contrário, e o alvo cicatriza enquanto a pele se enruga;
  - *Proteção Sigilosa* (ritual): sigilos dourados de Conhecimento protegem uma área ou um objeto; exige melodia constante e se desfaz se a máscara cair;
  - *Prever Resultados* (Bônus de Aliado): permite que os aliados rolem de novo um dado de um teste.
- **Fato (episódios):** lê a mão de Kemi e diz as palavras de intenção dela (Ep4 @3h37m). No Ep7, cura a perna de Franco e as feridas de Dalmo e fica muito cansada; ergue a Proteção Sigilosa em volta do globo de Caíto; Zéfero a mata enquanto ela mantém a proteção (Ep7 @4h04m).
- **Adaptação:** o cansaço depois de curar virou Atordoado, o que impede cura infinita. A proteção cai se Alê for ferida, como na cena com Zéfero.
- **Correção da nota anterior:** *Prever Resultados* não prevê ataques; vale para rolar de novo um dado em qualquer teste. Como o TCG não tem dados, virou um +1 Ataque.

**Equipe/identidade:** PSIKOLERA (teclado).

**Fontes:** [Alê](https://ordemparanormal.fandom.com/wiki/Alê); [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA); [Zéfero](https://ordemparanormal.fandom.com/wiki/Zéfero); Ep4, Ep7.

---

#### 31. CAÍTO ROCHA

❤️ 3 | ⚔️ 2 | 🛡️ 2

**Habilidade — Globo da Morte** *(Passiva · proteção)*

> Enquanto houver pelo menos 2 aliados na área de Caíto, ele não pode ser alvo de ataques feitos de outra área.

**Habilidade — Ódio Suprimido** *(Reação)*

> Quando Caíto sofrer um ferimento ou ficar Atordoado ou Preso, ele pode explodir de raiva: faça imediatamente um ataque com +1 Ataque contra qualquer personagem na área dele, inclusive um aliado. Depois, coloque Atordoado em Caíto.

**Habilidade — Estigma do Rancor** *(Sacrifício)*

> Quando Caíto for derrotado, quem o derrotou recebe o Estigma do Rancor: depois que esse personagem derrotar outro personagem, os ataques dele causam +1 ferimento até o fim da rodada.

**Função:** sacrifício exigente. Só fica seguro cercado de defensores, explode de raiva quando é ferido ou contido (acertando inclusive a própria equipe) e entrega a quem o derrota um prêmio para emendar mortes.

**Base na lore:**
- **Fato:** Caíto Rocha tem 18 ou 19 anos (as fontes divergem). Não é músico, nem fã da banda: "nem conhece direito a banda" (Ep4). É o sacrifício do PSIKOLERA, com o Estigma do Rancor ("Liberta tua cólera primordial e aniquila a díade"), e, como todo sacrifício, já foi receptáculo do Diabo. Usa um revólver .38.
- **Fato:** fica num trono dentro de um globo da morte modificado, com espinhos. No Ep4, exige água e comida e ameaça se matar com o revólver. No Ep7, exige pelo menos quatro defensores, e Alê o protege com a *Proteção Sigilosa*.
- **Fato:** o poder de sacrifício dele é *Ódio Suprimido*. Ao explodir de raiva, assume uma forma demoníaca e avança em qualquer pessoa para feri-la; quando a explosão acaba, fica exausto. Usos:
  - Ep7: quando Henri o agarra pelo pescoço;
  - Ep8: sob a *Perturbação* de Henri, transforma-se e larga a arma; depois morde Eloy.
- **Fato (Ep8):** os Mascarados o sequestram com a ajuda de Eloy e o entregam a Cristino no bunker, em troca de Pomba. Cristino, irritado com o barulho, corta a garganta dele com a peixeira (Ep8 @6h13m). O sangue de Caíto abre a porta da verdadeira Coroa de Espinhos, e a morte dele transforma Cindy, Caio e Eloy em desertores.
- **Fato:** quem herda o Estigma do Rancor ganha uma forma monstruosa que libera o ódio em todos ao redor. A condição depois da morte do sacrifício é matar duas pessoas no mesmo dia, e a recompensa é causar mais dano.
- **Interpretação:** o globo e a exigência de quatro defensores fazem dele uma peça que só fica segura com escolta.
- **Adaptação:** *Globo da Morte* (2 aliados bloqueiam os tiros), *Ódio Suprimido* (ataque de raiva seguido de exaustão) e *Estigma do Rancor* (recompensa por emendar mortes, a "díade").
- **Pendência:** as fontes divergem sobre quem jogou Caíto aos pés de Cristino: Eloy, segundo o resumo do Ep8, ou Aguiar, segundo as páginas de Jasper e de Henri/Juan.
- **Distinção:** Caíto Rocha **não** é Caio Teles, o vocalista.

**Equipe/identidade:** PSIKOLERA. Sacrifício (Estigma do Rancor).

**Fontes:** [Caíto Rocha](https://ordemparanormal.fandom.com/wiki/Caíto_Rocha); [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA); [Cristino](https://ordemparanormal.fandom.com/wiki/Cristino); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); [Juan](https://ordemparanormal.fandom.com/wiki/Juan); Ep4, Ep7, Ep8.

---

## 8. Equipe Transtornados

Membros do culto de Giovanni, mais quem foi colocado na equipe à força para completar as vagas (Cleo, Cristino) e o sacrifício, Nando. A base era o Mercado Central. Nenhum deles sobreviveu.

---

#### 32. GIOVANNI OPSPOR

❤️ 3 | ⚔️ 1 | 🛡️ 2

**Habilidade — Espelho** *(Passiva e Ação)*

> **Passiva:** Giovanni não começa no tabuleiro. No início da partida, coloque 3 fichas iguais em áreas diferentes; uma delas tem um sinal no lado virado para a mesa e representa Giovanni, as outras são Clones. Na ativação de Giovanni, escolha uma ficha, mova-a até 1 área e realize a ação de Giovanni a partir dela. As fichas só podem ser afetadas por ataques (com a Defesa de Giovanni) e pelo Olho; efeitos de área e ferimentos sem ataque as ignoram. Quando uma ficha for atacada ou estiver na área do Olho, revele-a: se for um Clone atacado, ele é destruído e o ataque não tem outro efeito; se for um Clone revelado pelo Olho, ele fica com a face para cima até ser destruído; se for Giovanni, coloque a carta no lugar e, se foi atacado, resolva o ataque normalmente. Depois de revelado, Giovanni age como um personagem comum.
>
> **Ação:** coloque um novo Clone virado para baixo na área de um dos seus marcadores (máximo de 3 marcadores em jogo). Você pode embaralhar em segredo os marcadores dessa área.

**Habilidade — Informação Vale Mais** *(Ação)*

> Escolha um inimigo a até 1 área de distância de qualquer marcador seu ou de Giovanni. Até o fim da rodada, seus aliados recebem +1 Ataque contra ele.

**Função:** estrategista escondido. Ninguém sabe onde ele está de verdade. Sobrevive pelo blefe e ajuda a equipe apontando alvos. Se for encontrado sem clones, cai rápido.

**Base na lore:**
- **Fato:** Giovanni é o líder do culto e da equipe Transtornados. A estratégia dele era ficar recluso e vencer "com informações, não com força bruta".
- **Fato:** o ritual *Espelho* cria clones de carne que percorrem longas distâncias para colher informações ou falar com outras equipes, servindo de proteção. Os clones podem ter a aparência dele ou de conhecidos (um clone disfarçado de Cleo, no Ep8), mas falam com atraso e se desfazem.
- **Fato (episódios):**
  - no Ep5, o "Giovanni" em campo era um manequim de carne, que derreteu quando ele virou desertor;
  - fez pactos de neutralidade com os Mascarados e o PSIKOLERA;
  - antes do ritual, contratou uma assassina para matar Andrei, a pedido de Cindy;
  - no Ep10, aparece em pessoa, sem a gaiola e sem clones, e Remi o carboniza (Ep10 @2h05m).
- **Correção da nota anterior:** "escapar de situações fatais" não está nas fontes. Os clones são descritos como proteção e meio de contato, e no dia final ele morre justamente quando já não tem clones.
- **Adaptação:** o blefe com marcadores representa não saber onde está o verdadeiro Giovanni, e o Clone destruído no lugar dele é a proteção. O *Capturar Momento* de Labirinto revela esses marcadores.

**Equipe/identidade:** Transtornados, líder.

**Fontes:** [Giovanni Opspor](https://ordemparanormal.fandom.com/wiki/Giovanni_Opspor); [Equipe Transtornados](https://ordemparanormal.fandom.com/wiki/Equipe_Transtornados); [Andrei Colfas](https://ordemparanormal.fandom.com/wiki/Andrei_Colfas); Ep2–Ep10.

---

#### 33. CRISTINO

❤️ 4 | ⚔️ 3 | 🛡️ 3

**Habilidade — Espingarda Socadeira** *(Passiva)*

> Cristino pode atacar inimigos a até 1 área de distância.

**Habilidade — Lampiões Explosivos** *(Ação)*

> Coloque o marcador de Lampião numa área a até 1 área de distância (só 1 Lampião em jogo). No início de qualquer ativação de Cristino, ele pode detoná-lo: cada personagem nessa área sofre 1 ferimento. Isso não é um ataque. Depois, retire o marcador.

**Habilidade — Não é Pessoal** *(Passiva)*

> Cristino não é afetado por habilidades de aliados, e as habilidades dele nunca afetam aliados de forma positiva.

**Função:** atirador solitário. Atira de perto e prepara explosões que forçam o inimigo a sair da área ou pagar o preço. Joga ao lado da equipe, mas não com ela.

**Base na lore:**
- **Fato:** Cristino é um cangaceiro. Entrou na equipe "integrado à força pelo evento" e não queria participar do jogo. Veio a pé para cumprir a promessa da família de pegar a criatura, o Quibungo, e recuperar o medalhão de Tenebris. Depois, passou a buscar "a Promessa".
- **Fato:** o arsenal dele é a *Espingarda Socadeira* (com espinhos na coronha, serve também de bastão), a *Peixeira* e os *Lampiões Explosivos*.
- **Fato (episódios):**
  - Ep5: com Jae e Labirinto, monta uma trilha de lamparinas por onde o Quibungo pula; Cristino atira nos barris e provoca uma explosão;
  - Ep8: sequestra Pomba e mata Caíto com a peixeira;
  - Ep9: atira em Alvira do alto da igreja, corta um braço de Raziel e vai embora, porque "cumpriu sua palavra";
  - Ep10: atira no coração de Argano, é preso pela corrente do Crânio Dominador e descarnado por Juan (Ep10 @2h56m).
  - Fala: "Não é pessoal, e eu já disse que não me importo com os joguinhos de vocês." (Ep8 @5h04m).
- **Correção da nota anterior:** o objetivo real era o medalhão e, depois, a Promessa. Ele também não ficou passivo: sequestrou Pomba e matou Caíto. Nenhuma habilidade dele tem nome oficial; tiro, alcance e explosivos vêm do arsenal.
- **Adaptação:** alcance 1 com a espingarda, o lampião como explosivo com atraso (como a isca do Quibungo) e *Não é Pessoal* como desvantagem de equipe.

**Equipe/identidade:** Transtornados, integrado à força.

**Fontes:** [Cristino](https://ordemparanormal.fandom.com/wiki/Cristino); [Quibungo](https://ordemparanormal.fandom.com/wiki/Quibungo); [Equipe Transtornados](https://ordemparanormal.fandom.com/wiki/Equipe_Transtornados); Ep3–Ep10.

---

#### 34. MOSTO

❤️ 5 | ⚔️ 3 | 🛡️ 3

**Habilidade — Trocação Justa** *(Ação)*

> Só pode ser usada se Mosto tiver pelo menos 1 ferimento (o saco de pão já caiu). Escolha um inimigo na área de Mosto: cada um dos dois sofre 1 ferimento, ao mesmo tempo, causado pelo outro. Isso não é um ataque e ignora a Defesa.

**Habilidade — Guarda-Costas** *(Reação · proteção)*

> Quando Giovanni, ou um marcador de Giovanni, na área de Mosto for alvo de um ataque, Mosto pode se tornar o alvo desse ataque.

**Função:** brigão de trocação. Quando já está sangrando, troca golpe por golpe com qualquer um, ignorando armaduras. Protege o chefe com o próprio corpo.

**Base na lore:**
- **Fato:** Mosto é ex-lutador do submundo, segurança do The Monica Club e o "faz tudo e guarda-costas" de Giovanni, a quem é extremamente leal. Foi desfigurado pelo verdadeiro Dalmo (o Colosso) numa luta de arena antes do ritual e esconde o rosto com um saco de pão. Usa um cutelo de açougueiro.
- **Fato:** a habilidade *Trocação Justa* chama o alvo para uma luta de mãos em que ninguém faz teste de ataque: todos os golpes acertam. Ela só é liberada quando tiram o saco de pão da cabeça dele.
- **Fato (episódios):** no Ep4, grita "COLOSSO... EU VIM TE BUSCAR." No Ep5:
  1. uma cabeçada solta o saco;
  2. começa a trocação justa;
  3. o cutelo quebra o visor do Colosso;
  4. o Colosso o mata com pisões (Ep5 @1h30m).
- **Correção da nota anterior:** o nome do local é **The Monica Club**. Quem desfigurou Mosto foi o Dalmo original, não Tuco.
- **Adaptação:** a *Trocação Justa* virou uma troca automática de ferimentos, liberada depois do primeiro ferimento, quando o saco cai. *Guarda-Costas* representa a lealdade a Giovanni.

**Equipe/identidade:** Transtornados.

**Fontes:** [Mosto](https://ordemparanormal.fandom.com/wiki/Mosto); [Dalmo Magno](https://ordemparanormal.fandom.com/wiki/Dalmo_Magno); [Equipe Transtornados](https://ordemparanormal.fandom.com/wiki/Equipe_Transtornados); Ep2, Ep4, Ep5.

---

#### 35. TARRAFA

❤️ 3 | ⚔️ 2 | 🛡️ 2

**Habilidade — Engolir Metal** *(Ação)*

> Retire do jogo um marcador (Armadilha, Barricada, Lampião, Olho, Marca X ou Clone) que esteja na área de Tarrafa.

**Habilidade — Pacto: Zumbi Espinhento** *(Passiva)*

> Quando Tarrafa for derrotado pela primeira vez, retire os ferimentos dele e gire a carta de lado na mesma área. Ele volta como Zumbi Espinhento, com ❤️ 2 | ⚔️ 3 | 🛡️ 2 e sem outras habilidades. Se o Zumbi for derrotado, retire a carta do jogo.

**Função:** utilidade e incômodo. Desmonta armadilhas, barricadas e blefes, e obriga o inimigo a derrotá-lo duas vezes.

**Base na lore:**
- **Fato:** Tarrafa era um pescador. Segundo a biografia (sem referência de episódio), fez um pacto com o Diabo e voltou à praia com a rede cheia. É membro dos Transtornados.
- **Fato (episódios):**
  - no Ep2, engole a chave da sala de Giovanni e depois a vomita;
  - no Ep3, tenta comer o metal dos veículos dos Couraças, é empalado por Chispa, vomita metal e Jae o finaliza;
  - o corpo vira um Zumbi Espinhento, porque ele morreu num local com a Membrana enfraquecida, e Aguiar o destrói com o machado e o arpão (Ep3 @2h07m).
- **Fato:** o arsenal dele tem o *Arpão do Pescador* e uma *Faca*, mas nenhuma cena o mostra usando os dois.
- **Correção da nota anterior:** arpão e faca estão no arsenal, mas não há uso em cena; o arpão foi usado por Aguiar, depois da morte de Tarrafa. A equipe dele é a dos **Transtornados**, não a dos Vampiros.
- **Adaptação:** *Engolir Metal* remove marcadores, e o retorno como zumbi aparece com a carta girada.

**Equipe/identidade:** Transtornados.

**Fontes:** [Tarrafa](https://ordemparanormal.fandom.com/wiki/Tarrafa); [Zumbi Espinhento](https://ordemparanormal.fandom.com/wiki/Zumbi_Espinhento); [Chispa](https://ordemparanormal.fandom.com/wiki/Chispa); Ep2, Ep3.

---

#### 36. CLEO BRISA

❤️ 3 | ⚔️ 3 | 🛡️ 2

**Habilidade — Emboscada** *(Reação)*

> Quando um inimigo entrar na área de Cleo, ela pode atacá-lo imediatamente e, depois, se mover 1 área.

**Habilidade — Eu Sei Quem Você É** *(Passiva)*

> Cleo recebe +1 Ataque contra personagens que estejam usando uma Máscara.

**Função:** investigadora acuada. Ataca quem chega perto e foge em seguida. Sabe reconhecer os assassinos mascarados.

**Base na lore:**
- **Fato:** Cleo Brisa é investigadora da Polícia Civil de Inquisidor do Vale e colega de Aguiar, que ela investigava em segredo como o Mutilador Noturno.
- **Fato (episódios):**
  - Ep2: segue Aguiar até o The Monica Club; Mosto a carrega para dentro e a joga no portal. Assim, ela entra à força nos Transtornados, no lugar de Carrara;
  - Ep6: na Casa de Taipa, acerta Jae com um pé de cabra e aponta a pistola para Aguiar: "Eu sei que você é a porra do Mutilador Noturno!" (Ep6 @4h36m). É desarmada, solta e foge;
  - depois, é capturada e torturada por Velisar e transformada à força em vampira;
  - Ep9: Velisar a apresenta como sua obra-prima, uma armadilha ambulante, e ela explode quando Remi a toca (Ep9 @5h56m).
- **Correção da nota anterior:** Cleo era da equipe **Transtornados**, não dos Vampiros. O nome oficial do ritual é *Armadilha Sanguinária*, de Velisar; "armadilha de sangue" não é o nome.
- **Adaptação:** emboscada seguida de fuga, e um bônus contra personagens mascarados. A explosão do Ep9 está na carta de Velisar.

**Equipe/identidade:** Transtornados, integrada à força.

**Fontes:** [Cleo Brisa](https://ordemparanormal.fandom.com/wiki/Cleo_Brisa); [Velisar](https://ordemparanormal.fandom.com/wiki/Velisar); [Vampiros](https://ordemparanormal.fandom.com/wiki/Vampiros); Ep1, Ep2, Ep6, Ep9.

---

#### 37. NANDO SALLES

❤️ 3 | ⚔️ 2 | 🛡️ 2

**Habilidade — Arrogância Diabólica** *(Ação)*

> Escolha um inimigo a até 1 área de distância e um alvo para o desafio: o próprio Nando ou um aliado de Nando que esteja na área desse inimigo. Na próxima ativação, o inimigo deve atacar o alvo do desafio; se não atacar, por qualquer motivo, sofre 1 ferimento causado por Nando.

**Habilidade — Estigma do Orgulho** *(Sacrifício)*

> Quando Nando for derrotado, quem o derrotou recebe o Estigma do Orgulho: enquanto não tiver ferimentos, recebe +1 Ataque.

**Função:** sacrifício provocador. Força lutas que interessam à equipe dele, mas é frágil e entrega um prêmio a quem o derrota.

**Base na lore:**
- **Fato:** Nando Salles era influenciador de finanças, apostador e o "fã número 1" do Colosso. É o sacrifício dos Transtornados, com o Estigma do Orgulho ("Abata incólume o indigno que ousaria te flagelar").
- **Fato:** o poder de sacrifício dele é a *Arrogância Diabólica*: desafia um alvo e o provoca até uma vergonha quase física; se o alvo recusar o desafio, sofre dano.
- **Fato (episódios):**
  - Ep4: dá um tapa no rosto de Dalmo e diz "Eu sou o Nando! Eu nunca vou morrer!" (Ep4 @1h56m);
  - Ep5: usa a Arrogância Diabólica para chamar Dalmo de covarde e fazê-lo lutar com Mosto. Nos bastidores, Cellbit revelou que Nando também usava o poder para jogar Mosto contra Dalmo (Ep11 @58m);
  - Ep5: atira em Henri. Kemi (Lena) pega a arma dele e o executa (Ep5 @1h18m). Foi o 2º sacrifício. A Pistola Transtornada fica com Lena.
- **Correção da nota anterior:** Nando é dos **Transtornados**, não dos Vampiros. Ninguém herdou o estigma dele, porque ele morreu à noite, como sacrifício regular.
- **Adaptação:** o desafio obriga o inimigo a atacar um alvo escolhido. O Estigma do Orgulho vai para quem o derrota.

**Equipe/identidade:** Transtornados. Sacrifício (Estigma do Orgulho).

**Fontes:** [Nando Salles](https://ordemparanormal.fandom.com/wiki/Nando_Salles); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); [Mosto](https://ordemparanormal.fandom.com/wiki/Mosto); Ep4, Ep5, Ep11.

---

## 9. Equipe Vampiros

Os "Monstruosos de Sangue" da Igreja Antiga, liderados por Raziel. Fizeram o primeiro sacrifício, ao massacrar os Pássaros, e foram a única equipe sem nenhum sobrevivente no último dia: todos morreram na noite 5 (Ep9).

---

#### 38. RAZIEL

❤️ 6 | ⚔️ 4 | 🛡️ 3

**Habilidade — Turno Extra** *(Passiva)*

> Raziel é ativado duas vezes por rodada. Cada ativação segue as regras normais, inclusive o movimento.

**Habilidade — Endurecer Sangue** *(Reação · proteção, uma vez por partida)*

> Quando Raziel for atingido por um ataque, ignore os ferimentos desse ataque.

**Habilidade — Sede Incontrolável** *(Passiva, obrigatória)*

> Se houver um personagem, aliado ou inimigo, com 1 de Vida restante na área de Raziel ou numa área adjacente, Raziel deve se mover até ele e atacá-lo na próxima ativação.

**Função:** chefe predador. Age duas vezes por rodada e derruba qualquer um, mas a sede o arrasta para quem está morrendo, mesmo que seja um aliado. Isso permite atraí-lo para armadilhas.

**Base na lore:**
- **Fato:** Raziel é o líder dos Vampiros: um aristocrata cortês que ataca com garras e mordidas, com 390 PV. Habilidades na wiki:
  - *Turno Extra*: dois turnos por rodada;
  - *Endurecer Sangue*: endurece o próprio sangue e ganha resistência a qualquer dano;
  - *Sede Incontrolável*: na forma bestial, não consegue deixar de devorar um corpo que esteja morrendo por perto;
  - também *Bote Retalhador*, *Maldição Sanguínea* e *Vampirismo*.
  - Ele tinha duas fichas: a elegante e a da forma verdadeira.
- **Fato (episódios):**
  - Ep7: atravessa as chamas, decapita Franco (Ep7 @3h51m), perfura o estômago do Colosso, usa Endurecer Sangue e morde Henri;
  - Ep8: mata Damir e herda o Estigma da Culpa (Ep8 @6h21m). Pela regra do ritual, quem mata o segundo sacrifício do mesmo dia herda o estigma;
  - Ep9: revela a forma verdadeira, tomado pela sede mata Cindy e Maria, e Juan o mata e o devora (Ep9 @7h06m).
- **Interpretação:** a nota anterior dizia que a forma verdadeira é "mais perigosa". As fontes descrevem uma forma bestial com ficha própria, mas não dizem isso com essas palavras.
- **Adaptação:** *Turno Extra* virou duas ativações. *Endurecer Sangue* ficou limitado a uma vez por partida. *Sede Incontrolável* virou uma compulsão. A herança da Culpa acontece pela carta de Damir.

**Equipe/identidade:** Vampiros, líder e herdeiro do sacrifício (Estigma da Culpa).

**Fontes:** [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); [Vampiros](https://ordemparanormal.fandom.com/wiki/Vampiros); [Damir Lukic](https://ordemparanormal.fandom.com/wiki/Damir_Lukic); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); Ep7–Ep9.

---

#### 39. ALVIRA

❤️ 4 | ⚔️ 2 | 🛡️ 3

**Habilidade — Bolsa do Sangue** *(Ação)*

> Alvira sofre 1 ferimento e remove 2 ferimentos de outro personagem a até 1 área de distância (pode ser um inimigo). Coloque nesse personagem o marcador de Sangue.

**Habilidade — Titereira de Sangue** *(Passiva)*

> No início de cada ativação de Alvira, ela pode deslocar um personagem com o marcador de Sangue que esteja a até 2 áreas dela. Esse personagem pode retirar o marcador no início da própria ativação, sofrendo 1 ferimento.

**Função:** curandeira e titereira. Mantém aliados vivos com o próprio sangue e pode "comprar" um inimigo curando-o, para depois arrastá-lo pelo mapa.

**Base na lore:**
- **Fato:** Alvira, "a Primeira Vampira", é a curandeira da equipe. Fica na retaguarda e só age quando Raziel manda. Carrega o Cajado da Cruz de Sangue. Habilidades na wiki:
  - *Bolsa do Sangue*: usa o próprio sangue para recuperar PV de um alvo e pode tirá-lo de Morrendo;
  - *Titereira de Sangue*: controla quem bebeu o sangue dela; o alvo pode cortar as "cordas", mas sofre dano;
  - *Transferir Sangue*: agarra-se a um aliado e o cura com o próprio sangue;
  - *Vampirismo*.
- **Fato (episódios):**
  - Ep7: por ordem de Raziel, abre o braço e salva Henri da morte;
  - Ep8: fura Damir com hastes de metal e bebe o sangue dele;
  - Ep9: dá o próprio sangue para manter Raziel vivo; prende Juan "como uma marionete" pelo sangue que tinha dado a ele e o obriga a atacar Cristino; morre pela Rajada Caótica de Remi (Ep9 @6h54m).
- **Confirmação:** tudo o que a nota anterior dizia está confirmado (primeira vampira, cura com o próprio sangue, tentativa de salvar Raziel, morte pela Rajada Caótica de Remi).
- **Adaptação:** a cura marca o alvo; a marionete reposiciona quem bebeu o sangue; cortar as cordas custa 1 ferimento.

**Equipe/identidade:** Vampiros.

**Fontes:** [Alvira](https://ordemparanormal.fandom.com/wiki/Alvira); [Vampiros](https://ordemparanormal.fandom.com/wiki/Vampiros); [Juan](https://ordemparanormal.fandom.com/wiki/Juan); [Remi](https://ordemparanormal.fandom.com/wiki/Remi); Ep7–Ep9.

---

#### 40. SABARA

❤️ 3 | ⚔️ 3 | 🛡️ 3

**Habilidade — Batedora** *(Passiva)*

> Antes da primeira rodada, depois que todos os personagens forem posicionados, Sabara pode se mover até 2 áreas.

**Habilidade — Aparar e Revidar** *(Reação · proteção)*

> Quando Sabara for atingida por um ataque de um personagem na mesma área, se o Ataque dela for igual ou maior que o Ataque do atacante, ela anula o ataque e o atacante sofre 1 ferimento.

**Habilidade — Dança das Lâminas** *(Ação)*

> Ataque um inimigo em uma área adjacente.

**Função:** batedora duelista. Chega primeiro, atira lâminas à distância e pune quem tenta enfrentá-la no corpo a corpo sem ser mais forte do que ela.

**Base na lore:**
- **Fato:** Sabara (Fenna) é a batedora dos Vampiros: saía de dia atrás de recursos e de presas. Localizou o acampamento dos Pássaros no Dia 1 e, na noite 1, prendeu Papagaio no chão com lâminas e matou Coruja. Usa a Adaga Cerimonial, uma Espada mais letal contra quem está sangrando, facas nos cintos e óculos de caça de lentes vermelhas. Habilidades na wiki:
  - *Dança das Lâminas*: gira e atira várias adagas;
  - *Aparar e Revidar*: uma vez por rodada, apara um golpe corpo a corpo contra-atacando; se vencer, não sofre dano e fere o agressor.
- **Fato (episódios):**
  - Ep4: embosca Aguiar e Henri no cânion, corta o pescoço de Aguiar e o morde; o Mutilador a mata (Ep4 @5h29m);
  - Ep6: Velisar usa a cabeça dela como armadilha;
  - Ep9: Lena usa os óculos dela.
- **Confirmação:** tudo o que a nota anterior dizia está confirmado.
- **Adaptação:** o "aparar" virou uma comparação de Ataque, sem sorteio. Por isso só atacantes mais fortes que ela, como o Mutilador, passam.

**Equipe/identidade:** Vampiros, batedora.

**Fontes:** [Sabara](https://ordemparanormal.fandom.com/wiki/Sabara); [Vampiros](https://ordemparanormal.fandom.com/wiki/Vampiros); [Pássaros](https://ordemparanormal.fandom.com/wiki/Pássaros); [Jasper](https://ordemparanormal.fandom.com/wiki/Jasper); Ep3, Ep4, Ep6, Ep9.

---

#### 41. VELISAR

❤️ 4 | ⚔️ 3 | 🛡️ 2

**Habilidade — Olhar da Curiosidade Mórbida** *(Ação)*

> Escolha um inimigo a até 1 área de distância. Ele escolhe: encara Velisar e fica Atordoado, ou desvia o olhar e recebe −1 Ataque até o fim da próxima ativação dele.

**Habilidade — Armadilha Sanguinária** *(Ação)*

> Coloque o marcador de Armadilha Sanguinária em um personagem de qualquer lado a até 1 área de distância (só 1 em jogo). Quando esse personagem for atacado por um inimigo de Velisar ou for derrotado, a armadilha explode: cada outro personagem na área dele sofre 1 ferimento. Depois, retire o marcador.

**Função:** diplomata cruel. Paralisa ou enfraquece com o olhar e transforma corpos (até os de aliados) em bombas, punindo quem se agrupa.

**Base na lore:**
- **Fato:** Velisar é o diplomata e rastreador dos Vampiros: sádico, cordial, e quem segura a corrente de Zéfero. Rituais na wiki:
  - *Olhar da Curiosidade Mórbida*: quem evita o olhar fica cego; quem olha faz um teste de Vontade e, numa falha grave, vira uma espécie de servo;
  - *Armadilha Sanguinária*: uma armadilha posta num corpo, vivo ou morto. Quando alguém toca, a cabeça e o torso explodem em sangue, dentes e navalhas.
- **Fato (episódios):**
  - Ep6: visita a mansão com Zéfero e deixa a cabeça de Sabara como "presente"; ela explode, fere Henri e quase mata Dalmo;
  - Ep7: cega o Colosso, enfia a garra na ferida aberta por Raziel e drena o sangue dele (a morte de Tuco);
  - Ep9: apresenta Cleo, vampirizada, como sua "obra-prima"; ela explode quando Remi a toca (Ep9 @5h56m). Lena o mata com um tiro de sniper (Ep9 @6h03m).
- **Correção da nota anterior:** não há explosivos literais; é o ritual *Armadilha Sanguinária*. "Manipulação" não aparece como tal nas fontes; o mais próximo é o olhar que pode criar um servo.
- **Adaptação:** o alvo escolhe como reage ao olhar. A armadilha explode quando o portador é atacado ou derrotado.

**Equipe/identidade:** Vampiros, diplomata.

**Fontes:** [Velisar](https://ordemparanormal.fandom.com/wiki/Velisar); [Cleo Brisa](https://ordemparanormal.fandom.com/wiki/Cleo_Brisa); [Tuco Belez](https://ordemparanormal.fandom.com/wiki/Tuco_Belez); [Sabara](https://ordemparanormal.fandom.com/wiki/Sabara); Ep6, Ep7, Ep9.

---

#### 42. ZÉFERO

❤️ 4 | ⚔️ 3 | 🛡️ 2

**Habilidade — Coleira** *(Passiva)*

> Se Velisar estiver em jogo, Zéfero só pode terminar o movimento a até 1 área de distância de Velisar. Enquanto estiver na área de Velisar, Zéfero recebe +1 Ataque.

**Habilidade — Devorar Restos** *(Passiva)*

> Quando um personagem for derrotado na área de Zéfero, ou quando um Clone for destruído nela, remova 1 ferimento de Zéfero.

**Função:** fera de coleira. Rende mais ao lado do dono e se recupera com cada corpo que cai perto dele.

**Base na lore:**
- **Fato:** Zéfero é tratado como uma criatura da equipe. Velisar o carrega por uma coleira com espinhos e corrente, e Zéfero o chama de "Mestre". Tinha 70 PV. Nenhuma habilidade com nome foi encontrada nas fontes.
- **Fato (episódios):**
  - Ep6: come os restos do invólucro de carne de Giovanni na frente da mansão;
  - Ep7: devora a cabeça de Franco e mata e devora Alê (Ep7 @4h04m);
  - Ep9: parece não sentir dor no primeiro Descarnar, fere Juan (e Jasper, pelo Vínculo) e morre no segundo (Ep9 @6h25m).
- **Confirmação:** a nota anterior (criatura ligada a Velisar, coleira e consumo de restos) está confirmada.
- **Adaptação:** *Coleira* e *Devorar Restos* foram criadas a partir do comportamento descrito, porque não há poderes oficiais.

**Equipe/identidade:** Vampiros, criatura.

**Fontes:** [Zéfero](https://ordemparanormal.fandom.com/wiki/Zéfero); [Velisar](https://ordemparanormal.fandom.com/wiki/Velisar); [Vampiros](https://ordemparanormal.fandom.com/wiki/Vampiros); Ep6, Ep7, Ep9.

---

#### 43. DAMIR LUKIC

❤️ 3 | ⚔️ 1 | 🛡️ 1

**Habilidade — Dama de Ferro** *(Passiva)*

> Damir não pode se mover. Aliados na área de Damir podem atacá-lo; quando um aliado ferir Damir, esse aliado remove 1 ferimento de si mesmo.

**Habilidade — Estigma da Culpa** *(Sacrifício)*

> Quando Damir for derrotado, quem o derrotou recebe o Estigma da Culpa: uma vez por rodada, quando atacar, o alvo tem −1 Defesa contra esse ataque.

**Função:** sacrifício prisioneiro. Não luta nem foge; serve de fonte de sangue para a própria equipe. Quem o matar, de qualquer lado, fica com a Culpa.

**Base na lore:**
- **Fato:** Damir Lukic é filho de Lucas Davo, irmão do pai de Juan; os dois são primos. Foi trapezista no circo da família, o "Show do Diabo", num passado anterior a *Calamidade*.
- **Fato:** é o sacrifício dos Vampiros, com o Estigma da Culpa ("Carrega o fardo daquele sucumbido em teu amparo"). Quem herda esse estigma consegue fazer uma pessoa sentir uma culpa profunda e baixar a guarda.
- **Fato (episódios):** em Hexatombe, fica preso na "Dama da Culpa", uma dama de ferro, com uma coleira de espinhos, e não usa nenhum poder. Alvira o fura com hastes de metal e bebe o sangue dele. Ele aceita o sangue dela, se confessa e pergunta como matar o Diabo (Ep8). Raziel o mata e herda o estigma (Ep8 @6h21m), e o sangue dele é servido como "vinho" (Ep9).
- **Correção da nota anterior:** os rituais e habilidades atribuídos a Damir (Amaldiçoar Arma, Armadura de Sangue, Ofuscação Mental, Perturbação, Embaralhar, Cicatrização, Ódio Incontrolável, Precognição etc.) são de *Calamidade* e não aparecem em Hexatombe. Por isso, não entraram na carta.
- **Adaptação:** a dama de ferro virou uma peça imóvel que alimenta os aliados. A Culpa virou um "baixar a guarda" do alvo (−1 Defesa).

**Equipe/identidade:** Vampiros. Sacrifício (Estigma da Culpa).

**Fontes:** [Damir Lukic](https://ordemparanormal.fandom.com/wiki/Damir_Lukic); [Raziel](https://ordemparanormal.fandom.com/wiki/Raziel); [Alvira](https://ordemparanormal.fandom.com/wiki/Alvira); [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe); Ep8, Ep9.

---

## 10. Personagens fora do catálogo

| Personagem | Equipe / papel | Motivo da ausência |
|---|---|---|
| Papagaio, Corvo, Coruja | Pássaros | Restrição do projeto: dos Pássaros, só Pomba e Harpia. |
| Suellen | Pássaros — sacrifício (Estigma do Prazer), 1º sacrifício, morta pelos Vampiros na noite 1 | Fora por decisão do projeto, junto com os outros Pássaros (exceto Pomba e Harpia). As notas antigas a listavam entre os Vampiros, mas as fontes a colocam como sacrifício dos Pássaros. |
| Carrara | Seria dos Transtornados | Morreu no Ep1, antes do ritual (Kemi o mata no apartamento dela). Não participou. |
| Andrei Colfas | Ex-vocalista do PSIKOLERA | Morto antes do ritual. Aparece só como história de Kemi, Cindy, Eloy e Giovanni. |
| Agatha Volkomenn, Arthur Cervero, Dante, Jeremias, Aaron, Ivete Beicur | Ordo Realitas | Não participaram do ritual como equipe. |
| Manu Magno e outros personagens de São Paulo | Família e coadjuvantes | Não participaram do ritual. |
| Quibungo, Kerberos, Zumbis de Sangue, Anulado, animais devorados | Criaturas | Não são integrantes das equipes. Podem virar cartas de ameaça ou de cenário num módulo futuro. |

---

## 11. Resumo das correções feitas nas notas anteriores

1. **Equipes:** Cleo Brisa, Tarrafa e Nando Salles são dos **Transtornados**, não dos Vampiros. Suellen é a **sacrifício dos Pássaros**.
2. **Pomba** é tratado no masculino: "cartógrafo".
3. **Remi:** o nome é *Novo Caminho* (Poder de Intenção). Ele cura quando **outro** personagem morre; não é uma segunda vida. A segunda vida é a recompensa do Estigma do Desejo (Juan).
4. **Nomes que não são oficiais** (mantidos ou descartados como adaptação): *Furtividade*, *Tiro de Precisão*, *Sem Recuar*, *Morte Natural*, *Curativos*, "Eu Te Amo" como sacrifício, "Método Moeller" (o nome oficial é *Moeller Method*).
5. **Nomes que são oficiais** e foram confirmados: *Sabor do Silêncio*, *Punhal X*, *Vínculo de Sangue*, *Descarnar Discente*, *Rajada Caótica*, *Dominação*, *Transfusão Vital*, *Crânio Dominador*, *Alvo Pequeno*, *Tiros de Aviso*, *Silenciar*, *Berrão*, *Barulheira*, *Rasante da Harpia* (este só nos bastidores).
6. **Ana:** era ex-enfermeira, não estudante. "Eu te amo" é uma fala. A armadilha era de X. Ana não era o sacrifício da equipe.
7. **Crânio Dominador:** é o item de Argano, feito com o crânio de Escarlata (Ep10), não um poder dela em vida.
8. **Chispa:** é o próprio Chispa que corta o braço, e o *Alvo Pequeno* vale contra o motor do triciclo.
9. **Miasma:** não era literalmente uma barreira; operava a grua que formava as barreiras.
10. **Colosso:** Nando o chamou de covarde **antes** da luta, quando ele ia embora. Não existe habilidade de resistência com nome.
11. **Mutilador e Caio:** a morte está confirmada, mas Caio já estava à beira da morte por causa de Raziel.
12. **Damir:** os poderes registrados vêm de *Calamidade* e não aparecem em Hexatombe.
13. **Velisar:** não há explosivos literais; é o ritual *Armadilha Sanguinária*.
14. **Park Jae-Yoon:** a velocidade só aparece em *Natal Macabro*. O Punhal X cega o alvo; não o interrompe.
15. **X:** a ficha pune alvos flanqueados ou desprevenidos, não "isolados".
16. **Alê:** *Prever Resultados* é rolar de novo um dado em qualquer teste, não prever ataques.
17. **Eloy:** não há bônus pela presença de um aliado; o tambor de guerra é só uma imagem.
18. **Franco:** o *Fogo em Geral* oficial atinge um único inimigo; o fogo em área vem das defesas do Circo.
19. **Giovanni:** o ritual se chama *Espelho*. Usar os clones para "escapar de situações fatais" não está nas fontes.
20. **Mosto:** o local é o *The Monica Club*, e quem o desfigurou foi o Dalmo original.
21. **Kemi e Andrei:** quem pediu a morte foi Cindy; Giovanni contratou a assassina.

---

## 12. Pendências que não puderam ser resolvidas

**Lore**
1. O nome real de Labirinto e o nome por trás de "???" não aparecem nas fontes.
2. Quem contratou Kemi para matar o Colosso não é nomeado. Giovanni é uma inferência (ele perdeu R$ 25 mil apostando contra Dalmo, o mesmo valor do contrato).
3. A morte de Pomba tem duas versões nas fontes. Só a página dele diz que o corpo volta a se mexer.
4. Não se sabe qual estigma cada um dos seis vencedores herdou no fim.
5. O destino das mentes originais dos assassinos não é revelado. Um deles morreu como o Anulado no Ep1, mas não se sabe qual.
6. As biografias da wiki (seções "Passado") não citam episódio. Provavelmente vêm dos Arquivos Secretos, material pago que não foi consultado diretamente. Os fatos marcados como material extra dependem dessa atribuição.
7. As fontes divergem em detalhes de algumas mortes (Raziel, Maria, Ana, Chispa). As cartas não dependem desses detalhes.

**Regras e equilíbrio (para testar)**
1. *Turno Extra* (Raziel) depende da regra de ordem de ativação, que ainda não existe.
2. O alcance ilimitado de Kemi, Lena e Fantasma depende do tamanho do mapa. Se ele tiver muitas áreas, limitar a "até 3 áreas" é o primeiro ajuste a testar.
3. *Espelho* (Giovanni) é o efeito mais complexo do catálogo. Use 3 fichas iguais com uma marca no verso.
4. Ainda não está definido se uma equipe pode misturar facções. As cartas funcionam nos dois casos; só *Guarda-Costas* (Mosto), *Coleira* (Zéfero), *O Mais Fraco* (Pomba) e *Crânio Dominador* (Argano) citam outro personagem pelo nome. O *Crânio Dominador* só funciona se Escarlata estiver na mesma equipe de Argano e for derrotada.
5. Também não está definido se as Máscaras contam no limite de cartas da equipe.
6. *Morte Natural* (Maria) também impede que ela receba o Estigma de um Sacrifício que ela derrote. Isso é intencional.

**Verificação**
- Os episódios não foram assistidos nesta revisão. Toda a verificação foi feita pelas páginas da Ordem Paranormal Wiki, que citam os episódios e os tempos usados aqui.

---

## 13. Tabela de atributos (conferência)

| # | Carta | ❤️ | ⚔️ | 🛡️ | Soma | Habilidades |
|---|---|---|---|---|---|---|
| 1 | Kemi | 3 | 3 | 2 | 8 | 3 |
| 2 | Lena Viegas | 4 | 3 | 2 | 9 | 2 |
| 3 | Fantasma | 3 | 4 | 2 | 9 | 3 |
| 4 | Jonas Aguiar | 4 | 3 | 3 | 10 | 2 |
| 5 | Jasper | 5 | 3 | 3 | 11 | 2 |
| 6 | Mutilador Noturno | 4 | 4 | 3 | 11 | 2 |
| 7 | Labirinto | 3 | 2 | 3 | 8 | 3 |
| 8 | Remi | 4 | 3 | 3 | 10 | 3 |
| 9 | ??? | 3 | 4 | 3 | 10 | 3 |
| 10 | Dalmo Magno | 5 | 3 | 3 | 11 | 2 |
| 11 | Tuco Belez | 5 | 3 | 3 | 11 | 3 |
| 12 | Colosso | 5 | 4 | 4 | 13 | 2 |
| 13 | Park Jae-Yoon | 3 | 3 | 3 | 9 | 2 |
| 14 | Maria Helena Rodrigues | 3 | 3 | 3 | 9 | 2 |
| 15 | X | 3 | 4 | 2 | 9 | 3 |
| 16 | Henri | 3 | 2 | 2 | 7 | 4 |
| 17 | Juan | 4 | 3 | 3 | 10 | 3 |
| 18 | Escarlata | 4 | 2 | 4 | 10 | 3 |
| 19 | Torvo | 5 | 1 | 3 | 9 | 2 |
| 20 | Ana Delgado dos Santos | 4 | 3 | 3 | 10 | 2 |
| 21 | Argano | 6 | 3 | 5 | 14 | 2 |
| 22 | Chispa | 3 | 3 | 2 | 8 | 3 |
| 23 | Miasma | 4 | 1 | 2 | 7 | 3 |
| 24 | Pomba | 2 | 1 | 2 | 5 | 3 |
| 25 | Harpia | 4 | 3 | 3 | 10 | 3 |
| 26 | Eloy Furtado | 5 | 3 | 2 | 10 | 2 |
| 27 | Cindy Lopes | 3 | 3 | 2 | 8 | 3 |
| 28 | Caio Teles | 4 | 3 | 3 | 10 | 2 |
| 29 | Franco | 3 | 3 | 2 | 8 | 2 |
| 30 | Alê | 3 | 1 | 2 | 6 | 3 |
| 31 | Caíto Rocha | 3 | 2 | 2 | 7 | 3 |
| 32 | Giovanni Opspor | 3 | 1 | 2 | 6 | 2 |
| 33 | Cristino | 4 | 3 | 3 | 10 | 3 |
| 34 | Mosto | 5 | 3 | 3 | 11 | 2 |
| 35 | Tarrafa | 3 | 2 | 2 | 7 | 2 |
| 36 | Cleo Brisa | 3 | 3 | 2 | 8 | 2 |
| 37 | Nando Salles | 3 | 2 | 2 | 7 | 2 |
| 38 | Raziel | 6 | 4 | 3 | 13 | 3 |
| 39 | Alvira | 4 | 2 | 3 | 9 | 2 |
| 40 | Sabara | 3 | 3 | 3 | 9 | 3 |
| 41 | Velisar | 4 | 3 | 2 | 9 | 2 |
| 42 | Zéfero | 4 | 3 | 2 | 9 | 2 |
| 43 | Damir Lukic | 3 | 1 | 1 | 5 | 2 |

**Leitura rápida do equilíbrio**
- **Ataque 4** só aparece em máscaras e em Raziel. Nenhuma carta tem Ataque 5, para que Defesa 4 continue significando alguma coisa.
- **Defesa 4 ou 5** só em Colosso, Escarlata e Argano. Elas são vencidas por bônus de +1 Ataque e por efeitos que ignoram Defesa: *Descarnar*, *Trocação Justa*, *Lampiões Explosivos*, as armadilhas e a explosão de Velisar.
- As somas mais altas (Argano 14, Colosso 13, Raziel 13) têm compensações explícitas: *Coração Exposto*; *Sem Recuar* e as condições para vestir a máscara; *Sede Incontrolável*. São as primeiras candidatas a ajuste depois dos testes.
- As somas mais baixas (Pomba, Damir, Alê, Giovanni) são peças de apoio, de blefe ou de sacrifício, com habilidades que compensam a fragilidade.

---

## 14. Fontes gerais e licença

**Página principal da campanha**
- [Hexatombe](https://ordemparanormal.fandom.com/wiki/Hexatombe): elenco, equipes, episódios e status final.

**Regras do ritual e equipes**
- [Ritos do Hexatombe](https://ordemparanormal.fandom.com/wiki/Ritos_do_Hexatombe): regras do ritual e estigmas.
- Equipes: [Mascarados](https://ordemparanormal.fandom.com/wiki/Mascarados) · [Assassinos](https://ordemparanormal.fandom.com/wiki/Assassinos) · [Couraças](https://ordemparanormal.fandom.com/wiki/Couraças) · [Pássaros](https://ordemparanormal.fandom.com/wiki/Pássaros) · [PSIKOLERA](https://ordemparanormal.fandom.com/wiki/PSIKOLERA) · [Equipe Transtornados](https://ordemparanormal.fandom.com/wiki/Equipe_Transtornados) · [Vampiros](https://ordemparanormal.fandom.com/wiki/Vampiros).

**Material oficial fora das sessões**
- Arquivos Secretos: [Pacote 02](https://ordemparanormal.fandom.com/wiki/Arquivos_Secretos/Pacote_02:_Hexatombe_-_Parte_1) e [Pacote 03](https://ordemparanormal.fandom.com/wiki/Arquivos_Secretos/Pacote_03:_Hexatombe_-_Parte_2), consultados só pela descrição da wiki.

**Episódios (VODs oficiais no YouTube)**

| Episódio | Título | Link |
|---|---|---|
| Ep1 | Receptáculo | [vídeo](https://www.youtube.com/watch?v=DMzwnM6gwBY) |
| Ep2 | Portal | [vídeo](https://www.youtube.com/watch?v=OOLM72CU84w) |
| Ep3 | Um Novo Começo | [vídeo](https://www.youtube.com/watch?v=trLRev31rQ8) |
| Ep4 | Máscara | [vídeo](https://www.youtube.com/watch?v=yh_J363Ork4) |
| Ep5 | Encontro | [vídeo](https://www.youtube.com/watch?v=zsOSZ_r9mhg) |
| Ep6 | Decisão | [vídeo](https://www.youtube.com/watch?v=J55mRb1n5L4) |
| Ep7 | Consequências | [vídeo](https://www.youtube.com/watch?v=K_c2VdmPuLg) |
| Ep8 | Culpa | [vídeo](https://www.youtube.com/watch?v=-7prXUHT8OM) |
| Ep9 | Banho de Sangue | [vídeo](https://www.youtube.com/watch?v=p5alZam12ss) |
| Ep10 | Renascimento | [vídeo](https://www.youtube.com/watch?v=g53ZfYHUQOw) |
| Ep11 | Revelando Hexatombe (bastidores) | [vídeo](https://www.youtube.com/watch?v=LVBZay042_c) |

**Licença**
- O texto deste catálogo resume e parafraseia a Ordem Paranormal Wiki (conteúdo comunitário da Fandom, sob licença CC BY-SA). As citações literais são curtas.
- Ordem Paranormal, seus personagens e nomes pertencem aos respectivos detentores. Este é um protótipo de fã, sem fins comerciais. Antes de qualquer uso comercial, confira a licença aplicável.

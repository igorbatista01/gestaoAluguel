// Dados do locador são sempre enviados pelo frontend (perfil do usuário logado).

function resolveImovelInfo(numImovel, numCasa, fallback) {
  // Imóveis originais com dados específicos (compatibilidade legada)
  if (numImovel === "1898") {
    return {
      enderecoFormatado: "Estrada Baviera nº 1898 (antigo 113A) - Embu das Artes - SP - 06825050",
      numComodos: "2",
      aguaLuzIndividual: ".",
    };
  }

  if (numImovel === "105") {
    if (numCasa === "1") return { enderecoFormatado: "Estrada Baviera nº 105, casa 1 - Embu das Artes - SP - 06825050", numComodos: "3", aguaLuzIndividual: "." };
    if (numCasa === "2") return { enderecoFormatado: "Estrada Baviera nº 105, casa 2 - Embu das Artes - SP - 06825050", numComodos: "4", aguaLuzIndividual: "." };
    if (numCasa === "3") return { enderecoFormatado: "Estrada Baviera nº 105, casa 3 - Embu das Artes - SP - 06825050", numComodos: "2", aguaLuzIndividual: " por meio do LOCADOR." };
  }

  // Fallback genérico: usa o endereço completo enviado pelo frontend
  return {
    enderecoFormatado: fallback.enderecoCompleto || [numImovel, numCasa].filter(Boolean).join(", nº "),
    numComodos: fallback.numComodos || "—",
    aguaLuzIndividual: ".",
  };
}

function dataAtualPorExtenso() {
  const data = new Date();
  const meses = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${data.getDate()} de ${meses[data.getMonth()]} de ${data.getFullYear()}`;
}

function calcularDataFim(dataInicioContrato, tempoContrato) {
  const dataFim = new Date(dataInicioContrato.split("/").reverse().join("/"));
  dataFim.setMonth(dataFim.getMonth() + parseInt(tempoContrato, 10));
  return dataFim.toLocaleDateString("pt-BR");
}

function buildContratoHtml({ nomeAlugante, rg, cpf, maritalStatus, birthdate, dataInicioContrato, diaPagamento, tempoContrato, valorAluguel, numImovel, numCasa, enderecoCompleto, numComodos: numComodoParam, nomeLocador, rgLocador, cpfLocador, dataNascimentoLocador, maritalStatusLocador }) {
  const { enderecoFormatado, numComodos, aguaLuzIndividual } = resolveImovelInfo(numImovel, numCasa, { enderecoCompleto, numComodos: numComodoParam });
  const fimData = calcularDataFim(dataInicioContrato, tempoContrato);
  const dataAtualExtenso = dataAtualPorExtenso();

  // Dados do locador vindos do perfil do usuário logado
  const locadorNome     = nomeLocador           || "";
  const locadorRg       = rgLocador             || "";
  const locadorCpf      = cpfLocador            || "";
  const locadorNasc     = dataNascimentoLocador || "";
  const locadorEstCivil = maritalStatusLocador  || "";

  const contrato = `
<b>LOCADOR:</b> ${locadorNome}, brasileiro, ${locadorEstCivil}, portador da cédula de R.G de nº ${locadorRg} e CPF nº ${locadorCpf}, nascido em ${locadorNasc}
<br><br>
<b>LOCATÁRIO:</b> ${nomeAlugante}, brasileiro, ${maritalStatus}, portador da cédula de R.G de nº: ${rg}, e C.P.F de nº ${cpf}, nascido em ${birthdate}
<br><br>
<b>CLÁUSULA PRIMEIRA:</b> O objeto deste contrato de locação é o imóvel residencial, situado à ${enderecoFormatado} - ${numComodos} cômodo(s), banheiro e área de serviço de uso individual do LOCATÁRIO.
<br><br>
<b>CLÁUSULA SEGUNDA:</b> O prazo da locação é de ${tempoContrato} mes(es), iniciando-se em ${dataInicioContrato} com término em ${fimData}, independentemente de aviso, notificação ou interpelação judicial ou mesmo extrajudicial.
<br><br>
<b>CLÁUSULA TERCEIRA:</b> O aluguel mensal, deverá ser pago até o dia ${diaPagamento} do mês subseqüente ao vencido, no local indicado pelo LOCADOR, é de R$ ${valorAluguel} mensais, somado à taxa de depósito, com o valor de R$ ${valorAluguel} no mês de início, como foi previamente informado.
<br><br>
<b>CLÁUSULA QUARTA:</b> O LOCATÁRIO será responsável por todos os tributos incidentes sobre o imóvel e quaisquer outras despesas que recaírem sobre o imóvel, arcando também com as despesas provenientes de sua utilização seja elas, ligação e consumo de luz, e água que serão pagas diretamente às empresas concessionárias dos referidos serviços${aguaLuzIndividual}
<br><br>
<b>CLÁUSULA QUINTA:</b> Em caso de mora no pagamento do aluguel, será aplicada multa de 2% (dois por cento) sobre o valor devido e juros mensais de 1% (um por cento) do montante devido.
<br><br>
<b>CLÁUSULA SEXTA:</b> Fica ao LOCATÁRIO, a responsabilidade em zelar pela conservação, limpeza do imóvel, efetuando as reformas necessárias para sua manutenção sendo que os gastos e pagamentos decorrentes da mesma, correrão por conta do mesmo. O LOCATÁRIO está obrigado a devolver o imóvel em perfeitas condições de limpeza, conservação e pintura, quando finda ou rescindida esta avença. O LOCATÁRIO não poderá realizar obras que alterem ou modifiquem a estrutura do imóvel locado, sem prévia autorização por escrito da LOCADORA. Caso este consinta na realização das obras, estas ficarão desde logo, incorporadas ao imóvel, sem que assista ao LOCATÁRIO qualquer indenização pelas obras ou retenção por benfeitorias. As benfeitorias removíveis poderão ser retiradas, desde que não desfigurem o imóvel locado.
<br><br>
<b>PARÁGRAFO ÚNICO:</b> O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e perfeito funcionamento devendo observar o que consta no termo de vistoria.
<br><br>
<b>CLÁUSULA SÉTIMA:</b> O LOCATÁRIO declara, que o imóvel ora locado, destina-se única e exclusivamente para o seu uso residencial e de sua família.
<br><br>
<b>CLÁUSULA OITAVA:</b> O LOCATÁRIO não poderá sublocar, transferir ou ceder o imóvel, sendo nulo de pleno direito qualquer ato praticado com este fim sem o consentimento prévio e por escrito do LOCADOR.
<br><br>
<b>CLÁUSULA NONA:</b> Em caso de sinistro parcial ou total do imóvel, que impossibilite a habitação o imóvel locado, o presente contrato estará rescindido, independentemente de aviso ou interpelação judicial ou extrajudicial; no caso de incêndio parcial, obrigando a obras de reconstrução, o presente contrato terá suspensa a sua vigência e reduzida a renda do imóvel durante o período da reconstrução à metade do que na época for o aluguel, e sendo após a reconstrução devolvido o LOCATÁRIO pelo prazo restante do contrato, que ficará prorrogado pelo mesmo tempo de duração das obras de reconstrução.
<br><br>
<b>CLÁUSULA DÉCIMA:</b> Em caso de desapropriação total ou parcial do imóvel locado, ficará rescindido de pleno direito o presente contrato de locação, independente de quaisquer indenizações de ambas as partes ou contratantes.
<br><br>
<b>CLÁUSULA DÉCIMA PRIMEIRA:</b> No caso de alienação do imóvel, obriga-se o LOCADOR, dar preferência ao LOCATÁRIO, e se o mesmo não utilizar-se dessa prerrogativa, o LOCADOR deverá constar da respectiva escritura pública, a existência do presente contrato, para que o adquirente o respeite nos termos da legislação vigente.
<br><br>
<b>CLÁUSULA DÉCIMA SEGUNDA:</b> O FIADOR (caso haja) e principal pagador do LOCATÁRIO, responde solidariamente por todos os pagamentos descritos neste contrato bem como, não só até o final de seu prazo, como mesmo depois, até a efetiva entrega das chaves ao LOCADOR e termo de vistoria do imóvel.
<br><br>
<b>CLÁUSULA DÉCIMA TERCEIRA:</b> É facultado ao LOCADOR vistoriar, por si ou seus procuradores, sempre que achar conveniente, para a certeza do cumprimento das obrigações assumidas neste contrato.
<br><br>
<b>CLÁUSULA DÉCIMA QUARTA:</b> A infração de qualquer das cláusulas do presente contrato, sujeita o infrator à multa de duas vezes o valor do aluguel, tomando-se por base, o último aluguel vencido.
<br><br>
<b>CLÁUSULA DÉCIMA QUINTA:</b> As partes contratantes obrigam-se por si, herdeiros e/ou sucessores, elegendo o Foro da Cidade de Embu das Artes, para a propositura de qualquer ação.
<br><br>
<b>CLÁUSULA DÉCIMA SEXTA:</b> Está vedado o consumo de drogas (que se inclui bebidas alcoólicas) dentro do objeto deste contrato.
<br><br>
<b>CLÁUSULA DÉCIMA SÉTIMA:</b> Está vedado a perturbação da paz alheia seguindo a Lei da Poluição Sonora do município de Embu das Artes (lei nº 2438, de 11/12/2009), em caso de reincidência o contrato será rescindido.
<br><br>
<b>CLÁUSULA DÉCIMA OITAVA:</b> ${nomeAlugante}, brasileiro, ${maritalStatus}, portador da cédula de R.G de nº: ${rg}, e C.P.F de nº ${cpf}, nascido em ${birthdate} autoriza ${locadorNome}, brasileiro, ${locadorEstCivil}, portador da cédula de R.G de nº ${locadorRg} e CPF nº ${locadorCpf} a realizar transferência da titularidade das contas de água (junto a Sabesp) e luz (junto a Enel) para seu nome a partir da data de início da locação ou desvinculá-lo caso o contrato seja encerrado.
<br><br>
<br>
Embu das Artes,<br>
${dataAtualExtenso}
<br><br>
_____________________________________________________<br>
LOCADOR - ${locadorNome}
<br><br>
_____________________________________________________<br>
LOCATÁRIO - ${nomeAlugante}
<br><br>
_____________________________________________________<br>
TESTEMUNHAS`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 94px; }
    body {
      font-family: Arial, sans-serif;
      font-size: 9pt;
      text-align: justify;
      line-height: 1.25;
    }
    h1 {
      font-size: 48pt;
      line-height: 2;
      height: calc(100vh - 94px);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
    }
  </style>
</head>
<body>
  <p>${contrato}</p>
</body>
</html>`;
}

module.exports = { buildContratoHtml, resolveImovelInfo };

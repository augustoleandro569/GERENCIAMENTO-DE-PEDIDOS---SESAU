import { HospitalUnit } from '../types';

export const CANONICAL_UNITS: HospitalUnit[] = [
  { id: 'u-hge', sigla: 'HGE', nome: 'Hospital Geral do Estado Dr. Osvaldo Brandão Vilela', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-hma', sigla: 'HMA', nome: 'Hospital Metropolitano de Alagoas', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-hemoar', sigla: 'HEMOAR', nome: 'Hemocentro Regional de Arapiraca', municipio: 'Arapiraca', tipo: 'Hemocentro', ativa: true },
  { id: 'u-hrm', sigla: 'HRM', nome: 'Hospital Regional da Mata', municipio: 'União dos Palmares', tipo: 'Hospital', ativa: true },
  { id: 'u-hrn', sigla: 'HRN', nome: 'Hospital Regional do Norte', municipio: 'Porto Calvo', tipo: 'Hospital', ativa: true },
  { id: 'u-hra', sigla: 'HRA', nome: 'Hospital Regional do Alto Sertão', municipio: 'Delmiro Gouveia', tipo: 'Hospital', ativa: true },
  { id: 'u-lacen', sigla: 'LACEN', nome: 'Laboratório Central de Saúde Pública Dr. Aristeu Lopes', municipio: 'Maceió', tipo: 'Laboratório', ativa: true },
  { id: 'u-hmulher', sigla: 'HMULHER', nome: 'Hospital da Mulher Dra. Nise da Silveira', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-hemoal', sigla: 'HEMOAL', nome: 'Hemocentro de Alagoas', municipio: 'Maceió', tipo: 'Hemocentro', ativa: true },
  { id: 'u-hemoal-trap', sigla: 'HEMOAL-TRAP', nome: 'HEMOAL - Unidade Trapiche', municipio: 'Maceió', tipo: 'Hemocentro', ativa: true },
  { id: 'u-hemoal-via', sigla: 'HEMOAL-VIA', nome: 'HEMOAL - Unidade Via Expressa', municipio: 'Maceió', tipo: 'Hemocentro', ativa: true },
  { id: 'u-mesm', sigla: 'MESM', nome: 'Maternidade Escola Santa Mônica', municipio: 'Maceió', tipo: 'Maternidade', ativa: true },
  { id: 'u-upa-tab', sigla: 'UPA-TAB', nome: 'UPA Dr. Theobaldo Barbosa - Tabuleiro dos Martins', municipio: 'Maceió', tipo: 'UPA', ativa: true },
  { id: 'u-upa-jac', sigla: 'UPA-JAC', nome: 'UPA Dr. Ismar Gatto - Jacintinho', municipio: 'Maceió', tipo: 'UPA', ativa: true },
  { id: 'u-upa-jar', sigla: 'UPA-JAR', nome: 'UPA Jaraguá', municipio: 'Maceió', tipo: 'UPA', ativa: true },
  { id: 'u-upa-ben', sigla: 'UPA-BEN', nome: 'UPA Benedito Bentes', municipio: 'Maceió', tipo: 'UPA', ativa: true },
  { id: 'u-upa-chi', sigla: 'UPA-CHI', nome: 'UPA Dr. Cláudio Costa - Chã da Jaqueira', municipio: 'Maceió', tipo: 'UPA', ativa: true },
  { id: 'u-upa-sm', sigla: 'UPA-SM', nome: 'UPA Santa Maria - Cidade Universitária', municipio: 'Maceió', tipo: 'UPA', ativa: true },
  { id: 'u-upa-ara', sigla: 'UPA-ARA', nome: 'UPA Noel Macedo de Melo - Arapiraca', municipio: 'Arapiraca', tipo: 'UPA', ativa: true },
  { id: 'u-upa-del', sigla: 'UPA-DEL', nome: 'UPA Delmiro Gouveia', municipio: 'Delmiro Gouveia', tipo: 'UPA', ativa: true },
  { id: 'u-upa-cor', sigla: 'UPA-COR', nome: 'UPA Coruripe', municipio: 'Coruripe', tipo: 'UPA', ativa: true },
  { id: 'u-upa-mar', sigla: 'UPA-MAR', nome: 'UPA Marechal Deodoro', municipio: 'Marechal Deodoro', tipo: 'UPA', ativa: true },
  { id: 'u-upa-pal', sigla: 'UPA-PAL', nome: 'UPA Drª Helenilda Veloso - Palmeira dos Índios', municipio: 'Palmeira dos Índios', tipo: 'UPA', ativa: true },
  { id: 'u-upa-pen', sigla: 'UPA-PEN', nome: 'UPA Penedo', municipio: 'Penedo', tipo: 'UPA', ativa: true },
  { id: 'u-upa-rio', sigla: 'UPA-RIO', nome: 'UPA Rio Largo - Pedro Carlos da Silva Sobrinho', municipio: 'Rio Largo', tipo: 'UPA', ativa: true },
  { id: 'u-upa-sao', sigla: 'UPA-SAO', nome: 'UPA São Miguel dos Campos', municipio: 'São Miguel dos Campos', tipo: 'UPA', ativa: true },
  { id: 'u-upa-vic', sigla: 'UPA-VIC', nome: 'UPA Viçosa', municipio: 'Viçosa', tipo: 'UPA', ativa: true },
  { id: 'u-upa-bat', sigla: 'UPA-BAT', nome: 'UPA Batalha', municipio: 'Batalha', tipo: 'UPA', ativa: true },
  { id: 'u-upa-sant', sigla: 'UPA-SANT', nome: 'UPA Santana do Ipanema', municipio: 'Santana do Ipanema', tipo: 'UPA', ativa: true },
  { id: 'u-samu-al', sigla: 'SAMU-AL', nome: 'Central de Regulação SAMU 192 Alagoas', municipio: 'Maceió', tipo: 'Outro', ativa: true },
  { id: 'u-samu-mcz', sigla: 'SAMU-MCZ', nome: 'SAMU Regional Maceió', municipio: 'Maceió', tipo: 'Outro', ativa: true },
  { id: 'u-samu-arp', sigla: 'SAMU-ARP', nome: 'SAMU Regional Arapiraca', municipio: 'Arapiraca', tipo: 'Outro', ativa: true },
  { id: 'u-h-crianca', sigla: 'H-CRIANCA', nome: 'Hospital da Criança de Alagoas', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-h-coracao', sigla: 'H-CORACAO', nome: 'Hospital do Coração Alagoano - Prof. Adib Jatene', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-cra', sigla: 'CRA', nome: 'Centro de Reabilitação de Arapiraca', municipio: 'Arapiraca', tipo: 'Ambulatório', ativa: true },
  { id: 'u-cerest', sigla: 'CEREST', nome: 'Centro de Referência Estadual em Saúde do Trabalhador', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-ceta', sigla: 'CETA', nome: 'Centro de Triagem e Acolhimento', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-almox-central', sigla: 'ALMOX-CENTRAL', nome: 'Almoxarifado Central SESAU', municipio: 'Rio Largo', tipo: 'Outro', ativa: true },
  { id: 'u-farm-esp', sigla: 'FARM-ESP', nome: 'Farmácia de Medicamentos Especializados (CEAF)', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-farmajud', sigla: 'FARMAJUD', nome: 'Farmácia Judicial do Estado / SESAU', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-svo', sigla: 'SVO', nome: 'Serviço de Verificação de Óbitos de Alagoas', municipio: 'Maceió', tipo: 'Laboratório', ativa: true },
  { id: 'u-h-sanatorio', sigla: 'H-SANATORIO', nome: 'Hospital Sanatório - Unidade de Apoio', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-caps-inf', sigla: 'CAPS-INF', nome: 'CAPS Infantil Dr. Zezito Falcão', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-caps-alcool', sigla: 'CAPS-ALCOOL', nome: 'CAPS Álcool e Drogas Dr. Everaldo Miranda', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-h-santana', sigla: 'H-SANTANA', nome: 'Hospital Regional Clodolfo Rodrigues de Melo', municipio: 'Santana do Ipanema', tipo: 'Hospital', ativa: true },
  { id: 'u-h-penedo', sigla: 'H-PENEDO', nome: 'Hospital Regional de Penedo', municipio: 'Penedo', tipo: 'Hospital', ativa: true },
  { id: 'u-amb-hge', sigla: 'AMB-HGE', nome: 'Ambulatório de Especialidades do HGE', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-hem-arap', sigla: 'HEM-ARAP', nome: 'Unidade de Coleta e Transfusão Arapiraca', municipio: 'Arapiraca', tipo: 'Hemocentro', ativa: true },
  { id: 'u-posto-marag', sigla: 'POSTO-MARAG', nome: 'Posto Avançado Litoral Norte', municipio: 'Maragogi', tipo: 'Ambulatório', ativa: true },
  { id: 'u-base-piran', sigla: 'BASE-PIRAN', nome: 'Base Descentralizada SAMU Piranhas', municipio: 'Piranhas', tipo: 'Outro', ativa: true },
  { id: 'u-amb-mat', sigla: 'AMB-MAT', nome: 'Ambulatório da Maternidade Santa Mônica', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-hcb', sigla: 'HCB', nome: 'Hospital Carvalho Beltrão - Coruripe', municipio: 'Coruripe', tipo: 'Hospital', ativa: true },
  { id: 'u-hedh', sigla: 'HEDH', nome: 'Hospital de Emergência do Agreste Dr. Daniel Houly', municipio: 'Arapiraca', tipo: 'Hospital', ativa: true },
  { id: 'u-hia', sigla: 'HIA', nome: 'Hospital do Idoso de Alagoas', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-hospigaf', sigla: 'HOSPIGAF', nome: 'Hospital Geral Prof. Ib Gatto Falcão', municipio: 'Rio Largo', tipo: 'Hospital', ativa: true },
  { id: 'u-hrpi', sigla: 'HRPI', nome: 'Hospital Regional de Palmeira dos Índios', municipio: 'Palmeira dos Índios', tipo: 'Hospital', ativa: true },
  { id: 'u-hrv', sigla: 'HRV', nome: 'Hospital Regional de Viçosa', municipio: 'Viçosa', tipo: 'Hospital', ativa: true },
  { id: 'u-hu', sigla: 'HU', nome: 'Hospital Universitário Professor Alberto Antunes', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-crie', sigla: 'CRIE', nome: 'Centro de Referência em Imunobiológicos Especiais', municipio: 'Maceió', tipo: 'Ambulatório', ativa: true },
  { id: 'u-creadi', sigla: 'CREADI', nome: 'Centro de Referência e Distribuição de Imunobiológicos', municipio: 'Arapiraca', tipo: 'Ambulatório', ativa: true },
  { id: 'u-cievs', sigla: 'CIEVS', nome: 'Centro de Informações Estratégicas em Vigilância em Saúde', municipio: 'Maceió', tipo: 'Outro', ativa: true },
  { id: 'u-geraf', sigla: 'GERAF', nome: 'Gerência da Assistência Farmacêutica', municipio: 'Maceió', tipo: 'Outro', ativa: true },
  { id: 'u-seris', sigla: 'SERIS', nome: 'Unidade de Saúde Prisional SERIS', municipio: 'Maceió', tipo: 'Outro', ativa: true },
  { id: 'u-sulog', sigla: 'SULOG', nome: 'Supervisão de Logística SESAU', municipio: 'Maceió', tipo: 'Outro', ativa: true },
  { id: 'u-uncisal', sigla: 'UNCISAL', nome: 'Hospital Universitário / UNCISAL', municipio: 'Maceió', tipo: 'Hospital', ativa: true },
  { id: 'u-um-aguabranca', sigla: 'UM-AGUABRANCA', nome: 'Unidade Mista Drª Quitéria Bezerra de Melo', municipio: 'Água Branca', tipo: 'Hospital', ativa: true },
  { id: 'u-um-piranhas', sigla: 'UM-PIRANHAS', nome: 'Unidade Mista Senador Arnon de Melo', municipio: 'Piranhas', tipo: 'Hospital', ativa: true },
];

const CANONICAL_MAP = new Map<string, HospitalUnit>();
CANONICAL_UNITS.forEach(u => {
  CANONICAL_MAP.set(u.sigla.toUpperCase(), u);
});

// Resilient normalizer that maps dirty strings from legacy exports/spreadsheets
export function cleanUnitName(raw: string): string {
  if (!raw) return 'HGE';
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();

  const MEASURE_UNITS = new Set([
    'UND', 'UN', 'UNID', 'CX', 'CXS', 'CAIXA', 'CAIXAS', 'FR', 'FRASCO', 'FRASCOS',
    'AMP', 'AMPOLA', 'AMPOLAS', 'PCT', 'PACOTE', 'PACOTES', 'COMP', 'COMPRIMIDO',
    'BLISTER', 'KG', 'G', 'MG', 'L', 'ML', 'ROLO', 'PAR', 'TUBO'
  ]);
  if (MEASURE_UNITS.has(upper)) {
    return 'HGE';
  }

  // If already exactly a canonical sigla, return directly
  if (CANONICAL_MAP.has(upper)) {
    return upper;
  }

  // Normalized version without accents and special characters
  const normalized = upper
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Specific legacy truncated patterns from previous dirty spreadsheet:
  if (normalized.includes('CLAUDIO COSTA') || normalized.includes('CHA DA JAQUEIRA') || normalized.startsWith('UPA DR. CL')) {
    return 'UPA-CHI';
  }
  if (normalized.includes('ISMAR GATTO') || (normalized.includes('JACINTINHO') && normalized.includes('UPA')) || normalized.startsWith('UPA DR. IS')) {
    return 'UPA-JAC';
  }
  if (normalized.includes('NOEL MACEDO') || (normalized.includes('ARAPIRACA') && normalized.includes('UPA')) || normalized.startsWith('UPA NOEL')) {
    return 'UPA-ARA';
  }
  if (normalized.includes('THEOBALDO') || normalized.includes('TABULEIRO') || normalized.startsWith('UPA TABULE')) {
    return 'UPA-TAB';
  }
  if (normalized.includes('RIO LARGO') && normalized.includes('UPA')) {
    return 'UPA-RIO';
  }
  if (normalized.includes('SANTA MARIA') || normalized.includes('CIDADE UNIVERSITARIA') || normalized.startsWith('UPA SANTA')) {
    return 'UPA-SM';
  }
  if (normalized.includes('HELENILDA') || (normalized.includes('PALMEIRA') && normalized.includes('UPA')) || normalized.startsWith('UPA- PALME')) {
    return 'UPA-PAL';
  }
  if (normalized.includes('JARAGUA') && normalized.includes('UPA')) {
    return 'UPA-JAR';
  }
  if (normalized.includes('BENEDITO BENTES') && normalized.includes('UPA')) {
    return 'UPA-BEN';
  }
  if (normalized.includes('CORURIPE') && normalized.includes('UPA')) {
    return 'UPA-COR';
  }
  if (normalized.includes('DELMIRO') && normalized.includes('UPA')) {
    return 'UPA-DEL';
  }
  if (normalized.includes('MARECHAL') && normalized.includes('UPA')) {
    return 'UPA-MAR';
  }
  if (normalized.includes('PENEDO') && normalized.includes('UPA')) {
    return 'UPA-PEN';
  }
  if (normalized.includes('BATALHA') && normalized.includes('UPA')) {
    return 'UPA-BAT';
  }
  if (normalized.includes('SANTANA') && normalized.includes('UPA')) {
    return 'UPA-SANT';
  }
  if (normalized.includes('SAO MIGUEL') && normalized.includes('UPA')) {
    return 'UPA-SAO';
  }
  if (normalized.includes('VICOSA') && normalized.includes('UPA')) {
    return 'UPA-VIC';
  }

  // Hospitals & Hemocenters
  if (normalized.includes('CARVALHO BELTRAO') || normalized.startsWith('HCB')) {
    return 'HCB';
  }
  if (normalized.includes('DANIEL HOULY') || normalized.startsWith('HEDH') || normalized.startsWith('UEDH')) {
    return 'HEDH';
  }
  if (normalized.includes('HEMOAL') && (normalized.includes('TRAPICHE') || normalized.endsWith('- T'))) {
    return 'HEMOAL-TRAP';
  }
  if (normalized.includes('HEMOAL') && (normalized.includes('VIA EXPRESSA') || normalized.endsWith('- V'))) {
    return 'HEMOAL-VIA';
  }
  if (normalized.includes('HEMOAR')) {
    return 'HEMOAR';
  }
  if (normalized.includes('HEMOAL')) {
    return 'HEMOAL';
  }
  if (normalized.includes('HOSPITAL GERAL DO ESTADO') || normalized.startsWith('HGE -') || normalized === 'HGE') {
    return 'HGE';
  }
  if (normalized.includes('METROPOLITANO') || normalized.startsWith('HMA')) {
    return 'HMA';
  }
  if (normalized.includes('MULHER') || normalized.startsWith('HMULHER') || normalized.startsWith('HM -')) {
    return 'HMULHER';
  }
  if (normalized.includes('REGIONAL DA MATA') || normalized.startsWith('HRM')) {
    return 'HRM';
  }
  if (normalized.includes('REGIONAL DO NORTE') || normalized.startsWith('HRN')) {
    return 'HRN';
  }
  if (normalized.includes('ALTO SERTAO') || normalized.startsWith('HRA') || normalized.startsWith('HRAS')) {
    return 'HRA';
  }
  if (normalized.includes('IDOSO') || normalized.startsWith('HIA')) {
    return 'HIA';
  }
  if (normalized.includes('IB GATTO') || normalized.startsWith('HOSPIGAF')) {
    return 'HOSPIGAF';
  }
  if (normalized.includes('CRIANCA') || normalized.startsWith('H-CRIANCA') || normalized.startsWith('H.CRIA')) {
    return 'H-CRIANCA';
  }
  if (normalized.includes('CORACAO') || normalized.startsWith('H-CORACAO') || normalized.startsWith('HCA')) {
    return 'H-CORACAO';
  }
  if (normalized.includes('SANTA MONICA') || normalized.startsWith('MESM') || normalized.includes('AMB-MAT')) {
    return 'MESM';
  }
  if (normalized.includes('LACEN')) {
    return 'LACEN';
  }
  if (normalized.includes('SANATORIO') || normalized.startsWith('H-SANATORIO')) {
    return 'H-SANATORIO';
  }
  if (normalized.includes('PENEDO') && normalized.includes('HOSPITAL')) {
    return 'H-PENEDO';
  }
  if (normalized.includes('CLODOLFO') || (normalized.includes('SANTANA') && normalized.includes('HOSPITAL'))) {
    return 'H-SANTANA';
  }
  if (normalized.includes('PALMEIRA DOS INDIOS') && normalized.includes('HOSPITAL')) {
    return 'HRPI';
  }
  if (normalized.includes('VICOSA') && normalized.includes('HOSPITAL')) {
    return 'HRV';
  }
  if (normalized.includes('ALBERTO ANTUNES') || normalized.startsWith('HU -') || normalized === 'HU') {
    return 'HU';
  }
  if (normalized.includes('UNCISAL')) {
    return 'UNCISAL';
  }
  if (normalized.includes('ALMOXARIFADO CENTRAL') || normalized.startsWith('ALMOX')) {
    return 'ALMOX-CENTRAL';
  }
  if (normalized.includes('FARMACIA JUDICIAL') || normalized.startsWith('FARMAJUD')) {
    return 'FARMAJUD';
  }
  if (normalized.includes('CEAF') || normalized.includes('FARMACIA DE MEDICAMENTOS') || normalized.startsWith('FARM-ESP')) {
    return 'FARM-ESP';
  }
  if (normalized.includes('VERIFICACAO DE OBITOS') || normalized === 'SVO') {
    return 'SVO';
  }
  if (normalized.includes('SAMU') && normalized.includes('ARAPIRACA')) {
    return 'SAMU-ARP';
  }
  if (normalized.includes('SAMU') && normalized.includes('MACEIO')) {
    return 'SAMU-MCZ';
  }
  if (normalized.includes('SAMU')) {
    return 'SAMU-AL';
  }
  if (normalized.includes('REABILITACAO') || normalized === 'CRA') {
    return 'CRA';
  }
  if (normalized.includes('TRABALHADOR') || normalized === 'CEREST') {
    return 'CEREST';
  }
  if (normalized.includes('TRIAGEM E ACOLHIMENTO') || normalized === 'CETA') {
    return 'CETA';
  }
  if (normalized.includes('QUITERIA BEZERRA') || normalized.includes('AGUA BRANCA')) {
    return 'UM-AGUABRANCA';
  }
  if (normalized.includes('ARNON DE MELO') || normalized.includes('PIRANHAS')) {
    return 'UM-PIRANHAS';
  }
  if (normalized.includes('IMUNOBIOLOGICOS ESPECIAIS') || normalized === 'CRIE') {
    return 'CRIE';
  }
  if (normalized.includes('DISTRIBUICAO DE VACINAS') || normalized === 'CREADI') {
    return 'CREADI';
  }
  if (normalized.includes('VIGILANCIA EM SAUDE') || normalized === 'CIEVS') {
    return 'CIEVS';
  }
  if (normalized.includes('ASSISTENCIA FARMACEUTICA') || normalized === 'GERAF') {
    return 'GERAF';
  }
  if (normalized.includes('SERIS')) {
    return 'SERIS';
  }
  if (normalized.includes('SULOG') || normalized.includes('LOGISTICA')) {
    return 'SULOG';
  }

  // Fallback to checking any match with canonical names
  for (const cu of CANONICAL_UNITS) {
    if (normalized.includes(cu.sigla) || normalized.includes(cu.nome.toUpperCase())) {
      return cu.sigla;
    }
  }

  // If no match found, keep trimmed acronym or fallback to HGE
  return trimmed.slice(0, 15).toUpperCase();
}

export function getCanonicalUnit(siglaOrDirty: string): HospitalUnit {
  const cleanSigla = cleanUnitName(siglaOrDirty);
  return CANONICAL_MAP.get(cleanSigla) || {
    id: `u-${cleanSigla.toLowerCase()}`,
    sigla: cleanSigla,
    nome: cleanSigla,
    municipio: 'Alagoas',
    tipo: 'Hospital',
    ativa: true,
  };
}
